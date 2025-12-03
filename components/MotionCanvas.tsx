'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import 'pixi.js/app' // ensure Application plugins (ticker/resize) are registered
import 'pixi.js/events' // enable pointer events
import { sampleTimeline } from '@/lib/timeline'
import { useTimeline, useTimelineActions } from '@/lib/timeline-store'
import { GlowFilter } from 'pixi-filters'
import { DropShadowFilter } from 'pixi-filters'
import { GlitchFilter } from 'pixi-filters'
import { PixelateFilter } from 'pixi-filters'
import { AdjustmentFilter } from 'pixi-filters'
import { SimpleParticleEmitter } from '@/lib/particle-emitter'

interface MotionCanvasProps {
  template: string
  templateVersion: number
  layers?: Array<{
    id: string
    shapeKind: 'circle' | 'square' | 'heart' | 'star' | 'triangle' | 'pill' | 'like' | 'comment' | 'share' | 'cursor'
    x: number
    y: number
    width: number
    height: number
    width: number
    height: number
    scale?: number
    fillColor: number
    effects?: Array<{
      id: string
      type: string
      isEnabled: boolean
      params: Record<string, any>
    }>
  }>
  onUpdateLayerPosition?: (id: string, x: number, y: number) => void
  onTemplateComplete?: () => void
  isDrawingPath?: boolean
  pathPoints?: Array<{ x: number; y: number }>
  onAddPathPoint?: (x: number, y: number) => void
  onFinishPath?: () => void
  onSelectLayer?: (id: string) => void
  selectedLayerId?: string
  activePathPoints?: Array<{ x: number; y: number }>
  pathVersion?: number
  pathLayerId?: string
  onPathPlaybackComplete?: () => void
  onUpdateActivePathPoint?: (index: number, x: number, y: number) => void
  onClearPath?: () => void
  onInsertPathPoint?: (indexAfter: number, x: number, y: number) => void
  background?: {
    mode: 'solid' | 'gradient'
    solid: string
    from: string
    to: string
    opacity: number
  }
  offsetX?: number
  offsetY?: number
  popReappear?: boolean
  onCanvasBackgroundClick?: () => void
}

export default function MotionCanvas({ template, templateVersion, layers = [], onUpdateLayerPosition, onTemplateComplete, isDrawingPath = false, pathPoints = [], onAddPathPoint, onFinishPath, onSelectLayer, selectedLayerId, activePathPoints = [], pathVersion = 0, pathLayerId, onPathPlaybackComplete, onUpdateActivePathPoint, onClearPath, onInsertPathPoint, background: _background, offsetX = 0, offsetY = 0, popReappear = false, onCanvasBackgroundClick }: MotionCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const [isReady, setIsReady] = useState(false)
  // ... (refs)

  // Update stage position when offsets change
  useEffect(() => {
    if (!appRef.current || !appRef.current.stage) return
    appRef.current.stage.position.set(offsetX, offsetY)
    appRef.current.render()
  }, [offsetX, offsetY, isReady])

  // ... (rest of component)
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const graphicsByIdRef = useRef<Record<string, PIXI.Graphics>>({})
  const outlinesByIdRef = useRef<Record<string, PIXI.Graphics>>({})
  const filtersByLayerIdRef = useRef<Record<string, PIXI.Filter[]>>({})
  const emittersByLayerIdRef = useRef<Record<string, SimpleParticleEmitter[]>>({})
  const iconTextureCacheRef = useRef<Record<string, PIXI.Texture>>({})
  const layersRef = useRef(layers)
  const pathTraceActiveRef = useRef(false)
  const lastPathPointRef = useRef<{ x: number; y: number } | null>(null)
  const templateCompleteCalled = useRef(false)
  const timelineTracks = useTimeline((s) => s.tracks)
  const playhead = useTimeline((s) => s.currentTime)
  const sampledTimeline = useMemo(() => sampleTimeline(timelineTracks, playhead), [timelineTracks, playhead])
  const timelineActions = useTimelineActions()
  const currentPathClip = useMemo(() => {
    if (!selectedLayerId) return null
    const track = timelineTracks.find((t) => t.layerId === selectedLayerId)
    return track?.paths?.[0] ?? null
  }, [timelineTracks, selectedLayerId])

  const [canvasBounds, setCanvasBounds] = useState({ width: 1, height: 1, left: 0, top: 0 })
  // Keep layers ref updated
  useEffect(() => {
    layersRef.current = layers
  }, [layers])

  // 1. Initialize Pixi App ONCE
  useEffect(() => {
    if (!containerRef.current || appRef.current) return

    let aborted = false
    const initPixi = async () => {
      const app = new PIXI.Application()
      const bounds = containerRef.current?.getBoundingClientRect()
      const baseWidth = bounds?.width || 800
      const baseHeight = bounds?.height || 450
      
      // Create a canvas the same size as the container
      const canvasWidth = baseWidth
      const canvasHeight = baseHeight
      
      await app.init({ 
        background: '#000000',
        backgroundAlpha: 0,
        width: canvasWidth,
        height: canvasHeight,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
      })
      
      if (aborted) {
        app.destroy({ removeView: true })
        return
      }
      
      // Disable view culling to allow rendering outside visible bounds
      if (app.stage) {
        app.stage.cullable = false
      }
      
      app.start()
      app.ticker?.start()
      
      // Position canvas so overflow works correctly:
      // The visible container should map to the center of the 2x canvas
      // This means the canvas extends 50% beyond each edge
      app.renderer.canvas.style.position = 'absolute'
      app.renderer.canvas.style.left = '0'
      app.renderer.canvas.style.top = '0'
      // IMPORTANT: Set CSS size to logical size, not physical pixel size
      app.renderer.canvas.style.width = `${canvasWidth}px`
      app.renderer.canvas.style.height = `${canvasHeight}px`
      app.renderer.canvas.style.pointerEvents = 'auto'
      // No transform needed - canvas is same size as container
      
      if (containerRef.current) {
        // Clear any existing children to prevent duplicates
        while (containerRef.current.firstChild) {
          containerRef.current.removeChild(containerRef.current.firstChild)
        }
        
        containerRef.current.appendChild(app.canvas)
        appRef.current = app
        
        // Ensure container doesn't clip
        containerRef.current.style.overflow = 'visible'
        
        // keep rendering even if no template animation is running
        app.ticker.add(() => app.render())
        setIsReady(true)
      }
    }

    initPixi()

    return () => {
      aborted = true
      if (appRef.current) {
        appRef.current.destroy({ removeView: true })
        appRef.current = null
      }
    }
  }, [])

  // Apply timeline-sampled transforms onto Pixi graphics so playhead/scrub reflects on-canvas
  // Helper to update graphics from timeline state
  const updateGraphicsFromTimeline = () => {
    if (!containerRef.current) return
    const bounds = containerRef.current.getBoundingClientRect()
    const screenWidth = bounds.width || 1
    const screenHeight = bounds.height || 1
    
    Object.entries(sampledTimeline).forEach(([id, state]) => {
      const g = graphicsByIdRef.current[id]
      if (!g) return
      const shapeSize = (g as PIXI.Graphics & { __shapeSize?: { width?: number; height?: number } })?.__shapeSize
      const halfW = shapeSize?.width ? (shapeSize.width * state.scale) / 2 : 0
      const halfH = shapeSize?.height ? (shapeSize.height * state.scale) / 2 : 0
      
      const layer = layersRef.current.find(l => l.id === id)
      const layerScale = layer?.scale ?? 1
      
      // Check if track has specific animations
      const track = timelineTracks.find(t => t.layerId === id)
      const hasPositionAnim = (track?.position?.length ?? 0) > 0
      const hasRotationAnim = (track?.rotation?.length ?? 0) > 0
      const hasScaleAnim = (track?.scale?.length ?? 0) > 0
      const hasOpacityAnim = (track?.opacity?.length ?? 0) > 0

      // Calculate final transform values
      // For scale: always multiply layer.scale by animation scale (which defaults to 1)
      // This allows "Grow In" (0->1) to become (0 -> layerScale)
      const finalScale = state.scale * layerScale
      
      // For position: if animated, use timeline value. If not, use layer static position.
      const rawPos = hasPositionAnim ? state.position : { x: layer?.x ?? 0.5, y: layer?.y ?? 0.5 }
      
      // Allow values up to 4 (400% screen size) to be treated as normalized coordinates
      const posX = rawPos.x <= 4 ? rawPos.x * screenWidth : rawPos.x
      const posY = rawPos.y <= 4 ? rawPos.y * screenHeight : rawPos.y
      
      // No canvas offset needed - using 1x canvas
      const canvasPosX = posX
      const canvasPosY = posY
      
      // Check if shape is outside the visible canvas bounds
      const isOffCanvas = posX < 0 || posX > screenWidth || posY < 0 || posY > screenHeight
      
      if (g && Number.isFinite(canvasPosX)) g.x = canvasPosX
      if (g && Number.isFinite(canvasPosY)) g.y = canvasPosY
      if (g && g.scale) g.scale.set(finalScale)
      if (g) g.rotation = hasRotationAnim ? state.rotation : 0 // Default rotation is 0
      if (g) g.alpha = hasOpacityAnim ? state.opacity : 1 // Default opacity is 1
      
      // Apply filters (Effects + Off-canvas Blur)
      if (g) {
        const layerEffects = filtersByLayerIdRef.current[id] || []
        let activeFilters = [...layerEffects]

        if (isOffCanvas) {
          // Add blur if off-canvas
          const blurFilter = new PIXI.BlurFilter()
          blurFilter.blur = 4
          activeFilters.push(blurFilter)
        }
        
        g.filters = activeFilters.length > 0 ? activeFilters : null
      }
    })
    appRef.current?.render()
  }

  // Update filters when layers/effects change
  useEffect(() => {
    layers.forEach(layer => {
      const effects = layer.effects || []
      const filters: PIXI.Filter[] = []
      
      effects.forEach(effect => {
        if (!effect.isEnabled) return
        
        try {
          if (effect.type === 'glow') {
            filters.push(new GlowFilter({ 
              distance: 15, 
              outerStrength: effect.params.intensity ?? 0,
              innerStrength: 0,
              color: 0xffffff,
              quality: 0.1,
              knockout: false,
            }))
          } else if (effect.type === 'dropShadow') {
            filters.push(new DropShadowFilter({
              distance: effect.params.distance ?? 5,
              blur: effect.params.blur ?? 2,
              rotation: effect.params.rotation ?? 45,
              alpha: effect.params.alpha ?? 0.5,
              color: 0x000000
            } as any))
          } else if (effect.type === 'blur') {
             const f = new PIXI.BlurFilter()
             f.blur = effect.params.strength ?? 0
             filters.push(f)
          } else if (effect.type === 'glitch') {
            filters.push(new GlitchFilter({
              slices: effect.params.slices ?? 5,
              offset: effect.params.offset ?? 10,
              direction: 0,
              fillMode: 0,
              average: false,
              seed: Math.random()
            }))
          } else if (effect.type === 'pixelate') {
            const pixelSize = effect.params.size ?? 10
            filters.push(new PixelateFilter(pixelSize))
          }
        } catch (e) {
          console.error('Failed to create filter', effect.type, e)
        }
      })
      
      filtersByLayerIdRef.current[layer.id] = filters
      
      // Handle Particles
      // Get current emitters for this layer
      const currentEmitters = emittersByLayerIdRef.current[layer.id] || []
      const activeEffectTypes = new Set<string>()
      
      effects.forEach(effect => {
        if (!effect.isEnabled) return
        if (effect.type !== 'sparkles' && effect.type !== 'confetti') return
        
        activeEffectTypes.add(effect.type)
        
        let emitter = currentEmitters.find(e => (e as any)._effectType === effect.type)
        
        if (!emitter) {
           const container = new PIXI.Container()
           if (appRef.current) {
             appRef.current.stage.addChild(container)
             
             // Create a simple circle texture for particles
             const graphics = new PIXI.Graphics()
             graphics.circle(0, 0, 4)
             graphics.fill(0xffffff)
             const texture = appRef.current.renderer.generateTexture(graphics)
             
             emitter = new SimpleParticleEmitter(
               container,
               effect.type as 'sparkles' | 'confetti',
               texture
             )
             ;(emitter as any)._effectType = effect.type
             ;(emitter as any)._container = container
             
             // Add to array and update ref immediately
             currentEmitters.push(emitter)
             emittersByLayerIdRef.current[layer.id] = currentEmitters
           }
        }
        
        if (emitter) {
           // Ensure container is on stage (in case stage was cleared)
           const container = (emitter as any)._container
           if (container && !container.parent && appRef.current) {
              appRef.current.stage.addChild(container)
           }

           // Update params
           if (effect.params.density !== undefined) {
             emitter.frequency = (effect.type === 'sparkles' ? 0.008 : 0.05) / effect.params.density
           }
           if (effect.params.speed !== undefined) {
             emitter.speedMultiplier = effect.params.speed
           }
           
           // Update position to match layer
           const g = graphicsByIdRef.current[layer.id]
           if (g) {
              emitter.updateOwnerPos(g.x, g.y)
           }
        }
      })
      
      // Cleanup emitters for effects that are no longer active
      const emittersToRemove = currentEmitters.filter(e => !activeEffectTypes.has((e as any)._effectType))
      if (emittersToRemove.length > 0) {
        emittersToRemove.forEach(e => {
           e.destroy()
           if ((e as any)._container) {
              (e as any)._container.destroy()
           }
        })
        // Update ref with remaining emitters
        emittersByLayerIdRef.current[layer.id] = currentEmitters.filter(e => activeEffectTypes.has((e as any)._effectType))
      }

      // Apply immediately
      const g = graphicsByIdRef.current[layer.id]
      if (g) {
         // We don't handle off-canvas logic here, just base effects
         // The render loop will merge them
         g.filters = filters.length > 0 ? filters : null
      }
    })
  }, [layers])

  // Update particles loop
  useEffect(() => {
    const app = appRef.current
    if (!app) return
    
    let lastTime = Date.now()
    
    const update = () => {
       const now = Date.now()
       const dt = (now - lastTime) / 1000
       lastTime = now
       
       let hasParticles = false
       // Update particle positions to follow shapes
       Object.entries(emittersByLayerIdRef.current).forEach(([layerId, emitters]) => {
          const g = graphicsByIdRef.current[layerId]
          emitters.forEach(emitter => {
             if (!emitter || emitter.destroyed) return
             try {
               // Update emitter position to match shape
               if (g) {
                 emitter.updateOwnerPos(g.x, g.y)
               }
               emitter.update(dt)
               hasParticles = true
             } catch (e) {
               console.warn('Particle update failed', e)
             }
          })
       })
       
       if (hasParticles) {
          app.render()
       }
    }
    
    app.ticker.add(update)
    return () => {
      app.ticker.remove(update)
    }
  }, [isReady])

  // Apply timeline-sampled transforms onto Pixi graphics so playhead/scrub reflects on-canvas
  useEffect(() => {
    updateGraphicsFromTimeline()
  }, [sampledTimeline, isReady])

  // Re-apply transforms when layer props change (e.g., scale/position updates without timeline changes)
  useEffect(() => {
    updateGraphicsFromTimeline()
  }, [layers])

  useEffect(() => {
    const app = appRef.current
    if (!app) return
    // keep Pixi canvas transparent; CSS layers handle the color/opacity
    app.renderer.background.alpha = 0
    app.render()
  }, [isReady])

  // Debug: log raw DOM pointer events on the canvas to ensure we receive them
  useEffect(() => {
    const app = appRef.current
    const canvas = app?.canvas
    if (!app || !canvas) return
    const handler = (e: PointerEvent) => {}
    canvas.addEventListener('pointerdown', handler)
    return () => {
      canvas.removeEventListener('pointerdown', handler)
    }
  }, [isReady])

  useEffect(() => {
    const updateBounds = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setCanvasBounds({
        width: rect.width || 1,
        height: rect.height || 1,
        left: rect.left,
        top: rect.top,
      })
    }

    updateBounds()
    const observer = new ResizeObserver(updateBounds)
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }
    window.addEventListener('resize', updateBounds)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateBounds)
    }
  }, [isReady])

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDrawingPath) return
    const hasPath = activePathPoints.length > 0 || currentPathClip
    if (!hasPath) return
    const target = e.target as HTMLElement | null
    if (!target) return
    const isPath = target.closest('[data-path-element="true"]')
    if (isPath) return
    // keep overlay visible; no action on background click
  }

  const pathPointsSvg = useMemo(() => {
    if (pathPoints.length === 0) return null
    const { width, height } = canvasBounds
    if (!width || !height) return null
    const pts = pathPoints.map((pt) => ({ x: pt.x * width + offsetX, y: pt.y * height + offsetY }))
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    return { pts, d }
  }, [canvasBounds, pathPoints, offsetX, offsetY])

  // 2. Handle Template Changes (Draw & Animate)
  useEffect(() => {
    if (!isReady || !appRef.current) return

    templateCompleteCalled.current = false
    const notifyComplete = () => {
      if (templateCompleteCalled.current) return
      templateCompleteCalled.current = true
      onTemplateComplete?.()
    }

    const app = appRef.current
    const bounds = containerRef.current?.getBoundingClientRect()
    const screenWidth = (bounds?.width && bounds.width > 0 ? bounds.width : containerRef.current?.clientWidth) || app.screen?.width || 800
    const screenHeight = (bounds?.height && bounds.height > 0 ? bounds.height : containerRef.current?.clientHeight) || app.screen?.height || 450
    const stage = app.stage
    stage.interactive = true
    stage.eventMode = 'static'
    stage.hitArea = new PIXI.Rectangle(0, 0, screenWidth, screenHeight)
    stage.cursor = 'default'
    
    // Cleanup previous scene
    stage.removeChildren()
    
    // Re-add particle containers if they exist
    // This is critical because stage.removeChildren() wipes them out
    Object.values(emittersByLayerIdRef.current).forEach(emitters => {
      emitters.forEach(emitter => {
        const container = (emitter as any)._container
        if (container) {
          stage.addChild(container)
        }
      })
    })
    
    // We need to define the ticker callback variable so we can remove it later
    let tickerCallback: ((ticker: PIXI.Ticker) => void) | null = null
    const centerX = screenWidth / 2
    const centerY = screenHeight / 2
    const tickerCallbacks: Array<(ticker: PIXI.Ticker) => void> = []
    graphicsByIdRef.current = {}
    // templates are driven by timeline keyframes; built-in previews are disabled
    const templateEnabled = false

  const handlePointerMove = (e: PIXI.FederatedPointerEvent) => {
      if (!dragRef.current) return
      const { id, offsetX, offsetY } = dragRef.current
      const pos = e.global
      const newX = pos.x - offsetX
      const newY = pos.y - offsetY
      const g = graphicsByIdRef.current[id]
      
      // Check if shape is outside the visible canvas bounds
      const isOffCanvas = newX < 0 || newX > screenWidth || newY < 0 || newY > screenHeight
      
      if (g) {
        g.x = newX
        g.y = newY
        
        // Apply blur filter dynamically during drag
        if (isOffCanvas) {
          if (!g.filters || !g.filters.some(f => f instanceof PIXI.BlurFilter)) {
            const blurFilter = new PIXI.BlurFilter()
            blurFilter.blur = 4
            g.filters = [blurFilter]
          }
        } else {
          g.filters = null
        }
      }
      // Convert from canvas coordinates back to normalized
      const nx = screenWidth > 0 ? newX / screenWidth : 0
      const ny = screenHeight > 0 ? newY / screenHeight : 0
      onUpdateLayerPosition?.(id, nx, ny)
  }

  const clearDrag = () => {
    dragRef.current = null
    stage.cursor = 'default'
  }


    stage.on('pointermove', handlePointerMove)
    const handleStagePointerDown = (e: PIXI.FederatedPointerEvent) => {
      // Only deselect if clicking directly on the stage, not on a shape
      if (e.target !== stage) {
        return
      }
      if (dragRef.current) return
      // Clicked on stage background (not on a shape)
      onCanvasBackgroundClick?.()
    }
    stage.on('pointerdown', handleStagePointerDown)
    stage.on('pointerup', clearDrag)
    stage.on('pointerupoutside', clearDrag)

    // If there are layers, render/animate them and skip the built-in preview
    if (layers.length > 0) {
      const drawHeart = (g: PIXI.Graphics, width: number, height: number) => {
        const w = width
        const h = height
        const topCurveHeight = h * 0.3
        g.moveTo(0, -h / 2 + h * 0.25)
        g.bezierCurveTo(0, -h / 2, -w / 2, -h / 2, -w / 2, -h / 2 + topCurveHeight)
        g.bezierCurveTo(-w / 2, h * 0.05, 0, h / 2, 0, h / 2)
        g.bezierCurveTo(0, h / 2, w / 2, h * 0.05, w / 2, -h / 2 + topCurveHeight)
        g.bezierCurveTo(w / 2, -h / 2, 0, -h / 2, 0, -h / 2 + h * 0.25)
        g.closePath()
      }

      const drawStar = (g: PIXI.Graphics, width: number, height: number) => {
        const spikes = 5
        const outerRadius = Math.min(width, height) / 2
        const innerRadius = outerRadius * 0.5
        let rotation = Math.PI / 2 * 3
        const cx = 0
        const cy = 0
        g.moveTo(cx, cy - outerRadius)
        for (let i = 0; i < spikes; i++) {
          const x = cx + Math.cos(rotation) * outerRadius
          const y = cy + Math.sin(rotation) * outerRadius
          g.lineTo(x, y)
          rotation += Math.PI / spikes

          const xInner = cx + Math.cos(rotation) * innerRadius
          const yInner = cy + Math.sin(rotation) * innerRadius
          g.lineTo(xInner, yInner)
          rotation += Math.PI / spikes
        }
        g.closePath()
      }

      const drawTriangle = (g: PIXI.Graphics, width: number, height: number) => {
        g.moveTo(-width / 2, height / 2)
        g.lineTo(width / 2, height / 2)
        g.lineTo(0, -height / 2)
        g.closePath()
      }

      const drawPill = (g: PIXI.Graphics, width: number, height: number) => {
        const radius = Math.min(width, height) / 2
        g.roundRect(-width / 2, -height / 2, width, height, radius)
      }

      // Map shape kinds to SVG file paths
      const iconPaths: Record<string, string> = {
        like: '/icons/like.svg',
        comment: '/icons/comment.svg',
        share: '/icons/share.svg',
        cursor: '/icons/cursor.svg',
      }
      
      const drawShape = (graphics: PIXI.Graphics, kind: string, width: number, height: number, fillColor: number) => {
        graphics.clear()
        switch (kind) {
          case 'square':
            graphics.rect(-width / 2, -height / 2, width, height)
            break
          case 'heart':
            drawHeart(graphics, width, height)
            break
          case 'star':
            drawStar(graphics, width, height)
            break
          case 'triangle':
            drawTriangle(graphics, width, height)
            break
          case 'pill':
            drawPill(graphics, width, height)
            break
          case 'circle':
          default:
            graphics.circle(0, 0, width / 2)
            break
        }
        graphics.fill(fillColor)
      }
      
      // Load SVG icon as texture and create sprite
      const loadIconSprite = async (kind: string, width: number, height: number, fillColor: number): Promise<PIXI.Container> => {
        const container = new PIXI.Container()
        
        // Check if this shape uses an SVG icon
        const iconPath = iconPaths[kind]
        if (!iconPath) {
          // Fallback to manual drawing
          const g = new PIXI.Graphics()
          drawShape(g, kind as any, width, height, fillColor)
          container.addChild(g)
          return container
        }
        
        try {
          // Check cache
          let texture = iconTextureCacheRef.current[kind]
          
          if (!texture) {
            // Load the SVG file
            texture = await PIXI.Assets.load(iconPath)
            iconTextureCacheRef.current[kind] = texture
          }
          
          // Create sprite
          const sprite = new PIXI.Sprite(texture)
          sprite.anchor.set(0.5)
          sprite.width = width
          sprite.height = height
          sprite.tint = fillColor
          
          container.addChild(sprite)
        } catch (error) {
          console.error(`Failed to load icon ${kind}:`, error)
          // Fallback to manual drawing
          const g = new PIXI.Graphics()
          drawShape(g, kind as any, width, height, fillColor)
          container.addChild(g)
        }
        
        return container
      }

      layers.forEach(async (layer) => {
        const g = new PIXI.Graphics()
        
        // Check if this shape uses an SVG icon
        const usesIcon = ['like', 'comment', 'share', 'cursor'].includes(layer.shapeKind)
        
        if (usesIcon) {
          // For icon shapes, load SVG asynchronously
          const iconPath = iconPaths[layer.shapeKind]
          if (iconPath) {
            try {
              // Check cache
              let texture = iconTextureCacheRef.current[layer.shapeKind]
              
              if (!texture) {
                // Load the SVG file
                texture = await PIXI.Assets.load(iconPath)
                iconTextureCacheRef.current[layer.shapeKind] = texture
              }
              
              // Create sprite
              const sprite = new PIXI.Sprite(texture)
              sprite.anchor.set(0.5)
              sprite.width = layer.width
              sprite.height = layer.height
              sprite.tint = layer.fillColor
              
              g.addChild(sprite)
            } catch (error) {
              console.error(`Failed to load icon ${layer.shapeKind}:`, error)
              // Fallback to manual drawing
              drawShape(g, layer.shapeKind, layer.width, layer.height, layer.fillColor)
            }
          } else {
            // Fallback if no icon path
            drawShape(g, layer.shapeKind, layer.width, layer.height, layer.fillColor)
          }
        } else {
          // For non-icon shapes, use manual drawing
          drawShape(g, layer.shapeKind, layer.width, layer.height, layer.fillColor)
        }
        
        // Selection outline will be added by a separate effect
        
        ;(g as PIXI.Graphics & { __shapeSize?: { width: number; height: number } }).__shapeSize = {
          width: layer.width,
          height: layer.height,
        }
        const halfH = layer.height ? layer.height / 2 : 0
        const posX = layer.x <= 4 ? layer.x * screenWidth : layer.x
        const posY = layer.y <= 4 ? layer.y * screenHeight : layer.y
        // No canvas offset needed
        g.x = posX
        g.y = posY
        
        g.interactive = true
        g.eventMode = 'dynamic'
        g.cursor = 'pointer'
        g.hitArea = new PIXI.Rectangle(-layer.width / 2, -layer.height / 2, layer.width, layer.height)
        
        g.on('pointerdown', (e) => {
          e.stopPropagation()
          if (e.originalEvent) {
            e.originalEvent.stopPropagation()
          }
          const pos = e.global
          onSelectLayer?.(layer.id)
          dragRef.current = {
            id: layer.id,
            offsetX: pos.x - g.x,
            offsetY: pos.y - g.y,
          }
          stage.cursor = 'grabbing'
        })
        
        // Create a separate graphics object for the selection outline
        const outline = new PIXI.Graphics()
        switch (layer.shapeKind) {
          case 'square':
            outline.rect(-layer.width / 2, -layer.height / 2, layer.width, layer.height)
            break
          case 'heart':
            drawHeart(outline, layer.width, layer.height)
            break
          case 'star':
            drawStar(outline, layer.width, layer.height)
            break
          case 'triangle':
            drawTriangle(outline, layer.width, layer.height)
            break
          case 'pill':
            drawPill(outline, layer.width, layer.height)
            break
          case 'like':
          case 'comment':
          case 'share':
          case 'cursor':
            // For SVG icon shapes, draw a simple rectangle outline
            outline.rect(-layer.width / 2, -layer.height / 2, layer.width, layer.height)
            break
          case 'circle':
          default:
            outline.circle(0, 0, layer.width / 2)
            break
        }
        outline.stroke({ color: 0x9333ea, width: 2, alpha: 1 })
        outline.visible = false // Hidden by default
        outline.eventMode = 'none' // CRITICAL: Don't intercept pointer events
        g.addChild(outline)
        outlinesByIdRef.current[layer.id] = outline
        
        graphicsByIdRef.current[layer.id] = g
        stage.addChild(g)

        const shouldAnimateTemplate = selectedLayerId ? layer.id === selectedLayerId : true

        // animate this circle when a template is chosen
        if (!isDrawingPath && !template && pathLayerId && layer.id === pathLayerId && activePathPoints.length >= 2) {
          if (activePathPoints.length < 2) {
            return
          }
          const pts = activePathPoints.map((pt) => ({
            x: pt.x * screenWidth,
            y: pt.y * screenHeight,
          }))
          const segments: Array<{ a: { x: number; y: number }; b: { x: number; y: number }; len: number }> = []
          if (pts.length > 0) {
            g.x = pts[0].x
            g.y = pts[0].y
            g.alpha = 1
            g.rotation = 0
            g.visible = true
          }
          let totalLen = 0
          for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1]
            const b = pts[i]
            const len = Math.hypot(b.x - a.x, b.y - a.y)
            totalLen += len
            segments.push({ a, b, len })
          }
          console.log('[path] start', { id: layer.id, pts, totalLen, segments: segments.length })
          const durationMs = 2000
          let elapsed = 0
          const cb = (ticker?: PIXI.Ticker) => {
            if (totalLen === 0) return
            const deltaMs = ticker?.deltaMS ?? 16.67
            elapsed = Math.min(durationMs, elapsed + deltaMs)
            const progress = elapsed / durationMs
            const targetDist = progress * totalLen
            let acc = 0
            for (let i = 0; i < segments.length; i++) {
              const { a, b, len } = segments[i]
              if (acc + len >= targetDist) {
                const segT = len === 0 ? 0 : (targetDist - acc) / len
                g.x = a.x + (b.x - a.x) * segT
                g.y = a.y + (b.y - a.y) * segT
                g.alpha = 1
                const nx = screenWidth > 0 ? g.x / screenWidth : 0
                const ny = screenHeight > 0 ? g.y / screenHeight : 0
                onUpdateLayerPosition?.(layer.id, nx, ny)
                app.render()
                break
              }
              acc += len
            }
            if (progress >= 1) {
              const last = pts[pts.length - 1]
              g.x = last.x
              g.y = last.y
              const nx = screenWidth > 0 ? g.x / screenWidth : 0
              const ny = screenHeight > 0 ? g.y / screenHeight : 0
              onUpdateLayerPosition?.(layer.id, nx, ny)
              notifyComplete()
              onPathPlaybackComplete?.()
              app.ticker.remove(cb)
              console.log('[path] end', { id: layer.id, x: g.x, y: g.y })
            }
          }
          app.ticker.add(cb)
          tickerCallbacks.push(cb)
        } else if (templateEnabled && shouldAnimateTemplate && template === 'roll') {
          const startX = posX
          const travel = Math.min(screenWidth * 0.21, 200)
          const finalX = startX + travel
          const durationMs = 1200
          let elapsed = 0
          const cb = (t?: PIXI.Ticker) => {
            const deltaMs = t?.deltaMS ?? 16.67
            elapsed = Math.min(durationMs, elapsed + deltaMs)
            const progress = elapsed / durationMs
            const ease = 1 - Math.pow(1 - progress, 2)
            g.x = startX + travel * ease
            g.rotation = ease * Math.PI * 4
            if (progress >= 1) {
              g.x = finalX
              onUpdateLayerPosition?.(layer.id, finalX, g.y)
              notifyComplete()
            }
          }
          tickerCallbacks.push(cb)
        } else if (templateEnabled && shouldAnimateTemplate && template === 'jump') {
          const startY = posY
          const amplitude = Math.min(screenHeight * 0.25, 220)
          const durationMs = 1000
          let elapsed = 0
          const cb = (t?: PIXI.Ticker) => {
            const deltaMs = t?.deltaMS ?? 16.67
            elapsed = Math.min(durationMs, elapsed + deltaMs)
            const progress = elapsed / durationMs
            const hop = Math.sin(progress * Math.PI) // smooth up and down
            g.y = startY - hop * amplitude
            g.scale.set(1 + hop * 0.05, 1 - hop * 0.05)
            if (progress >= 1) {
              onUpdateLayerPosition?.(layer.id, g.x, g.y)
              notifyComplete()
            }
          }
          tickerCallbacks.push(cb)
        } else if (templateEnabled && shouldAnimateTemplate && template === 'pop') {
          const durationMs = 1000
          let elapsed = 0
          const cb = (t?: PIXI.Ticker) => {
            const deltaMs = t?.deltaMS ?? 16.67
            elapsed = Math.min(durationMs, elapsed + deltaMs)
            const progress = elapsed / durationMs

            if (progress < 0.5) {
              // inflate
              const inflate = 1 + 0.6 * (progress / 0.5)
              g.scale.set(inflate)
              g.alpha = 1
              g.rotation = 0
              g.x = posX
            } else if (progress < 0.8) {
              // shake near max size
              const shakeT = (progress - 0.5) / 0.3
              const shake = Math.sin(shakeT * Math.PI * 6) * 6
              const wobbleScale = 1.6 + 0.12 * Math.sin(shakeT * Math.PI * 4)
              g.scale.set(wobbleScale)
              g.x = posX + shake
              g.rotation = Math.sin(shakeT * Math.PI * 5) * 0.12
              g.alpha = 1
            } else {
              // burst and fade
              const burstT = (progress - 0.8) / 0.2
              const eased = 1 - Math.pow(1 - burstT, 2)
              g.scale.set(1.7 + 0.5 * eased)
              g.alpha = Math.max(0, 1 - eased)
              g.rotation = 0
              g.x = posX
            }
            if (progress >= 1) {
              onUpdateLayerPosition?.(layer.id, g.x, g.y)
              notifyComplete()
            }
          }
          tickerCallbacks.push(cb)
        }
      })

      tickerCallbacks.forEach((cb) => app.ticker.add(cb))
      if (tickerCallbacks.length > 0) {
        app.ticker.start()
      }

      // render once to show the shapes even if no animation selected
      updateGraphicsFromTimeline()
      app.render()

      return () => {
        tickerCallbacks.forEach((cb) => app.ticker.remove(cb))
        stage.removeChildren()
        stage.off('pointermove', handlePointerMove)
        stage.off('pointerup', clearDrag)
        stage.off('pointerupoutside', clearDrag)
        stage.off('pointerdown', handleStagePointerDown)
      }
    }

    // No layers -> show built-in template preview
    if (templateEnabled && template === 'roll') {
        const graphics = new PIXI.Graphics()
        graphics.circle(0, 0, 60)
        graphics.fill(0xffffff)
        // notch for visible rotation
        graphics.moveTo(0, -60)
        graphics.lineTo(0, -40)
        graphics.stroke({ color: 0x000000, width: 6, alpha: 0.8 })
        graphics.x = centerX
        graphics.y = centerY
        stage.addChild(graphics)

        let progress = 0
        const travel = Math.min(app.screen.width * 0.21, 200)
        tickerCallback = (t?: PIXI.Ticker) => {
          const delta = t?.deltaTime ?? 1
          if (progress >= 1) return
          progress = Math.min(1, progress + 0.01 * delta)
          const ease = 1 - Math.pow(1 - progress, 2)
          graphics.rotation = ease * Math.PI * 4
          graphics.x = centerX + travel * ease
        }
    } else if (templateEnabled && template === 'jump') {
        const graphics = new PIXI.Graphics()
        graphics.circle(0, 0, 60)
        graphics.fill(0xffffff)
        graphics.x = centerX
        graphics.y = centerY
        stage.addChild(graphics)

        const durationMs = 1000
        let elapsed = 0
        const amplitude = Math.min(app.screen.height * 0.25, 220)
        tickerCallback = (t?: PIXI.Ticker) => {
          const deltaMs = t?.deltaMS ?? 16.67
          elapsed = Math.min(durationMs, elapsed + deltaMs)
          const progress = elapsed / durationMs
          const hop = Math.sin(progress * Math.PI)
          graphics.y = centerY - hop * amplitude
          graphics.scale.set(1 + hop * 0.05, 1 - hop * 0.05)
          if (progress >= 1) notifyComplete()
        }
    } else if (templateEnabled && template === 'pop') {
        const graphics = new PIXI.Graphics()
        graphics.circle(0, 0, 60)
        graphics.fill(0xffffff)
        graphics.x = centerX
        graphics.y = centerY
        stage.addChild(graphics)

        const durationMs = 1000
        let elapsed = 0
        tickerCallback = (t?: PIXI.Ticker) => {
          const deltaMs = t?.deltaMS ?? 16.67
          elapsed = Math.min(durationMs, elapsed + deltaMs)
          const progress = elapsed / durationMs

          if (progress < 0.5) {
            const inflate = 1 + 0.6 * (progress / 0.5)
            graphics.scale.set(inflate)
            graphics.alpha = 1
            graphics.rotation = 0
            graphics.x = centerX
          } else if (progress < 0.8) {
            const shakeT = (progress - 0.5) / 0.3
            const shake = Math.sin(shakeT * Math.PI * 6) * 6
            const wobbleScale = 1.6 + 0.12 * Math.sin(shakeT * Math.PI * 4)
            graphics.scale.set(wobbleScale)
            graphics.x = centerX + shake
            graphics.rotation = Math.sin(shakeT * Math.PI * 5) * 0.12
            graphics.alpha = 1
          } else {
            const burstT = (progress - 0.8) / 0.2
            const eased = 1 - Math.pow(1 - burstT, 2)
            graphics.scale.set(1.7 + 0.5 * eased)
            graphics.alpha = Math.max(0, 1 - eased)
            graphics.rotation = 0
            graphics.x = centerX
          }
          if (progress >= 1) {
            if (popReappear) {
              graphics.alpha = 1
              graphics.scale.set(1)
            }
            notifyComplete()
          }
        }
    }

    // Add the ticker if we have one
    if (tickerCallback && app?.ticker) {
        app.ticker.add(tickerCallback)
        app.ticker.start()
    }

    // render first frame immediately so users see instant feedback on template switch
    app.render()

    // Cleanup function for this effect
    return () => {
        if (tickerCallback && app?.ticker) {
            app.ticker.remove(tickerCallback)
        }
        stage.removeChildren()
        stage.off('pointermove', handlePointerMove)
        stage.off('pointerup', clearDrag)
        stage.off('pointerupoutside', clearDrag)
        stage.off('pointerdown', handleStagePointerDown)
    }

  }, [template, templateVersion, pathVersion, pathLayerId, activePathPoints, isReady]) // Re-run on template/path switches; layer moves are handled directly

  // 3. Handle Selection Outline Updates
  useEffect(() => {
    if (!isReady || !appRef.current) return
    
    // Simply show/hide the outline graphics
    Object.entries(outlinesByIdRef.current).forEach(([id, outline]) => {
      outline.visible = (selectedLayerId === id)
    })
  }, [selectedLayerId, isReady])

  return (
    <div className="relative h-full w-full overflow-visible rounded-lg" onPointerDown={handleCanvasPointerDown}>
      <div ref={containerRef} className="relative z-10 h-full w-full" />
      {/* Path draw overlay */}
      {isDrawingPath && (
        <div
          className="absolute inset-0 cursor-crosshair"
          style={{ zIndex: 20 }}
          onPointerDown={(e) => {
            if (!containerRef.current) return
            const bounds = containerRef.current.getBoundingClientRect()
            const x = (e.clientX - bounds.left - offsetX) / bounds.width
            const y = (e.clientY - bounds.top - offsetY) / bounds.height
            pathTraceActiveRef.current = true
            lastPathPointRef.current = { x, y }
            onAddPathPoint?.(x, y)
          }}
          onPointerMove={(e) => {
            if (!pathTraceActiveRef.current || !containerRef.current) return
            const bounds = containerRef.current.getBoundingClientRect()
            const x = (e.clientX - bounds.left - offsetX) / bounds.width
            const y = (e.clientY - bounds.top - offsetY) / bounds.height
            const last = lastPathPointRef.current
            const dx = last ? x - last.x : 0
            const dy = last ? y - last.y : 0
            if (!last || Math.hypot(dx, dy) > 0.02) {
              lastPathPointRef.current = { x, y }
              onAddPathPoint?.(x, y)
            }
          }}
      onPointerUp={(e) => {
        if (!pathTraceActiveRef.current || !containerRef.current) return
        const bounds = containerRef.current.getBoundingClientRect()
        const x = (e.clientX - bounds.left - offsetX) / bounds.width
        const y = (e.clientY - bounds.top - offsetY) / bounds.height
            onAddPathPoint?.(x, y)
            pathTraceActiveRef.current = false
            onFinishPath?.()
      }}
    >
      <svg className="h-full w-full" style={{ pointerEvents: 'none' }}>
          {pathPointsSvg && (
            <path d={pathPointsSvg.d} stroke="#22c55e" strokeWidth={2} fill="none" data-path-element="true" />
          )}
        </svg>
      </div>
    )}
      
      {/* Show the finished path (non-interactive, just visual) */}
      {!isDrawingPath && currentPathClip && (
        <div className="absolute inset-0" style={{ zIndex: 25, pointerEvents: 'none' }}>
          <svg className="h-full w-full">
            <path
              d={(() => {
                const { width, height } = canvasBounds
                if (!width || !height || !currentPathClip.points.length) return ''
                const pts = currentPathClip.points.map((pt) => ({ x: pt.x * width + offsetX, y: pt.y * height + offsetY }))
                return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
              })()}
              stroke="#22c55e"
              strokeWidth={2}
              fill="none"
              opacity={0.5}
            />
            {/* Start point (green circle) */}
            {currentPathClip.points.length > 0 && (() => {
              const { width, height } = canvasBounds
              if (!width || !height) return null
              const startPt = currentPathClip.points[0]
              return (
                <circle
                  cx={startPt.x * width + offsetX}
                  cy={startPt.y * height + offsetY}
                  r={6}
                  fill="#22c55e"
                  stroke="#0f172a"
                  strokeWidth={2}
                />
              )
            })()}
            {/* End point (red circle) */}
            {currentPathClip.points.length > 1 && (() => {
              const { width, height } = canvasBounds
              if (!width || !height) return null
              const endPt = currentPathClip.points[currentPathClip.points.length - 1]
              return (
                <circle
                  cx={endPt.x * width + offsetX}
                  cy={endPt.y * height + offsetY}
                  r={6}
                  fill="#ef4444"
                  stroke="#0f172a"
                  strokeWidth={2}
                />
              )
            })()}
          </svg>
        </div>
      )}

      {/* Fallback DOM previews removed; timeline drives all motion */}
    </div>
  )
}

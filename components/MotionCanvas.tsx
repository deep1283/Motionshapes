'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
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
import { PanZoomRegionOverlay, PanZoomRegion } from '@/components/PanZoomRegionOverlay'

interface MotionCanvasProps {
  template: string
  templateVersion: number
  layers?: Array<{
    id: string
    type?: 'shape' | 'image' | 'svg' | 'text'
    shapeKind: 'circle' | 'square' | 'heart' | 'star' | 'triangle' | 'pill' | 'like' | 'comment' | 'share' | 'cursor' | 'counter'
    x: number
    y: number
    width: number
    height: number
    scale?: number
    rotation?: number
    fillColor: number
    imageUrl?: string
    svgUrl?: string
    // Text properties
    text?: string
    fontFamily?: string
    fontSize?: number
    fontWeight?: number
    // Counter properties
    isCounter?: boolean
    counterStart?: number
    counterEnd?: number
    counterPrefix?: string
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
  isDrawingLine?: boolean
  pathPoints?: Array<{ x: number; y: number }>
  layerOrder?: string[]
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
  onUpdateLayerScale?: (id: string, scale: number) => void
  onUpdateLayerSize?: (id: string, width: number, height: number) => void
  // Pan/Zoom region editing
  selectedClipId?: string
  onUpdatePanZoomRegions?: (clipId: string, targetRegion: PanZoomRegion) => void
}

const ICON_SHAPE_KINDS = ['like', 'comment', 'share', 'cursor'] as const
// Extract the item type from the array, handling the fact that 'layers' might be undefined
type LayerItem = NonNullable<MotionCanvasProps['layers']>[number]
const isIconShapeKind = (kind?: LayerItem['shapeKind']) =>
  !!kind && ICON_SHAPE_KINDS.includes(kind as any)

// Shared heart path so resizing keeps the shape consistent
const drawHeartPath = (g: PIXI.Graphics, width: number, height: number) => {
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

type LineOverlayProps = {
  canvasBounds: { width: number; height: number; left: number; top: number }
  offsetX: number
  offsetY: number
  layers: MotionCanvasProps['layers']
  selectedLayerId?: string
  activePathPoints: Array<{ x: number; y: number }>
  pathPoints: Array<{ x: number; y: number }>
  onClearPath?: () => void
  onAddPathPoint?: (x: number, y: number) => void
  onUpdateActivePathPoint?: (index: number, x: number, y: number) => void
  onFinishPath?: (pts?: Array<{ x: number; y: number }>) => void
  lineStartRef: React.MutableRefObject<{ x: number; y: number } | null>
  lineEndRef: React.MutableRefObject<{ x: number; y: number } | null>
  lineHasEndRef: React.MutableRefObject<boolean>
  lineDragActiveRef: React.MutableRefObject<boolean>
}

function LineOverlay({
  canvasBounds,
  offsetX,
  offsetY,
  layers,
  selectedLayerId,
  activePathPoints,
  pathPoints,
  onClearPath,
  onAddPathPoint,
  onUpdateActivePathPoint,
  onFinishPath,
  lineStartRef,
  lineEndRef,
  lineHasEndRef,
  lineDragActiveRef,
}: LineOverlayProps) {
  const { width, height } = canvasBounds
  if (!width || !height) return null

  const layerBase = layers?.find((l) => l.id === selectedLayerId)
  const layerPos = layerBase ? { x: layerBase.x, y: layerBase.y } : { x: 0.5, y: 0.5 }
  const points = activePathPoints.length ? activePathPoints : pathPoints
  const currentStart = lineStartRef.current ?? points[0] ?? layerPos
  const currentEnd = lineEndRef.current ?? points[1] ?? currentStart

  const toScreen = (pt: { x: number; y: number }) => ({
    x: pt.x * width + offsetX,
    y: pt.y * height + offsetY,
  })

  const normalizePointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const x = (e.clientX - canvasBounds.left - offsetX) / width
    const y = (e.clientY - canvasBounds.top - offsetY) / height
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) }
  }

  const handleDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const clamped = normalizePointer(e)
    lineStartRef.current = clamped
    lineEndRef.current = clamped
    lineHasEndRef.current = false
    onClearPath?.()
    onAddPathPoint?.(clamped.x, clamped.y) // start point
    lineDragActiveRef.current = true
  }

  const handleMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!lineDragActiveRef.current || !lineStartRef.current) return
    const clamped = normalizePointer(e)
    lineEndRef.current = clamped
    if (!lineHasEndRef.current) {
      onAddPathPoint?.(clamped.x, clamped.y) // add end
      lineHasEndRef.current = true
    } else {
      onUpdateActivePathPoint?.(1, clamped.x, clamped.y)
    }
  }

  const handleUp = () => {
    if (!lineDragActiveRef.current || !lineStartRef.current || !lineEndRef.current) return
    lineDragActiveRef.current = false
    const start = lineStartRef.current
    let end = lineEndRef.current
    if (Math.hypot(end.x - start.x, end.y - start.y) < 0.001) {
      end = { x: Math.min(1, start.x + 0.05), y: start.y }
    }
    onFinishPath?.([start, end])
    lineStartRef.current = null
    lineEndRef.current = null
    lineHasEndRef.current = false
  }

  const startScreen = toScreen(currentStart)
  const endScreen = toScreen(currentEnd)

  return (
    <div
      className="absolute inset-0 cursor-crosshair"
      style={{ zIndex: 24 }}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
    >
      <svg className="h-full w-full">
        <line
          x1={startScreen.x}
          y1={startScreen.y}
          x2={endScreen.x}
          y2={endScreen.y}
          stroke="#22c55e"
          strokeWidth={2}
        />
        <circle
          cx={startScreen.x}
          cy={startScreen.y}
          r={7}
          fill="#10b981"
          stroke="#0f172a"
          strokeWidth={2}
        />
        <circle
          cx={endScreen.x}
          cy={endScreen.y}
          r={8}
          fill="#ef4444"
          stroke="#0f172a"
          strokeWidth={2}
        />
      </svg>
    </div>
  )
}

export default function MotionCanvas({ template, templateVersion, layers = [], layerOrder = [], onUpdateLayerPosition, onUpdateLayerSize, onTemplateComplete, isDrawingPath = false, isDrawingLine = false, pathPoints = [], onAddPathPoint, onFinishPath, onSelectLayer, selectedLayerId, activePathPoints = [], pathVersion = 0, pathLayerId, onPathPlaybackComplete, onUpdateActivePathPoint, onClearPath, onInsertPathPoint, background: _background, offsetX = 0, offsetY = 0, popReappear = false, onCanvasBackgroundClick, selectedClipId, onUpdatePanZoomRegions }: MotionCanvasProps) {
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
  const spritesByIdRef = useRef<Record<string, PIXI.Sprite>>({})
  const resizeHandlesRef = useRef<Record<string, PIXI.Graphics[]>>({})
  const handlesByIdRef = useRef<Record<string, PIXI.Graphics[]>>({}) // For text layer resize handles
  const spotlightOverlayRef = useRef<PIXI.Graphics | null>(null) // For pan_zoom spotlight blur effect
  // Track layer dimensions, color, and rotation to detect changes from control panel
  const layerDimensionsRef = useRef<Record<string, { width: number; height: number; fillColor: number; rotation: number }>>({})
  const resizeStateRef = useRef<{
    layerId: string
    handle: 'tl' | 'tr' | 'br' | 'bl' | 't' | 'r' | 'b' | 'l'
    startX: number
    startY: number
    startWidth: number
    startHeight: number
  } | null>(null)
  const orderedLayers = useMemo(() => {
    if (!layers || layers.length === 0) return []
    if (!layerOrder || layerOrder.length === 0) return layers
    const orderMap = new Map(layerOrder.map((id, idx) => [id, idx]))
    return [...layers].sort((a, b) => {
      const aIdx = orderMap.get(a.id)
      const bIdx = orderMap.get(b.id)
      if (aIdx === undefined && bIdx === undefined) return 0
      if (aIdx === undefined) return 1
      if (bIdx === undefined) return -1
      return aIdx - bIdx
    })
  }, [layers, layerOrder])
  const renderLayers = orderedLayers
  const layersRef = useRef(renderLayers)
  const pathTraceActiveRef = useRef(false)
  const lastPathPointRef = useRef<{ x: number; y: number } | null>(null)
  const lineStartRef = useRef<{ x: number; y: number } | null>(null)
  const lineEndRef = useRef<{ x: number; y: number } | null>(null)
  const lineHasEndRef = useRef(false)
  const lineDragActiveRef = useRef(false)
  const templateCompleteCalled = useRef(false)
  const timelineTracks = useTimeline((s) => s.tracks)
  const playhead = useTimeline((s) => s.currentTime)
  const clickMarkers = useTimeline((s) => s.clickMarkers)
  const templateClips = useTimeline((s) => s.templateClips)
  const effectClips = useTimeline((s) => s.effectClips)
  const sampledTimeline = useMemo(() => sampleTimeline(timelineTracks, playhead), [timelineTracks, playhead])
  const timelineActions = useTimelineActions()
  const isPlaying = useTimeline((s) => s.isPlaying)
  
  // Pan/Zoom region editing state
  const [panZoomActiveRegion, setPanZoomActiveRegion] = useState<'start' | 'end' | null>(null)
  

  
  // Track which click markers have been triggered (to avoid re-triggering)
  const triggeredMarkersRef = useRef<Set<string>>(new Set())
  // Active ripple effects
  const [activeRipples, setActiveRipples] = useState<Array<{
    id: string
    layerId: string
    startTime: number
    x: number
    y: number
  }>>([])
  const rippleGraphicsRef = useRef<Map<string, PIXI.Graphics>>(new Map())

  const allPathClips = useMemo(() => {
    if (!selectedLayerId) return []
    const track = timelineTracks.find((t) => t.layerId === selectedLayerId)
    return track?.paths ?? []
  }, [timelineTracks, selectedLayerId])
  
  // For backward compatibility, also keep a reference to the first path
  const currentPathClip = allPathClips[0] ?? null

  const [canvasBounds, setCanvasBounds] = useState({ width: 1, height: 1, left: 0, top: 0 })
  // Keep layers ref updated
  useEffect(() => {
    layersRef.current = renderLayers
  }, [renderLayers])

  // Detect click marker crossings and trigger ripples
  const lastPlayheadRef = useRef(playhead)
  useEffect(() => {
    const prevTime = lastPlayheadRef.current
    const currentTime = playhead
    lastPlayheadRef.current = currentTime
    
    // Check if playhead crossed any click markers
    clickMarkers.forEach((marker) => {
      // Only trigger when playhead moves FORWARD across the marker time
      const crossed = prevTime < marker.time && currentTime >= marker.time
      
      if (crossed && !triggeredMarkersRef.current.has(marker.id)) {
        triggeredMarkersRef.current.add(marker.id)
        
        // Get the shape's CURRENT animated position from the graphics object
        const g = graphicsByIdRef.current[marker.layerId]
        if (g) {
          // Use the graphics object's current position (follows animations/paths)
          const x = g.x
          const y = g.y
          
          setActiveRipples((prev) => [...prev, {
            id: `ripple-${marker.id}-${Date.now()}`,
            layerId: marker.layerId,
            startTime: Date.now(),
            x,
            y
          }])
          
          // Add rapid click pulse effect on the shape itself
          const originalScaleX = g.scale.x
          const originalScaleY = g.scale.y
          const PULSE_DURATION = 150 // Very fast - 150ms total
          const pulseStartTime = Date.now()
          
          const animatePulse = () => {
            const elapsed = Date.now() - pulseStartTime
            const progress = Math.min(1, elapsed / PULSE_DURATION)
            
            if (progress < 0.4) {
              // Squish down quickly (first 60ms)
              const squishProgress = progress / 0.4
              const scale = 1 - (0.15 * squishProgress) // Goes to 0.85
              g.scale.set(originalScaleX * scale, originalScaleY * scale)
            } else {
              // Bounce back with overshoot (remaining 90ms)
              const bounceProgress = (progress - 0.4) / 0.6
              // Elastic bounce back: overshoot to 1.05 then settle to 1.0
              const eased = 1 - Math.pow(1 - bounceProgress, 3)
              const overshoot = bounceProgress < 0.5 ? 1 + (0.08 * (bounceProgress * 2)) : 1.08 - (0.08 * ((bounceProgress - 0.5) * 2))
              const scale = 0.85 + (eased * (overshoot - 0.85))
              g.scale.set(originalScaleX * scale, originalScaleY * scale)
            }
            
            appRef.current?.render()
            
            if (progress < 1) {
              requestAnimationFrame(animatePulse)
            } else {
              // Ensure we end exactly at original scale
              g.scale.set(originalScaleX, originalScaleY)
              appRef.current?.render()
            }
          }
          
          requestAnimationFrame(animatePulse)
        }
        
        // Reset trigger after animation completes
        setTimeout(() => {
          triggeredMarkersRef.current.delete(marker.id)
        }, 600)
      }
    })
    
    // Reset all markers when playhead is at start or jumps back to start
    if (currentTime < 50) {
      triggeredMarkersRef.current.clear()
    }
  }, [playhead, clickMarkers, renderLayers, canvasBounds])

  // Animate ripples on the canvas
  useEffect(() => {
    if (activeRipples.length === 0) return
    
    const app = appRef.current
    if (!app) return
    
    const RIPPLE_DURATION = 500 // ms
    const MAX_RADIUS = 80
    
    // Create graphics for new ripples
    activeRipples.forEach((ripple) => {
      if (!rippleGraphicsRef.current.has(ripple.id)) {
        const graphics = new PIXI.Graphics()
        graphics.zIndex = 9999
        app.stage.addChild(graphics)
        rippleGraphicsRef.current.set(ripple.id, graphics)
      }
    })
    
    // Animation loop
    const animateRipples = () => {
      const now = Date.now()
      const toRemove: string[] = []
      
      activeRipples.forEach((ripple) => {
        const elapsed = now - ripple.startTime
        const progress = Math.min(1, elapsed / RIPPLE_DURATION)
        const graphics = rippleGraphicsRef.current.get(ripple.id)
        
        if (!graphics) return
        
        if (progress >= 1) {
          toRemove.push(ripple.id)
          graphics.destroy()
          rippleGraphicsRef.current.delete(ripple.id)
        } else {
          // Easing: easeOutQuad
          const eased = 1 - (1 - progress) * (1 - progress)
          const radius = eased * MAX_RADIUS
          const alpha = 1 - eased
          
          graphics.clear()
          graphics.circle(ripple.x, ripple.y, radius)
          graphics.fill({ color: 0xa855f7, alpha: alpha * 0.5 })
          graphics.circle(ripple.x, ripple.y, radius)
          graphics.stroke({ width: 3, color: 0xa855f7, alpha })
        }
      })
      
      if (toRemove.length > 0) {
        setActiveRipples((prev) => prev.filter((r) => !toRemove.includes(r.id)))
      }
      
      app.render()
    }
    
    const intervalId = setInterval(animateRipples, 16) // ~60fps
    
    return () => {
      clearInterval(intervalId)
    }
  }, [activeRipples])

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
    
    renderLayers.forEach((layer, idx) => {
      const { id } = layer
      const state = sampledTimeline[id]
      if (!state) return
      const g = graphicsByIdRef.current[id]
      if (!g) return
      // Set zIndex: top of timeline (idx=0) = back (low z), bottom (high idx) = front (high z)
      g.zIndex = idx
      if (appRef.current?.stage && appRef.current.stage.sortableChildren !== true) {
        appRef.current.stage.sortableChildren = true
      }
      const shapeSize = (g as PIXI.Graphics & { __shapeSize?: { width?: number; height?: number } })?.__shapeSize
      const halfW = shapeSize?.width ? (shapeSize.width * state.scale) / 2 : 0
      const halfH = shapeSize?.height ? (shapeSize.height * state.scale) / 2 : 0
      
      const layerData = layersRef.current.find(l => l.id === id)
      const layerScale = layerData?.scale ?? 1
      
      // Check if track has specific animations
      const track = timelineTracks.find(t => t.layerId === id)
      const baseLayerPos = { x: layer?.x ?? 0.5, y: layer?.y ?? 0.5 }
      const positionFrames = track?.position ?? []
      // Treat position as animated only if there is a keyframe beyond time 0,
      // multiple frames, or an active path.
      const hasPositionAnim =
        positionFrames.some((kf) => kf.time > 0) ||
        positionFrames.length > 1 ||
        (track?.paths?.length ?? 0) > 0
      const hasRotationAnim = (track?.rotation?.length ?? 0) > 1
      const scaleFrames = track?.scale ?? []
      const hasScaleAnim =
        scaleFrames.length > 1 ||
        scaleFrames.some((kf) => kf.time !== 0 || Math.abs(kf.value - 1) > 1e-4)
      const hasOpacityAnim = (track?.opacity?.length ?? 0) > 1

      // Calculate final transform values
      // For scale: always multiply layer.scale by animation scale (which defaults to 1)
      // This allows "Grow In" (0->1) to become (0 -> layerScale)
      const scaleMultiplier = hasScaleAnim ? state.scale : 1
      const finalScale = scaleMultiplier * layerScale
      
      // For position: if animated, use timeline value. If not, use layer static position.
      // pan_zoom stores offsets relative to the base position, so add base back in that case.
      const hasPanZoom = templateClips.some(c => c.layerId === id && c.template === 'pan_zoom')
      const rawPos = hasPositionAnim
        ? hasPanZoom
          ? { x: baseLayerPos.x + state.position.x, y: baseLayerPos.y + state.position.y }
          : state.position
        : baseLayerPos
      

      
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
      
      // Calculate strict visibility based on timeline clips
      // If playhead < startTime or playhead > startTime + duration, alpha = 0
      const trackStartTime = track?.startTime ?? 0
      const trackDuration = track?.duration ?? 2000
      const isVisibleInTime = playhead >= trackStartTime && playhead <= trackStartTime + trackDuration
      
      let finalOpacity = state.opacity
      if (!isVisibleInTime) {
        finalOpacity = 0
      }
      
      g.alpha = hasOpacityAnim ? finalOpacity : (isVisibleInTime ? 1 : 0)

      // Sync rotation
      // For rotation: layer.rotation is the base, animation rotation is additive
      const baseRotationRad = ((layerData?.rotation ?? 0) * Math.PI) / 180
      const animRotation = hasRotationAnim ? state.rotation : 0
      if (g) g.rotation = baseRotationRad + animRotation
      
      // Apply filters (Effects + Off-canvas Blur + Pan/Zoom Focus Blur)
      if (g) {
        const layerEffects = filtersByLayerIdRef.current[id] || []
        let activeFilters = [...layerEffects]

        // Hide any leftover spotlight overlay (from previous implementation)
        if (hasPanZoom && spotlightOverlayRef.current) {
          spotlightOverlayRef.current.visible = false
        }

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

  // Update filters based on effect clips timing (not layer.effects toggle)
  useEffect(() => {
    layers.forEach(layer => {
      // Check if the parent layer is visible at current playhead
      const layerTrack = timelineTracks.find(t => t.layerId === layer.id)
      const layerStart = layerTrack?.startTime ?? 0
      const layerDuration = layerTrack?.duration ?? 2000
      const isLayerVisible = playhead >= layerStart && playhead <= layerStart + layerDuration
      
      // Get effect clips for this layer that are currently active 
      // (playhead within clip duration AND parent layer is visible)
      const activeEffectClips = effectClips.filter(clip => 
        clip.layerId === layer.id &&
        isLayerVisible &&
        playhead >= clip.start &&
        playhead <= clip.start + clip.duration
      )
      
      const filters: PIXI.Filter[] = []
      
      activeEffectClips.forEach(clip => {
        try {
          if (clip.effectType === 'glow') {
            filters.push(new GlowFilter({ 
              distance: clip.params.glowDistance ?? 15, 
              outerStrength: clip.params.glowIntensity ?? 2,
              innerStrength: 0,
              color: clip.params.glowColor ?? 0xffffff,
              quality: 0.1,
              knockout: false,
            }))
          } else if (clip.effectType === 'dropShadow') {
            filters.push(new DropShadowFilter({
              distance: 5,
              blur: 2,
              rotation: 45,
              alpha: 0.5,
              color: 0x000000
            } as any))
          } else if (clip.effectType === 'blur') {
            const f = new PIXI.BlurFilter()
            f.blur = clip.params.blurStrength ?? 4
            filters.push(f)
          } else if (clip.effectType === 'glitch') {
            filters.push(new GlitchFilter({
              slices: 5,
              offset: 10,
              direction: 0,
              fillMode: 0,
              average: false,
              seed: Math.random()
            }))
          } else if (clip.effectType === 'pixelate') {
            const pixelSize = 10
            filters.push(new PixelateFilter(pixelSize))
          }
        } catch (e) {
          console.error('Failed to create filter', clip.effectType, e)
        }
      })
      
      filtersByLayerIdRef.current[layer.id] = filters
      
      // Handle Particles (sparkles, confetti) - also based on effect clips timing
      const currentEmitters = emittersByLayerIdRef.current[layer.id] || []
      const activeEffectTypes = new Set<string>()
      
      activeEffectClips.forEach(clip => {
        if (clip.effectType !== 'sparkles' && clip.effectType !== 'confetti') return
        
        activeEffectTypes.add(clip.effectType)
        
        let emitter = currentEmitters.find(e => (e as any)._effectType === clip.effectType)
        
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
               clip.effectType as 'sparkles' | 'confetti',
               texture
             )
             ;(emitter as any)._effectType = clip.effectType
             ;(emitter as any)._container = container
             
             currentEmitters.push(emitter)
             emittersByLayerIdRef.current[layer.id] = currentEmitters
           }
        }
        
        if (emitter) {
           const container = (emitter as any)._container
           if (container && !container.parent && appRef.current) {
              appRef.current.stage.addChild(container)
           }

           if (clip.params.particleSpeed !== undefined) {
             emitter.speedMultiplier = clip.params.particleSpeed
           }
           
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
        emittersByLayerIdRef.current[layer.id] = currentEmitters.filter(e => activeEffectTypes.has((e as any)._effectType))
      }

      // Apply filters
      const g = graphicsByIdRef.current[layer.id]
      if (g) {
         g.filters = filters.length > 0 ? filters : null
      }
    })
  }, [layers, effectClips, playhead, timelineTracks])

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
      app.ticker?.remove(update)
    }
  }, [isReady])

  // Apply timeline-sampled transforms onto Pixi graphics so playhead/scrub reflects on-canvas
  useEffect(() => {
    updateGraphicsFromTimeline()
  }, [sampledTimeline, isReady])

  // Re-apply transforms when layer props or selection changes (e.g., scale/position/rotation updates without timeline changes)
  useEffect(() => {
    updateGraphicsFromTimeline()
  }, [orderedLayers, layers, selectedLayerId])

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
    stage.sortableChildren = true // Enable automatic z-order sorting by zIndex
    
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
      // Handle resize drag first
      if (resizeStateRef.current) {
        const { layerId, handle, startX, startY, startWidth, startHeight } = resizeStateRef.current
        const deltaX = e.global.x - startX
        const deltaY = e.global.y - startY
        
        let newWidth = startWidth
        let newHeight = startHeight
        
        // Calculate new dimensions based on handle type
        if (handle === 'tl') {
          newWidth = Math.max(20, startWidth - deltaX)
          newHeight = Math.max(20, startHeight - deltaY)
        } else if (handle === 'tr') {
          newWidth = Math.max(20, startWidth + deltaX)
          newHeight = Math.max(20, startHeight - deltaY)
        } else if (handle === 'br') {
          newWidth = Math.max(20, startWidth + deltaX)
          newHeight = Math.max(20, startHeight + deltaY)
        } else if (handle === 'bl') {
          newWidth = Math.max(20, startWidth - deltaX)
          newHeight = Math.max(20, startHeight + deltaY)
        } else if (handle === 't') {
          newHeight = Math.max(20, startHeight - deltaY)
        } else if (handle === 'b') {
          newHeight = Math.max(20, startHeight + deltaY)
        } else if (handle === 'l') {
          newWidth = Math.max(20, startWidth - deltaX)
        } else if (handle === 'r') {
          newWidth = Math.max(20, startWidth + deltaX)
        }
        
        // Update visuals immediately for real-time feedback
        const sprite = spritesByIdRef.current[layerId]
        const g = graphicsByIdRef.current[layerId]
        const outline = outlinesByIdRef.current[layerId]
        const handles = resizeHandlesRef.current[layerId]
        
        if (sprite) {
          sprite.width = newWidth
          sprite.height = newHeight
          // If the parent graphics had fallback geometry, clear it so only the sprite remains
          if (g instanceof PIXI.Graphics) {
            g.clear()
          }
        }
        
        // For shapes (not sprites), redraw the graphics
        const layer = renderLayers.find(l => l.id === layerId)
        if (!sprite && g && layer) {
          // Check if this container has a sprite child (for icon-based shapes like cursor, like, etc.)
          if (isIconShapeKind(layer.shapeKind)) {
            // Find the sprite child and resize it
            for (let i = 0; i < g.children.length; i++) {
              const child = g.children[i]
              if (child instanceof PIXI.Sprite) {
                child.width = newWidth
                child.height = newHeight
                break
              }
            }
          } else if (g instanceof PIXI.Graphics) {
            // For non-icon shapes, clear and redraw
            g.clear()
            const fillColor = layer.fillColor ?? 0xffffff
            switch (layer.shapeKind) {
              case 'square':
                g.rect(-newWidth / 2, -newHeight / 2, newWidth, newHeight)
                g.fill(fillColor)
                break
              case 'circle':
                g.ellipse(0, 0, newWidth / 2, newHeight / 2)
                g.fill(fillColor)
                break
              case 'triangle':
                g.moveTo(0, -newHeight / 2)
                g.lineTo(newWidth / 2, newHeight / 2)
                g.lineTo(-newWidth / 2, newHeight / 2)
                g.closePath()
                g.fill(fillColor)
                break
              case 'pill':
                const pillRadius = Math.min(newWidth, newHeight) / 2
                g.roundRect(-newWidth / 2, -newHeight / 2, newWidth, newHeight, pillRadius)
                g.fill(fillColor)
                break
              case 'heart':
                drawHeartPath(g, newWidth, newHeight)
                g.fill(fillColor)
                break
              case 'star':
                const outerRadius = Math.min(newWidth, newHeight) / 2
                const innerRadius = outerRadius * 0.4
                for (let i = 0; i < 10; i++) {
                  const r = i % 2 === 0 ? outerRadius : innerRadius
                  const angle = (Math.PI / 5) * i - Math.PI / 2
                  const sx = Math.cos(angle) * r
                  const sy = Math.sin(angle) * r
                  if (i === 0) g.moveTo(sx, sy)
                  else g.lineTo(sx, sy)
                }
                g.closePath()
                g.fill(fillColor)
                break
            }
          }
        }
        
        if (g) {
          g.hitArea = new PIXI.Rectangle(-newWidth / 2, -newHeight / 2, newWidth, newHeight)
        }
        
        if (outline && outline instanceof PIXI.Graphics) {
          outline.clear()
          outline.rect(-newWidth / 2, -newHeight / 2, newWidth, newHeight)
          outline.stroke({ color: 0x9333ea, width: 2, alpha: 1 })
        }
        
        // Update handle positions and dimensions
        if (handles && handles.length === 8) {
          const halfW = newWidth / 2
          const halfH = newHeight / 2
          const positions = [
            { x: -halfW, y: -halfH }, // tl
            { x: halfW, y: -halfH },  // tr
            { x: halfW, y: halfH },   // br
            { x: -halfW, y: halfH },  // bl
            { x: 0, y: -halfH },      // t
            { x: 0, y: halfH },       // b
            { x: -halfW, y: 0 },      // l
            { x: halfW, y: 0 },       // r
          ]
          
          const edgeThickness = 2
          const hitAreaSize = 12
          
          handles.forEach((h, i) => {
            h.x = positions[i].x
            h.y = positions[i].y
            
            // For edge handles (indices 4-7), we must update their length and hitArea
            if (i >= 4) {
              h.clear()
              let w = 0, hDim = 0
              
              if (i === 4 || i === 5) { // Top or Bottom
                w = newWidth
                hDim = edgeThickness
                h.hitArea = new PIXI.Rectangle(-w / 2, -hitAreaSize / 2, w, hitAreaSize)
              } else { // Left or Right
                w = edgeThickness
                hDim = newHeight
                h.hitArea = new PIXI.Rectangle(-hitAreaSize / 2, -hDim / 2, hitAreaSize, hDim)
              }
              
              h.rect(-w / 2, -hDim / 2, w, hDim)
              h.fill(0x9333ea)
            }
          })
        }
        
        appRef.current?.render()
        
        // Update via callback
        onUpdateLayerSize?.(layerId, Math.round(newWidth), Math.round(newHeight))
        return
      }
      
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
    resizeStateRef.current = null
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
        drawHeartPath(g, width, height)
      }

      const drawStar = (g: PIXI.Graphics, width: number, height: number) => {
        const spikes = 5
        const rx = width / 2
        const ry = height / 2
        const innerRx = rx * 0.5
        const innerRy = ry * 0.5
        let rotation = Math.PI / 2 * 3
        const cx = 0
        const cy = 0
        g.moveTo(cx, cy - ry)
        for (let i = 0; i < spikes; i++) {
          const x = cx + Math.cos(rotation) * rx
          const y = cy + Math.sin(rotation) * ry
          g.lineTo(x, y)
          rotation += Math.PI / spikes

          const xInner = cx + Math.cos(rotation) * innerRx
          const yInner = cy + Math.sin(rotation) * innerRy
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
            graphics.ellipse(0, 0, width / 2, height / 2)
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

      // Use layerIndex to set zIndex for proper z-ordering
      // Timeline displays top-to-bottom, but we want bottom to appear ON TOP on canvas
      // So we invert: first in renderLayers (top of timeline) gets lowest zIndex
      // Last in renderLayers (bottom of timeline) gets highest zIndex = rendered on top
      const totalLayers = renderLayers.length
      
      renderLayers.forEach(async (layer, layerIndex) => {
        // Handle image layers
        if (layer.type === 'image' && layer.imageUrl) {
          try {
            const texture = await PIXI.Assets.load(layer.imageUrl)
            const container = new PIXI.Container()
            const sprite = new PIXI.Sprite(texture)
            sprite.anchor.set(0.5)
            sprite.width = layer.width
            sprite.height = layer.height
            container.addChild(sprite)
            
            const posX = layer.x <= 4 ? layer.x * screenWidth : layer.x
            const posY = layer.y <= 4 ? layer.y * screenHeight : layer.y
            container.x = posX
            container.y = posY
            container.zIndex = layerIndex
            container.eventMode = 'static'
            container.cursor = 'grab'
            container.hitArea = new PIXI.Rectangle(-layer.width / 2, -layer.height / 2, layer.width, layer.height)
            
            // Store references
            graphicsByIdRef.current[layer.id] = container as any
            spritesByIdRef.current[layer.id] = sprite
            
            // Add outline
            const outline = new PIXI.Graphics()
            outline.rect(-layer.width / 2, -layer.height / 2, layer.width, layer.height)
            outline.stroke({ color: 0x9333ea, width: 2, alpha: 1 })
            outline.visible = false
            outline.eventMode = 'none'
            container.addChild(outline)
            outlinesByIdRef.current[layer.id] = outline
            
            // Add bounding box resize handles (4 corners + 4 edges)
            const handleSize = 8
            const edgeThickness = 2
            const hitAreaSize = 12
            const halfW = layer.width / 2
            const halfH = layer.height / 2
            
            const allHandles: Array<{ handle: 'tl' | 'tr' | 'br' | 'bl' | 't' | 'r' | 'b' | 'l', x: number, y: number, w: number, h: number, cursor: string }> = [
              // 4 corner squares
              { handle: 'tl', x: -halfW, y: -halfH, w: handleSize, h: handleSize, cursor: 'nwse-resize' },
              { handle: 'tr', x: halfW, y: -halfH, w: handleSize, h: handleSize, cursor: 'nesw-resize' },
              { handle: 'br', x: halfW, y: halfH, w: handleSize, h: handleSize, cursor: 'nwse-resize' },
              { handle: 'bl', x: -halfW, y: halfH, w: handleSize, h: handleSize, cursor: 'nesw-resize' },
              // 4 edge lines (at midpoints)
              { handle: 't', x: 0, y: -halfH, w: layer.width, h: edgeThickness, cursor: 'ns-resize' },
              { handle: 'b', x: 0, y: halfH, w: layer.width, h: edgeThickness, cursor: 'ns-resize' },
              { handle: 'l', x: -halfW, y: 0, w: edgeThickness, h: layer.height, cursor: 'ew-resize' },
              { handle: 'r', x: halfW, y: 0, w: edgeThickness, h: layer.height, cursor: 'ew-resize' },
            ]
            const handles: PIXI.Graphics[] = []
            allHandles.forEach(({ handle: handleType, x, y, w, h, cursor }) => {
              const handleGfx = new PIXI.Graphics()
              handleGfx.rect(-w / 2, -h / 2, w, h)
              handleGfx.fill(0x9333ea)
              
              // Set larger hit area for easier grabbing
              if (['t', 'b'].includes(handleType)) {
                handleGfx.hitArea = new PIXI.Rectangle(-w / 2, -hitAreaSize / 2, w, hitAreaSize)
              } else if (['l', 'r'].includes(handleType)) {
                handleGfx.hitArea = new PIXI.Rectangle(-hitAreaSize / 2, -h / 2, hitAreaSize, h)
              } else {
                // Corners
                handleGfx.hitArea = new PIXI.Rectangle(-handleSize, -handleSize, handleSize * 2, handleSize * 2)
              }
              
              handleGfx.x = x
              handleGfx.y = y
              handleGfx.eventMode = 'static'
              handleGfx.cursor = cursor
              handleGfx.visible = false
              // Corners (first 4) have higher priority than edges
              handleGfx.zIndex = ['tl', 'tr', 'br', 'bl'].includes(handleType) ? 10 : 1
              handleGfx.on('pointerdown', (e) => {
                e.stopPropagation()
                // Get CURRENT dimensions from layer state (not stale render-time values)
                const currentLayer = layersRef.current.find(l => l.id === layer.id)
                resizeStateRef.current = {
                  layerId: layer.id,
                  handle: handleType,
                  startX: e.global.x,
                  startY: e.global.y,
                  startWidth: currentLayer?.width ?? layer.width,
                  startHeight: currentLayer?.height ?? layer.height,
                }
              })
              container.addChild(handleGfx)
              handles.push(handleGfx)
            })
            resizeHandlesRef.current[layer.id] = handles
            
            // If this layer is already selected (e.g. auto-selected on import), show handles now
            if (selectedLayerId === layer.id) {
              outline.visible = true
              handles.forEach(h => h.visible = true)
            }
            
            // Pointer events
            container.on('pointerdown', (e) => {
              e.stopPropagation()
              onSelectLayer?.(layer.id)
              // Show outline/handles immediately on click for SVGs
              outline.visible = true
              handles.forEach(h => h.visible = true)
              dragRef.current = { id: layer.id, offsetX: e.global.x - container.x, offsetY: e.global.y - container.y }
              stage.cursor = 'grabbing'
            })
            
            stage.addChild(container)
            stage.sortChildren()
          } catch (err) {
            console.error('Failed to load image:', layer.imageUrl, err)
          }
          return // Skip shape rendering code
        }
        
        // Handle SVG layers (from Iconify)
        if (layer.type === 'svg' && layer.svgUrl) {
          try {
            const texture = await PIXI.Assets.load(layer.svgUrl)
            const container = new PIXI.Container()
            const sprite = new PIXI.Sprite(texture)
            sprite.anchor.set(0.5)
            sprite.width = layer.width
            sprite.height = layer.height
            // Apply fill color as tint
            sprite.tint = layer.fillColor ?? 0xffffff
            container.addChild(sprite)
            
            const posX = layer.x <= 4 ? layer.x * screenWidth : layer.x
            const posY = layer.y <= 4 ? layer.y * screenHeight : layer.y
            container.x = posX
            container.y = posY
            // Apply initial rotation from layer (convert degrees to radians)
            container.rotation = ((layer.rotation ?? 0) * Math.PI) / 180
            container.zIndex = layerIndex
            container.eventMode = 'static'
            container.cursor = 'grab'
            container.hitArea = new PIXI.Rectangle(-layer.width / 2, -layer.height / 2, layer.width, layer.height)
            
            // Store references
            graphicsByIdRef.current[layer.id] = container as any
            spritesByIdRef.current[layer.id] = sprite
            
            // Add outline
            const outline = new PIXI.Graphics()
            outline.rect(-layer.width / 2, -layer.height / 2, layer.width, layer.height)
            outline.stroke({ color: 0x9333ea, width: 2, alpha: 1 })
            outline.visible = false
            outline.eventMode = 'none'
            container.addChild(outline)
            outlinesByIdRef.current[layer.id] = outline
            
            // Add resize handles (4 corners + 4 edges like images)
            const handleSize = 8
            const edgeThickness = 2
            const hitAreaSize = 12
            const halfW = layer.width / 2
            const halfH = layer.height / 2
            
            const allHandles: Array<{ handle: 'tl' | 'tr' | 'br' | 'bl' | 't' | 'r' | 'b' | 'l', x: number, y: number, w: number, h: number, cursor: string }> = [
              { handle: 'tl', x: -halfW, y: -halfH, w: handleSize, h: handleSize, cursor: 'nwse-resize' },
              { handle: 'tr', x: halfW, y: -halfH, w: handleSize, h: handleSize, cursor: 'nesw-resize' },
              { handle: 'br', x: halfW, y: halfH, w: handleSize, h: handleSize, cursor: 'nwse-resize' },
              { handle: 'bl', x: -halfW, y: halfH, w: handleSize, h: handleSize, cursor: 'nesw-resize' },
              { handle: 't', x: 0, y: -halfH, w: layer.width, h: edgeThickness, cursor: 'ns-resize' },
              { handle: 'b', x: 0, y: halfH, w: layer.width, h: edgeThickness, cursor: 'ns-resize' },
              { handle: 'l', x: -halfW, y: 0, w: edgeThickness, h: layer.height, cursor: 'ew-resize' },
              { handle: 'r', x: halfW, y: 0, w: edgeThickness, h: layer.height, cursor: 'ew-resize' },
            ]
            const handles: PIXI.Graphics[] = []
            allHandles.forEach(({ handle: handleType, x, y, w, h, cursor }) => {
              const handleGfx = new PIXI.Graphics()
              handleGfx.rect(-w / 2, -h / 2, w, h)
              handleGfx.fill(0x9333ea)
              
              if (['t', 'b'].includes(handleType)) {
                handleGfx.hitArea = new PIXI.Rectangle(-w / 2, -hitAreaSize / 2, w, hitAreaSize)
              } else if (['l', 'r'].includes(handleType)) {
                handleGfx.hitArea = new PIXI.Rectangle(-hitAreaSize / 2, -h / 2, hitAreaSize, h)
              } else {
                handleGfx.hitArea = new PIXI.Rectangle(-handleSize, -handleSize, handleSize * 2, handleSize * 2)
              }
              
              handleGfx.x = x
              handleGfx.y = y
              handleGfx.eventMode = 'static'
              handleGfx.cursor = cursor
              handleGfx.visible = false
              handleGfx.zIndex = ['tl', 'tr', 'br', 'bl'].includes(handleType) ? 10 : 1
              handleGfx.on('pointerdown', (e) => {
                e.stopPropagation()
                const currentLayer = layersRef.current.find(l => l.id === layer.id)
                resizeStateRef.current = {
                  layerId: layer.id,
                  handle: handleType,
                  startX: e.global.x,
                  startY: e.global.y,
                  startWidth: currentLayer?.width ?? layer.width,
                  startHeight: currentLayer?.height ?? layer.height,
                }
              })
              container.addChild(handleGfx)
              handles.push(handleGfx)
            })
            resizeHandlesRef.current[layer.id] = handles
            
            // If already selected, show handles
            if (selectedLayerId === layer.id) {
              outline.visible = true
              handles.forEach(h => h.visible = true)
            }
            
            // Pointer events
            container.on('pointerdown', (e) => {
              e.stopPropagation()
              onSelectLayer?.(layer.id)
              dragRef.current = { id: layer.id, offsetX: e.global.x - container.x, offsetY: e.global.y - container.y }
              stage.cursor = 'grabbing'
            })
            
            stage.addChild(container)
            stage.sortChildren()
          } catch (err) {
            console.error('Failed to load SVG:', layer.svgUrl, err)
          }
          return // Skip shape rendering code
        }
        
        // Handle Text layers
        if (layer.type === 'text' && layer.text) {
          const container = new PIXI.Container()
          
          // Use layer.width as the text box width (wordWrapWidth)
          const textBoxWidth = layer.width || 400
          
          // Create text style
          const textStyle = new PIXI.TextStyle({
            fontFamily: layer.fontFamily || 'Inter',
            fontSize: layer.fontSize || 48,
            fontWeight: String(layer.fontWeight || 600) as PIXI.TextStyleFontWeight,
            fill: layer.fillColor ?? 0xffffff,
            align: 'center',
            wordWrap: true,
            wordWrapWidth: textBoxWidth,
          })
          
          // For counter layers, compute the initial display value based on current playhead
          let initialText = layer.text
          if (layer.isCounter) {
            const track = timelineTracks.find(t => t.layerId === layer.id)
            const startTime = track?.startTime ?? 0
            const duration = track?.duration ?? 2000
            const startValue = layer.counterStart ?? 0
            const endValue = layer.counterEnd ?? 100
            const prefix = layer.counterPrefix ?? ''
            
            if (playhead >= startTime && playhead <= startTime + duration) {
              const rawProgress = (playhead - startTime) / duration
              const k = 4.5
              const t = rawProgress * 3.6
              const easedProgress = 1 - (1 + k * t / 5) * Math.exp(-k * t / 2)
              const clampedProgress = Math.min(1, Math.max(0, easedProgress))
              const currentValue = startValue + (endValue - startValue) * clampedProgress
              initialText = `${prefix}${Math.round(currentValue)}`
            } else if (playhead < startTime) {
              initialText = `${prefix}${startValue}`
            } else {
              initialText = `${prefix}${endValue}`
            }
          }
          
          const text = new PIXI.Text({ text: initialText, style: textStyle })
          text.anchor.set(0.5)
          container.addChild(text)
          
          // Use text's intrinsic width/height (local dimensions, not global bounds)
          const boxWidth = Math.max(textBoxWidth, text.width)
          const boxHeight = text.height
          
          const posX = layer.x <= 4 ? layer.x * screenWidth : layer.x
          const posY = layer.y <= 4 ? layer.y * screenHeight : layer.y
          container.x = posX
          container.y = posY
          container.zIndex = layerIndex
          container.eventMode = 'static'
          container.cursor = 'grab'
          container.hitArea = new PIXI.Rectangle(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight)
          
          // Store references
          graphicsByIdRef.current[layer.id] = container as any
          
          // Add outline
          const outline = new PIXI.Graphics()
          outline.rect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight)
          outline.stroke({ color: 0xA855F7, width: 2, alpha: 1 })
          outline.visible = false
          outline.eventMode = 'none'
          container.addChild(outline)
          outlinesByIdRef.current[layer.id] = outline
          
          // Add bounding box resize handles (4 corners + 4 edges) - same as shapes
          const handleSize = 8
          const edgeThickness = 2
          const hitAreaSize = 12
          const halfW = boxWidth / 2
          const halfH = boxHeight / 2
          
          const allHandles: Array<{ handle: 'tl' | 'tr' | 'br' | 'bl' | 't' | 'r' | 'b' | 'l', x: number, y: number, w: number, h: number, cursor: string }> = [
            // 4 corner squares
            { handle: 'tl', x: -halfW, y: -halfH, w: handleSize, h: handleSize, cursor: 'nwse-resize' },
            { handle: 'tr', x: halfW, y: -halfH, w: handleSize, h: handleSize, cursor: 'nesw-resize' },
            { handle: 'br', x: halfW, y: halfH, w: handleSize, h: handleSize, cursor: 'nwse-resize' },
            { handle: 'bl', x: -halfW, y: halfH, w: handleSize, h: handleSize, cursor: 'nesw-resize' },
            // 4 edge lines (at midpoints)
            { handle: 't', x: 0, y: -halfH, w: boxWidth, h: edgeThickness, cursor: 'ns-resize' },
            { handle: 'b', x: 0, y: halfH, w: boxWidth, h: edgeThickness, cursor: 'ns-resize' },
            { handle: 'l', x: -halfW, y: 0, w: edgeThickness, h: boxHeight, cursor: 'ew-resize' },
            { handle: 'r', x: halfW, y: 0, w: edgeThickness, h: boxHeight, cursor: 'ew-resize' },
          ]
          const handles: PIXI.Graphics[] = []
          allHandles.forEach(({ handle: handleType, x, y, w, h, cursor }) => {
            const handleGfx = new PIXI.Graphics()
            handleGfx.rect(-w / 2, -h / 2, w, h)
            handleGfx.fill(0xA855F7)
            
            // Set larger hit area for easier grabbing
            if (['t', 'b'].includes(handleType)) {
              handleGfx.hitArea = new PIXI.Rectangle(-w / 2, -hitAreaSize / 2, w, hitAreaSize)
            } else if (['l', 'r'].includes(handleType)) {
              handleGfx.hitArea = new PIXI.Rectangle(-hitAreaSize / 2, -h / 2, hitAreaSize, h)
            } else {
              // Corners
              handleGfx.hitArea = new PIXI.Rectangle(-handleSize, -handleSize, handleSize * 2, handleSize * 2)
            }
            
            handleGfx.x = x
            handleGfx.y = y
            handleGfx.eventMode = 'static'
            handleGfx.cursor = cursor
            handleGfx.visible = false
            // Corners (first 4) have higher priority than edges
            handleGfx.zIndex = ['tl', 'tr', 'br', 'bl'].includes(handleType) ? 10 : 1
            handleGfx.on('pointerdown', (e) => {
              e.stopPropagation()
              // Get CURRENT dimensions from layer state (not stale render-time values)
              const currentLayer = layersRef.current.find(l => l.id === layer.id)
              resizeStateRef.current = {
                layerId: layer.id,
                handle: handleType,
                startX: e.global.x,
                startY: e.global.y,
                startWidth: currentLayer?.width ?? layer.width,
                startHeight: currentLayer?.height ?? layer.height,
              }
            })
            container.addChild(handleGfx)
            handles.push(handleGfx)
          })
          resizeHandlesRef.current[layer.id] = handles
          
          // If already selected, show outline and handles
          if (selectedLayerId === layer.id) {
            outline.visible = true
            handles.forEach(h => h.visible = true)
          }
          
          // Pointer events
          container.on('pointerdown', (e) => {
            e.stopPropagation()
            onSelectLayer?.(layer.id)
            dragRef.current = { id: layer.id, offsetX: e.global.x - container.x, offsetY: e.global.y - container.y }
            stage.cursor = 'grabbing'
          })
          
          stage.addChild(container)
          stage.sortChildren()
          return // Skip shape rendering code
        }
        
        const g = new PIXI.Graphics()
        // Bottom of timeline (higher index) = higher zIndex = renders on top
        g.zIndex = layerIndex
        
        // Check if this shape uses an SVG icon
        const usesIcon = isIconShapeKind(layer.shapeKind)
        
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
              spritesByIdRef.current[layer.id] = sprite
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
        // Apply initial rotation from layer (convert degrees to radians)
        g.rotation = ((layer.rotation ?? 0) * Math.PI) / 180
        
        g.interactive = true
        g.eventMode = 'dynamic'
        g.cursor = 'pointer'
        g.hitArea = new PIXI.Rectangle(-layer.width / 2, -layer.height / 2, layer.width, layer.height)
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
        
        // Add bounding box resize handles (4 corners + 4 edges) for shapes
        const shapeHandleSize = 8
        const shapeEdgeThickness = 2
        const shapeHitAreaSize = 12
        const shapeHalfW = layer.width / 2
        const shapeHalfH = layer.height / 2
        
        const shapeHandles: Array<{ handle: 'tl' | 'tr' | 'br' | 'bl' | 't' | 'r' | 'b' | 'l', x: number, y: number, w: number, h: number, cursor: string }> = [
          // 4 corner squares
          { handle: 'tl', x: -shapeHalfW, y: -shapeHalfH, w: shapeHandleSize, h: shapeHandleSize, cursor: 'nwse-resize' },
          { handle: 'tr', x: shapeHalfW, y: -shapeHalfH, w: shapeHandleSize, h: shapeHandleSize, cursor: 'nesw-resize' },
          { handle: 'br', x: shapeHalfW, y: shapeHalfH, w: shapeHandleSize, h: shapeHandleSize, cursor: 'nwse-resize' },
          { handle: 'bl', x: -shapeHalfW, y: shapeHalfH, w: shapeHandleSize, h: shapeHandleSize, cursor: 'nesw-resize' },
          // 4 edge lines
          { handle: 't', x: 0, y: -shapeHalfH, w: layer.width, h: shapeEdgeThickness, cursor: 'ns-resize' },
          { handle: 'b', x: 0, y: shapeHalfH, w: layer.width, h: shapeEdgeThickness, cursor: 'ns-resize' },
          { handle: 'l', x: -shapeHalfW, y: 0, w: shapeEdgeThickness, h: layer.height, cursor: 'ew-resize' },
          { handle: 'r', x: shapeHalfW, y: 0, w: shapeEdgeThickness, h: layer.height, cursor: 'ew-resize' },
        ]
        const handles: PIXI.Graphics[] = []
        shapeHandles.forEach(({ handle: handleType, x, y, w, h, cursor }) => {
          const handleGfx = new PIXI.Graphics()
          handleGfx.rect(-w / 2, -h / 2, w, h)
          handleGfx.fill(0x9333ea)
          
          // Set larger hit area for easier grabbing
          if (['t', 'b'].includes(handleType)) {
            handleGfx.hitArea = new PIXI.Rectangle(-w / 2, -shapeHitAreaSize / 2, w, shapeHitAreaSize)
          } else if (['l', 'r'].includes(handleType)) {
            handleGfx.hitArea = new PIXI.Rectangle(-shapeHitAreaSize / 2, -h / 2, shapeHitAreaSize, h)
          } else {
            // Corners
            handleGfx.hitArea = new PIXI.Rectangle(-shapeHandleSize, -shapeHandleSize, shapeHandleSize * 2, shapeHandleSize * 2)
          }
          
          handleGfx.x = x
          handleGfx.y = y
          handleGfx.eventMode = 'static'
          handleGfx.cursor = cursor
          handleGfx.visible = false
          // Corners have higher priority than edges
          handleGfx.zIndex = ['tl', 'tr', 'br', 'bl'].includes(handleType) ? 10 : 1
          handleGfx.on('pointerdown', (e) => {
            e.stopPropagation()
            // Get CURRENT dimensions from layer state (not stale render-time values)
            const currentLayer = layersRef.current.find(l => l.id === layer.id)
            resizeStateRef.current = {
              layerId: layer.id,
              handle: handleType,
              startX: e.global.x,
              startY: e.global.y,
              startWidth: currentLayer?.width ?? layer.width,
              startHeight: currentLayer?.height ?? layer.height,
            }
          })
          g.addChild(handleGfx)
          handles.push(handleGfx)
        })
        resizeHandlesRef.current[layer.id] = handles
        // If this layer is already selected (e.g., auto-selected on creation), show outline/handles immediately
        if (selectedLayerId === layer.id) {
          outline.visible = true
          handles.forEach(h => (h.visible = true))
        }
        
        g.on('pointerdown', (e) => {
          e.stopPropagation()
          if (e.originalEvent) {
            e.originalEvent.stopPropagation()
          }
          const pos = e.global
          onSelectLayer?.(layer.id)
          // Show outline/handles immediately on click for shape/icon layers
          outline.visible = true
          handles.forEach(h => (h.visible = true))
          dragRef.current = {
            id: layer.id,
            offsetX: pos.x - g.x,
            offsetY: pos.y - g.y,
          }
          stage.cursor = 'grabbing'
        })
        
        graphicsByIdRef.current[layer.id] = g
        stage.addChild(g)
        stage.sortChildren() // Force sort by zIndex after each layer

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

      
      // Update graphics and render
      Promise.all(renderLayers.map(async (layer, layerIndex) => {
        await updateGraphicsFromTimeline()
      })).then(() => {
        app.render()
      })

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
    stage.sortChildren() // Force sort by zIndex
    app.render()
    
    // Also sort after a delay to catch async-loaded layers
    setTimeout(() => {
      stage.sortChildren()
      app.render()
    }, 100)

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
    
    let needsRender = false
    // Simply show/hide the outline graphics and resize handles
    Object.entries(outlinesByIdRef.current).forEach(([id, outline]) => {
      const isSelected = selectedLayerId === id
      if (outline.visible !== isSelected) {
        outline.visible = isSelected
        needsRender = true
      }
      
      // Also show/hide resize handles
      const handles = resizeHandlesRef.current[id]
      if (handles) {
        handles.forEach(h => {
          if (h.visible !== isSelected) {
            h.visible = isSelected
            needsRender = true
          }
        })
      }
    })
    if (needsRender) {
      appRef.current.render()
    }
  }, [selectedLayerId, isReady])

  // 4. Sync dimensions from panel to canvas (for BOTH images AND shapes)
  useEffect(() => {
    if (!isReady || !appRef.current) return
    
    let needsRender = false
    
    renderLayers.forEach(layer => {
      const g = graphicsByIdRef.current[layer.id]
      if (!g) return
      const isIconShape = isIconShapeKind(layer.shapeKind)
      
      // For text layers, ALWAYS check for text/fontSize/width changes
      if (layer.type === 'text') {
        const container = g
        if (container && container.children && container.children.length > 0) {
          const textObj = container.children[0] as PIXI.Text
          if (textObj && 'text' in textObj) {
            let textChanged = false
            
            // Check if this is a counter layer (uses visibility bar for animation)
            if (layer.isCounter) {
              // Get track for this layer to find visibility bar timing
              // Duration is controlled by resizing the purple bar
              const track = timelineTracks.find(t => t.layerId === layer.id)
              const startTime = track?.startTime ?? 0
              const duration = track?.duration ?? 2000
              
              // Check if playhead is within the visibility bar
              if (playhead >= startTime && playhead <= startTime + duration) {
                // Calculate progress within the visibility bar (0 to 1)
                const rawProgress = (playhead - startTime) / duration
                
                // Spring physics easing (like React Bits CountUp / Framer Motion useSpring)
                // Based on: damping = 20 + 40 * (1 / duration), stiffness = 100 * (1 / duration)
                // This creates a critically damped spring that settles smoothly without bounce
                // Approximated using exponential decay: 1 - (1 + k*t) * e^(-k*t)
                const k = 4.5 // decay factor (lower = slower settle, was 5)
                const t = rawProgress * 3.6 // scale time for spring response (was 4)
                const easedProgress = 1 - (1 + k * t / 5) * Math.exp(-k * t / 2)
                
                // Clamp to 0-1 range
                const clampedProgress = Math.min(1, Math.max(0, easedProgress))
                
                // Get counter parameters from layer
                const startValue = layer.counterStart ?? 0
                const endValue = layer.counterEnd ?? 100
                const prefix = layer.counterPrefix ?? ''
                
                // Calculate current value (handles count up AND count down)
                const currentValue = startValue + (endValue - startValue) * clampedProgress
                
                // Format the number (integers)
                const formattedValue = Math.round(currentValue).toString()
                const counterText = `${prefix}${formattedValue}`
                
                if (textObj.text !== counterText) {
                  textObj.text = counterText
                  textChanged = true
                  needsRender = true
                }
              } else if (playhead < startTime) {
                // Before animation: show start value
                const counterText = `${layer.counterPrefix ?? ''}${layer.counterStart ?? 0}`
                if (textObj.text !== counterText) {
                  textObj.text = counterText
                  textChanged = true
                  needsRender = true
                }
              } else {
                // After animation: show end value
                const counterText = `${layer.counterPrefix ?? ''}${layer.counterEnd ?? 100}`
                if (textObj.text !== counterText) {
                  textObj.text = counterText
                  textChanged = true
                  needsRender = true
                }
              }
            } else {
              // Regular text layer - update text content
              if (layer.text !== undefined && textObj.text !== layer.text) {
                textObj.text = layer.text
                textChanged = true
                needsRender = true
              }
            }
            // Update font size
            if (layer.fontSize !== undefined && textObj.style && textObj.style.fontSize !== layer.fontSize) {
              textObj.style.fontSize = layer.fontSize
              textChanged = true
              needsRender = true
            }
            // Update fill color
            if (layer.fillColor !== undefined && textObj.style) {
              textObj.style.fill = layer.fillColor
              needsRender = true
            }
            // Update font family
            if (layer.fontFamily !== undefined && textObj.style && textObj.style.fontFamily !== layer.fontFamily) {
              textObj.style.fontFamily = layer.fontFamily
              textChanged = true
              needsRender = true
            }
            // Update wordWrapWidth (text box width)
            if (layer.width !== undefined && textObj.style && textObj.style.wordWrapWidth !== layer.width) {
              textObj.style.wordWrapWidth = layer.width
              textChanged = true
              needsRender = true
            }
            
            // If text properties changed, update outline, hit area, and handles
            if (textChanged) {
              // Use text's intrinsic width/height (local dimensions, not global bounds)
              const boxWidth = Math.max(layer.width || 400, textObj.width)
              const boxHeight = textObj.height
              const halfW = boxWidth / 2
              const halfH = boxHeight / 2
              
              // Update hit area
              container.hitArea = new PIXI.Rectangle(-halfW, -halfH, boxWidth, boxHeight)
              
              // Find and update the outline graphics (child index 1)
              if (container.children.length > 1) {
                const outline = container.children[1] as PIXI.Graphics
                if (outline && 'clear' in outline) {
                  outline.clear()
                  outline.rect(-halfW, -halfH, boxWidth, boxHeight)
                  outline.stroke({ width: 2, color: 0xA855F7 })
                }
              }
              
              // Update all 8 resize handles (same as shapes)
              const handles = resizeHandlesRef.current[layer.id]
              if (handles && handles.length === 8) {
                const handleSize = 8
                const edgeThickness = 2
                const hitAreaSize = 12
                
                // Handle positions: tl, tr, br, bl, t, b, l, r
                const handleData = [
                  { x: -halfW, y: -halfH, w: handleSize, h: handleSize },
                  { x: halfW, y: -halfH, w: handleSize, h: handleSize },
                  { x: halfW, y: halfH, w: handleSize, h: handleSize },
                  { x: -halfW, y: halfH, w: handleSize, h: handleSize },
                  { x: 0, y: -halfH, w: boxWidth, h: edgeThickness },
                  { x: 0, y: halfH, w: boxWidth, h: edgeThickness },
                  { x: -halfW, y: 0, w: edgeThickness, h: boxHeight },
                  { x: halfW, y: 0, w: edgeThickness, h: boxHeight },
                ]
                
                handles.forEach((handle, idx) => {
                  const data = handleData[idx]
                  handle.clear()
                  handle.rect(-data.w / 2, -data.h / 2, data.w, data.h)
                  handle.fill(0xA855F7)
                  handle.x = data.x
                  handle.y = data.y
                  
                  // Update hit areas
                  if (idx < 4) {
                    // Corners
                    handle.hitArea = new PIXI.Rectangle(-handleSize, -handleSize, handleSize * 2, handleSize * 2)
                  } else if (idx === 4 || idx === 5) {
                    // Top/Bottom edges
                    handle.hitArea = new PIXI.Rectangle(-data.w / 2, -hitAreaSize / 2, data.w, hitAreaSize)
                  } else {
                    // Left/Right edges
                    handle.hitArea = new PIXI.Rectangle(-hitAreaSize / 2, -data.h / 2, hitAreaSize, data.h)
                  }
                })
              }
            }
          }
        }
        return // Skip the rest for text layers
      }
      
      const prevDims = layerDimensionsRef.current[layer.id]
      const layerRotation = layer.rotation ?? 0
      const hasChanged = !prevDims || prevDims.width !== layer.width || prevDims.height !== layer.height || prevDims.fillColor !== layer.fillColor || prevDims.rotation !== layerRotation
      
      if (!hasChanged) return
      
      // Update tracked dimensions, color, and rotation
      layerDimensionsRef.current[layer.id] = { width: layer.width, height: layer.height, fillColor: layer.fillColor, rotation: layerRotation }
      needsRender = true
      
      // NOTE: Rotation is handled by updateGraphicsFromTimeline to combine base + animation
      
      // For images, update sprite dimensions and tint
      const sprite = spritesByIdRef.current[layer.id]
      if (sprite) {
        sprite.width = layer.width
        sprite.height = layer.height
        sprite.tint = layer.fillColor ?? 0xffffff
        if (g instanceof PIXI.Graphics) {
          g.clear() // remove any fallback geometry so only the sprite shows
        }
      }
      // Fallback: some icon shapes keep the sprite as a child of a Graphics container
      if (isIconShape && !sprite && 'children' in g) {
        const childSprite = g.children.find((c): c is PIXI.Sprite => c instanceof PIXI.Sprite)
        if (childSprite) {
          childSprite.width = layer.width
          childSprite.height = layer.height
          childSprite.tint = layer.fillColor ?? 0xffffff
        }
      }
      
      // For shapes only (not images or SVGs which use containers), redraw the graphics
      if (layer.shapeKind && layer.type !== 'image' && layer.type !== 'svg' && !isIconShape) {
        g.clear()
        const fillColor = layer.fillColor ?? 0xffffff
        switch (layer.shapeKind) {
          case 'square':
            g.rect(-layer.width / 2, -layer.height / 2, layer.width, layer.height)
            break
          case 'heart': {
            const w = layer.width, h = layer.height
            g.moveTo(0, -h * 0.35)
            g.bezierCurveTo(w * 0.5, -h * 0.5, w * 0.5, 0, 0, h * 0.5)
            g.bezierCurveTo(-w * 0.5, 0, -w * 0.5, -h * 0.5, 0, -h * 0.35)
            g.closePath()
            break
          }
          case 'star': {
            const spikes = 5
            const rx = layer.width / 2, ry = layer.height / 2
            const innerRx = rx * 0.5, innerRy = ry * 0.5
            let rotation = Math.PI / 2 * 3
            g.moveTo(0, -ry)
            for (let i = 0; i < spikes; i++) {
              const x = Math.cos(rotation) * rx
              const y = Math.sin(rotation) * ry
              g.lineTo(x, y)
              rotation += Math.PI / spikes
              const xInner = Math.cos(rotation) * innerRx
              const yInner = Math.sin(rotation) * innerRy
              g.lineTo(xInner, yInner)
              rotation += Math.PI / spikes
            }
            g.closePath()
            break
          }
          case 'triangle':
            g.moveTo(-layer.width / 2, layer.height / 2)
            g.lineTo(layer.width / 2, layer.height / 2)
            g.lineTo(0, -layer.height / 2)
            g.closePath()
            break
          case 'pill': {
            const radius = Math.min(layer.width, layer.height) / 2
            g.roundRect(-layer.width / 2, -layer.height / 2, layer.width, layer.height, radius)
            break
          }
          case 'circle':
          default:
            g.ellipse(0, 0, layer.width / 2, layer.height / 2)
            break
        }
        g.fill(fillColor)
      }
      
      // Update hit area
      g.hitArea = new PIXI.Rectangle(-layer.width / 2, -layer.height / 2, layer.width, layer.height)
      
        // Update outline for selection
        const outline = outlinesByIdRef.current[layer.id]
        if (outline && outline instanceof PIXI.Graphics) {
          outline.clear()
          if (layer.shapeKind === 'heart') {
            drawHeartPath(outline, layer.width, layer.height)
          } else if (layer.shapeKind === 'star') {
            const spikes = 5, rx = layer.width / 2, ry = layer.height / 2
            const innerRx = rx * 0.5, innerRy = ry * 0.5
            let rotation = Math.PI / 2 * 3
          outline.moveTo(0, -ry)
          for (let i = 0; i < spikes; i++) {
            outline.lineTo(Math.cos(rotation) * rx, Math.sin(rotation) * ry)
            rotation += Math.PI / spikes
            outline.lineTo(Math.cos(rotation) * innerRx, Math.sin(rotation) * innerRy)
            rotation += Math.PI / spikes
          }
          outline.closePath()
        } else if (layer.shapeKind === 'triangle') {
          outline.moveTo(-layer.width / 2, layer.height / 2)
          outline.lineTo(layer.width / 2, layer.height / 2)
          outline.lineTo(0, -layer.height / 2)
          outline.closePath()
        } else if (layer.shapeKind === 'circle') {
          outline.ellipse(0, 0, layer.width / 2, layer.height / 2)
        } else {
          outline.rect(-layer.width / 2, -layer.height / 2, layer.width, layer.height)
        }
        outline.stroke({ color: 0x9333ea, width: 2, alpha: 1 })
      }
      
      // Update handle positions and geometry (4 corners or 8 with edges)
      const handles = resizeHandlesRef.current[layer.id]
      if (handles) {
        const halfW = layer.width / 2, halfH = layer.height / 2
        const edgeThickness = 2
        const hitAreaSize = 12
        
        if (handles.length === 8) {
          // Corner positions (indices 0-3)
          const cornerPositions = [
            { x: -halfW, y: -halfH }, { x: halfW, y: -halfH },
            { x: halfW, y: halfH }, { x: -halfW, y: halfH },
          ]
          // Edge positions (indices 4-7: top, bottom, left, right)
          const edgePositions = [
            { x: 0, y: -halfH }, { x: 0, y: halfH },
            { x: -halfW, y: 0 }, { x: halfW, y: 0 },
          ]
          
          // Update corner handles (just position)
          for (let i = 0; i < 4; i++) {
            handles[i].x = cornerPositions[i].x
            handles[i].y = cornerPositions[i].y
          }
          
          // Update edge handles (position + redraw geometry)
          for (let i = 4; i < 8; i++) {
            const h = handles[i]
            h.x = edgePositions[i - 4].x
            h.y = edgePositions[i - 4].y
            
            // Redraw the edge handle bar with new dimensions
            h.clear()
            let w: number, hDim: number
            if (i === 4 || i === 5) { // Top or Bottom edge
              w = layer.width
              hDim = edgeThickness
              h.hitArea = new PIXI.Rectangle(-w / 2, -hitAreaSize / 2, w, hitAreaSize)
            } else { // Left or Right edge
              w = edgeThickness
              hDim = layer.height
              h.hitArea = new PIXI.Rectangle(-hitAreaSize / 2, -hDim / 2, hitAreaSize, hDim)
            }
            h.rect(-w / 2, -hDim / 2, w, hDim)
            h.fill(0x9333ea)
          }
        } else {
          // 4 corner handles only
          const positions = [
            { x: -halfW, y: -halfH }, { x: halfW, y: -halfH },
            { x: halfW, y: halfH }, { x: -halfW, y: halfH },
          ]
          handles.forEach((h, i) => {
            if (positions[i]) {
              h.x = positions[i].x
              h.y = positions[i].y
            }
          })
        }
      }
    })
    
    if (needsRender) {
      appRef.current?.render()
    }
  }, [renderLayers, isReady, layers, playhead, timelineTracks])

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
      {!isDrawingPath && allPathClips.length > 0 && (
        <div className="absolute inset-0" style={{ zIndex: 25, pointerEvents: 'none' }}>
          <svg className="h-full w-full">
            {allPathClips.map((pathClip, pathIndex) => (
              <g key={pathClip.id || pathIndex}>
                {/* Path line */}
                <path
                  d={(() => {
                    const { width, height } = canvasBounds
                    if (!width || !height || !pathClip.points.length) return ''
                    const pts = pathClip.points.map((pt) => ({ x: pt.x * width + offsetX, y: pt.y * height + offsetY }))
                    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
                  })()}
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="none"
                  opacity={0.5}
                />
                {/* Start point (green circle) */}
                {pathClip.points.length > 0 && (() => {
                  const { width, height } = canvasBounds
                  if (!width || !height) return null
                  const startPt = pathClip.points[0]
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
                {pathClip.points.length > 1 && (() => {
                  const { width, height } = canvasBounds
                  if (!width || !height) return null
                  const endPt = pathClip.points[pathClip.points.length - 1]
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
              </g>
            ))}
          </svg>
        </div>
      )}

      {/* Line draw overlay (two-point, draggable end) */}
      {isDrawingLine && (
        <LineOverlay
          canvasBounds={canvasBounds}
          offsetX={offsetX}
          offsetY={offsetY}
          layers={renderLayers}
          selectedLayerId={selectedLayerId}
          activePathPoints={activePathPoints}
          pathPoints={pathPoints}
          onClearPath={onClearPath}
          onAddPathPoint={onAddPathPoint}
          onUpdateActivePathPoint={onUpdateActivePathPoint}
          onFinishPath={onFinishPath}
          lineStartRef={lineStartRef}
          lineEndRef={lineEndRef}
          lineHasEndRef={lineHasEndRef}
          lineDragActiveRef={lineDragActiveRef}
        />
      )}

      {/* Pan/Zoom region overlay - show when editing a pan_zoom clip and not playing */}
      {(() => {
        // Find if selectedClipId corresponds to a pan_zoom template clip
        const panZoomClip = selectedClipId 
          ? templateClips.find(c => c.id === selectedClipId && c.template === 'pan_zoom')
          : null
        
        if (!panZoomClip || isPlaying) return null
        
        // Get target region from clip parameters or use default
        const targetRegion = panZoomClip.parameters?.panZoomEndRegion ?? { x: 0.25, y: 0.25, width: 0.5, height: 0.5 }
        
        // Get canvas bounds
        const canvasBoundsForOverlay = {
          width: canvasBounds.width,
          height: canvasBounds.height,
          left: canvasBounds.left,
          top: canvasBounds.top,
        }
        
        return (
          <PanZoomRegionOverlay
            canvasBounds={canvasBoundsForOverlay}
            offsetX={offsetX}
            offsetY={offsetY}
            targetRegion={targetRegion}
            onUpdateTargetRegion={(newTargetRegion) => {
              onUpdatePanZoomRegions?.(panZoomClip.id, newTargetRegion)
            }}
            onClickBackdrop={onCanvasBackgroundClick}
          />
        )
      })()}

      {/* Fallback DOM previews removed; timeline drives all motion */}
    </div>
  )
}

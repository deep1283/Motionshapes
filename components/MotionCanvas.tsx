'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import 'pixi.js/app' // ensure Application plugins (ticker/resize) are registered
import 'pixi.js/events' // enable pointer events
import { sampleTimeline } from '@/lib/timeline'
import { useTimeline, useTimelineActions } from '@/lib/timeline-store'

interface MotionCanvasProps {
  template: string
  templateVersion: number
  layers?: Array<{
    id: string
    shapeKind: 'circle'
    x: number
    y: number
    width: number
    height: number
    fillColor: number
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
}

export default function MotionCanvas({ template, templateVersion, layers = [], onUpdateLayerPosition, onTemplateComplete, isDrawingPath = false, pathPoints = [], onAddPathPoint, onFinishPath, onSelectLayer, selectedLayerId, activePathPoints = [], pathVersion = 0, pathLayerId, onPathPlaybackComplete, onUpdateActivePathPoint, onClearPath, onInsertPathPoint }: MotionCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const [isReady, setIsReady] = useState(false)
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const graphicsByIdRef = useRef<Record<string, PIXI.Graphics>>({})
  const domDragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const pathDragIndexRef = useRef<number | null>(null)
  const pathDragClipRef = useRef<{ layerId: string; clipId: string } | null>(null)
  const pathTranslateRef = useRef<{ startX: number; startY: number; origPoints: Array<{ x: number; y: number }> } | null>(null)
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
  const [pathHandleIndices, setPathHandleIndices] = useState<number[]>([])
  const [showPathOverlay, setShowPathOverlay] = useState(true)

  useEffect(() => {
    // reset handles when the clip/layer changes; show endpoints by default if clip exists
    if (currentPathClip && currentPathClip.points.length > 0) {
      // if we already have handles for this clip, keep them; otherwise init to endpoints
      if (pathHandleIndices.length === 0 || pathHandleIndices.some((i) => i >= currentPathClip.points.length)) {
        const last = currentPathClip.points.length - 1
        setPathHandleIndices([0, last])
      }
      setShowPathOverlay(true)
    } else {
      setPathHandleIndices([])
      setShowPathOverlay(false)
    }
  }, [currentPathClip?.id, selectedLayerId]) // do not reset on length change so added nodes persist

  // 1. Initialize Pixi App ONCE
  useEffect(() => {
    if (!containerRef.current || appRef.current) return

    const initPixi = async () => {
      const app = new PIXI.Application()
      await app.init({ 
        background: '#0f0f0f',
        resizeTo: containerRef.current!,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
      })
      // ensure the ticker/render loop runs even if autoStart defaults ever change
      app.start()
      app.ticker?.start()
      // enforce canvas sizing inside the container
      app.renderer.canvas.style.width = '100%'
      app.renderer.canvas.style.height = '100%'
      // force an initial resize to the container dimensions in case ResizeObserver hasn't fired yet
      const bounds = containerRef.current?.getBoundingClientRect()
      if (bounds) {
        app.renderer.resize(bounds.width, bounds.height)
      }
      
      if (containerRef.current) {
        containerRef.current.appendChild(app.canvas)
        appRef.current = app
        // keep rendering even if no template animation is running
        app.ticker.add(() => app.render())
        setIsReady(true)
      }
    }

    initPixi()

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true })
        appRef.current = null
      }
    }
  }, [])

  // Apply timeline-sampled transforms onto Pixi graphics so playhead/scrub reflects on-canvas
  useEffect(() => {
    if (!isReady || !containerRef.current) return
    const bounds = containerRef.current.getBoundingClientRect()
    const screenWidth = bounds.width || 1
    const screenHeight = bounds.height || 1
    Object.entries(sampledTimeline).forEach(([id, state]) => {
      const g = graphicsByIdRef.current[id]
      if (!g) return
      const posX = state.position.x <= 1 ? state.position.x * screenWidth : state.position.x
      const posY = state.position.y <= 1 ? state.position.y * screenHeight : state.position.y
      g.x = posX
      g.y = posY
      g.scale.set(state.scale)
      g.rotation = state.rotation
      g.alpha = state.opacity
    })
    appRef.current?.render()
  }, [sampledTimeline, isReady])

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

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDrawingPath) return
    const hasPath = activePathPoints.length > 0 || currentPathClip
    if (!hasPath) return
    const target = e.target as HTMLElement | null
    if (!target) return
    const isPath = target.closest('[data-path-element="true"]')
    const isShape = target.closest('[data-shape-element="true"]')
    if (isPath || isShape) return
    // keep overlay visible; no action on background click
  }

  // Ensure the editable path contains only the current handles (nodes) so stretching is strictly between nodes
  const normalizePathToHandles = (clip: { id: string; points: Array<{ x: number; y: number }> } | null) => {
    if (!clip || !selectedLayerId) return clip?.points ?? []
    if (pathHandleIndices.length === 0) return clip.points
    if (pathHandleIndices.length === clip.points.length) return clip.points
    const compressed = pathHandleIndices.map((idx) => clip.points[idx]).filter(Boolean)
    timelineActions.updatePathClip(selectedLayerId, clip.id, { points: compressed })
    setPathHandleIndices(compressed.map((_, i) => i))
    return compressed
  }

  const insertPointIntoPath = (x: number, y: number) => {
    if (!currentPathClip || !selectedLayerId) return
    console.log('[path] insertPointIntoPath', { x, y, clipId: currentPathClip.id })
    const normalizedPoints = normalizePathToHandles(currentPathClip)
    const pts = [...normalizedPoints]
    let insertIdx = pts.length
    if (pts.length === 0) {
      pts.push({ x, y })
      insertIdx = 0
    } else if (pts.length === 1) {
      pts.push({ x, y })
      insertIdx = 1
    } else {
      let bestIdx = 0
      let bestDist = Infinity
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]
        const b = pts[i + 1]
        const abx = b.x - a.x
        const aby = b.y - a.y
        const apx = x - a.x
        const apy = y - a.y
        const abLen2 = abx * abx + aby * aby
        const t = abLen2 === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLen2))
        const projX = a.x + abx * t
        const projY = a.y + aby * t
        const dx = x - projX
        const dy = y - projY
        const dist2 = dx * dx + dy * dy
        if (dist2 < bestDist) {
          bestDist = dist2
          bestIdx = i + 1
        }
      }
      insertIdx = bestIdx
      pts.splice(insertIdx, 0, { x, y })
    }
    // shift existing handle indices that are at/after the insert point
    const remappedHandles =
      pathHandleIndices.length > 0
        ? pathHandleIndices.map((idx) => (idx >= insertIdx ? idx + 1 : idx))
        : [0, Math.max(pts.length - 1, 0)]
    const nextHandles = Array.from(new Set([...remappedHandles, insertIdx].filter((n) => n >= 0))).sort((a, b) => a - b)
    timelineActions.updatePathClip(selectedLayerId, currentPathClip.id, { points: pts })
    setPathHandleIndices(nextHandles)
    setShowPathOverlay(true)
  }

    // DOM drag handler as a fallback for Pixi events
    useEffect(() => {
      if (!containerRef.current) return
      const handleMove = (e: PointerEvent) => {
        // translate whole path on right-drag
        if (pathTranslateRef.current && containerRef.current && currentPathClip && selectedLayerId) {
          const bounds = containerRef.current.getBoundingClientRect()
          const currentX = (e.clientX - bounds.left) / bounds.width
          const currentY = (e.clientY - bounds.top) / bounds.height
          const { startX, startY, origPoints } = pathTranslateRef.current
          const dx = currentX - startX
          const dy = currentY - startY
          const translated = origPoints.map((p) => ({ x: p.x + dx, y: p.y + dy }))
          timelineActions.updatePathClip(selectedLayerId, currentPathClip.id, { points: translated })
          return
        }
        if (pathDragIndexRef.current !== null && containerRef.current && pathDragClipRef.current) {
          const bounds = containerRef.current.getBoundingClientRect()
          const x = (e.clientX - bounds.left) / bounds.width
          const y = (e.clientY - bounds.top) / bounds.height
          const { layerId, clipId } = pathDragClipRef.current
            if (!layerId || !clipId) return
            const track = timelineTracks.find((t) => t.layerId === layerId)
            const clip = track?.paths?.find((p) => p.id === clipId)
            if (clip) {
              const normalizedPoints = pathHandleIndices.length === clip.points.length ? clip.points : pathHandleIndices.map((idx) => clip.points[idx]).filter(Boolean)
              const pts = [...normalizedPoints]
              pts[pathDragIndexRef.current] = { x, y }
              timelineActions.updatePathClip(layerId, clipId, { points: pts })
            }
          }
          if (!domDragRef.current || !containerRef.current) return
          const bounds = containerRef.current.getBoundingClientRect()
          const newX = e.clientX - bounds.left - domDragRef.current.offsetX
          const newY = e.clientY - bounds.top - domDragRef.current.offsetY
          const id = domDragRef.current.id
          const nx = bounds.width > 0 ? newX / bounds.width : 0
          const ny = bounds.height > 0 ? newY / bounds.height : 0
          onUpdateLayerPosition?.(id, nx, ny)
          const g = graphicsByIdRef.current[id]
          if (g) {
            g.x = newX
            g.y = newY
          }
        }
        const handleUp = () => {
          pathDragIndexRef.current = null
          pathDragClipRef.current = null
          pathTranslateRef.current = null
          domDragRef.current = null
        }
        window.addEventListener('pointermove', handleMove)
        window.addEventListener('pointerup', handleUp)
        return () => {
          window.removeEventListener('pointermove', handleMove)
          window.removeEventListener('pointerup', handleUp)
        }
      }, [onUpdateLayerPosition, timelineTracks, timelineActions])

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
    
    // We need to define the ticker callback variable so we can remove it later
    let tickerCallback: ((ticker: PIXI.Ticker) => void) | null = null
    const centerX = screenWidth / 2
    const centerY = screenHeight / 2
    const tickerCallbacks: Array<(ticker: PIXI.Ticker) => void> = []
    graphicsByIdRef.current = {}
    const templateEnabled = false

  const handlePointerMove = (e: PIXI.FederatedPointerEvent) => {
      if (!dragRef.current) return
      const { id, offsetX, offsetY } = dragRef.current
      const pos = e.global
      const newX = pos.x - offsetX
      const newY = pos.y - offsetY
      const g = graphicsByIdRef.current[id]
      if (g) {
        g.x = newX
        g.y = newY
      }
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
      if (dragRef.current) return
    }
    stage.on('pointerdown', handleStagePointerDown)
    stage.on('pointerup', clearDrag)
    stage.on('pointerupoutside', clearDrag)

    // If there are layers, render/animate them and skip the built-in preview
    if (layers.length > 0) {
      layers.forEach((layer) => {
        const g = new PIXI.Graphics()
        g.circle(0, 0, layer.width / 2)
        g.fill(layer.fillColor)
        // add a small notch so roll rotation is visible
        if (templateEnabled && template === 'roll') {
          g.moveTo(0, -layer.width / 2)
          g.lineTo(0, -layer.width / 3)
          g.stroke({ color: 0x000000, width: 6, alpha: 0.8 })
        }
        g.pivot.set(layer.width / 2, layer.height / 2)
        const posX = layer.x <= 1 ? layer.x * screenWidth : layer.x
        const posY = layer.y <= 1 ? layer.y * screenHeight : layer.y
        g.x = posX
        g.y = posY
        g.interactive = true
        g.eventMode = 'dynamic'
        g.cursor = 'pointer'
        g.hitArea = new PIXI.Circle(0, 0, layer.width / 2)
        g.on('pointerdown', (e) => {
          e.stopPropagation()
          const pos = e.global
          onSelectLayer?.(layer.id)
          dragRef.current = {
            id: layer.id,
            offsetX: pos.x - g.x,
            offsetY: pos.y - g.y,
          }
          stage.cursor = 'grabbing'
        })
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
          if (progress >= 1) notifyComplete()
        }
    }

    // Add the ticker if we have one
    if (tickerCallback) {
        app.ticker.add(tickerCallback)
        app.ticker.start()
    }

    // render first frame immediately so users see instant feedback on template switch
    app.render()

    // Cleanup function for this effect
    return () => {
        if (tickerCallback) {
            app.ticker.remove(tickerCallback)
        }
        stage.removeChildren()
        stage.off('pointermove', handlePointerMove)
        stage.off('pointerup', clearDrag)
        stage.off('pointerupoutside', clearDrag)
        stage.off('pointerdown', handleStagePointerDown)
    }

  }, [template, templateVersion, pathVersion, pathLayerId, activePathPoints, isReady]) // Re-run on template/path switches; layer moves are handled directly

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-gray-900" onPointerDown={handleCanvasPointerDown}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          opacity: 0.6,
        }}
      />
      <div ref={containerRef} className="h-full w-full" />
      {/* Path draw overlay */}
      {isDrawingPath && (
        <div
          className="absolute inset-0 cursor-crosshair"
          style={{ zIndex: 20 }}
          onPointerDown={(e) => {
            if (!containerRef.current) return
            const bounds = containerRef.current.getBoundingClientRect()
            const x = (e.clientX - bounds.left) / bounds.width
            const y = (e.clientY - bounds.top) / bounds.height
            pathTraceActiveRef.current = true
            lastPathPointRef.current = { x, y }
            onAddPathPoint?.(x, y)
          }}
          onPointerMove={(e) => {
            if (!pathTraceActiveRef.current || !containerRef.current) return
            const bounds = containerRef.current.getBoundingClientRect()
            const x = (e.clientX - bounds.left) / bounds.width
            const y = (e.clientY - bounds.top) / bounds.height
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
            const x = (e.clientX - bounds.left) / bounds.width
            const y = (e.clientY - bounds.top) / bounds.height
            onAddPathPoint?.(x, y)
            pathTraceActiveRef.current = false
            onFinishPath?.()
          }}
        >
          <svg className="h-full w-full" style={{ pointerEvents: 'none' }}>
            {(() => {
              if (!containerRef.current || pathPoints.length === 0) return null
              const bounds = containerRef.current.getBoundingClientRect()
              const toPx = (pt: { x: number; y: number }) => ({
                x: pt.x * bounds.width,
                y: pt.y * bounds.height,
              })
            const pts = pathPoints.map(toPx)
            const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
            return (
              <>
                <path d={d} stroke="#22c55e" strokeWidth={2} fill="none" data-path-element="true" />
              </>
            )
         })()}
        </svg>
       </div>
     )}
      {!isDrawingPath && currentPathClip && showPathOverlay && (
        <div className="absolute inset-0" style={{ zIndex: 25, pointerEvents: 'none' }}>
          <svg className="h-full w-full" style={{ pointerEvents: 'auto' }}>
            {(() => {
              if (!containerRef.current || currentPathClip.points.length === 0) return null
              const bounds = containerRef.current.getBoundingClientRect()
              const toPx = (pt: { x: number; y: number }) => ({
                x: pt.x * bounds.width,
                y: pt.y * bounds.height,
              })
              const pts = currentPathClip.points.map(toPx)
              const defaultHandles = pts.length > 1 ? [0, pts.length - 1] : pts.length === 1 ? [0] : []
              const handles = pathHandleIndices.length > 0 ? pathHandleIndices : defaultHandles
              const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
              return (
                <>
                  <path
                    d={d}
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="none"
                    data-path-element="true"
                    style={{ pointerEvents: 'auto', cursor: 'crosshair' }}
                    onPointerDown={(e) => {
                      e.preventDefault()
                      // right-click drag translates the whole path without adding a node
                      if (e.button === 2) {
                        if (!containerRef.current || !currentPathClip) return
                        const boundsPath = containerRef.current.getBoundingClientRect()
                        const startX = (e.clientX - boundsPath.left) / boundsPath.width
                        const startY = (e.clientY - boundsPath.top) / boundsPath.height
                        pathTranslateRef.current = {
                          startX,
                          startY,
                          origPoints: [...currentPathClip.points],
                        }
                        return
                      }
                      if (e.button !== 0) return
                      if (!containerRef.current) return
                      const boundsPath = containerRef.current.getBoundingClientRect()
                      const x = (e.clientX - boundsPath.left) / boundsPath.width
                      const y = (e.clientY - boundsPath.top) / boundsPath.height
                      console.log('[path] insert handle at', { x, y })
                      insertPointIntoPath(x, y)
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                  {pts.map((p, i) =>
                    handles.includes(i) ? (
                      <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={6}
                        fill="#22c55e"
                        stroke="#0f172a"
                        strokeWidth={2}
                        data-path-element="true"
                        data-path-handle="true"
                        style={{ pointerEvents: 'auto', cursor: 'grab' }}
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          pathDragIndexRef.current = i
                          pathDragClipRef.current = { layerId: selectedLayerId ?? '', clipId: currentPathClip.id }
                        }}
                      />
                    ) : null
                  )}
                </>
              )
            })()}
          </svg>
        </div>
      )}
      {/* DOM overlay for layers so a shape is always visible; mimic template motion with CSS AND enable dragging */}
      {layers.length > 0 && (
        <div
          className="absolute inset-0"
          style={{ pointerEvents: isDrawingPath ? 'none' : undefined }}
        >
          {layers.map((layer) => {
        const bounds = containerRef.current?.getBoundingClientRect()
        const screenWidth = bounds?.width || 1
        const screenHeight = bounds?.height || 1
        const sampled = sampledTimeline[layer.id]
        const baseX = sampled ? sampled.position.x : layer.x
        const baseY = sampled ? sampled.position.y : layer.y
        const posX = baseX <= 1 ? baseX * screenWidth : baseX
        const posY = baseY <= 1 ? baseY * screenHeight : baseY
        return (
              <div
                key={layer.id}
                style={{
                  position: 'absolute',
                  left: posX,
              top: posY,
              width: layer.width,
              height: layer.height,
              transform: `translate(-50%, -50%) scale(${sampled?.scale ?? 1}) rotate(${sampled?.rotation ?? 0}rad)`,
              background: '#fff',
              borderRadius: '50%',
              opacity: sampled?.opacity ?? 0.9,
              outline: selectedLayerId === layer.id ? '1px solid #d1d5db' : undefined,
              outlineOffset: '1px',
              touchAction: 'none',
              userSelect: 'none',
                  cursor: 'grab',
                  '--shape-id': layer.id,
                } as React.CSSProperties}
                data-shape-element="true"
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                onPointerDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const boundsNow = containerRef.current?.getBoundingClientRect()
                  if (!boundsNow) return
                  onSelectLayer?.(layer.id)
                  const offsetX = e.clientX - boundsNow.left - posX
                  const offsetY = e.clientY - boundsNow.top - posY
                  domDragRef.current = { id: layer.id, offsetX, offsetY }
                }}
              />
            )
          })}
        </div>
      )}

      {/* Fallback DOM previews removed; timeline drives all motion */}
    </div>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import * as PIXI from 'pixi.js'
import 'pixi.js/app' // ensure Application plugins (ticker/resize) are registered
import 'pixi.js/events' // enable pointer events
import { sampleTimeline, sampleTimelineUnified, ClipInfo } from '@/lib/timeline'
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
  // Separate callbacks for independent line/path handling
  onFinishLine?: (start: { x: number; y: number }, end: { x: number; y: number }) => void
  onAddCustomPathPoint?: (x: number, y: number) => void
  onFinishCustomPath?: () => void
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
    mode: 'transparent' | 'solid' | 'gradient' | 'image'
    solid: string
    from: string
    to: string
    opacity: number
    gradientType?: 'linear' | 'radial'
    gradientPosition?: number
    image?: string
    imageMode?: 'cover' | 'contain' | 'stretch'
  }
  viewportWidth?: number
  viewportHeight?: number
  offsetX?: number
  offsetY?: number
  popReappear?: boolean
  onCanvasBackgroundClick?: () => void
  onUpdateLayerScale?: (id: string, scale: number) => void
  onUpdateLayerSize?: (id: string, width: number, height: number) => void
  // Pan/Zoom region editing
  selectedClipId?: string
  onUpdatePanZoomRegions?: (clipId: string, targetRegion: PanZoomRegion) => void
  // Roll visualization
  selectedTemplate?: string
  rollDistance?: number
  onRollDistanceChange?: (distance: number) => void
  // Jump visualization
  jumpHeight?: number
  onJumpHeightChange?: (height: number) => void
  // Export support - provides canvas access and UI control functions
  onCanvasReady?: (
    canvas: HTMLCanvasElement, 
    render: () => void, 
    hideHandles: () => void,
    showHandles: () => void,
    resetStagePosition: () => void,
    restoreStagePosition: () => void,
    resizeForExport: (width: number, height: number) => void,
    restoreFromExport: () => void
  ) => void
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
  onFinishLine?: (start: { x: number; y: number }, end: { x: number; y: number }) => void
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
  onFinishLine,
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
    // Use separate onFinishLine if available, otherwise fall back to onFinishPath
    if (onFinishLine) {
      onFinishLine(start, end)
    } else {
      onFinishPath?.([start, end])
    }
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

export default function MotionCanvas({ template, templateVersion, layers = [], layerOrder = [], onUpdateLayerPosition, onUpdateLayerSize, onTemplateComplete, isDrawingPath = false, isDrawingLine = false, pathPoints = [], onAddPathPoint, onFinishPath, onFinishLine, onAddCustomPathPoint, onFinishCustomPath, onSelectLayer, selectedLayerId, activePathPoints = [], pathVersion = 0, pathLayerId, onPathPlaybackComplete, onUpdateActivePathPoint, onClearPath, onInsertPathPoint, background: _background, viewportWidth = 640, viewportHeight = 360, offsetX = 0, offsetY = 0, popReappear = false, onCanvasBackgroundClick, selectedClipId, onUpdatePanZoomRegions, onCanvasReady, selectedTemplate, rollDistance = 0.3, onRollDistanceChange, jumpHeight = 0.2, onJumpHeightChange }: MotionCanvasProps) {
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

  // Keep selectedLayerIdRef in sync with prop for per-frame handle positioning
  useEffect(() => {
    selectedLayerIdRef.current = selectedLayerId
  }, [selectedLayerId])


  // ... (rest of component)
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const graphicsByIdRef = useRef<Record<string, PIXI.Graphics>>({})
  // Export dimensions override - when set, updateGraphicsFromTimeline uses these instead of container bounds
  const exportDimensionsRef = useRef<{ width: number; height: number } | null>(null)
  const maskGraphicsByIdRef = useRef<Record<string, PIXI.Graphics>>({})
  const outlinesByIdRef = useRef<Record<string, PIXI.Graphics>>({})
  const filtersByLayerIdRef = useRef<Record<string, PIXI.Filter[]>>({})
  const emittersByLayerIdRef = useRef<Record<string, SimpleParticleEmitter[]>>({})
  const iconTextureCacheRef = useRef<Record<string, PIXI.Texture>>({})
  const spritesByIdRef = useRef<Record<string, PIXI.Sprite>>({})
  const textsByIdRef = useRef<Record<string, { text: PIXI.Text; fullText: string; layerId: string; hasTypewriter: boolean; parts?: PIXI.Text[]; originalChars?: string[] }>>({})
  const resizeHandlesRef = useRef<Record<string, PIXI.Graphics[]>>({})
  const allHandlesRef = useRef<PIXI.Graphics[]>([]) // Strict tracking of ALL created handles for cleanup
  const selectedLayerIdRef = useRef<string | undefined>(undefined) // Track selected layer for per-frame sync
  const isPlayingRef = useRef<boolean>(false) // Track playing state for ticker callback
  const playheadRef = useRef<number>(0) // Track playhead for timeline-based handle visibility
  const timelineTracksRef = useRef<any[]>([]) // Track timeline tracks for visibility check
  const handlesOverlayRef = useRef<PIXI.Container | null>(null) // Overlay container for handles (doesn't inherit shape transforms)
  const handlesByIdRef = useRef<Record<string, PIXI.Graphics[]>>({}) // For text layer resize handles
  const spotlightOverlayRef = useRef<PIXI.Graphics | null>(null) // For pan_zoom spotlight blur effect
  // Ref to store updateGraphicsFromTimeline function for calling from restoreFromExport
  const updateGraphicsFnRef = useRef<(() => void) | null>(null)
  // Track layer dimensions, color, and rotation to detect changes from control panel
  const layerDimensionsRef = useRef<Record<string, { width: number; height: number; fillColor: number; rotation: number }>>({})
  // Background rendering refs
  const bgContainerRef = useRef<PIXI.Container | null>(null)
  const bgGraphicsRef = useRef<PIXI.Graphics | null>(null)
  const bgMaskRef = useRef<PIXI.Graphics | null>(null)
  const bgSpriteRef = useRef<PIXI.Sprite | null>(null)
  const bgTextureRef = useRef<PIXI.Texture | null>(null)
  const bgImageUrlRef = useRef<string | null>(null) // Track loaded image URL to avoid reloading on resize
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
  
  // Refs to keep callbacks stable for event listeners (fixes stale closure issue)
  const onJumpHeightChangeRef = useRef(onJumpHeightChange)
  const onRollDistanceChangeRef = useRef(onRollDistanceChange)
  
  // Keep callback refs in sync with props
  useEffect(() => {
    onJumpHeightChangeRef.current = onJumpHeightChange
  }, [onJumpHeightChange])
  
  useEffect(() => {
    onRollDistanceChangeRef.current = onRollDistanceChange
  }, [onRollDistanceChange])
  
  // Keep playhead and timeline tracks refs in sync for per-frame handle visibility
  useEffect(() => {
    playheadRef.current = playhead
  }, [playhead])
  
  useEffect(() => {
    timelineTracksRef.current = timelineTracks
  }, [timelineTracks])
  // Convert template clips to ClipInfo for unified sampling
  const clipInfos: ClipInfo[] = useMemo(() => 
    templateClips.map(c => ({ 
      id: c.id, 
      layerId: c.layerId,
      template: c.template,
      start: c.start ?? 0, 
      duration: c.duration ?? 1000 
    })),
    [templateClips]
  )
  // Create per-layer base states map from actual layer state (position, rotation, scale, color from right panel)
  const layerBaseStates = useMemo(() => {
    const map: Record<string, { x: number; y: number; rotation?: number; scale?: number; color?: number }> = {}
    layers.forEach(layer => {
      // Convert rotation from degrees (UI) to radians (animation system)
      const rotationDegrees = layer.rotation ?? 0
      const rotationRadians = rotationDegrees * (Math.PI / 180)
      map[layer.id] = { 
        x: layer.x, 
        y: layer.y,
        rotation: rotationRadians,  // Angle in radians for animation system
        scale: layer.scale ?? 1,    // Scale from right panel (if applicable)
        color: layer.fillColor      // Color from right panel
      }
    })
    return map
  }, [layers])
  const sampledTimeline = useMemo(
    () => sampleTimelineUnified(timelineTracks, clipInfos, playhead, undefined, layerBaseStates),
    [timelineTracks, clipInfos, playhead, layerBaseStates]
  )
  const timelineActions = useTimelineActions()
  const isPlaying = useTimeline((s) => s.isPlaying)
  
  // Keep isPlayingRef in sync for ticker to check without triggering re-renders
  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])
  
  // Pan/Zoom region editing state
  const [panZoomActiveRegion, setPanZoomActiveRegion] = useState<'start' | 'end' | null>(null)
  
  // ANIMATION CACHE: Stores sampled frames for instant replay
  // Cache is invalidated when animation data changes
  const animationCacheRef = useRef<{
    version: number
    frames: Map<number, Record<string, any>>  // frameIndex -> sampledTimeline
    frameInterval: number  // ms per frame (e.g., 16.67 for 60fps)
  }>({
    version: 0,
    frames: new Map(),
    frameInterval: 1000 / 60  // 60fps
  })
  
  // Track cache version based on animation-relevant data changes
  const cacheVersion = useMemo(() => {
    // Generate a hash based on ALL animation data including parameters
    // When this changes, cache becomes stale
    return JSON.stringify({
      tracks: timelineTracks.map(t => JSON.stringify(t)).join(','), // Full track data including clipKeyframes for resize, color, etc.
      clips: templateClips.map(c => JSON.stringify(c)).join(','), // Animations (roll, jump, etc.)
      effects: effectClips.map(c => JSON.stringify(c)).join(','), // Effects (glow, blur, etc.)
      markers: clickMarkers.map(m => `${m.id}:${m.time}:${m.layerId}`).join(','), // Click markers
      layers: layers.map(l => `${l.id}:${l.x}:${l.y}:${l.scale}:${l.rotation}:${l.fillColor}`).join(',')
    })
  }, [timelineTracks, templateClips, effectClips, clickMarkers, layers])
  
  // Invalidate cache when version changes
  useEffect(() => {
    animationCacheRef.current = {
      version: animationCacheRef.current.version + 1,
      frames: new Map(),
      frameInterval: 1000 / 60
    }
  }, [cacheVersion])

  
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
    
    // Get paths from new templateClips format
    const pathsFromTemplateClips = templateClips
      .filter(c => c.layerId === selectedLayerId && c.template === 'path' && c.parameters?.pathPoints)
      .map(c => ({
        id: c.id,
        layerId: c.layerId,
        points: c.parameters!.pathPoints as Array<{ x: number; y: number }>,
        startTime: c.start ?? 0,
        duration: c.duration ?? 1000,
      }))
    
    // Also check old timelineTracks format for backward compatibility
    const track = timelineTracks.find((t) => t.layerId === selectedLayerId)
    const pathsFromTracks = (track?.paths ?? []).map(p => ({
      ...p,
      layerId: selectedLayerId
    }))
    
    // Combine both, preferring templateClips format
    return pathsFromTemplateClips.length > 0 ? pathsFromTemplateClips : pathsFromTracks
  }, [timelineTracks, templateClips, selectedLayerId])
  
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
        // ALSO sync handle positions every frame for the selected layer (like Jitter/Figma)
        app.ticker.add(() => {
          // Skip handle sync during playback - handles are hidden
          if (isPlayingRef.current) return
          
          // Sync handles every frame if there's a selected layer
          if (selectedLayerIdRef.current && graphicsByIdRef.current[selectedLayerIdRef.current]) {
            const layerId = selectedLayerIdRef.current
            const g = graphicsByIdRef.current[layerId]
            const layer = layersRef.current.find(l => l.id === layerId)
            if (g && layer && handlesOverlayRef.current) {
              // Check if layer is visible at current playhead position
              const layerTrack = timelineTracksRef.current.find((t: any) => t.layerId === layerId)
              const layerStart = layerTrack?.startTime ?? 0
              const layerDuration = layerTrack?.duration ?? 2000
              const currentPlayhead = playheadRef.current
              const isLayerVisible = currentPlayhead >= layerStart && currentPlayhead <= layerStart + layerDuration
              
              const outline = outlinesByIdRef.current[layerId]
              const handles = resizeHandlesRef.current[layerId]
              
              if (!isLayerVisible) {
                // Hide handles when layer is not visible on timeline
                if (outline) outline.visible = false
                if (handles) handles.forEach(h => h.visible = false)
              } else {
                // Layer is visible - show and position handles
                const localPos = { x: g.x, y: g.y }
                const rotation = g.rotation
                
                // For TEXT layers: use layer dimensions directly (text doesn't use scale for sizing)
                // For other shapes: use animated dimensions from graphics scale
                let animatedWidth: number
                let animatedHeight: number
                
                if (layer.type === 'text') {
                  // Text uses wordWrapWidth, not scale - get actual rendered text bounds
                  const textWrapper = textsByIdRef.current[layer.id]
                  if (textWrapper?.text) {
                    // Use actual rendered text dimensions for accurate handle positioning
                    animatedWidth = Math.max(layer.width, textWrapper.text.width)
                    animatedHeight = Math.max(layer.height, textWrapper.text.height)
                  } else {
                    animatedWidth = layer.width
                    animatedHeight = layer.height
                  }
                } else {
                  const scaleX = g.scale.x
                  const scaleY = g.scale.y
                  animatedWidth = layer.width * Math.abs(scaleX)
                  animatedHeight = layer.height * Math.abs(scaleY)
                }
                
                const halfW = animatedWidth / 2
                const halfH = animatedHeight / 2
                
                // Update outline with animated dimensions and rotation
                if (outline) {
                  outline.visible = true
                  outline.x = localPos.x
                  outline.y = localPos.y
                  outline.rotation = rotation // Apply shape's rotation to outline
                  // Redraw at animated size
                  outline.clear()
                  outline.rect(-halfW, -halfH, animatedWidth, animatedHeight)
                  outline.stroke({ color: layer.type === 'text' ? 0xA855F7 : 0x9333ea, width: 2, alpha: 1 })
                }
                
                // Update handle positions with animated dimensions and rotation
                if (handles && handles.length === 8) {
                  const cos = Math.cos(rotation)
                  const sin = Math.sin(rotation)
                  
                  // Rotate a point around origin
                  const rotatePoint = (x: number, y: number) => ({
                    x: x * cos - y * sin,
                    y: x * sin + y * cos
                  })
                  
                  const cornerOffsets = [
                    { x: -halfW, y: -halfH }, { x: halfW, y: -halfH },
                    { x: halfW, y: halfH }, { x: -halfW, y: halfH }
                  ]
                  const edgeOffsets = [
                    { x: 0, y: -halfH }, { x: 0, y: halfH },
                    { x: -halfW, y: 0 }, { x: halfW, y: 0 }
                  ]
                  // Corners - rotate around center
                  for (let i = 0; i < 4; i++) {
                    const rotated = rotatePoint(cornerOffsets[i].x, cornerOffsets[i].y)
                    handles[i].visible = true
                    handles[i].x = localPos.x + rotated.x
                    handles[i].y = localPos.y + rotated.y
                  }
                  // Edges - also rotate and redraw at animated size
                  const edgeThickness = 1
                  for (let i = 4; i < 8; i++) {
                    const rotated = rotatePoint(edgeOffsets[i - 4].x, edgeOffsets[i - 4].y)
                    handles[i].visible = true
                    handles[i].x = localPos.x + rotated.x
                    handles[i].y = localPos.y + rotated.y
                    handles[i].rotation = rotation // Rotate edge handles too
                    handles[i].clear()
                    if (i === 4 || i === 5) { // t, b - horizontal edges
                      handles[i].rect(-animatedWidth / 2, -edgeThickness / 2, animatedWidth, edgeThickness)
                    } else { // l, r - vertical edges
                      handles[i].rect(-edgeThickness / 2, -animatedHeight / 2, edgeThickness, animatedHeight)
                    }
                    handles[i].fill(layer.type === 'text' ? 0xA855F7 : 0x9333ea)
                  }
                }
              }
            }
          }
          app.render()
        })
        
        // Create background container (at bottom, zIndex 0)
        const bgContainer = new PIXI.Container()
        bgContainer.zIndex = -1000  // Always at bottom
        app.stage.addChild(bgContainer)
        bgContainerRef.current = bgContainer
        
        // Create background graphics for solid/gradient fills
        const bgGraphics = new PIXI.Graphics()
        bgContainer.addChild(bgGraphics)
        bgGraphicsRef.current = bgGraphics
        
        // Create handles overlay container (always on top, doesn't inherit shape transforms)
        const handlesOverlay = new PIXI.Container()
        handlesOverlay.sortableChildren = true
        handlesOverlay.zIndex = 1000  // Always on top of shapes
        app.stage.addChild(handlesOverlay)
        handlesOverlayRef.current = handlesOverlay
        app.stage.sortableChildren = true  // Enable zIndex sorting on stage
        
        setIsReady(true)
        
        // Expose canvas for export functionality
        if (onCanvasReady) {
          // Function to hide all selection outlines and resize handles
          const hideHandles = () => {
            // Hide entire handles overlay container (most robust approach)
            if (handlesOverlayRef.current) {
              handlesOverlayRef.current.visible = false
            }
            // Also hide individual handles (belt and suspenders)
            Object.values(outlinesByIdRef.current).forEach(outline => {
              if (outline) outline.visible = false
            })
            Object.values(resizeHandlesRef.current).forEach(handles => {
              if (handles) handles.forEach(h => h.visible = false)
            })
            app.render()
          }
          
          // Function to restore handle visibility based on selection
          const showHandles = () => {
            // Restore entire handles overlay container visibility
            if (handlesOverlayRef.current) {
              handlesOverlayRef.current.visible = true
            }
            Object.entries(outlinesByIdRef.current).forEach(([id, outline]) => {
              if (outline) outline.visible = selectedLayerId === id
            })
            Object.entries(resizeHandlesRef.current).forEach(([id, handles]) => {
              if (handles) handles.forEach(h => h.visible = selectedLayerId === id)
            })
            app.render()
          }
          
          // Store current stage position for restore
          let savedStageX = 0
          let savedStageY = 0
          
          // Function to reset stage position to (0,0) for export
          const resetStagePosition = () => {
            if (app.stage) {
              savedStageX = app.stage.position.x
              savedStageY = app.stage.position.y
              app.stage.position.set(0, 0)
              app.render()
            }
          }
          
          // Function to restore stage position after export
          const restoreStagePosition = () => {
            if (app.stage) {
              app.stage.position.set(savedStageX, savedStageY)
              app.render()
            }
          }
          
          // Store original canvas dimensions for restore (LOGICAL dimensions, not physical)
          // app.canvas.width is scaled by devicePixelRatio, but renderer.resize() expects logical dimensions
          const dpr = window.devicePixelRatio || 1
          let savedLogicalWidth = app.canvas.width / dpr
          let savedLogicalHeight = app.canvas.height / dpr
          let savedCSSWidth = app.canvas.style.width
          let savedCSSHeight = app.canvas.style.height
          
          // Function to resize PIXI renderer to exact export dimensions
          const resizeForExport = (width: number, height: number) => {
            // Save current LOGICAL dimensions (divide by DPR since canvas.width is scaled)
            savedLogicalWidth = app.canvas.width / dpr
            savedLogicalHeight = app.canvas.height / dpr
            savedCSSWidth = app.canvas.style.width
            savedCSSHeight = app.canvas.style.height
            
            // Save current stage position BEFORE resetting to 0,0
            savedStageX = app.stage.position.x
            savedStageY = app.stage.position.y
            
            // Set export dimensions for updateGraphicsFromTimeline to use
            exportDimensionsRef.current = { width, height }
            
            // Resize the renderer to exact export dimensions
            app.renderer.resize(width, height)
            
            // Update canvas CSS to match
            app.canvas.style.width = `${width}px`
            app.canvas.style.height = `${height}px`
            
            // Reset stage position to (0,0) so content is centered
            app.stage.position.set(0, 0)
            
            // Recalculate background for export dimensions
            // During export, canvas = viewport, so background should be at (0,0)
            if (bgMaskRef.current) {
              bgMaskRef.current.clear()
              bgMaskRef.current.rect(0, 0, width, height)
              bgMaskRef.current.fill({ color: 0xffffff })
            }
            
            // Redraw solid background at (0,0) for export
            if (bgGraphicsRef.current && _background && _background.mode === 'solid') {
              bgGraphicsRef.current.clear()
              const color = parseInt(_background.solid.replace('#', ''), 16)
              bgGraphicsRef.current.rect(0, 0, width, height)
              bgGraphicsRef.current.fill({ color, alpha: _background.opacity ?? 1 })
            }
            
            // Reposition background sprite at (0,0) for export (gradient/image backgrounds)
            if (bgSpriteRef.current) {
              bgSpriteRef.current.x = 0
              bgSpriteRef.current.y = 0
            }
            
            app.render()
          }
          
          // Function to restore original canvas dimensions after export
          const restoreFromExport = () => {
            // Clear export dimensions override
            exportDimensionsRef.current = null
            
            // Restore renderer to original LOGICAL dimensions
            // renderer.resize() takes logical dimensions and applies devicePixelRatio internally
            app.renderer.resize(savedLogicalWidth, savedLogicalHeight)
            
            // Restore CSS dimensions
            app.canvas.style.width = savedCSSWidth
            app.canvas.style.height = savedCSSHeight
            
            // Restore stage position
            app.stage.position.set(savedStageX, savedStageY)
            
            // Recalculate content positions with container dimensions
            updateGraphicsFnRef.current?.()
            
            app.render()
          }
          
          onCanvasReady(
            app.canvas as HTMLCanvasElement, 
            () => app.render(),
            hideHandles,
            showHandles,
            resetStagePosition,
            restoreStagePosition,
            resizeForExport,
            restoreFromExport
          )
        }
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

  // BACKGROUND RENDERING EFFECT
  // Renders solid/gradient/image backgrounds using PIXI
  useEffect(() => {
    if (!appRef.current || !isReady || !bgGraphicsRef.current) {
      return
    }
    
    const app = appRef.current
    const bgGraphics = bgGraphicsRef.current
    const bgContainer = bgContainerRef.current
    
    // Ensure bgContainer is attached to stage
    if (bgContainer && !bgContainer.parent) {
      bgContainer.zIndex = -1000
      app.stage.addChildAt(bgContainer, 0) // Add at index 0 (bottom)
    }
    
    // Use viewport dimensions from props
    const width = viewportWidth
    const height = viewportHeight
    
    // Calculate viewport position in stage coordinates
    // The viewport is centered in the workspace. When stage pans, we want the background
    // to move WITH the viewport (appear fixed on screen in the viewport area).
    //
    // Math: 
    // - Stage position = (offsetX, offsetY) - this is the panning offset
    // - Child at (x, y) appears at screen position (x + offsetX, y + offsetY)
    // - Viewport top-left on screen = (workspaceWidth/2 + offsetX - width/2, workspaceHeight/2 + offsetY - height/2)
    // - For child to appear at viewport top-left: x + offsetX = workspaceWidth/2 + offsetX - width/2
    // - Solving: x = (workspaceWidth - width) / 2  (offsetX cancels out!)
    //
    // This means the background position in STAGE space is CONSTANT and doesn't depend on panning.
    // The panning is handled by the stage.position, which moves all children together.
    const container = containerRef.current
    const workspaceWidth = container?.clientWidth || 1200
    const workspaceHeight = container?.clientHeight || 800
    
    const bgX = (workspaceWidth - width) / 2
    const bgY = (workspaceHeight - height) / 2
    
    // Clear existing background
    bgGraphics.clear()
    
    // Create/update mask to clip background to viewport bounds
    if (!bgMaskRef.current && bgContainer) {
      const mask = new PIXI.Graphics()
      bgMaskRef.current = mask
      app.stage.addChild(mask) // Mask needs to be on stage
      bgContainer.mask = mask
    }
    
    // Update mask to match viewport position and size
    if (bgMaskRef.current) {
      bgMaskRef.current.clear()
      bgMaskRef.current.rect(bgX, bgY, width, height)
      bgMaskRef.current.fill({ color: 0xffffff })
    }
    
    // Check if we're in image mode and URL hasn't changed
    const currentImageUrl = _background?.mode === 'image' ? _background.image : null
    const imageUrlChanged = currentImageUrl !== bgImageUrlRef.current
    
    // Only destroy old sprite if switching modes or image URL changed
    if (imageUrlChanged || _background?.mode !== 'image') {
      if (bgSpriteRef.current && bgContainerRef.current) {
        bgContainerRef.current.removeChild(bgSpriteRef.current)
        bgSpriteRef.current.destroy()
        bgSpriteRef.current = null
      }
      
      if (bgTextureRef.current) {
        bgTextureRef.current.destroy(true)
        bgTextureRef.current = null
      }
      
      bgImageUrlRef.current = null
    }
    
    if (!_background || _background.mode === 'transparent') {
      // Transparent - no background needed
      app.render()
      return
    }
    
    if (_background.mode === 'solid') {
      // Solid color background
      const color = parseInt(_background.solid.replace('#', ''), 16)
      
      // Draw background at viewport position
      bgGraphics.rect(bgX, bgY, width, height)
      bgGraphics.fill({ color, alpha: _background.opacity ?? 1 })
    } else if (_background.mode === 'gradient') {
      // Gradient background - use a series of rects to approximate gradient
      const fromColor = parseInt(_background.from.replace('#', ''), 16)
      const toColor = parseInt(_background.to.replace('#', ''), 16)
      const steps = 64 // Number of gradient steps
      const isRadial = _background.gradientType === 'radial'
      const position = _background.gradientPosition ?? 0.5
      
      if (isRadial) {
        // Radial gradient - use canvas to create smooth gradient texture
        const gradCanvas = document.createElement('canvas')
        gradCanvas.width = width
        gradCanvas.height = height
        const ctx = gradCanvas.getContext('2d')
        if (ctx) {
          const centerX = width / 2
          const centerY = height / 2
          const maxRadius = Math.sqrt(width * width + height * height) / 2
          
          const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius)
          gradient.addColorStop(0, _background.from)
          gradient.addColorStop(position, _background.from)
          gradient.addColorStop(1, _background.to)
          
          ctx.fillStyle = gradient
          ctx.fillRect(0, 0, width, height)
          
          // Create PIXI texture from canvas
          const texture = PIXI.Texture.from(gradCanvas)
          bgTextureRef.current = texture
          
          // Create sprite
          const sprite = new PIXI.Sprite(texture)
          sprite.x = bgX
          sprite.y = bgY
          sprite.alpha = _background.opacity ?? 1
          
          if (bgContainerRef.current) {
            bgContainerRef.current.addChild(sprite)
            bgSpriteRef.current = sprite
          }
        }
      } else {
        // Linear gradient - use canvas to create smooth gradient texture
        const gradCanvas = document.createElement('canvas')
        gradCanvas.width = width
        gradCanvas.height = height
        const ctx = gradCanvas.getContext('2d')
        if (ctx) {
          // Create vertical gradient (top to bottom)
          const gradient = ctx.createLinearGradient(0, 0, 0, height)
          gradient.addColorStop(0, _background.from)
          gradient.addColorStop(position, _background.from)
          gradient.addColorStop(1, _background.to)
          
          ctx.fillStyle = gradient
          ctx.fillRect(0, 0, width, height)
          
          // Create PIXI texture from canvas
          const texture = PIXI.Texture.from(gradCanvas)
          bgTextureRef.current = texture
          
          // Create sprite
          const sprite = new PIXI.Sprite(texture)
          sprite.x = bgX
          sprite.y = bgY
          sprite.alpha = _background.opacity ?? 1
          
          if (bgContainerRef.current) {
            bgContainerRef.current.addChild(sprite)
            bgSpriteRef.current = sprite
          }
        }
      }
    } else if (_background.mode === 'image' && _background.image) {
      // Image background - load texture and create sprite
      const imageUrl = _background.image
      const imageMode = _background.imageMode || 'cover'
      
      // Helper function to apply sizing to sprite
      const applySpriteSize = (sprite: PIXI.Sprite, imgWidth: number, imgHeight: number) => {
        const imgAspect = imgWidth / imgHeight
        const viewportAspect = width / height
        
        // Reset position first
        sprite.x = bgX
        sprite.y = bgY
        
        if (imageMode === 'stretch') {
          sprite.width = width
          sprite.height = height
        } else if (imageMode === 'contain') {
          if (imgAspect > viewportAspect) {
            sprite.width = width
            sprite.height = width / imgAspect
            sprite.y = bgY + (height - sprite.height) / 2
          } else {
            sprite.height = height
            sprite.width = height * imgAspect
            sprite.x = bgX + (width - sprite.width) / 2
          }
        } else {
          // Cover
          if (imgAspect > viewportAspect) {
            sprite.height = height
            sprite.width = height * imgAspect
            sprite.x = bgX + (width - sprite.width) / 2
          } else {
            sprite.width = width
            sprite.height = width / imgAspect
            sprite.y = bgY + (height - sprite.height) / 2
          }
        }
      }
      
      // If sprite already exists with same image, just update size/position
      if (bgSpriteRef.current && bgTextureRef.current && bgImageUrlRef.current === imageUrl) {
        const texture = bgTextureRef.current
        applySpriteSize(bgSpriteRef.current, texture.width, texture.height)
        app.render()
        return
      }
      
      // Load new image
      const img = new Image()
      img.crossOrigin = 'anonymous'
      
      img.onerror = (err) => {
        console.error('Background image failed to load:', imageUrl?.substring(0, 100), err)
      }
      
      img.onload = () => {
        if (!bgContainerRef.current || !appRef.current) return
        
        // Create texture from image
        const texture = PIXI.Texture.from(img)
        bgTextureRef.current = texture
        bgImageUrlRef.current = imageUrl
        
        // Create sprite
        const sprite = new PIXI.Sprite(texture)
        bgSpriteRef.current = sprite
        
        // Apply sizing
        applySpriteSize(sprite, img.width, img.height)
        
        bgContainerRef.current.addChild(sprite)
        appRef.current.render()
      }
      img.src = imageUrl
    }
    
    app.render()
  }, [_background, viewportWidth, viewportHeight, isReady])

  // Apply timeline-sampled transforms onto Pixi graphics so playhead/scrub reflects on-canvas
  // Helper to update graphics from timeline state
  // Optional sampledData parameter for direct playback updates (bypasses React)
  
  // Sync handle positions to match shape's world position (Step 3 of overlay architecture)
  // This is called every frame for the selected layer to keep handles positioned correctly
  // Also ensures handles are visible when called
  const syncHandlePositions = (layerId: string) => {
    // Don't show/sync handles during animation playback
    if (isPlaying) return
    
    const g = graphicsByIdRef.current[layerId]
    const layer = layersRef.current.find(l => l.id === layerId)
    
    if (!g || !layer || !handlesOverlayRef.current) return
    
    // Both the shape (g) and the overlay are children of the same stage
    // So we can use the shape's position directly
    const localPos = { x: g.x, y: g.y }
    const rotation = g.rotation
    
    // For TEXT layers: use layer dimensions directly (text doesn't use scale for sizing)
    // For other shapes: use animated dimensions from graphics scale
    let animatedWidth: number
    let animatedHeight: number
    
    if (layer.type === 'text') {
      // Text uses wordWrapWidth, not scale - get actual rendered text bounds
      const textWrapper = textsByIdRef.current[layer.id]
      if (textWrapper?.text) {
        // Use actual rendered text dimensions for accurate handle positioning
        animatedWidth = Math.max(layer.width, textWrapper.text.width)
        animatedHeight = Math.max(layer.height, textWrapper.text.height)
      } else {
        animatedWidth = layer.width
        animatedHeight = layer.height
      }
    } else {
      // Get ANIMATED dimensions for handle positioning
      // Use the graphics object's scale to get the actual rendered size
      const scaleX = g.scale.x
      const scaleY = g.scale.y
      animatedWidth = layer.width * Math.abs(scaleX)
      animatedHeight = layer.height * Math.abs(scaleY)
    }
    
    const halfW = animatedWidth / 2
    const halfH = animatedHeight / 2
    
    // Update outline position, size, and rotation
    const outline = outlinesByIdRef.current[layerId]
    if (outline) {
      outline.visible = true // Ensure visible when syncing
      outline.x = localPos.x
      outline.y = localPos.y
      outline.rotation = rotation // Apply shape's rotation to outline
      // Redraw outline at correct size (uses animated dimensions)
      outline.clear()
      outline.rect(-halfW, -halfH, animatedWidth, animatedHeight)
      outline.stroke({ color: layer.type === 'text' ? 0xA855F7 : 0x9333ea, width: 2, alpha: 1 })
    }
    
    // Update handle positions (relative to shape center in world space)
    const handles = resizeHandlesRef.current[layerId]
    if (handles && handles.length === 8) {
      const cos = Math.cos(rotation)
      const sin = Math.sin(rotation)
      
      // Rotate a point around origin
      const rotatePoint = (x: number, y: number) => ({
        x: x * cos - y * sin,
        y: x * sin + y * cos
      })
      
      // Corner positions (relative to shape center, using animated dimensions)
      const cornerOffsets = [
        { x: -halfW, y: -halfH }, // tl
        { x: halfW, y: -halfH },  // tr
        { x: halfW, y: halfH },   // br
        { x: -halfW, y: halfH },  // bl
      ]
      // Edge positions (relative to shape center)  
      const edgeOffsets = [
        { x: 0, y: -halfH }, // t
        { x: 0, y: halfH },  // b
        { x: -halfW, y: 0 }, // l
        { x: halfW, y: 0 },  // r
      ]
      
      // Position and redraw corners (rotated around center)
      const cornerSize = 8
      for (let i = 0; i < 4; i++) {
        const h = handles[i]
        const rotated = rotatePoint(cornerOffsets[i].x, cornerOffsets[i].y)
        h.visible = true
        h.alpha = 1
        h.x = localPos.x + rotated.x
        h.y = localPos.y + rotated.y
        h.clear()
        h.rect(-cornerSize / 2, -cornerSize / 2, cornerSize, cornerSize)
        h.fill(layer.type === 'text' ? 0xA855F7 : 0x9333ea)
      }
      // Position and redraw edges (rotated, with correct animated dimensions)
      const edgeThickness = 1
      for (let i = 4; i < 8; i++) {
        const h = handles[i]
        const rotated = rotatePoint(edgeOffsets[i - 4].x, edgeOffsets[i - 4].y)
        h.visible = true // Ensure edges visible
        h.x = localPos.x + rotated.x
        h.y = localPos.y + rotated.y
        h.rotation = rotation // Rotate edge handles to match shape
        
        // Redraw edge handles at correct size (using animated dimensions)
        h.clear()
        if (i === 4 || i === 5) { // t, b - horizontal edges
          h.rect(-animatedWidth / 2, -edgeThickness / 2, animatedWidth, edgeThickness)
        } else { // l, r - vertical edges
          h.rect(-edgeThickness / 2, -animatedHeight / 2, edgeThickness, animatedHeight)
        }
        h.fill(layer.type === 'text' ? 0xA855F7 : 0x9333ea)
      }
    }
  }
  
  const updateGraphicsFromTimeline = (sampledData?: Record<string, any>, manualPlayhead?: number) => {
    if (!containerRef.current) return
    
    // During export, use export dimensions for positioning; otherwise use container bounds
    let screenWidth: number
    let screenHeight: number
    if (exportDimensionsRef.current) {
      screenWidth = exportDimensionsRef.current.width
      screenHeight = exportDimensionsRef.current.height
    } else {
      const bounds = containerRef.current.getBoundingClientRect()
      screenWidth = bounds.width || 1
      screenHeight = bounds.height || 1
    }
    
    // Use provided sampledData (for playback) or fall back to React's sampledTimeline
    const timelineData = sampledData || sampledTimeline
    const currentPlayhead = manualPlayhead ?? playhead
    
    renderLayers.forEach((layer, idx) => {
      const { id } = layer
      const state = timelineData[id]
      if (!state) {
        return
      }
      const g = graphicsByIdRef.current[id]
      if (!g) {
        return
      }
      
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
      
      const hasRotationAnim = (track?.rotation?.length ?? 0) > 1 ||
        // Also check clipKeyframes for unified sampling (rotation templates like roll/spin store keyframes there)
        Object.values(track?.clipKeyframes ?? {}).some(kf => (kf.rotation?.length ?? 0) > 0)
      const scaleFrames = track?.scale ?? []
      const hasScaleAnim =
        scaleFrames.length > 1 ||
        scaleFrames.some((kf) => kf.time !== 0 || Math.abs(kf.value - 1) > 1e-4)
      const hasOpacityAnim = (track?.opacity?.length ?? 0) > 1
      const defaultColor = layerData?.fillColor ?? 0xffffff
      const finalColor = state.color ?? defaultColor

      // Calculate final transform values
      // For scale: always multiply layer.scale by animation scale (which defaults to 1)
      // This allows "Grow In" (0->1) to become (0 -> layerScale)
      const scaleMultiplier = hasScaleAnim ? state.scale : 1
      const finalScale = scaleMultiplier * layerScale
      
      // For position: if animated, use timeline value. If not, use layer static position.
      // pan_zoom stores offsets in NORMALIZED coords (0-1 range), so multiply by screen size before adding to base.
      const hasPanZoom = templateClips.some(c => c.layerId === id && c.template === 'pan_zoom')
      const rawPos = hasPositionAnim
        ? hasPanZoom
          ? { 
              x: baseLayerPos.x + state.position.x * screenWidth, 
              y: baseLayerPos.y + state.position.y * screenHeight 
            }
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
      
      // Apply resize animation: if we have animated width/height, calculate scale from it
      // Resize animation works by scaling the shape based on the ratio of animated size to base size
      let resizeScaleX = 1
      let resizeScaleY = 1
      const baseWidth = layerData?.width ?? 100
      const baseHeight = layerData?.height ?? 100
      
      if (state.width !== undefined && baseWidth > 0) {
        resizeScaleX = state.width / baseWidth
      }
      if (state.height !== undefined && baseHeight > 0) {
        resizeScaleY = state.height / baseHeight
      }
      
      // Combine all scale factors: animation scale * layer scale * resize scale
      // For uniform scaling, use average of X and Y; for non-uniform use separate X/Y
      const hasResizeAnim = state.width !== undefined || state.height !== undefined
      
      // Get resize anchor from template clip
      const resizeClip = templateClips.find(c => c.layerId === id && c.template === 'resize')
      const resizeAnchor = resizeClip?.parameters?.resizeAnchor || 'middle'
      
      // RESIZE ANIMATION: Uses actual SCALING to stretch/shrink the shape
      // This allows the shape to visually exceed its base dimensions (no 100px barrier)
      // Always scales from center (pivot 0,0) to avoid snapping issues with path animation
      if (hasResizeAnim && g) {
        // Calculate scale factors based on animated vs base dimensions
        // Handle edge case: if base is 0, use 1 to avoid division by zero
        const safeBaseWidth = baseWidth > 0 ? baseWidth : 1
        const safeBaseHeight = baseHeight > 0 ? baseHeight : 1
        
        // Get animated dimensions (from keyframes - these are the actual target sizes in pixels)
        const animatedWidth = state.width ?? baseWidth
        const animatedHeight = state.height ?? baseHeight
        
        // For PILL shapes: redraw with new dimensions to maintain proper corner radius
        // Instead of scaling (which distorts the rounded corners), we redraw the shape
        const shapeKind = layerData?.shapeKind
        if (shapeKind === 'pill' && g instanceof PIXI.Graphics) {
          // Only redraw if dimensions actually changed (avoid unnecessary redraws)
          const lastDims = (g as any).__lastPillDims as { w: number, h: number } | undefined
          const needsRedraw = !lastDims || 
            Math.abs(lastDims.w - animatedWidth) > 0.1 || 
            Math.abs(lastDims.h - animatedHeight) > 0.1
          
          if (needsRedraw) {
            // Clear and redraw with correct corner radius
            g.clear()
            const pillRadius = Math.min(animatedWidth, animatedHeight) / 2
            g.roundRect(-animatedWidth / 2, -animatedHeight / 2, animatedWidth, animatedHeight, pillRadius)
            // Use white fill + tint approach to support color animation
            g.fill(0xffffff)
            g.tint = finalColor // Use animated color, not static layer color
            // Store dimensions to avoid unnecessary redraws
            ;(g as any).__lastPillDims = { w: animatedWidth, h: animatedHeight }
            // Store shape size for hit area
            ;(g as any).__shapeSize = { width: animatedWidth, height: animatedHeight }
          }
          // Apply uniform scale (just the layer scale, not resize scale since we redrew)
          g.scale.set(finalScale * layerScale)
        } else {
          // For other shapes: use non-uniform scale as before
          const scaleX = Math.max(0.01, animatedWidth / safeBaseWidth)
          const scaleY = Math.max(0.01, animatedHeight / safeBaseHeight)
          
          // Apply non-uniform scaling with overall layer scale
          const actualScaleX = finalScale * scaleX
          const actualScaleY = finalScale * scaleY
          g.scale.set(actualScaleX, actualScaleY)
        }
        
        // Calculate anchor offsets to simulate fixed edges
        // (Default is middle, so center stays fixed)
        let anchorOffsetX = 0
        let anchorOffsetY = 0
        
        if (resizeAnchor !== 'middle') {
          const diffX = animatedWidth - (layerData?.width || safeBaseWidth)
          const diffY = animatedHeight - (layerData?.height || safeBaseHeight)
          
          if (resizeAnchor === 'left') anchorOffsetX = diffX / 2 // Move center right
          else if (resizeAnchor === 'right') anchorOffsetX = -diffX / 2 // Move center left
          else if (resizeAnchor === 'top') anchorOffsetY = diffY / 2 // Move center down
          else if (resizeAnchor === 'bottom') anchorOffsetY = -diffY / 2 // Move center up
        }
        
        g.x += anchorOffsetX
        g.y += anchorOffsetY
        
        // Always use center pivot (0,0) - this ensures no snapping when animation ends
        // and works correctly with path animation
        g.pivot.set(0, 0)
        
        // Mark resize as active but disable mask approach (using scale-only)
        ;(g as any).__resizeProgress = { active: false }
      } else {
        // Clear resize progress flag and ensure uniform scale
        if (g) {
          (g as any).__resizeProgress = null
          g.pivot.set(0, 0)
          g.scale.set(finalScale)
          
          // For PILL shapes: if previously resized, redraw at base dimensions
          const shapeKind = layerData?.shapeKind
          if (shapeKind === 'pill' && g instanceof PIXI.Graphics) {
            const lastDims = (g as any).__lastPillDims as { w: number, h: number } | undefined
            const pillBaseWidth = layerData?.width ?? 100
            const pillBaseHeight = layerData?.height ?? 100
            
            // Only redraw if the pill was previously drawn at different dimensions
            if (lastDims && (Math.abs(lastDims.w - pillBaseWidth) > 0.1 || Math.abs(lastDims.h - pillBaseHeight) > 0.1)) {
              g.clear()
              const pillRadius = Math.min(pillBaseWidth, pillBaseHeight) / 2
              g.roundRect(-pillBaseWidth / 2, -pillBaseHeight / 2, pillBaseWidth, pillBaseHeight, pillRadius)
              g.fill(layerData?.fillColor ?? 0xffffff)
              ;(g as any).__lastPillDims = { w: pillBaseWidth, h: pillBaseHeight }
              ;(g as any).__shapeSize = { width: pillBaseWidth, height: pillBaseHeight }
            }
          }
          // Clear last pill dims cache when not animating
          ;(g as any).__lastPillDims = null
        }
      }
      
      // Calculate strict visibility based on timeline clips
      // If playhead < startTime or playhead > startTime + duration, alpha = 0
      const trackStartTime = track?.startTime ?? 0
      const trackDuration = track?.duration ?? 2000
      const isVisibleInTime = currentPlayhead >= trackStartTime && currentPlayhead <= trackStartTime + trackDuration
      
      let finalOpacity = state.opacity
      let transitionScale = 1
      let slideOffsetY: number | null = null // null = no slide, -1 to 1 = normalized Y offset
      let slideOffsetX: number | null = null // null = no slide, -1 to 1 = normalized X offset
      
      if (!isVisibleInTime) {
        finalOpacity = 0
      } else {
        // Check for unified transition clips that affect this layer
        // A transition clip can affect this layer as either:
        // 1. The "from" layer (layerId matches - gets fade OUT)
        // 2. The "to" layer (transitionToLayerId matches - gets fade IN)
        
        const transitionTemplates = ['transition_fade', 'transition_slide', 'transition_zoom', 'transition_blur']
        
        templateClips.forEach(clip => {
          if (!transitionTemplates.includes(clip.template)) return
          
          const clipStart = clip.start ?? 0
          const clipEnd = clipStart + (clip.duration ?? 1000)
          
          // Only process if playhead is within this transition
          if (currentPlayhead < clipStart || currentPlayhead > clipEnd) return
          
          const clipDuration = clip.duration ?? 1000
          const progress = Math.min(1, Math.max(0, (currentPlayhead - clipStart) / clipDuration))
          
          // Check if this layer is the "from" layer (fades OUT)
          if (clip.layerId === id) {
            // Apply fade OUT effect (1 -> 0)
            if (clip.template === 'transition_fade') {
              finalOpacity *= (1 - progress)
            } else if (clip.template === 'transition_zoom') {
              transitionScale *= (1 - progress * 0.5) // Scale down to 0.5
              finalOpacity *= (1 - progress)
            } else if (clip.template === 'transition_slide') {
              // Slide out
              const direction = clip.parameters?.slideDirection || 'top'
              
              if (direction === 'top') {
                slideOffsetY = -progress // Move UP (0 -> -1)
              } else if (direction === 'bottom') {
                slideOffsetY = progress // Move DOWN (0 -> 1)
              } else if (direction === 'left') {
                slideOffsetX = -progress // Move LEFT (0 -> -1)
              } else if (direction === 'right') {
                slideOffsetX = progress // Move RIGHT (0 -> 1)
              }
            } else if (clip.template === 'transition_blur') {
              // Blur out - apply blur filter that increases, opacity fades
              const blurStrength = progress * 15 // 0 to 15 blur
              const blurFilter = new PIXI.BlurFilter({ strength: blurStrength })
              if (!g.filters) g.filters = []
              // Add blur filter for this frame (will be cleared next frame)
              const existingFilters = Array.isArray(g.filters) ? g.filters.filter(f => !(f instanceof PIXI.BlurFilter)) : []
              g.filters = [...existingFilters, blurFilter]
              finalOpacity *= (1 - progress)
            }
          }
          
          // Check if this layer is the "to" layer (fades IN)
          if (clip.parameters?.transitionToLayerId === id) {
            // Apply fade IN effect (0 -> 1)
            if (clip.template === 'transition_fade') {
              finalOpacity *= progress
            } else if (clip.template === 'transition_zoom') {
              transitionScale *= (0.5 + progress * 0.5) // Scale from 0.5 to 1
              finalOpacity *= progress
            } else if (clip.template === 'transition_slide') {
              // Slide in
              const direction = clip.parameters?.slideDirection || 'top'
              
              if (direction === 'top') {
                slideOffsetY = 1 - progress // From BOTTOM to center (1 -> 0) - waits, "top" here means "enter FROM bottom moving to top"? No, usually matches "Slide Out Top" logic.
                // Standard convention: "Slide In Top" means "Enters FROM Top". 
                // But the default "Slide" implementation was:
                // Out: Moves UP (0 -> -1)
                // In: Moves UP from bottom (1 -> 0)
                // This implies the global flow is "Upwards".
                
                // Let's stick to the Direction meaning "The direction of movement".
                // Top: Moves Up.
                // Out Top: Moves Up (leaves top).
                // In Top: Moves Up (enters from bottom). wait, "In Top" usually means "Comes from Top".
                // Let's check the previous code: "Slide in - push up from below (1 -> 0, starts at bottom)"
                // This corresponds to "Move Up".
                
                // So if Direction = Top (Up):
                // Out: 0 -> -1 (Goes up)
                // In: 1 -> 0 (Comes from bottom, goes up)
                slideOffsetY = 1 - progress 
              } else if (direction === 'bottom') {
                // Direction = Bottom (Down):
                // Out: 0 -> 1 (Goes down)
                // In: -1 -> 0 (Comes from top, goes down)
                slideOffsetY = -(1 - progress) 
              } else if (direction === 'left') {
                // Direction = Left:
                // Out: 0 -> -1 (Goes left)
                // In: 1 -> 0 (Comes from right, goes left)
                slideOffsetX = 1 - progress
              } else if (direction === 'right') {
                // Direction = Right:
                // Out: 0 -> 1 (Goes right)
                // In: -1 -> 0 (Comes from left, goes right)
                slideOffsetX = -(1 - progress)
              }
            } else if (clip.template === 'transition_blur') {
              // Blur in - start blurred and become clear
              const blurStrength = (1 - progress) * 15 // 15 to 0 blur
              const blurFilter = new PIXI.BlurFilter({ strength: blurStrength })
              if (!g.filters) g.filters = []
              const existingFilters = Array.isArray(g.filters) ? g.filters.filter(f => !(f instanceof PIXI.BlurFilter)) : []
              g.filters = [...existingFilters, blurFilter]
              finalOpacity *= progress
            }
          }
        })
      }
      
      // Apply transition scale if modified
      if (transitionScale !== 1) {
        g.scale.set(finalScale * transitionScale)
        // No need to adjust handles - transitions are brief and handles hidden during playback
      }
      
      const finalAlpha = hasOpacityAnim ? finalOpacity : (isVisibleInTime ? (finalOpacity < 1 ? finalOpacity : 1) : 0)
      g.alpha = finalAlpha

      // Sync rotation
      // For rotation: state.rotation from unified sampling ALREADY includes base rotation
      // Only use layerData.rotation as fallback when there's no animation
      const baseRotationRad = ((layerData?.rotation ?? 0) * Math.PI) / 180
      // If animation exists, use state.rotation directly (it already includes base)
      // If no animation, use base rotation only
      // EXCEPTION: Text layers with character animations (fade_in_char, bounce_in, etc.) don't animate rotation
      // If hasRotationAnim is true but state.rotation is 0 and baseRotation is non-zero, use baseRotation
      // This handles cases where other layers' animations incorrectly trigger hasRotationAnim for text
      const shouldUseBaseRotation = 
        !hasRotationAnim || 
        (layerData?.type === 'text' && Math.abs(state.rotation) < 0.001 && Math.abs(baseRotationRad) > 0.001)
      if (g) g.rotation = shouldUseBaseRotation ? baseRotationRad : state.rotation
      
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

        // Apply Color Animation (Tint)
        // 1. Shapes (Graphics)
        g.tint = finalColor
        
        // Reset outline and resize handle tints so they don't inherit shape color
        // (They are children of the container and inherit tint)
        const outline = outlinesByIdRef.current[id]
        if (outline) outline.tint = 0xffffff
        const handles = resizeHandlesRef.current[id]
        if (handles) {
          handles.forEach(h => { h.tint = 0xffffff })
        }

        // 2. Icons (Sprites)
        if (spritesByIdRef.current[id]) {
          spritesByIdRef.current[id].tint = finalColor
        }

        // 3. Text
        if (textsByIdRef.current[id]) {
          textsByIdRef.current[id].text.tint = finalColor
        }
      }
      // Handle Masking (mask_center and mask_top)
      let maskScale = state.maskScale
      
      // Check for completed mask_out clips. 
      // Keep shape hidden ONLY if the mask_out clip ends at or after the shape's layer clip ends.
      // If the shape clip is longer than the mask_out clip, let the shape reappear.
      if (typeof maskScale !== 'number') {
        const completedMaskOutClip = templateClips.find(c => 
          c.layerId === id && 
          (c.template === 'mask_center_out' || c.template === 'mask_top_out') &&
          currentPlayhead >= (c.start ?? 0) + (c.duration ?? 1000) // Use >= for exact end time match
        )
        if (completedMaskOutClip) {
          // Get the shape's layer clip (track) end time
          const layerTrack = timelineTracks.find(t => t.layerId === id)
          const layerEnd = (layerTrack?.startTime ?? 0) + (layerTrack?.duration ?? 2000)
          const maskOutEnd = (completedMaskOutClip.start ?? 0) + (completedMaskOutClip.duration ?? 1000)
          
          // Only keep shape hidden if mask_out ends at or before layer ends
          // If shape clip extends beyond mask_out, let shape reappear
          if (maskOutEnd >= layerEnd - 50) { // 50ms tolerance for "same time"
            maskScale = 0 // Keep shape hidden
          }
        }
      }
      
      if (typeof maskScale === 'number') {
        let mask = maskGraphicsByIdRef.current[id]
        if (!mask) {
          mask = new PIXI.Graphics()
          maskGraphicsByIdRef.current[id] = mask
          if (g?.parent) g.parent.addChild(mask)
        } else if (g?.parent && mask.parent !== g.parent) {
             g.parent.addChild(mask)
        }

        if (g) {
          // Check which mask type is active (include both IN and OUT versions)
          const maskCenterClip = templateClips.find(c => c.layerId === id && (c.template === 'mask_center' || c.template === 'mask_center_out'))
          const maskTopClip = templateClips.find(c => c.layerId === id && (c.template === 'mask_top' || c.template === 'mask_top_out'))
          const activeClip = maskCenterClip || maskTopClip
          const isMaskTop = !!maskTopClip
          
          const maskAngle = activeClip?.parameters?.maskAngle ?? 0
          
          // Use layer dimensions instead of getLocalBounds() to avoid issues with unloaded images
          const layerWidth = layer.width || 100
          const layerHeight = layer.height || 100
          
          // For ANY rotation angle, the mask needs to be large enough to cover the diagonal of the shape
          // This ensures when rotated, the mask still fully covers the shape
          const diagonal = Math.sqrt(layerWidth * layerWidth + layerHeight * layerHeight)
          const angleRad = (maskAngle * Math.PI / 180)
          
          // Use diagonal as the mask dimension to ensure full coverage at any angle
          // Add 20% padding to ensure no edge clipping
          const maskSize = diagonal * 1.3
          const maskWidth = maskSize
          const maskHeight = maskSize

          mask.clear()
          
          if (isMaskTop) {
            // Mask Top: reveals from one edge
            // Draw rect centered, but use pivot to control which edge is the "reveal origin"
            mask.rect(-maskWidth / 2, -maskHeight / 2, maskWidth, maskHeight).fill(0xffffff)
            
            // Set pivot so the top edge is the origin for scaling
            // When scaleY=0, the mask collapses to a line at the top edge
            mask.pivot.set(0, -maskHeight / 2)
            
            // Position at edge of shape (accounting for pivot offset)
            // For diagonal angles (45°, 135°), use diagonal/2 to reach corners
            // For cardinal angles (0°, 90°), use the appropriate edge distance
            const offsetAmount = (diagonal / 2) * state.scale
            // Calculate offset in rotated direction
            const offsetX = Math.sin(angleRad) * offsetAmount
            const offsetY = -Math.cos(angleRad) * offsetAmount
            mask.position.set(g.position.x + offsetX, g.position.y + offsetY)
          } else {
            // Mask Center: draw rect centered, expands from center
            mask.rect(-maskWidth / 2, -maskHeight / 2, maskWidth, maskHeight).fill(0xffffff)
            mask.pivot.set(0, 0) // Center pivot
            mask.position.copyFrom(g.position)
          }
          
          // Apply layer rotation + mask angle (convert degrees to radians)
          mask.rotation = g.rotation + angleRad
          
          // Non-uniform scale: X stays full, Y animates from 0 to full
          const fullScale = state.scale
          mask.scale.set(fullScale, maskScale * fullScale)
          
          g.mask = mask
        }
      } else {
        const mask = maskGraphicsByIdRef.current[id]
        if (mask) {
          if (g && g.mask === mask) g.mask = null
          mask.destroy()
          delete maskGraphicsByIdRef.current[id]
        }
      }
      
      // Handle Resize Animation (mask-based clipping like mask_top)
      const resizeProgress = (g as any)?.__resizeProgress
      if (resizeProgress?.active && g) {
        const { scaleX, scaleY, anchor, baseWidth: rBaseW, baseHeight: rBaseH } = resizeProgress
        
        // Create or get resize mask (separate from maskScale mask)
        let resizeMask = (g as any).__resizeMask as PIXI.Graphics | undefined
        if (!resizeMask) {
          resizeMask = new PIXI.Graphics()
          ;(g as any).__resizeMask = resizeMask
          if (g.parent) g.parent.addChild(resizeMask)
        } else if (g.parent && resizeMask.parent !== g.parent) {
          g.parent.addChild(resizeMask)
        }
        
        // Use base layer dimensions for mask size (like mask_top)
        const layerWidth = rBaseW || layer.width || 100
        const layerHeight = rBaseH || layer.height || 100
        const maskWidth = layerWidth * 1.2  // Slightly larger to ensure coverage
        const maskHeight = layerHeight * 1.2
        const fullScale = state.scale
        
        resizeMask.clear()
        
        // Draw full-size rect centered, then use pivot + scale to reveal from anchor
        // This exactly matches the mask_top pattern
        resizeMask.rect(-maskWidth / 2, -maskHeight / 2, maskWidth, maskHeight).fill(0xffffff)
        
        // Set pivot and scale based on anchor (like mask_top pattern)
        // scaleX/scaleY can go beyond 1.0 - no 100% barrier
        switch (anchor) {
          case 'top':
            // Pivot at top edge, scale Y controls vertical reveal
            resizeMask.pivot.set(0, -maskHeight / 2)
            resizeMask.position.set(g.position.x, g.position.y - (layerHeight * fullScale / 2))
            resizeMask.scale.set(scaleX * fullScale, scaleY * fullScale)
            break
          case 'bottom':
            // Pivot at bottom edge, scale Y controls vertical reveal
            resizeMask.pivot.set(0, maskHeight / 2)
            resizeMask.position.set(g.position.x, g.position.y + (layerHeight * fullScale / 2))
            resizeMask.scale.set(scaleX * fullScale, scaleY * fullScale)
            break
          case 'left':
            // Pivot at left edge, scale X controls horizontal reveal
            resizeMask.pivot.set(-maskWidth / 2, 0)
            resizeMask.position.set(g.position.x - (layerWidth * fullScale / 2), g.position.y)
            resizeMask.scale.set(scaleX * fullScale, scaleY * fullScale)
            break
          case 'right':
            // Pivot at right edge, scale X controls horizontal reveal
            resizeMask.pivot.set(maskWidth / 2, 0)
            resizeMask.position.set(g.position.x + (layerWidth * fullScale / 2), g.position.y)
            resizeMask.scale.set(scaleX * fullScale, scaleY * fullScale)
            break
          case 'middle':
          default:
            // Pivot at center, both scales control reveal from center
            resizeMask.pivot.set(0, 0)
            resizeMask.position.copyFrom(g.position)
            resizeMask.scale.set(scaleX * fullScale, scaleY * fullScale)
            break
        }
        
        resizeMask.rotation = g.rotation
        
        // Only apply mask if not already masked by maskScale
        if (!g.mask) {
          g.mask = resizeMask
        }
      } else if (g) {
        // Clean up resize mask if resize animation ended
        const resizeMask = (g as any)?.__resizeMask as PIXI.Graphics | undefined
        if (resizeMask) {
          if (g.mask === resizeMask) g.mask = null
          resizeMask.destroy()
          ;(g as any).__resizeMask = null
        }
      }
      
      // Handle Slide Transition (position-based push effect)
      if ((slideOffsetY !== null || slideOffsetX !== null) && g) {
        // Apply position offset based on slideOffset X/Y
        const layerHeight = layerData?.height || 100
        const layerWidth = layerData?.width || 100
        
        if (slideOffsetY !== null) {
          const positionOffsetY = slideOffsetY * layerHeight * state.scale
          g.position.y += positionOffsetY
        }
        
        if (slideOffsetX !== null) {
          const positionOffsetX = slideOffsetX * layerWidth * state.scale
          g.position.x += positionOffsetX
        }
      }
      
      // Step 4: Sync handle positions for selected layer (handles are in overlay, don't inherit transforms)
      // Only sync when not playing to avoid performance overhead during animation
      if (id === selectedLayerId && !isPlaying) {
        syncHandlePositions(id)
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
  // SKIP during playback - the PixiJS playback ticker handles this for 60fps performance
  useEffect(() => {
    if (isPlaying) return // During playback, PixiJS ticker handles updates
    updateGraphicsFromTimeline()
  }, [sampledTimeline, isReady, isPlaying])

  // Re-apply transforms when layer props or selection changes (e.g., scale/position/rotation updates without timeline changes)
  useEffect(() => {
    updateGraphicsFromTimeline()
  }, [orderedLayers, layers, selectedLayerId])
  
  // Store updateGraphicsFromTimeline in ref for restoreFromExport to call
  useEffect(() => {
    updateGraphicsFnRef.current = updateGraphicsFromTimeline
  })

  // HIGH-PERFORMANCE PLAYBACK: Use PixiJS ticker to update graphics at 60fps
  // This bypasses React completely during playback for smooth animation
  useEffect(() => {
    const app = appRef.current
    if (!app || !isReady) return
    
    if (isPlaying) {
      // Hide all selection outlines and resize handles during playback
      Object.values(outlinesByIdRef.current).forEach(outline => {
        if (outline) outline.visible = false
      })
      Object.values(resizeHandlesRef.current).forEach(handles => {
        if (handles) handles.forEach(h => h.visible = false)
      })
      
      const playbackTick = () => {
        // Read state directly from store (bypasses React)
        const storeState = timelineActions.getState()
        
        // Get precise playhead time (60fps internal time, not throttled React state)
        const currentPlayhead = timelineActions.getPlayheadTime()
        
        // Calculate frame index for cache lookup
        const cache = animationCacheRef.current
        const frameIndex = Math.floor(currentPlayhead / cache.frameInterval)
        
        // Check cache first for instant replay
        let sampled = cache.frames.get(frameIndex)
        
        if (!sampled) {
          // Cache miss - compute sample and store
          sampled = sampleTimelineUnified(
            storeState.tracks,
            clipInfos,
            currentPlayhead,
            undefined,
            layerBaseStates
          )
          // Store in cache for next replay
          cache.frames.set(frameIndex, sampled)
        }
        
        // Update graphics directly (bypasses React state)
        updateGraphicsFromTimeline(sampled, currentPlayhead)
      }
      
      // Add to PixiJS ticker for 60fps updates
      app.ticker.add(playbackTick)
      
      return () => {
        app.ticker?.remove(playbackTick)
        
        // Show handles and sync to animated size when playback stops
        if (selectedLayerId) {
          const g = graphicsByIdRef.current[selectedLayerId]
          const layer = layersRef.current.find(l => l.id === selectedLayerId)
          
          if (g && layer) {
            // Get animated dimensions from shape (stored during resize animation) or use base
            const shapeSize = (g as any).__shapeSize as { width?: number; height?: number } | undefined
            const animatedWidth = shapeSize?.width ?? layer.width
            const animatedHeight = shapeSize?.height ?? layer.height
            
            // Update outline
            const outline = outlinesByIdRef.current[selectedLayerId]
            if (outline) {
              outline.visible = true
              outline.x = g.x
              outline.y = g.y
              outline.clear()
              const halfW = animatedWidth / 2
              const halfH = animatedHeight / 2
              outline.rect(-halfW, -halfH, animatedWidth, animatedHeight)
              outline.stroke({ color: layer.type === 'text' ? 0xA855F7 : 0x9333ea, width: 2, alpha: 1 })
            }
            
            // Update resize handles
            const handles = resizeHandlesRef.current[selectedLayerId]
            if (handles && handles.length === 8) {
              const halfW = animatedWidth / 2
              const halfH = animatedHeight / 2
              const cornerOffsets = [
                { x: -halfW, y: -halfH }, // tl
                { x: halfW, y: -halfH },  // tr
                { x: halfW, y: halfH },   // br
                { x: -halfW, y: halfH },  // bl
              ]
              const edgeOffsets = [
                { x: 0, y: -halfH }, // t
                { x: 0, y: halfH },  // b
                { x: -halfW, y: 0 }, // l
                { x: halfW, y: 0 },  // r
              ]
              
              const cornerSize = 8
              for (let i = 0; i < 4; i++) {
                const h = handles[i]
                h.visible = true
                h.alpha = 1
                h.x = g.x + cornerOffsets[i].x
                h.y = g.y + cornerOffsets[i].y
                h.clear()
                h.rect(-cornerSize / 2, -cornerSize / 2, cornerSize, cornerSize)
                h.fill(layer.type === 'text' ? 0xA855F7 : 0x9333ea)
              }
              
              const edgeThickness = 1
              for (let i = 4; i < 8; i++) {
                const h = handles[i]
                h.visible = true
                h.x = g.x + edgeOffsets[i - 4].x
                h.y = g.y + edgeOffsets[i - 4].y
                h.clear()
                if (i === 4 || i === 5) { // t, b - horizontal edges
                  h.rect(-animatedWidth / 2, -edgeThickness / 2, animatedWidth, edgeThickness)
                } else { // l, r - vertical edges
                  h.rect(-edgeThickness / 2, -animatedHeight / 2, edgeThickness, animatedHeight)
                }
                h.fill(layer.type === 'text' ? 0xA855F7 : 0x9333ea)
              }
            }
          }
        }
        
        app.render()
      }
    }
  }, [isPlaying, isReady, clipInfos, layerBaseStates, timelineActions, selectedLayerId])

  // Note: Typewriter animation is now handled in the playhead useEffect (around line 2520)
  // which updates text.text directly based on playhead position, similar to counter animations

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
    
    // Re-add background container FIRST (at bottom)
    if (bgContainerRef.current) {
      bgContainerRef.current.zIndex = -1000
      stage.addChild(bgContainerRef.current)
    }
    
    // Re-add background mask (needs to be on stage for masking to work)
    if (bgMaskRef.current) {
      stage.addChild(bgMaskRef.current)
    }
    
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
    
    // Re-add handles overlay (it was removed by stage.removeChildren())
    // MAJOR FIX: Strictly destroy ALL previously created handles
    // This prevents "ghost" handles that might become detached but not destroyed
    allHandlesRef.current.forEach(h => {
      if (h && typeof (h as any).destroy === 'function') {
        (h as any).destroy()
      }
    })
    allHandlesRef.current = [] // Clear the tracking array
    
    // Also clear overlay children as a backup
    if (handlesOverlayRef.current) {
      handlesOverlayRef.current.removeChildren()
      stage.addChild(handlesOverlayRef.current)
    }
    
    // Clear outline and handle refs since we're rebuilding them
    outlinesByIdRef.current = {}
    resizeHandlesRef.current = {}
    
    // We need to define the ticker callback variable so we can remove it later
    let tickerCallback: ((ticker: PIXI.Ticker) => void) | null = null
    const centerX = screenWidth / 2
    const centerY = screenHeight / 2
    const tickerCallbacks: Array<(ticker: PIXI.Ticker) => void> = []
    
    graphicsByIdRef.current = {}
    textsByIdRef.current = {} // Clear text refs - they'll be repopulated with fresh objects
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
            // For non-icon shapes, clear and redraw with WHITE fill
            // Color is applied via tint (consistent with initial shape creation)
            g.clear()
            const fillColor = 0xffffff // Always draw white, color comes from tint
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
            // Apply the actual color via tint
            g.tint = layer.fillColor ?? 0xffffff
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
          
          const edgeThickness = 1
          const hitAreaSize = 12
          const cornerSize = 8
          
          handles.forEach((h, i) => {
            h.x = positions[i].x
            h.y = positions[i].y
            
            // For corner handles (indices 0-3), redraw them
            if (i < 4) {
              h.clear()
              h.rect(-cornerSize / 2, -cornerSize / 2, cornerSize, cornerSize)
              h.fill(0x9333ea)
              h.tint = 0xffffff
            }
            // For edge handles (indices 4-7), we must update their length and hitArea
            else {
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
              h.tint = 0xffffff // Prevent inheriting parent tint
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
        // Always fill white and apply color via tint for consistency with resize handler
        graphics.fill(0xffffff)
        graphics.tint = fillColor
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
            // Check cache first to avoid async delay if possible
            let texture = PIXI.Assets.cache.get(layer.imageUrl)
            
            if (!texture) {
              texture = await PIXI.Assets.load(layer.imageUrl)
            }
            
            // Re-check if this layer is still relevant
            if (!graphicsByIdRef.current) {
              return // Component unmounted
            }

            // Check if stage was cleared
            if (!app.stage || app.stage.destroyed) {
              return
            }

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
            
            // Explicitly ensure container is visible
            container.alpha = 1
            container.visible = true
            sprite.alpha = 1
            sprite.visible = true
            
            app.stage.addChild(container)
            // Force sort to ensure zIndex is respected after async add
            app.stage.sortChildren()
            
            // Force render after async add
            app.render()
            
            // Store references
            graphicsByIdRef.current[layer.id] = container as any
            spritesByIdRef.current[layer.id] = sprite
            
            // Add outline to handles overlay (not container) so it doesn't inherit transforms
            const outline = new PIXI.Graphics()
            outline.rect(-layer.width / 2, -layer.height / 2, layer.width, layer.height)
            outline.stroke({ color: 0x9333ea, width: 2, alpha: 1 })
            outline.tint = 0xffffff // Prevent inheriting parent tint
            outline.visible = false
            outline.eventMode = 'none'
            outline.zIndex = 0 // Render below handles (corners have zIndex 10)
            if (handlesOverlayRef.current) {
              handlesOverlayRef.current.addChild(outline)
            } else {
              container.addChild(outline) // Fallback if overlay not ready
            }
            outlinesByIdRef.current[layer.id] = outline
            
            // Add bounding box resize handles (4 corners + 4 edges)
            const handleSize = 8
            const edgeThickness = 1
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
              handleGfx.tint = 0xffffff // Prevent inheriting parent tint
              
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
              // Add handles to overlay (not container) so they don't inherit transforms
              if (handlesOverlayRef.current) {
                handlesOverlayRef.current.addChild(handleGfx)
              } else {
                container.addChild(handleGfx) // Fallback
              }
              handles.push(handleGfx)
            })
            resizeHandlesRef.current[layer.id] = handles
            
            // If this layer is already selected (e.g. auto-selected on import), show handles now
            if (selectedLayerId === layer.id) {
              outline.visible = true
              handles.forEach(h => h.visible = true)
              // Sync handle positions (they're in overlay, need world coords)
              syncHandlePositions(layer.id)
            }
            
            // Pointer events
            container.on('pointerdown', (e) => {
              e.stopPropagation()
              onSelectLayer?.(layer.id)
              // Show outline/handles immediately on click for SVGs
              outline.visible = true
              handles.forEach(h => h.visible = true)
              // Position handles correctly (they're in overlay)
              syncHandlePositions(layer.id)
              dragRef.current = { id: layer.id, offsetX: e.global.x - container.x, offsetY: e.global.y - container.y }
              stage.cursor = 'grabbing'
            })
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
            
            // Add outline to handles overlay (not container) so it doesn't inherit transforms
            const outline = new PIXI.Graphics()
            outline.rect(-layer.width / 2, -layer.height / 2, layer.width, layer.height)
            outline.stroke({ color: 0x9333ea, width: 2, alpha: 1 })
            outline.tint = 0xffffff // Prevent inheriting parent tint
            outline.visible = false
            outline.eventMode = 'none'
            outline.zIndex = 0 // Render below handles (corners have zIndex 10)
            if (handlesOverlayRef.current) {
              handlesOverlayRef.current.addChild(outline)
            } else {
              container.addChild(outline) // Fallback if overlay not ready
            }
            outlinesByIdRef.current[layer.id] = outline
            
            // Add resize handles (4 corners + 4 edges like images)
            const handleSize = 8
            const edgeThickness = 1
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
              handleGfx.tint = 0xffffff // Prevent inheriting parent tint
              
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
              // Add handles to overlay (not container) so they don't inherit transforms
              if (handlesOverlayRef.current) {
                handlesOverlayRef.current.addChild(handleGfx)
              } else {
                container.addChild(handleGfx) // Fallback
              }
              handles.push(handleGfx)
            })
            resizeHandlesRef.current[layer.id] = handles
            
            // If already selected, show handles
            if (selectedLayerId === layer.id) {
              outline.visible = true
              handles.forEach(h => h.visible = true)
              // Sync handle positions (they're in overlay, need world coords)
              syncHandlePositions(layer.id)
            }
            
            // Pointer events
            container.on('pointerdown', (e) => {
              e.stopPropagation()
              onSelectLayer?.(layer.id)
              // Show outline/handles immediately on click
              outline.visible = true
              handles.forEach(h => h.visible = true)
              // Position handles correctly (they're in overlay)
              syncHandlePositions(layer.id)
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
          // Check if a typewriter clip exists for this layer
          const hasTypewriterClip = templateClips.some(
            c => c.layerId === layer.id && c.template === 'typewriter'
          )
          
          const container = new PIXI.Container()
          
          // Use layer.width as the text box width (wordWrapWidth)
          const textBoxWidth = layer.width || 400
          
          // Create text style
          const textStyle = new PIXI.TextStyle({
            fontFamily: [layer.fontFamily || 'Inter', 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'sans-serif'],
            fontSize: layer.fontSize || 48,
            fontWeight: String(layer.fontWeight || 600) as PIXI.TextStyleFontWeight,
            fill: 0xffffff, // Use white for tinting
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
          
          // Check for typewriter animation
          const typewriterClip = templateClips.find(
            c => c.layerId === layer.id && c.template === 'typewriter'
          )
          
          let displayText = initialText
          let showCursor = false
          
          if (typewriterClip) {
            const clipStart = typewriterClip.start ?? 0
            const clipDuration = typewriterClip.duration ?? 2000
            const clipEnd = clipStart + clipDuration
            const fullText = initialText
            const totalChars = fullText.length
            
            if (playhead < clipStart) {
              // Before clip starts - show nothing
              displayText = ''
            } else if (playhead >= clipEnd) {
              // After clip ends - show full text
              displayText = fullText
            } else {
              // During clip - reveal characters progressively
              const progress = (playhead - clipStart) / clipDuration
              const charsToShow = Math.floor(progress * totalChars)
              displayText = fullText.substring(0, charsToShow)
              showCursor = typewriterClip.parameters?.showCursor !== false
            }
          }
          
          // Add cursor if typewriter is active
          const finalText = showCursor ? displayText + '|' : displayText
          
          const text = new PIXI.Text({ text: finalText, style: textStyle })
          text.anchor.set(0.5)
          
          // BOUNCE IN/OUT/SCRAMBLE/FADE_IN_CHAR/FADE_OUT_CHAR: Split text implementation
          const bounceInClip = templateClips.find(c => c.layerId === layer.id && c.template === 'bounce_in')
          const bounceOutClip = templateClips.find(c => c.layerId === layer.id && c.template === 'bounce_out')
          const scrambleClip = templateClips.find(c => c.layerId === layer.id && c.template === 'scramble')
          const fadeInCharClip = templateClips.find(c => c.layerId === layer.id && c.template === 'fade_in_char')
          const fadeOutCharClip = templateClips.find(c => c.layerId === layer.id && c.template === 'fade_out_char')
          let parts: PIXI.Text[] | undefined
          
          if ((bounceInClip || bounceOutClip || scrambleClip || fadeInCharClip || fadeOutCharClip) && layer.text) {
             text.visible = false // Hide main text
             parts = []
             const fullText = layer.text
             // BOUNCE IN: Split text implementation
             // We need to manually calculate layout to match PIXI's wrapping
             const wrapWidth = textBoxWidth
             const fontSize = layer.fontSize || 48
             const lineHeight = fontSize * 1.2
             
             // Create a measurement style WITHOUT wordWrap (critical for accurate width measurement)
             const measureStyle = new PIXI.TextStyle({
               fontFamily: [layer.fontFamily || 'Inter', 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'sans-serif'],
               fontSize: layer.fontSize || 48,
               fontWeight: String(layer.fontWeight || 600) as PIXI.TextStyleFontWeight,
               fill: layer.fillColor ?? 0xffffff,
               wordWrap: false, // IMPORTANT: No wrapping for measurement
             })
             
             // Measure space width upfront (important for proper spacing)
             const spaceTemp = new PIXI.Text({ text: 'M M', style: measureStyle })
             const mTemp = new PIXI.Text({ text: 'MM', style: measureStyle })
             const spaceWidth = spaceTemp.width - mTemp.width
             spaceTemp.destroy()
             mTemp.destroy()
             
             // 1. Tokenize and Wrap (matching PIXI's wordWrap behavior)
             const paragraphs = fullText.split('\n')
             const lines: { text: string; width: number }[] = []
             
             paragraphs.forEach(paragraph => {
                const words = paragraph.split(' ')
                if (words.length === 0) {
                   lines.push({ text: '', width: 0 })
                   return
                }
                
                let currentLine = words[0]
                
                for (let i = 1; i < words.length; i++) {
                   const word = words[i]
                   const testLine = currentLine + ' ' + word
                   const temp = new PIXI.Text({ text: testLine, style: measureStyle })
                   const w = temp.width
                   temp.destroy()
                   
                   if (w > wrapWidth) {
                      // Push current line and start new one
                      const lineTemp = new PIXI.Text({ text: currentLine, style: measureStyle })
                      lines.push({ text: currentLine, width: lineTemp.width })
                      lineTemp.destroy()
                      currentLine = word
                   } else {
                      currentLine = testLine
                   }
                }
                // Push the last line
                const t = new PIXI.Text({ text: currentLine, style: measureStyle })
                lines.push({ text: currentLine, width: t.width })
                t.destroy()
             })
             
             // 2. Render Characters with proper spacing
             const totalContentHeight = lines.length * lineHeight
             let currentY = -totalContentHeight / 2
             const originalChars: string[] = [] // Track original characters for scramble animation
             
             lines.forEach((line) => {
                 let currentX = -line.width / 2 // Center aligned
                 
                 for (let i = 0; i < line.text.length; i++) {
                     const char = line.text[i]
                     const charStyle = new PIXI.TextStyle(textStyle)
                     
                     const charText = new PIXI.Text({ text: char, style: charStyle })
                     charText.anchor.set(0.5)
                     
                     // Use proper width for space characters
                     const charWidth = char === ' ' ? spaceWidth : charText.width
                     
                     charText.x = currentX + charWidth / 2
                     charText.y = currentY + lineHeight / 2
                     
                     container.addChild(charText)
                     parts?.push(charText)
                     originalChars.push(char) // Store original character
                     
                     currentX += charWidth
                 }
                 currentY += lineHeight
             })
             
             // Store originalChars for scramble animation
             if (parts) {
                (parts as any).originalChars = originalChars
             }
          }

          // Initial Tint
          text.tint = layer.fillColor ?? 0xffffff
          
          container.addChild(text) 
          
          // Use text's intrinsic width/height (local dimensions, not global bounds)
          const boxWidth = Math.max(textBoxWidth, text.width)
          const boxHeight = text.height
          
          const posX = layer.x <= 4 ? layer.x * screenWidth : layer.x
          const posY = layer.y <= 4 ? layer.y * screenHeight : layer.y
          container.x = posX
          container.y = posY
          // Apply initial rotation from layer (convert degrees to radians)
          container.rotation = ((layer.rotation ?? 0) * Math.PI) / 180
          container.zIndex = layerIndex
          container.eventMode = 'static'
          container.cursor = 'grab'
          container.hitArea = new PIXI.Rectangle(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight)
          
          // Store references for typewriter animation updates
          graphicsByIdRef.current[layer.id] = container as any
          textsByIdRef.current[layer.id] = { text, fullText: initialText, layerId: layer.id, hasTypewriter: hasTypewriterClip, parts }
          
          // Add outline to handles overlay (not container) so it doesn't inherit transforms
          const outline = new PIXI.Graphics()
          outline.rect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight)
          outline.stroke({ color: 0xA855F7, width: 2, alpha: 1 })
          outline.tint = 0xffffff // Prevent inheriting parent tint
          outline.visible = false
          outline.eventMode = 'none'
          outline.zIndex = 0 // Render below handles (corners have zIndex 10)
          if (handlesOverlayRef.current) {
            handlesOverlayRef.current.addChild(outline)
          } else {
            container.addChild(outline) // Fallback if overlay not ready
          }
          outlinesByIdRef.current[layer.id] = outline
          
          // Add bounding box resize handles (4 corners + 4 edges) - same as shapes
          const handleSize = 8
          const edgeThickness = 1
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
            handleGfx.tint = 0xffffff // Prevent inheriting parent tint
            
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
            // Add handles to overlay (not container) so they don't inherit transforms
            if (handlesOverlayRef.current) {
              handlesOverlayRef.current.addChild(handleGfx)
            } else {
              container.addChild(handleGfx) // Fallback
            }
            handles.push(handleGfx)
          })
          resizeHandlesRef.current[layer.id] = handles
          
          // If already selected, show outline and handles
          if (selectedLayerId === layer.id) {
            outline.visible = true
            handles.forEach(h => h.visible = true)
            // Sync handle positions (they're in overlay, need world coords)
            syncHandlePositions(layer.id)
          }
          
          // Pointer events
          container.on('pointerdown', (e) => {
            e.stopPropagation()
            onSelectLayer?.(layer.id)
            // Show outline/handles immediately on click
            outline.visible = true
            handles.forEach(h => h.visible = true)
            // Position handles correctly (they're in overlay)
            syncHandlePositions(layer.id)
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
              // Initial Tint
              sprite.tint = layer.fillColor ?? 0xffffff
              
              g.addChild(sprite)
              spritesByIdRef.current[layer.id] = sprite
            } catch (error) {
              console.error(`Failed to load icon ${layer.shapeKind}:`, error)
              // Fallback to manual drawing
              // Fallback to manual drawing
              drawShape(g, layer.shapeKind, layer.width, layer.height, 0xffffff)
            }
          } else {
            // Fallback if no icon path
          // Fallback if no icon path
            drawShape(g, layer.shapeKind, layer.width, layer.height, 0xffffff)
          }
        } else {
          // For non-icon shapes, use manual drawing
          drawShape(g, layer.shapeKind, layer.width, layer.height, 0xffffff)
        }
        
        // Initial Tint for Shape
        g.tint = layer.fillColor ?? 0xffffff
        
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
        // Always use rectangular bounding box (not shape-following outline)
        // Add to handles overlay (not shape) so it doesn't inherit transforms
        const outline = new PIXI.Graphics()
        outline.rect(-layer.width / 2, -layer.height / 2, layer.width, layer.height)
        outline.stroke({ color: 0x9333ea, width: 2, alpha: 1 })
        outline.tint = 0xffffff // Prevent inheriting parent tint
        outline.stroke({ color: 0x9333ea, width: 2, alpha: 1 })
        outline.tint = 0xffffff // Prevent inheriting parent tint
        outline.x = posX // Set valid position immediately
        outline.y = posY 
        outline.visible = selectedLayerId === layer.id // Show immediately if selected
        outline.eventMode = 'none' // CRITICAL: Don't intercept pointer events
        outline.zIndex = 0 // Render below handles (corners have zIndex 10)
        if (handlesOverlayRef.current) {
          handlesOverlayRef.current.addChild(outline)
        } else {
          g.addChild(outline) // Fallback if overlay not ready
        }
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
          handleGfx.tint = 0xffffff // Prevent inheriting parent tint
          
          // Set larger hit area for easier grabbing
          if (['t', 'b'].includes(handleType)) {
            handleGfx.hitArea = new PIXI.Rectangle(-w / 2, -shapeHitAreaSize / 2, w, shapeHitAreaSize)
          } else if (['l', 'r'].includes(handleType)) {
            handleGfx.hitArea = new PIXI.Rectangle(-shapeHitAreaSize / 2, -h / 2, shapeHitAreaSize, h)
          } else {
            // Corners
            handleGfx.hitArea = new PIXI.Rectangle(-shapeHandleSize, -shapeHandleSize, shapeHandleSize * 2, shapeHandleSize * 2)
          }
          
          handleGfx.x = posX + x // Set valid world position immediately (no ghost at 0,0)
          handleGfx.y = posY + y
          handleGfx.eventMode = 'static'
          handleGfx.cursor = cursor
          handleGfx.visible = selectedLayerId === layer.id // Show immediately if selected
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
          // Add handles to overlay (not shape) so they don't inherit transforms
          if (handlesOverlayRef.current) {
            handlesOverlayRef.current.addChild(handleGfx)
          } else {
            g.addChild(handleGfx) // Fallback
          }
          handles.push(handleGfx)
          allHandlesRef.current.push(handleGfx) // Track for cleanup
        })
        resizeHandlesRef.current[layer.id] = handles
        
        // IMPORTANT: Store graphics ref and add to stage BEFORE syncHandlePositions,
        // otherwise sync will fail because g doesn't exist in the ref yet
        graphicsByIdRef.current[layer.id] = g
        stage.addChild(g)
        stage.sortChildren() // Force sort by zIndex after each layer
        
        // If this layer is already selected (e.g., auto-selected on creation), show outline/handles immediately
        if (selectedLayerId === layer.id) {
          outline.visible = true
          // Sync handle positions synchronously - graphics are already set up at this point
          syncHandlePositions(layer.id)
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
          // Position handles correctly (they're in overlay, not on shape)
          syncHandlePositions(layer.id)
          
          // Check if layer has any template clips - if so, disable dragging
          const hasClips = templateClips.some(c => c.layerId === layer.id)
          if (hasClips) {
            // Don't initiate drag - shape is locked after templates applied
            return
          }
          
          dragRef.current = {
            id: layer.id,
            offsetX: pos.x - g.x,
            offsetY: pos.y - g.y,
          }
          stage.cursor = 'grabbing'
        })

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
        // Sync handle positions for selected layer after all graphics are updated
        if (selectedLayerId && resizeHandlesRef.current[selectedLayerId]) {
          syncHandlePositions(selectedLayerId)
        }
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
    // Hide during playback so handles don't appear in exports
    Object.entries(outlinesByIdRef.current).forEach(([id, outline]) => {
      const isSelected = selectedLayerId === id && !isPlaying
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
    
    // Sync handle positions for newly selected layer (handles are in overlay)
    if (selectedLayerId && !isPlaying) {
      syncHandlePositions(selectedLayerId)
    }
    
    // Force render to ensure changes are visible
    appRef.current.render()
  }, [selectedLayerId, isReady, isPlaying])

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
          const textWrapper = textsByIdRef.current[layer.id]
          const textObj = textWrapper?.text
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
              // Check for typewriter animation
              const typewriterClip = templateClips.find(
                c => c.layerId === layer.id && c.template === 'typewriter'
              )
              
              if (typewriterClip) {
                // Typewriter animation - reveal characters progressively
                const clipStart = typewriterClip.start ?? 0
                const clipDuration = typewriterClip.duration ?? 2000
                const clipEnd = clipStart + clipDuration
                const fullText = layer.text || ''
                const totalChars = fullText.length
                
                let displayText: string
                let showCursor = false
                
                if (playhead < clipStart) {
                  displayText = ''
                } else if (playhead >= clipEnd) {
                  displayText = fullText
                } else {
                  const progress = (playhead - clipStart) / clipDuration
                  const charsToShow = Math.floor(progress * totalChars)
                  displayText = fullText.substring(0, charsToShow)
                  showCursor = typewriterClip.parameters?.showCursor !== false
                }
                
                // Add blinking cursor
                const cursorChar = Math.floor(playhead / 500) % 2 === 0 && showCursor ? '|' : ''
                const typewriterText = displayText + cursorChar
                
                if (textObj.text !== typewriterText) {
                  textObj.text = typewriterText
                  textChanged = true
                  needsRender = true
                }
              } else {
                // Regular text layer - update text content
                if (layer.text !== undefined && textObj.text !== layer.text) {
                  textObj.text = layer.text
                  textChanged = true
                  needsRender = true
                }
              }

              // Update bounce_in/out/scramble/fade_in_char/fade_out_char parts animation
              const bounceInClip = templateClips.find(c => c.layerId === layer.id && c.template === 'bounce_in')
              const bounceOutClip = templateClips.find(c => c.layerId === layer.id && c.template === 'bounce_out')
              const scrambleClip = templateClips.find(c => c.layerId === layer.id && c.template === 'scramble')
              const fadeInCharClip = templateClips.find(c => c.layerId === layer.id && c.template === 'fade_in_char')
              const fadeOutCharClip = templateClips.find(c => c.layerId === layer.id && c.template === 'fade_out_char')
              
              if ((bounceInClip || bounceOutClip || scrambleClip || fadeInCharClip || fadeOutCharClip) && textWrapper?.parts) {
                const numParts = textWrapper.parts.length
                // Calculate stagger and letterDuration based on clip duration
                // Get the active clip duration for bounce animations
                const bounceClip = bounceInClip || bounceOutClip
                const bounceClipDuration = bounceClip?.duration ?? 1500
                
                // Reserve 20% of clip for the last character's animation duration
                // The remaining 80% is spread across character stagger
                const letterDurationRatio = 0.20
                const letterDuration = bounceClipDuration * letterDurationRatio
                
                // Calculate stagger: total stagger time = clipDuration - letterDuration
                // divided by (numParts - 1) to space out character starts
                const stagger = numParts > 1 
                  ? (bounceClipDuration - letterDuration) / (numParts - 1)
                  : 0
                
                const c4 = (2 * Math.PI) / 3
                
                // Scramble character pool
                const scrambleChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*<>?'
                const scrambleStagger = 100 // ms between each letter settling
                const scrambleSpeed = 50 // ms between random character changes
                
                // Get stored originalChars
                const originalChars = (textWrapper.parts as any).originalChars as string[] | undefined
                
                textWrapper.parts.forEach((part: PIXI.Text, i: number) => {
                   let scale = 1
                   let alpha = 1
                   
                   // Get the original character for this position
                   const originalChar = originalChars?.[i] ?? ''

                   // Bounce In
                   if (bounceInClip) {
                      const start = bounceInClip.start ?? 0
                      const letterStart = start + i * stagger
                      const relativeTime = playhead - letterStart
                      const progress = Math.max(0, Math.min(1, relativeTime / letterDuration))

                      if (relativeTime < 0) {
                         scale *= 0
                         alpha *= 0
                      } else {
                         const x = progress
                         const ease = x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1
                         scale *= ease
                         alpha *= Math.min(1, progress * 10)
                      }
                   }

                   // Bounce Out
                   if (bounceOutClip) {
                      const start = bounceOutClip.start ?? 0
                      const letterStart = start + i * stagger
                      const relativeTime = playhead - letterStart
                      const progress = Math.max(0, Math.min(1, relativeTime / letterDuration))
                      
                      if (relativeTime < 0) {
                        // Before exit starts: no impact
                      } else if (progress >= 1) {
                         scale *= 0
                         alpha *= 0
                      } else {
                         const x = progress
                         const ease = x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1
                         scale *= Math.abs(1 - ease)
                         alpha *= (1 - progress)
                      }
                   }
                   
                   // Scramble animation
                   if (scrambleClip) {
                      const start = scrambleClip.start ?? 0
                      const clipDuration = scrambleClip.duration ?? 2000
                      const numParts = textWrapper.parts?.length ?? 1
                      
                      const initialDelay = Math.max(50, clipDuration * 0.05)
                      const availableTime = clipDuration - initialDelay
                      const scrambleRatio = 0.25
                      
                      const dynamicScrambleDuration = Math.max(80, availableTime * scrambleRatio / Math.max(1, numParts))
                      const dynamicStagger = numParts > 1 
                        ? (availableTime - dynamicScrambleDuration) / (numParts - 1)
                        : availableTime - dynamicScrambleDuration
                      
                      const letterStartTime = start + initialDelay + i * dynamicStagger
                      const letterSettleTime = letterStartTime + dynamicScrambleDuration
                      const dynamicScrambleSpeed = Math.max(30, dynamicScrambleDuration / 6)
                      
                      if (playhead < letterStartTime) {
                         alpha *= 0
                         scale *= 0
                      } else if (playhead >= letterSettleTime) {
                         part.text = originalChar
                      } else {
                         const cycleIndex = Math.floor(playhead / dynamicScrambleSpeed)
                         const charIndex = (cycleIndex + i * 7) % scrambleChars.length
                         part.text = scrambleChars[charIndex]
                      }
                   }
                   
                   // Fade In Per Character animation
                   if (fadeInCharClip) {
                      const start = fadeInCharClip.start ?? 0
                      const clipDuration = fadeInCharClip.duration ?? 1500
                      const numParts = textWrapper.parts?.length ?? 1
                      
                      const fadeStagger = 60
                      const fadeDuration = 200
                      
                      const baseAnimTime = (numParts - 1) * fadeStagger + fadeDuration
                      const timeScale = clipDuration / baseAnimTime
                      
                      const scaledStagger = fadeStagger * timeScale
                      const scaledFadeDuration = fadeDuration * timeScale
                      
                      const letterStart = start + i * scaledStagger
                      const relativeTime = playhead - letterStart
                      const progress = Math.max(0, Math.min(1, relativeTime / scaledFadeDuration))
                      
                      if (relativeTime < 0) {
                         alpha *= 0
                      } else {
                         alpha *= progress
                      }
                   }
                   
                   // Fade Out Per Character animation (letters fade out one by one)
                   if (fadeOutCharClip) {
                      const start = fadeOutCharClip.start ?? 0
                      const clipDuration = fadeOutCharClip.duration ?? 1500
                      const numParts = textWrapper.parts?.length ?? 1
                      
                      const fadeStagger = 60
                      const fadeDuration = 200
                      
                      const baseAnimTime = (numParts - 1) * fadeStagger + fadeDuration
                      const timeScale = clipDuration / baseAnimTime
                      
                      const scaledStagger = fadeStagger * timeScale
                      const scaledFadeDuration = fadeDuration * timeScale
                      
                      const letterStart = start + i * scaledStagger
                      const relativeTime = playhead - letterStart
                      const progress = Math.max(0, Math.min(1, relativeTime / scaledFadeDuration))
                      
                      if (relativeTime < 0) {
                         // Before this letter starts fading out - fully visible
                         // alpha stays at 1
                      } else if (progress >= 1) {
                         // Fully faded out
                         alpha *= 0
                      } else {
                         // Linear fade out (1 -> 0)
                         alpha *= (1 - progress)
                      }
                   }
                   
                   part.scale.set(scale)
                   part.alpha = alpha
                })
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
                const edgeThickness = 1
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
        // Always fill white - color is applied via tint (consistent with initial creation)
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
        g.fill(0xffffff) // White fill
        g.tint = layer.fillColor ?? 0xffffff // Apply color via tint
      }
      
      // Update hit area
      g.hitArea = new PIXI.Rectangle(-layer.width / 2, -layer.height / 2, layer.width, layer.height)
      
        // Update outline for selection - always use rectangular bounding box
        const outline = outlinesByIdRef.current[layer.id]
        if (outline && outline instanceof PIXI.Graphics) {
          outline.clear()
          // Simple rectangular bounding box for all shapes
          outline.rect(-layer.width / 2, -layer.height / 2, layer.width, layer.height)
          outline.stroke({ color: 0x9333ea, width: 2, alpha: 1 })
        }
      
      // Update handle positions and geometry (4 corners or 8 with edges)
      const handles = resizeHandlesRef.current[layer.id]
      if (handles) {
        const halfW = layer.width / 2, halfH = layer.height / 2
        const edgeThickness = 1
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
            h.tint = 0xffffff // Prevent inheriting parent tint
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
            const { width, height } = canvasBounds
            if (!width || !height) return
            const x = (e.clientX - bounds.left - offsetX) / width
            const y = (e.clientY - bounds.top - offsetY) / height
            pathTraceActiveRef.current = true
            lastPathPointRef.current = { x, y }
            // Use separate callback if available
            if (onAddCustomPathPoint) {
              onAddCustomPathPoint(x, y)
            } else {
              onAddPathPoint?.(x, y)
            }
          }}
          onPointerMove={(e) => {
            if (!pathTraceActiveRef.current || !containerRef.current) return
            const bounds = containerRef.current.getBoundingClientRect()
            const { width, height } = canvasBounds
            if (!width || !height) return
            const x = (e.clientX - bounds.left - offsetX) / width
            const y = (e.clientY - bounds.top - offsetY) / height
            const last = lastPathPointRef.current
            const dx = last ? x - last.x : 0
            const dy = last ? y - last.y : 0
            if (!last || Math.hypot(dx, dy) > 0.02) {
              lastPathPointRef.current = { x, y }
              // Use separate callback if available
              if (onAddCustomPathPoint) {
                onAddCustomPathPoint(x, y)
              } else {
                onAddPathPoint?.(x, y)
              }
            }
          }}
          onPointerUp={(e) => {
            if (!pathTraceActiveRef.current || !containerRef.current) return
            const bounds = containerRef.current.getBoundingClientRect()
            const { width, height } = canvasBounds
            if (!width || !height) return
            const x = (e.clientX - bounds.left - offsetX) / width
            const y = (e.clientY - bounds.top - offsetY) / height
            // Add final point
            if (onAddCustomPathPoint) {
              onAddCustomPathPoint(x, y)
            } else {
              onAddPathPoint?.(x, y)
            }
            pathTraceActiveRef.current = false
            // Use separate callback if available
            if (onFinishCustomPath) {
              onFinishCustomPath()
            } else {
              onFinishPath?.()
            }
          }}
        >
          <svg className="h-full w-full" style={{ pointerEvents: 'none' }}>
            {pathPointsSvg && (
              <path d={pathPointsSvg.d} stroke="#22c55e" strokeWidth={2} fill="none" data-path-element="true" />
            )}
          </svg>
        </div>
      )}
      {/* Show the finished path - INTERACTIVE: drag start/end points */}
      {!isPlaying && allPathClips.length > 0 && (
        <div 
          className="absolute inset-0" 
          style={{ zIndex: 25, pointerEvents: 'none' }}
        >
          <svg className="h-full w-full" style={{ pointerEvents: 'none' }}>
            {allPathClips.map((pathClip, pathIndex) => {
              const { width, height } = canvasBounds
              if (!width || !height || !pathClip.points.length) return null
              
              // Simple absolute coordinates - render exactly where user drew
              const renderedPts = pathClip.points.map((pt) => ({
                x: pt.x * width + offsetX,
                y: pt.y * height + offsetY
              }))
              
              const pathD = renderedPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
              const startScreen = renderedPts[0]
              const endScreen = renderedPts[renderedPts.length - 1]
              const canDrag = !isDrawingPath && !isDrawingLine
              
              return (
                <g key={pathClip.id || pathIndex}>
                  {/* Path line */}
                  <path
                    d={pathD}
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="none"
                    opacity={0.5}
                  />
                  {/* Start point (green circle) */}
                  <circle
                    cx={startScreen.x}
                    cy={startScreen.y}
                    r={8}
                    fill="#22c55e"
                    stroke="#0f172a"
                    strokeWidth={2}
                    style={{ pointerEvents: canDrag ? 'auto' : 'none', cursor: canDrag ? 'grab' : 'default' }}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      
                      const handleMove = (ev: PointerEvent) => {
                        const container = containerRef.current
                        if (!container) return
                        const bounds = container.getBoundingClientRect()
                        const x = (ev.clientX - bounds.left - offsetX) / width
                        const y = (ev.clientY - bounds.top - offsetY) / height
                        const clampedX = Math.max(0, Math.min(1, x))
                        const clampedY = Math.max(0, Math.min(1, y))
                        
                        const clip = templateClips.find(c => c.id === pathClip.id)
                        if (clip && clip.parameters?.pathPoints) {
                          const newPoints = [...clip.parameters.pathPoints]
                          newPoints[0] = { x: clampedX, y: clampedY }
                          onUpdateLayerPosition?.(clip.layerId, clampedX, clampedY)
                          timelineActions.updateTemplateClip(clip.layerId, clip.id, {
                            parameters: { pathPoints: newPoints }
                          })
                        }
                      }
                      
                      const handleUp = () => {
                        window.removeEventListener('pointermove', handleMove)
                        window.removeEventListener('pointerup', handleUp)
                        document.body.style.cursor = ''
                      }
                      
                      document.body.style.cursor = 'grabbing'
                      window.addEventListener('pointermove', handleMove)
                      window.addEventListener('pointerup', handleUp)
                    }}
                  />
                  {/* End point (red circle) */}
                  {pathClip.points.length > 1 && (
                    <circle
                      cx={endScreen.x}
                      cy={endScreen.y}
                      r={8}
                      fill="#ef4444"
                      stroke="#0f172a"
                      strokeWidth={2}
                      style={{ pointerEvents: canDrag ? 'auto' : 'none', cursor: canDrag ? 'grab' : 'default' }}
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        
                        const handleMove = (ev: PointerEvent) => {
                          const container = containerRef.current
                          if (!container) return
                          const bounds = container.getBoundingClientRect()
                          const x = (ev.clientX - bounds.left - offsetX) / width
                          const y = (ev.clientY - bounds.top - offsetY) / height
                          const clampedX = Math.max(0, Math.min(1, x))
                          const clampedY = Math.max(0, Math.min(1, y))
                          
                          const clip = templateClips.find(c => c.id === pathClip.id)
                          if (clip && clip.parameters?.pathPoints) {
                            const newPoints = [...clip.parameters.pathPoints]
                            newPoints[newPoints.length - 1] = { x: clampedX, y: clampedY }
                            timelineActions.updateTemplateClip(clip.layerId, clip.id, {
                              parameters: { pathPoints: newPoints }
                            })
                          }
                        }
                        
                        const handleUp = () => {
                          window.removeEventListener('pointermove', handleMove)
                          window.removeEventListener('pointerup', handleUp)
                          document.body.style.cursor = ''
                        }
                        
                        document.body.style.cursor = 'grabbing'
                        window.addEventListener('pointermove', handleMove)
                        window.addEventListener('pointerup', handleUp)
                      }}
                    />
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      )}

      {/* Line draw overlay (two-point, draggable end) - hide during playback */}
      {isDrawingLine && !isPlaying && (
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
          onFinishLine={onFinishLine}
          lineStartRef={lineStartRef}
          lineEndRef={lineEndRef}
          lineHasEndRef={lineHasEndRef}
          lineDragActiveRef={lineDragActiveRef}
        />
      )}

      {/* Roll distance visualization overlay - show when layer has roll clip */}
      {selectedLayerId && !isPlaying && (() => {
        // Check if layer has any roll clips
        const hasRollClip = templateClips.some(c => c.layerId === selectedLayerId && c.template === 'roll')
        if (!hasRollClip) return null
        
        const layer = renderLayers?.find(l => l.id === selectedLayerId)
        if (!layer) return null
        
        const { width, height } = canvasBounds
        if (!width || !height) return null
        
        // Get rollDistance from the selected clip if available, otherwise first roll clip
        // Prioritize selectedClipId to show handles for the correct clip when multiple exist
        const rollClip = selectedClipId 
          ? templateClips.find(c => c.id === selectedClipId && c.template === 'roll') 
            ?? templateClips.find(c => c.layerId === selectedLayerId && c.template === 'roll')
          : templateClips.find(c => c.layerId === selectedLayerId && c.template === 'roll')
        const clipRollDistance = rollClip?.parameters?.rollDistance ?? rollDistance
        
        // Check for preceding Path clip to determine start position
        // If a path exists, the roll should start from the end of that path
        const layerClips = templateClips
          .filter(c => c.layerId === selectedLayerId)
          .sort((a, b) => (a.start || 0) - (b.start || 0))
        
        let startX = layer.x
        let startY = layer.y
        
        for (const clip of layerClips) {
           // Stop if we reach the specific roll clip we are rendering
           if (rollClip && clip.template === 'roll' && clip.id === rollClip.id) break;

           if (clip.template === 'path' && clip.parameters?.pathPoints) {
             const points = clip.parameters.pathPoints
             if (points.length > 0) {
               startX = points[points.length - 1].x
               startY = points[points.length - 1].y
             }
           }
           
           if (clip.template === 'roll') {
             startX += clip.parameters?.rollDistance ?? 0.3
           }
        }

        // Shape center position
        const centerX = startX * width + offsetX
        const centerY = startY * height + offsetY
        
        // End position (roll goes right by rollDistance)
        // Note: drag calculation needs to account for this offset too
        const endX = (startX + clipRollDistance) * width + offsetX
        const endY = centerY
        
        // Only allow dragging when roll template is selected OR a roll clip is selected AND not in drawing mode
        const isRollClipSelected = selectedClipId ? templateClips.some(c => c.id === selectedClipId && c.template === 'roll') : false
        const canDrag = (selectedTemplate === 'roll' || isRollClipSelected) && !isDrawingPath && !isDrawingLine
        
        return (
          <div 
            className="absolute inset-0" 
            style={{ zIndex: 26, pointerEvents: 'none' }}
          >
            <svg className="h-full w-full" style={{ pointerEvents: 'none' }}>
              {/* Dashed line from center to end */}
              <line
                x1={centerX}
                y1={centerY}
                x2={endX}
                y2={endY}
                stroke="#a855f7"
                strokeWidth={2}
                strokeDasharray="6 4"
                opacity={canDrag ? 0.8 : 0.5}
              />
              {/* Start point (small circle at shape center) */}
              <circle
                cx={centerX}
                cy={centerY}
                r={6}
                fill="none"
                stroke="#a855f7"
                strokeWidth={2}
                opacity={canDrag ? 1 : 0.5}
              />
              {/* End point (draggable circle when roll selected, otherwise just visual) */}
              <circle
                cx={endX}
                cy={endY}
                r={8}
                fill={canDrag ? "#a855f7" : "#a855f780"}
                stroke="#0f172a"
                strokeWidth={2}
                style={{ pointerEvents: canDrag ? 'auto' : 'none', cursor: canDrag ? 'ew-resize' : 'default' }}
                onPointerDown={canDrag ? (e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  
                  const handleMove = (ev: PointerEvent) => {
                    const container = containerRef.current
                    if (!container) return
                    const bounds = container.getBoundingClientRect()
                    const x = (ev.clientX - bounds.left - offsetX) / width
                    
                    // Calculate new distance from start position (which might be offset by a path)
                    const newDistance = Math.max(0.05, Math.min(1 - startX, x - startX))
                    onRollDistanceChangeRef.current?.(newDistance)
                  }
                  
                  const handleUp = () => {
                    window.removeEventListener('pointermove', handleMove)
                    window.removeEventListener('pointerup', handleUp)
                    document.body.style.cursor = ''
                  }
                  
                  document.body.style.cursor = 'ew-resize'
                  window.addEventListener('pointermove', handleMove)
                  window.addEventListener('pointerup', handleUp)
                } : undefined}
              />
            </svg>
          </div>
        )
      })()}

      {/* Jump height visualization overlay - show when layer has jump clip */}
      {selectedLayerId && !isPlaying && (() => {
        // Check if layer has any jump clips
        const hasJumpClip = templateClips.some(c => c.layerId === selectedLayerId && c.template === 'jump')
        if (!hasJumpClip) return null
        
        const layer = renderLayers?.find(l => l.id === selectedLayerId)
        if (!layer) return null
        
        const { width, height } = canvasBounds
        if (!width || !height) return null
        
        // Get jumpHeight from the selected clip if available, otherwise first jump clip
        // Prioritize selectedClipId to show handles for the correct clip when multiple exist
        const jumpClip = selectedClipId 
          ? templateClips.find(c => c.id === selectedClipId && c.template === 'jump') 
            ?? templateClips.find(c => c.layerId === selectedLayerId && c.template === 'jump')
          : templateClips.find(c => c.layerId === selectedLayerId && c.template === 'jump')
        const clipJumpHeight = jumpClip?.parameters?.jumpHeight ?? jumpHeight
        
        // Calculate accumulated offset from Roll (if any exists before Jump)
        // Sort clips by start time and find any roll clips that start before this jump
        const layerClips = templateClips
          .filter(c => c.layerId === selectedLayerId)
          .sort((a, b) => (a.start ?? 0) - (b.start ?? 0))
        
        let currentX = layer.x
        let currentY = layer.y
        
        for (const clip of layerClips) {
          // Stop when we reach the jump clip (if it exists in the list)
          // Note: if we are just previewing (no clip yet), we might iterate all.
          // But usually layerClips includes the clip if it exists.
          if (jumpClip && clip.id === jumpClip.id) break
          // If we are just selecting 'jump' template but haven't added it, 
          // we might want to stop at playhead? The loop iterates all clips.
          // Let's assume for new jump, it comes after everything? 
          // Or strictly use the sorted order. If 'jump' is not in list, it goes to end.
          
          if (clip.template === 'path' && clip.parameters?.pathPoints) {
             const points = clip.parameters.pathPoints
             if (points.length > 0) {
               currentX = points[points.length - 1].x
               currentY = points[points.length - 1].y
             }
          }
          
          if (clip.template === 'roll') {
            currentX += clip.parameters?.rollDistance ?? 0.3
          }
        }
        
        // Shape center position (with accumulated offset from prior clips)
        const centerX = currentX * width + offsetX
        const centerY = currentY * height + offsetY
        
        // Top position (jump goes UP by jumpHeight)
        const topX = centerX
        const topY = (currentY - clipJumpHeight) * height + offsetY
        
        // Only allow dragging when jump template is selected OR a jump clip is selected AND not in drawing mode
        const isJumpClipSelected = selectedClipId ? templateClips.some(c => c.id === selectedClipId && c.template === 'jump') : false
        const canDrag = (selectedTemplate === 'jump' || isJumpClipSelected) && !isDrawingPath && !isDrawingLine
        
        return (
          <div 
            className="absolute inset-0" 
            style={{ zIndex: 27, pointerEvents: 'none' }}
          >
            <svg className="h-full w-full" style={{ pointerEvents: 'none' }}>
              {/* Dashed line from center upward */}
              <line
                x1={centerX}
                y1={centerY}
                x2={topX}
                y2={topY}
                stroke="#22c55e"
                strokeWidth={2}
                strokeDasharray="6 4"
                opacity={canDrag ? 0.8 : 0.5}
              />
              {/* Start point (small circle at shape center) */}
              <circle
                cx={centerX}
                cy={centerY}
                r={6}
                fill="none"
                stroke="#22c55e"
                strokeWidth={2}
                opacity={canDrag ? 1 : 0.5}
              />
              {/* Top point (draggable circle when jump selected) */}
              <circle
                cx={topX}
                cy={topY}
                r={8}
                fill={canDrag ? "#22c55e" : "#22c55e80"}
                stroke="#0f172a"
                strokeWidth={2}
                style={{ pointerEvents: canDrag ? 'auto' : 'none', cursor: canDrag ? 'ns-resize' : 'default' }}
                onPointerDown={canDrag ? (e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  
                  const handleMove = (ev: PointerEvent) => {
                    const container = containerRef.current
                    if (!container) return
                    const bounds = container.getBoundingClientRect()
                    const y = (ev.clientY - bounds.top - offsetY) / height
                    
                    // Calculate new height (upward is negative in screen coords)
                    // Use currentY from closure - it's the base position which doesn't change during drag
                    const newHeight = Math.max(0.05, Math.min(currentY, currentY - y))
                    onJumpHeightChangeRef.current?.(newHeight)
                  }
                  
                  const handleUp = () => {
                    window.removeEventListener('pointermove', handleMove)
                    window.removeEventListener('pointerup', handleUp)
                    document.body.style.cursor = ''
                  }
                  
                  document.body.style.cursor = 'ns-resize'
                  window.addEventListener('pointermove', handleMove)
                  window.addEventListener('pointerup', handleUp)
                } : undefined}
              />
            </svg>
          </div>
        )
      })()}

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

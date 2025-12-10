import { Pause, Play, Repeat, SlidersHorizontal, ChevronRight, ChevronDown } from 'lucide-react'
import { useMemo, useState, useRef, useEffect } from 'react'
import { useTimeline, useTimelineActions } from '@/lib/timeline-store'
import { sampleTimeline } from '@/lib/timeline'

interface TimelinePanelProps {
  layers: Array<{ id: string; shapeKind: string; type?: 'shape' | 'image' | 'svg' | 'text' }>
  layerOrder?: string[]
  onReorderLayers?: (order: string[]) => void
  selectedLayerId?: string
  selectedTemplate?: string
  selectedClipId?: string
  isDrawingPath?: boolean
  onFinishPath?: () => void
  onCancelPath?: () => void
  pathPointCount?: number
  onClipClick?: (clip: { id: string; template: string }) => void
  onSelectLayer?: (layerId: string) => void
}

const formatTime = (ms: number) => {
  const clamped = Math.max(0, Math.floor(ms))
  const totalSeconds = Math.floor(clamped / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const centiseconds = Math.floor((clamped % 1000) / 10)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(centiseconds).padStart(2, '0')}`
}

export default function TimelinePanel({ layers, layerOrder = [], onReorderLayers, selectedLayerId, selectedTemplate, selectedClipId, isDrawingPath, onFinishPath, onCancelPath, pathPointCount = 0, onClipClick, onSelectLayer }: TimelinePanelProps) {
  // Split selectors to ensure each value change triggers re-render
  const currentTime = useTimeline((s) => s.currentTime)
  const duration = useTimeline((s) => s.duration)
  const isPlaying = useTimeline((s) => s.isPlaying)
  const loop = useTimeline((s) => s.loop)
  const tracks = useTimeline((s) => s.tracks)
  const templateSpeed = useTimeline((s) => s.templateSpeed)
  const rollDistance = useTimeline((s) => s.rollDistance)
  const jumpHeight = useTimeline((s) => s.jumpHeight)
  const jumpVelocity = useTimeline((s) => s.jumpVelocity)
  const popScale = useTimeline((s) => s.popScale)
  const popWobble = useTimeline((s) => s.popWobble)
  const popSpeed = useTimeline((s) => s.popSpeed)
  const popCollapse = useTimeline((s) => s.popCollapse)
  const templateClips = useTimeline((s) => s.templateClips)
  const clickMarkers = useTimeline((s) => s.clickMarkers)
  const effectClips = useTimeline((s) => s.effectClips)
  const timeline = useTimelineActions()
  const MIN_TIMELINE_MS = 5000 // 5 seconds minimum for free playhead movement
  const safeDuration = Math.max(MIN_TIMELINE_MS, Number.isFinite(duration) ? duration : MIN_TIMELINE_MS)
  // Timeline resize state
  const MIN_HEIGHT = 100
  const MAX_HEIGHT = typeof window !== 'undefined' ? window.innerHeight * 0.8 : 600
  const DEFAULT_HEIGHT = 256
  
  const [timelineHeight, setTimelineHeight] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_HEIGHT
    const saved = localStorage.getItem('timelineHeight')
    return saved ? Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, parseInt(saved))) : DEFAULT_HEIGHT
  })
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null)
  
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartRef = useRef<{ startY: number; startHeight: number } | null>(null)

  // Handle timeline resize
  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation() // Stop event from bubbling
    
    // Capture pointer to ensure we get move events even if mouse leaves element
    const target = e.target as HTMLElement
    target.setPointerCapture(e.pointerId)
    
    setIsResizing(true)
    resizeStartRef.current = {
      startY: e.clientY,
      startHeight: timelineHeight
    }
  }

  useEffect(() => {
    if (!isResizing) return

    const handleResizeMove = (e: PointerEvent) => {
      if (!resizeStartRef.current) return
      
      const deltaY = resizeStartRef.current.startY - e.clientY
      const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, resizeStartRef.current.startHeight + deltaY))
      setTimelineHeight(newHeight)
    }

    const handleResizeEnd = (e: PointerEvent) => {
      setIsResizing(false)
      if (typeof window !== 'undefined') {
        localStorage.setItem('timelineHeight', timelineHeight.toString())
      }
      resizeStartRef.current = null
    }

    window.addEventListener('pointermove', handleResizeMove)
    window.addEventListener('pointerup', handleResizeEnd)
    
    return () => {
      window.removeEventListener('pointermove', handleResizeMove)
      window.removeEventListener('pointerup', handleResizeEnd)
    }
  }, [isResizing, MIN_HEIGHT, MAX_HEIGHT])

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

  const reorderLayerOrder = (sourceId: string, targetId: string) => {
    if (!onReorderLayers) return
    const currentOrder = layerOrder && layerOrder.length ? [...layerOrder] : layers.map((l) => l.id)
    const sourceIdx = currentOrder.indexOf(sourceId)
    const targetIdx = currentOrder.indexOf(targetId)
    if (sourceIdx === -1 || targetIdx === -1 || sourceIdx === targetIdx) return
    const next = [...currentOrder]
    next.splice(sourceIdx, 1)
    next.splice(targetIdx, 0, sourceId)
    onReorderLayers(next)
  }

  const sampled = useMemo(() => sampleTimeline(tracks, currentTime), [tracks, currentTime])
  const selectedSample = selectedLayerId ? sampled[selectedLayerId] : undefined
  const pathClip = useMemo(() => {
    if (!selectedLayerId) return null
    const track = tracks.find((t) => t.layerId === selectedLayerId)
    return track?.paths?.[0] ?? null
  }, [tracks, selectedLayerId])
  const handlePlayClick = () => {
    // If currently playing, just pause (don't reset)
    if (isPlaying) {
      timeline.togglePlay()
      return
    }
    
    // Starting playback - check if we need to reset from end
    const clipsEnd = templateClips.reduce((max, c) => Math.max(max, (c.start ?? 0) + (c.duration ?? 0)), 0)
    
    const getTrackEnd = (track: any) => {
      const times: number[] = []
      if (track.position?.length) times.push(track.position[track.position.length - 1].time)
      if (track.scale?.length) times.push(track.scale[track.scale.length - 1].time)
      if (track.rotation?.length) times.push(track.rotation[track.rotation.length - 1].time)
      if (track.opacity?.length) times.push(track.opacity[track.opacity.length - 1].time)
      return times.length ? Math.max(...times) : 0
    }
    const tracksEnd = tracks.reduce((max, t) => Math.max(max, getTrackEnd(t)), 0)
    
    // Also check paths
    let pathsEnd = 0
    tracks.forEach((t) => {
      (t.paths ?? []).forEach((p) => {
        pathsEnd = Math.max(pathsEnd, p.startTime + p.duration)
      })
    })
    
    // Also check click markers
    const clickMarkersEnd = clickMarkers.reduce((max, m) => Math.max(max, m.time), 0)

    const hasClips = templateClips.length > 0 || tracksEnd > 0 || pathsEnd > 0
    const contentDuration = hasClips 
      ? Math.max(100, tracksEnd, clipsEnd, pathsEnd, clickMarkersEnd) 
      : Math.max(5000, clickMarkersEnd + 500)

    // Only reset to beginning if at or near the end
    if (currentTime >= contentDuration - 50) {
      timeline.setCurrentTime(0)
    }
    timeline.togglePlay()
  }
  const [showTemplateControls] = useState(true)
  const templateControlsVisible = true
  const timelineAreaRef = useRef<HTMLDivElement>(null)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const [scrubTarget, setScrubTarget] = useState<boolean>(false)
  const [isResizingClip, setIsResizingClip] = useState(false)
  const [isMovingClip, setIsMovingClip] = useState(false)
  const [optimisticClip, setOptimisticClip] = useState<{ id: string; start: number; duration: number } | null>(null)
  const resizeStateRef = useRef<{
    clipId: string
    layerId: string
    edge: 'left' | 'right'
    startX: number
    baseStart: number
    baseDuration: number
    currentStart?: number
    currentDuration?: number
  } | null>(null)
  const moveStateRef = useRef<{
    clipId: string
    layerId: string
    startX: number
    baseStart: number
    duration: number
    currentStart?: number
  } | null>(null)
  
  // State for dragging/resizing the Shape Visibility Bar itself
  const [optimisticLayer, setOptimisticLayer] = useState<{ layerId: string; startTime: number; duration: number } | null>(null)
  const [isMovingLayer, setIsMovingLayer] = useState(false)
  const [isResizingLayer, setIsResizingLayer] = useState(false)

  const handleLayerDragStart = (e: React.PointerEvent, layerId: string, start: number, duration: number) => {
    e.stopPropagation()
    const rect = timelineAreaRef.current?.getBoundingClientRect()
    if (!rect) return
    
    layerMoveStateRef.current = {
      layerId,
      startX: e.clientX,
      baseStart: start,
      currentStart: start
    }
    setIsMovingLayer(true)
    setScrubTarget(false)
    setIsScrubbing(false)
  }

  const handleLayerResizeStart = (e: React.PointerEvent, layerId: string, duration: number) => {
    e.stopPropagation()
    const rect = timelineAreaRef.current?.getBoundingClientRect()
    if (!rect) return

    layerResizeStateRef.current = {
      layerId,
      startX: e.clientX,
      baseDuration: duration,
      currentDuration: duration
    }
    setIsResizingLayer(true)
    setScrubTarget(false)
    setIsScrubbing(false)
  }
  
  const layerMoveStateRef = useRef<{
    layerId: string
    startX: number
    baseStart: number
    currentStart?: number
  } | null>(null)

  const layerResizeStateRef = useRef<{
    layerId: string
    startX: number
    baseDuration: number
    currentDuration?: number
  } | null>(null)
  const MIN_CLIP_DURATION = 80 // ms

  const applyScrub = (clientX: number) => {
    const rect = timelineAreaRef.current?.getBoundingClientRect()
    if (!rect) return
    const t = ((clientX - rect.left) / rect.width) * safeDuration
    timeline.setCurrentTime(Math.max(0, Math.min(safeDuration, t)))
  }

  const handleScrubStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isResizingClip || isMovingClip) return
    setIsScrubbing(true)
    setScrubTarget(true)
    applyScrub(e.clientX)
  }

  useEffect(() => {
    if (!isScrubbing || !scrubTarget) return
    const move = (e: PointerEvent) => applyScrub(e.clientX)
    const up = () => setIsScrubbing(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [isScrubbing, scrubTarget])

  const startResize = (e: React.PointerEvent, clip: { id: string; layerId: string; start: number; duration: number }, edge: 'left' | 'right') => {
    e.stopPropagation()
    const rect = timelineAreaRef.current?.getBoundingClientRect()
    if (!rect) return
    resizeStateRef.current = {
      clipId: clip.id,
      layerId: clip.layerId,
      edge,
      startX: e.clientX,
      baseStart: clip.start,
      baseDuration: clip.duration,
    }
    setIsResizingClip(true)
    setScrubTarget(false)
    setIsScrubbing(false)
  }

  const startMove = (e: React.PointerEvent, clip: { id: string; layerId: string; start: number; duration: number; template: any }) => {
    e.stopPropagation()
    onClipClick?.({ id: clip.id, template: clip.template as string })
    const rect = timelineAreaRef.current?.getBoundingClientRect()
    if (!rect) return
    moveStateRef.current = {
      clipId: clip.id,
      layerId: clip.layerId,
      startX: e.clientX,
      baseStart: clip.start,
      duration: clip.duration,
    }
    setIsMovingClip(true)
    setScrubTarget(false)
    setIsScrubbing(false)
  }

  useEffect(() => {
    if (!isResizingClip) return
    const handleMove = (ev: PointerEvent) => {
      const state = resizeStateRef.current
      const rect = timelineAreaRef.current?.getBoundingClientRect()
      if (!state || !rect) return

      const pxPerMs = rect.width / safeDuration
      const deltaMs = (ev.clientX - state.startX) / pxPerMs

      let nextStart = state.baseStart
      let nextDuration = state.baseDuration

      if (state.edge === 'left') {
        nextStart = Math.max(0, state.baseStart + deltaMs)
        const maxStart = state.baseStart + state.baseDuration - MIN_CLIP_DURATION
        nextStart = Math.min(nextStart, maxStart)
        nextDuration = Math.max(MIN_CLIP_DURATION, state.baseDuration - (nextStart - state.baseStart))
      } else {
        nextDuration = Math.max(MIN_CLIP_DURATION, state.baseDuration + deltaMs)
      }

      state.currentStart = Math.round(nextStart)
      state.currentDuration = Math.round(nextDuration)

      setOptimisticClip({
        id: state.clipId,
        start: state.currentStart,
        duration: state.currentDuration,
      })
    }

    const handleUp = () => {
      const state = resizeStateRef.current
      if (state && state.currentStart !== undefined && state.currentDuration !== undefined) {
        timeline.updateTemplateClip(state.layerId, state.clipId, {
          start: state.currentStart,
          duration: state.currentDuration,
        })
      }
      setIsResizingClip(false)
      setOptimisticClip(null)
      resizeStateRef.current = null
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [isResizingClip, safeDuration, timeline])

  useEffect(() => {
    if (!isMovingClip) return
    const handleMove = (ev: PointerEvent) => {
      const state = moveStateRef.current
      const rect = timelineAreaRef.current?.getBoundingClientRect()
      if (!state || !rect) return
      const pxPerMs = rect.width / safeDuration
      const deltaMs = (ev.clientX - state.startX) / pxPerMs
      let nextStart = Math.max(0, Math.round(state.baseStart + deltaMs))
      const clipEnd = nextStart + state.duration
      
      // Magnetic snap threshold (50ms)
      const SNAP_THRESHOLD = 50
      
      // Collect all snap points from layers and other clips
      const snapPoints: number[] = []
      
      // Add layer start/end points
      tracks.forEach(track => {
        snapPoints.push(track.startTime ?? 0)
        snapPoints.push((track.startTime ?? 0) + (track.duration ?? 2000))
      })
      
      // Add other template clip start/end points
      templateClips.forEach(clip => {
        if (clip.id !== state.clipId) {
          snapPoints.push(clip.start ?? 0)
          snapPoints.push((clip.start ?? 0) + (clip.duration ?? 1000))
        }
      })
      
      // Try to snap clip start
      for (const snapPoint of snapPoints) {
        if (Math.abs(nextStart - snapPoint) <= SNAP_THRESHOLD) {
          nextStart = snapPoint
          break
        }
        // Try to snap clip end
        if (Math.abs(clipEnd - snapPoint) <= SNAP_THRESHOLD) {
          nextStart = snapPoint - state.duration
          break
        }
      }
      
      state.currentStart = Math.max(0, nextStart)
      
      setOptimisticClip({
        id: state.clipId,
        start: state.currentStart,
        duration: state.duration,
      })
    }
    const handleUp = () => {
      const state = moveStateRef.current
      if (state && state.currentStart !== undefined) {
        timeline.updateTemplateClip(state.layerId, state.clipId, {
          start: state.currentStart,
          duration: state.duration,
        })
      }
      setIsMovingClip(false)
      setOptimisticClip(null)
      moveStateRef.current = null
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [isMovingClip, safeDuration, timeline])

  // Effect for Moving Layer visibility bar
  useEffect(() => {
    if (!isMovingLayer) return
    const handleMove = (ev: PointerEvent) => {
      const state = layerMoveStateRef.current
      const rect = timelineAreaRef.current?.getBoundingClientRect()
      if (!state || !rect) return
      
      const pxPerMs = rect.width / safeDuration
      const deltaMs = (ev.clientX - state.startX) / pxPerMs
      let nextStart = Math.max(0, Math.round(state.baseStart + deltaMs))
      
      const track = tracks.find(t => t.layerId === state.layerId)
      const duration = track?.duration ?? 2000
      const layerEnd = nextStart + duration
      
      // Magnetic snap threshold (50ms)
      const SNAP_THRESHOLD = 50
      
      // Collect snap points from other layers AND template clips
      const snapPoints: number[] = []
      tracks.forEach(t => {
        if (t.layerId !== state.layerId) {
          snapPoints.push(t.startTime ?? 0)
          snapPoints.push((t.startTime ?? 0) + (t.duration ?? 2000))
        }
      })
      
      // Add template clip edges (including transition clips)
      templateClips.forEach(clip => {
        snapPoints.push(clip.start ?? 0)
        snapPoints.push((clip.start ?? 0) + (clip.duration ?? 1000))
      })
      
      // Try to snap layer start or end
      for (const snapPoint of snapPoints) {
        if (Math.abs(nextStart - snapPoint) <= SNAP_THRESHOLD) {
          nextStart = snapPoint
          break
        }
        if (Math.abs(layerEnd - snapPoint) <= SNAP_THRESHOLD) {
          nextStart = snapPoint - duration
          break
        }
      }
      
      state.currentStart = Math.max(0, nextStart)

      setOptimisticLayer({
        layerId: state.layerId,
        startTime: state.currentStart,
        duration: duration
      })
    }

    const handleUp = () => {
       const state = layerMoveStateRef.current
       if (state && state.currentStart !== undefined) {
         const delta = state.currentStart - state.baseStart
         
         // Update the layer's start time
         timeline.updateLayer(state.layerId, {
           startTime: state.currentStart
         })
         
         // Move all template clips for this layer by the same delta
         templateClips
           .filter(c => c.layerId === state.layerId)
           .forEach(clip => {
             timeline.updateTemplateClip(state.layerId, clip.id, {
               start: clip.start + delta
             })
           })
         
         // Move all effect clips for this layer by the same delta
         effectClips
           .filter(c => c.layerId === state.layerId)
           .forEach(clip => {
             timeline.updateEffectClip(clip.id, {
               start: clip.start + delta
             })
           })
       }
       setIsMovingLayer(false)
       setOptimisticLayer(null)
       layerMoveStateRef.current = null
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [isMovingLayer, safeDuration, timeline, tracks])

  // Effect for Resizing Layer visibility bar
  useEffect(() => {
    if (!isResizingLayer) return
    const handleMove = (ev: PointerEvent) => {
      const state = layerResizeStateRef.current
      const rect = timelineAreaRef.current?.getBoundingClientRect()
      if (!state || !rect) return

      const pxPerMs = rect.width / safeDuration
      const deltaMs = (ev.clientX - state.startX) / pxPerMs
      
      const track = tracks.find(t => t.layerId === state.layerId)
      const startTime = track?.startTime ?? 0
      
      // Calculate minimum duration based on template clips for this layer
      const layerClips = templateClips.filter(c => c.layerId === state.layerId)
      const templateClipsEnd = layerClips.reduce((max, c) => {
        const clipEnd = (c.start ?? 0) + (c.duration ?? 0) - startTime
        return Math.max(max, clipEnd)
      }, 0)
      const minDuration = Math.max(100, templateClipsEnd) // Min 100ms or templates' end
      
      let newDuration = Math.max(minDuration, Math.round(state.baseDuration + deltaMs))
      
      // Snap logic: snap to template clip edges and other shapes' bars (50ms threshold)
      const SNAP_THRESHOLD = 50
      const newEndTime = startTime + newDuration
      let snapped = false
      
      // 1. Snap to own template clips
      for (const clip of layerClips) {
        if (snapped) break
        const clipStart = clip.start ?? 0
        const clipEnd = clipStart + (clip.duration ?? 0)
        
        // Snap to clip end
        if (Math.abs(newEndTime - clipEnd) <= SNAP_THRESHOLD) {
          newDuration = clipEnd - startTime
          snapped = true
          break
        }
        // Snap to clip start
        if (Math.abs(newEndTime - clipStart) <= SNAP_THRESHOLD) {
          newDuration = clipStart - startTime
          if (newDuration < minDuration) newDuration = minDuration
          snapped = true
          break
        }
      }
      
      // 2. Snap to other shapes' visibility bars
      if (!snapped) {
        for (const otherTrack of tracks) {
          if (snapped) break
          if (otherTrack.layerId === state.layerId) continue // Skip self
          
          const otherStart = otherTrack.startTime ?? 0
          const otherEnd = otherStart + (otherTrack.duration ?? 0)
          
          // Snap to other shape's start
          if (Math.abs(newEndTime - otherStart) <= SNAP_THRESHOLD) {
            newDuration = otherStart - startTime
            if (newDuration >= minDuration) snapped = true
          }
          // Snap to other shape's end
          if (!snapped && Math.abs(newEndTime - otherEnd) <= SNAP_THRESHOLD) {
            newDuration = otherEnd - startTime
            if (newDuration >= minDuration) snapped = true
          }
        }
      }
      
      state.currentDuration = newDuration

      setOptimisticLayer({
        layerId: state.layerId,
        startTime: startTime,
        duration: newDuration
      })
    }

    const handleUp = () => {
      const state = layerResizeStateRef.current
      if (state && state.currentDuration !== undefined) {
        timeline.updateLayer(state.layerId, {
          duration: state.currentDuration
        })
      }
      setIsResizingLayer(false)
      setOptimisticLayer(null)
      layerResizeStateRef.current = null
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [isResizingLayer, safeDuration, timeline, tracks])

  const [collapsedLayers, setCollapsedLayers] = useState<Record<string, boolean>>({})

  const toggleLayer = (layerId: string) => {
    setCollapsedLayers(prev => ({
      ...prev,
      [layerId]: !prev[layerId]
    }))
  }

  useEffect(() => {
    if (isResizing) {
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'row-resize'
    } else {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    return () => {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isResizing])

  return (
    <div 
      className={`border-t border-white/5 bg-[#0a0a0a] z-40 flex flex-col relative ${isResizing ? '' : 'transition-[height] duration-75 ease-out'}`}
      style={{ height: timelineHeight }}
    >
      {/* Resize Handle */}
      <div
        className="absolute -top-1.5 left-0 right-0 h-3 cursor-row-resize z-50 group flex items-center justify-center"
        onPointerDown={handleResizeStart}
      >
        <div className="w-full h-[2px] bg-transparent group-hover:bg-violet-500/50 group-active:bg-violet-500 transition-colors" />
      </div>
      <div className="flex h-10 items-center justify-between border-b border-white/5 px-4 bg-white/[0.02]">
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-bold tracking-widest text-neutral-600">TIMELINE</span>
          <div className="h-3 w-px bg-white/5" />
          <span className="text-[10px] font-mono text-violet-500/80 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayClick}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-violet-500/30 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 hover:scale-105 transition-all"
          >
            {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 fill-current" />}
          </button>
          <button
            onClick={() => timeline.setLoop(!loop)}
            className="inline-flex h-7 px-2 items-center justify-center gap-1 rounded-full border border-white/10 bg-white/[0.04] text-[11px] text-neutral-300 hover:bg-white/[0.1] transition-colors"
          >
            <Repeat className="h-3 w-3" />
            <span>{loop ? 'Loop' : 'No Loop'}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Full Width Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-rose-500 z-10 pointer-events-none"
            style={{ left: `calc(200px + ${(Math.min(currentTime, safeDuration) / safeDuration) * (100 - (200 / (typeof window !== 'undefined' ? window.innerWidth : 1920)) * 100)}%)` }}
          />

          {/* Time Ruler */}
          <div className="flex h-8 border-b border-white/5 bg-white/[0.01] shrink-0">
            <div className="w-[200px] border-r border-white/5 flex items-center px-4">
              <span className="text-[10px] font-semibold text-neutral-500">LAYER</span>
            </div>
            <div
              ref={timelineAreaRef}
              className="flex-1 relative cursor-col-resize"
              onPointerDown={handleScrubStart}
            >
              <div className="absolute inset-0 pointer-events-none">
                <div className="flex h-full w-full">
                  {Array.from({ length: Math.max(2, Math.ceil(safeDuration / 1000) + 1) }).map((_, idx) => {
                    const left = (idx * 1000) / safeDuration * 100
                    return (
                      <div key={idx} className="absolute top-0 bottom-0 border-l border-white/5 text-[10px] text-neutral-500" style={{ left: `${left}%` }}>
                        <span className="absolute top-1 left-1">{idx}s</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Timeline Tracks */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {layers.length === 0 && (
              <div className="flex items-center justify-center h-full text-[12px] text-neutral-500">
                Add a shape to populate the timeline.
              </div>
            )}
            {orderedLayers.map((layer, idx) => {
              const clips = templateClips.filter((c) => c.layerId === layer.id).sort((a, b) => a.start - b.start)
              const isCollapsed = collapsedLayers[layer.id]
              
              // Calculate summary bar dimensions
              const minStart = clips.length > 0 ? clips[0].start : 0
              const maxEnd = clips.length > 0 ? clips[clips.length - 1].start + clips[clips.length - 1].duration : 0
              const summaryDuration = maxEnd - minStart
              const summaryLeft = (minStart / safeDuration) * 100
              const summaryWidth = Math.max(0, (summaryDuration / safeDuration) * 100)

              return (
                <div
                  key={layer.id}
                  className="flex flex-col border-b border-white/5"
                >
                  {/* Layer Header */}
                  <div 
                    className="flex h-8 bg-white/[0.02] hover:bg-white/[0.04] transition-colors group"
                  >
                    <div 
                      className="w-[200px] border-r border-white/5 flex items-center px-2 gap-2 cursor-grab active:cursor-grabbing"
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation()
                        setDraggingLayerId(layer.id)
                        // Add drag image offset to center on cursor
                        const target = e.currentTarget as HTMLElement
                        target.style.opacity = '0.5'
                      }}
                      onDragEnd={(e) => {
                        setDraggingLayerId(null)
                        const target = e.currentTarget as HTMLElement
                        target.style.opacity = '1'
                      }}
                      onDragOver={(e) => {
                        if (!draggingLayerId || draggingLayerId === layer.id) return
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (!draggingLayerId || draggingLayerId === layer.id) return
                        reorderLayerOrder(draggingLayerId, layer.id)
                        setDraggingLayerId(null)
                      }}
                    >
                      {/* Drag Handle */}
                      <div className="text-neutral-600 group-hover:text-neutral-400 transition-colors flex-shrink-0">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                          <circle cx="3" cy="3" r="1" />
                          <circle cx="3" cy="6" r="1" />
                          <circle cx="3" cy="9" r="1" />
                          <circle cx="6" cy="3" r="1" />
                          <circle cx="6" cy="6" r="1" />
                          <circle cx="6" cy="9" r="1" />
                        </svg>
                      </div>
                      <div 
                        className="text-neutral-500 group-hover:text-neutral-300 transition-colors cursor-pointer flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleLayer(layer.id)
                        }}
                      >
                        {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </div>
                      <span className="text-[11px] font-medium text-neutral-200 truncate select-none flex-1">
                        {layer.type === 'text' ? 'Text' : layer.type === 'image' ? 'Image' : (layer.shapeKind ? `${layer.shapeKind.charAt(0).toUpperCase()}${layer.shapeKind.slice(1)}` : 'Layer')} {idx + 1}
                      </span>
                    </div>
                    <div className="flex-1 relative border-l border-white/5">
                      {/* Grid lines for header */}
                      <div className="absolute inset-0 pointer-events-none opacity-20">
                        <div className="flex h-full w-full">
                          {Array.from({ length: Math.max(2, Math.ceil(safeDuration / 1000) + 1) }).map((_, i) => {
                            const left = (i * 1000) / safeDuration * 100
                            return (
                              <div key={i} className="absolute top-0 bottom-0 border-l border-white/10" style={{ left: `${left}%` }} />
                            )
                          })}
                        </div>
                      </div>
                      
                      
                      {/* Shape Visibility Bar (Parent Container) */}
                      {(() => {
                        const track = tracks.find(t => t.layerId === layer.id)
                        const isOptimistic = optimisticLayer?.layerId === layer.id
                        const startTime = isOptimistic ? optimisticLayer!.startTime : (track?.startTime ?? 0)
                        const duration = isOptimistic ? optimisticLayer!.duration : (track?.duration ?? 2000)
                        
                        const left = (startTime / safeDuration) * 100
                        const width = Math.max(0, (duration / safeDuration) * 100)
                        
                        // Check if locked (has children)
                        const hasClips = clips.length > 0
                        const hasPaths = (track?.paths?.length ?? 0) > 0
                        // Keyframes check could be complex, for now let's stick to clips/paths as "children"
                        const isLocked = hasClips || hasPaths || hasPaths

                        return (
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 h-5 rounded-sm border transition-all z-20 group/bar cursor-pointer
                              ${isOptimistic ? 'bg-purple-500/60 border-purple-500/80' : selectedLayerId === layer.id ? 'bg-purple-500/60 border-purple-500' : 'bg-purple-500/40 border-purple-500/50 hover:bg-purple-500/50'}
                            `}
                            style={{ left: `${left}%`, width: `${width}%` }}
                            onClick={() => onSelectLayer?.(layer.id)}
                            onPointerDown={(e) => handleLayerDragStart(e, layer.id, startTime, duration)}
                          >
                             {/* Label */}
                             <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-medium text-white/90 truncate pointer-events-none opacity-0 group-hover/bar:opacity-100 transition-opacity">
                               {layer.shapeKind || 'Shape'}
                             </span>

                             {/* Resize Handle (Right) - Always visible */}
                             <div
                               className="absolute right-0 top-0 bottom-0 w-3 cursor-e-resize flex items-center justify-center hover:bg-white/10"
                               onPointerDown={(e) => handleLayerResizeStart(e, layer.id, duration)}
                               onClick={(e) => e.stopPropagation()}
                             >
                               <div className="w-[1px] h-3 bg-white/40" />
                             </div>
                          </div>
                        )
                      })()}
                      
                      {/* Click Markers as dots */}
                      {clickMarkers
                        .filter((m) => m.layerId === layer.id)
                        .map((marker) => {
                          const markerLeft = (marker.time / safeDuration) * 100
                          return (
                            <div
                              key={marker.id}
                              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-purple-500 border-2 border-white cursor-grab hover:scale-125 transition-transform z-10"
                              style={{ left: `${markerLeft}%`, transform: 'translate(-50%, -50%)' }}
                              title={`Click at ${Math.round(marker.time)}ms`}
                              onPointerDown={(e) => {
                                e.stopPropagation()
                                // Start dragging the marker
                                const rect = e.currentTarget.parentElement?.getBoundingClientRect()
                                if (!rect) return
                                const startX = e.clientX
                                const baseTime = marker.time
                                
                                const onMove = (ev: PointerEvent) => {
                                  const pxPerMs = rect.width / safeDuration
                                  const deltaMs = (ev.clientX - startX) / pxPerMs
                                  const newTime = Math.max(0, Math.min(safeDuration, baseTime + deltaMs))
                                  timeline.updateClickMarker(marker.id, newTime)
                                }
                                
                                const onUp = () => {
                                  window.removeEventListener('pointermove', onMove)
                                  window.removeEventListener('pointerup', onUp)
                                }
                                
                                window.addEventListener('pointermove', onMove)
                                window.addEventListener('pointerup', onUp)
                              }}
                            />
                          )
                        })
                      }
                    </div>
                  </div>

                  {/* Clip Rows - Conditionally Rendered */}
                  {!isCollapsed && clips.map((clip) => {
                    const isOptimistic = optimisticClip?.id === clip.id
                    const start = isOptimistic ? optimisticClip!.start : clip.start
                    const duration = isOptimistic ? optimisticClip!.duration : clip.duration
                    const left = (start / safeDuration) * 100
                    const width = Math.max(2, (duration / safeDuration) * 100)
                    const isSelected = clip.id === selectedClipId
                    const clipClasses = [
                      'absolute top-1/2 -translate-y-1/2 h-6 rounded-md border px-2 text-[10px] text-white flex items-center gap-1 shadow-lg overflow-hidden transition-all',
                      'bg-gradient-to-r from-purple-500/40 to-purple-600/40 border-purple-500/50 hover:brightness-110',
                      isSelected ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-black/40' : '',
                    ]

                    return (
                      <div key={clip.id} className="flex h-8 border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                        {/* Clip Label Column */}
                        <div 
                          className="w-[200px] border-r border-white/5 flex items-center px-8 cursor-pointer hover:bg-white/[0.04]"
                          onClick={() => onClipClick?.({ id: clip.id, template: clip.template as string })}
                        >
                          <span className="text-[10px] text-neutral-400 truncate capitalize select-none">
                            {clip.template}
                          </span>
                        </div>
                        
                        {/* Clip Track Area */}
                        <div className="flex-1 relative cursor-default border-l border-white/5">
                           {/* Grid lines for clip row */}
                           <div className="absolute inset-0 pointer-events-none opacity-20">
                            <div className="flex h-full w-full">
                              {Array.from({ length: Math.max(2, Math.ceil(safeDuration / 1000) + 1) }).map((_, i) => {
                                const left = (i * 1000) / safeDuration * 100
                                return (
                                  <div key={i} className="absolute top-0 bottom-0 border-l border-white/10" style={{ left: `${left}%` }} />
                                )
                              })}
                            </div>
                          </div>

                          <div
                            className={clipClasses.filter(Boolean).join(' ')}
                            style={{ left: `${left}%`, width: `${width}%` }}
                            onClick={(e) => {
                              e.stopPropagation()
                              onClipClick?.({ id: clip.id, template: clip.template as string })
                            }}
                            onPointerDown={(e) => startMove(e, clip)}
                          >
                            <span className="font-semibold capitalize truncate select-none">{clip.template}</span>
                            <div
                              className="absolute right-0 top-0 h-full w-3 cursor-col-resize bg-white/15 z-10 hover:bg-white/30 transition-colors"
                              onPointerDown={(e) => startResize(e, clip, 'right')}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {/* Effect Clip Rows - Render after template clips */}
                  {!isCollapsed && effectClips
                    .filter((c) => c.layerId === layer.id)
                    .map((clip) => {
                      const left = (clip.start / safeDuration) * 100
                      const width = Math.max(2, (clip.duration / safeDuration) * 100)
                      
                      return (
                        <div key={clip.id} className="flex h-8 border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                          {/* Effect Label Column */}
                          <div className="w-[200px] border-r border-white/5 flex items-center px-8">
                            <span className="text-[10px] text-neutral-400 truncate capitalize select-none">
                              ✨ {clip.effectType}
                            </span>
                          </div>
                          
                          {/* Effect Track Area */}
                          <div className="flex-1 relative cursor-default border-l border-white/5">
                            {/* Grid lines for effect row */}
                            <div className="absolute inset-0 pointer-events-none opacity-20">
                              <div className="flex h-full w-full">
                                {Array.from({ length: Math.max(2, Math.ceil(safeDuration / 1000) + 1) }).map((_, i) => {
                                  const gridLeft = (i * 1000) / safeDuration * 100
                                  return (
                                    <div key={i} className="absolute top-0 bottom-0 border-l border-white/10" style={{ left: `${gridLeft}%` }} />
                                  )
                                })}
                              </div>
                            </div>

                            {/* Effect Clip Bar */}
                            <div
                              className="absolute top-1/2 -translate-y-1/2 h-6 rounded-md border px-2 text-[10px] text-white flex items-center gap-1 shadow-lg overflow-hidden transition-all bg-gradient-to-r from-purple-500/40 to-purple-600/40 border-purple-500/50 hover:brightness-110 cursor-grab"
                              style={{ left: `${left}%`, width: `${width}%` }}
                              onPointerDown={(e) => {
                                e.stopPropagation()
                                const rect = e.currentTarget.parentElement?.getBoundingClientRect()
                                if (!rect) return
                                const startX = e.clientX
                                const baseStart = clip.start
                                
                                const onMove = (ev: PointerEvent) => {
                                  const pxPerMs = rect.width / safeDuration
                                  const deltaMs = (ev.clientX - startX) / pxPerMs
                                  const newStart = Math.max(0, baseStart + deltaMs)
                                  timeline.updateEffectClip(clip.id, { start: newStart })
                                }
                                
                                const onUp = () => {
                                  window.removeEventListener('pointermove', onMove)
                                  window.removeEventListener('pointerup', onUp)
                                }
                                
                                window.addEventListener('pointermove', onMove)
                                window.addEventListener('pointerup', onUp)
                              }}
                            >
                              <span className="font-semibold capitalize truncate select-none">✨ {clip.effectType}</span>
                              {/* Resize Handle */}
                              <div
                                className="absolute right-0 top-0 h-full w-3 cursor-col-resize bg-white/15 z-10 hover:bg-white/30 transition-colors"
                                onPointerDown={(e) => {
                                  e.stopPropagation()
                                  const rect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect()
                                  if (!rect) return
                                  const startX = e.clientX
                                  const baseDuration = clip.duration
                                  
                                  const onMove = (ev: PointerEvent) => {
                                    const pxPerMs = rect.width / safeDuration
                                    const deltaMs = (ev.clientX - startX) / pxPerMs
                                    const newDuration = Math.max(100, baseDuration + deltaMs)
                                    timeline.updateEffectClip(clip.id, { duration: newDuration })
                                  }
                                  
                                  const onUp = () => {
                                    window.removeEventListener('pointermove', onMove)
                                    window.removeEventListener('pointerup', onUp)
                                  }
                                  
                                  window.addEventListener('pointermove', onMove)
                                  window.addEventListener('pointerup', onUp)
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })
                  }
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

import { Pause, Play, Repeat, SlidersHorizontal, ChevronRight, ChevronDown } from 'lucide-react'
import { useMemo, useState, useRef, useEffect } from 'react'
import { useTimeline, useTimelineActions } from '@/lib/timeline-store'
import { sampleTimeline } from '@/lib/timeline'

interface TimelinePanelProps {
  layers: Array<{ id: string; shapeKind: string }>
  layerOrder?: string[]
  onReorderLayers?: (order: string[]) => void
  selectedLayerId?: string
  selectedTemplate?: string
  isDrawingPath?: boolean
  onFinishPath?: () => void
  onCancelPath?: () => void
  pathPointCount?: number
  onClipClick?: (clip: { id: string; template: string }) => void
}

const formatTime = (ms: number) => {
  const clamped = Math.max(0, Math.floor(ms))
  const totalSeconds = Math.floor(clamped / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const centiseconds = Math.floor((clamped % 1000) / 10)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(centiseconds).padStart(2, '0')}`
}

export default function TimelinePanel({ layers, layerOrder = [], onReorderLayers, selectedLayerId, selectedTemplate, isDrawingPath, onFinishPath, onCancelPath, pathPointCount = 0, onClipClick }: TimelinePanelProps) {
  const { currentTime, duration, isPlaying, loop, tracks, templateSpeed, rollDistance, jumpHeight, jumpVelocity, popScale, popWobble, popSpeed, popCollapse, templateClips } = useTimeline((s) => ({
    currentTime: s.currentTime,
    duration: s.duration,
    isPlaying: s.isPlaying,
    loop: s.loop,
    tracks: s.tracks,
    templateSpeed: s.templateSpeed,
    rollDistance: s.rollDistance,
    jumpHeight: s.jumpHeight,
    jumpVelocity: s.jumpVelocity,
    popScale: s.popScale,
    popWobble: s.popWobble,
    popSpeed: s.popSpeed,
    popCollapse: s.popCollapse,
    templateClips: s.templateClips,
  }))
  const timeline = useTimelineActions()
  const safeDuration = Math.max(1, duration)
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
    // Calculate actual content duration (ignoring the 4s minimum padding)
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

    const contentDuration = Math.max(100, tracksEnd, clipsEnd, pathsEnd)

    // If at or near the end of CONTENT, reset to beginning before playing
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
      const nextStart = Math.max(0, Math.round(state.baseStart + deltaMs))
      state.currentStart = nextStart
      
      setOptimisticClip({
        id: state.clipId,
        start: nextStart,
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
        className="absolute -top-1 left-0 right-0 h-2 cursor-row-resize hover:bg-emerald-500/50 transition-colors z-50 active:bg-emerald-500"
        onPointerDown={handleResizeStart}
      />
      <div className="flex h-10 items-center justify-between border-b border-white/5 px-4 bg-white/[0.02]">
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-bold tracking-widest text-neutral-600">TIMELINE</span>
          <div className="h-3 w-px bg-white/5" />
          <span className="text-[10px] font-mono text-emerald-500/80 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayClick}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-neutral-100 hover:bg-white/[0.12] transition-colors"
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
                        {layer.shapeKind ? `${layer.shapeKind.charAt(0).toUpperCase()}${layer.shapeKind.slice(1)}` : 'Layer'} {idx + 1}
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
                      
                      {/* Summary Bar */}
                      {clips.length > 0 && (
                        <div
                          className="absolute top-1/2 -translate-y-1/2 h-4 rounded-sm bg-purple-500/30 border border-purple-500/30"
                          style={{ left: `${summaryLeft}%`, width: `${summaryWidth}%` }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Clip Rows - Conditionally Rendered */}
                  {!isCollapsed && clips.map((clip) => {
                    const isOptimistic = optimisticClip?.id === clip.id
                    const start = isOptimistic ? optimisticClip!.start : clip.start
                    const duration = isOptimistic ? optimisticClip!.duration : clip.duration
                    const left = (start / safeDuration) * 100
                    const width = Math.max(2, (duration / safeDuration) * 100)

                    return (
                      <div key={clip.id} className="flex h-8 border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                        {/* Clip Label Column */}
                        <div className="w-[200px] border-r border-white/5 flex items-center px-8">
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
                            className="absolute top-1/2 -translate-y-1/2 h-6 rounded-md bg-gradient-to-r from-purple-500/40 to-purple-600/40 border border-purple-500/50 px-2 text-[10px] text-white flex items-center gap-1 shadow-lg overflow-hidden hover:brightness-110 transition-all"
                            style={{ left: `${left}%`, width: `${width}%` }}
                            onPointerDown={(e) => startMove(e, clip)}
                          >
                            <span className="font-semibold capitalize truncate select-none">{clip.template}</span>
                            <div
                              className="absolute right-0 top-0 h-full w-3 cursor-col-resize bg-white/15 z-10 hover:bg-white/30 transition-colors"
                              onPointerDown={(e) => startResize(e, clip, 'right')}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { Pause, Play, Repeat, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState, useRef, useEffect } from 'react'
import { useTimeline, useTimelineActions } from '@/lib/timeline-store'
import { sampleTimeline } from '@/lib/timeline'

interface TimelinePanelProps {
  layers: Array<{ id: string; shapeKind: string }>
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

export default function TimelinePanel({ layers, selectedLayerId, selectedTemplate, isDrawingPath, onFinishPath, onCancelPath, pathPointCount = 0, onClipClick }: TimelinePanelProps) {
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
  const sampled = useMemo(() => sampleTimeline(tracks, currentTime), [tracks, currentTime])
  const selectedSample = selectedLayerId ? sampled[selectedLayerId] : undefined
  const pathClip = useMemo(() => {
    if (!selectedLayerId) return null
    const track = tracks.find((t) => t.layerId === selectedLayerId)
    return track?.paths?.[0] ?? null
  }, [tracks, selectedLayerId])
  const handlePlayClick = () => {
    if (!isPlaying && currentTime >= duration) {
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

  return (
    <div className="h-64 border-t border-white/5 bg-[#0a0a0a] z-40 flex flex-col">
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

      <div className="flex flex-1 overflow-hidden">
        {/* Full Width Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-rose-500 z-10 pointer-events-none"
            style={{ left: `calc(200px + ${(Math.min(currentTime, safeDuration) / safeDuration) * (100 - (200 / (typeof window !== 'undefined' ? window.innerWidth : 1920)) * 100)}%)` }}
          />

          {/* Time Ruler */}
          <div className="flex h-8 border-b border-white/5 bg-white/[0.01]">
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
          <div className="flex-1 overflow-auto">
            {layers.length === 0 && (
              <div className="flex items-center justify-center h-full text-[12px] text-neutral-500">
                Add a shape to populate the timeline.
              </div>
            )}
            {layers.map((layer, idx) => {
              const clips = templateClips.filter((c) => c.layerId === layer.id).sort((a, b) => a.start - b.start)
              return (
                <div key={layer.id} className="flex h-12 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  {/* Layer Name */}
                  <div className="w-[200px] border-r border-white/5 flex items-center px-4">
                    <span className="text-[11px] font-medium text-neutral-200 truncate">
                      {layer.shapeKind === 'circle' ? 'Circle' : 'Layer'} {idx + 1}
                    </span>
                  </div>
                  {/* Timeline Bar */}
                  <div className="flex-1 relative cursor-default">
                    {clips.map((clip) => {
                      const isOptimistic = optimisticClip?.id === clip.id
                      const start = isOptimistic ? optimisticClip!.start : clip.start
                      const duration = isOptimistic ? optimisticClip!.duration : clip.duration
                      const left = (start / safeDuration) * 100
                      const width = Math.max(2, (duration / safeDuration) * 100)
                      return (
                        <div
                          key={clip.id}
                          className="absolute top-1/2 -translate-y-1/2 h-8 rounded-md bg-gradient-to-r from-purple-500/40 to-purple-600/40 border border-purple-500/50 px-2 text-[10px] text-white flex items-center gap-1 shadow-lg overflow-hidden"
                          style={{ left: `${left}%`, width: `${width}%` }}
                          onPointerDown={(e) => startMove(e, clip)}
                        >
                          <span className="font-semibold capitalize truncate">{clip.template}</span>
                          <div
                            className="absolute right-0 top-0 h-full w-3 cursor-col-resize bg-white/15 z-10"
                            onPointerDown={(e) => startResize(e, clip, 'right')}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

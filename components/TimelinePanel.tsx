'use client'

import { Pause, Play, Repeat, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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
}

const formatTime = (ms: number) => {
  const clamped = Math.max(0, Math.floor(ms))
  const totalSeconds = Math.floor(clamped / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const centiseconds = Math.floor((clamped % 1000) / 10)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(centiseconds).padStart(2, '0')}`
}

export default function TimelinePanel({ layers, selectedLayerId, selectedTemplate, isDrawingPath, onFinishPath, onCancelPath, pathPointCount = 0 }: TimelinePanelProps) {
  const { currentTime, duration, isPlaying, loop, tracks, templateSpeed, rollDistance, jumpHeight, popScale, popWobble, popSpeed, popCollapse } = useTimeline((s) => ({
    currentTime: s.currentTime,
    duration: s.duration,
    isPlaying: s.isPlaying,
    loop: s.loop,
    tracks: s.tracks,
    templateSpeed: s.templateSpeed,
    rollDistance: s.rollDistance,
    jumpHeight: s.jumpHeight,
    popScale: s.popScale,
    popWobble: s.popWobble,
    popSpeed: s.popSpeed,
    popCollapse: s.popCollapse,
  }))
  const timeline = useTimelineActions()
  const safeDuration = Math.max(1, duration)
  const sampled = useMemo(() => sampleTimeline(tracks, currentTime), [tracks, currentTime])
  const selectedSample = selectedLayerId ? sampled[selectedLayerId] : undefined
  const state = useTimeline((s) => s)
  const handlePlayClick = () => {
    if (!isPlaying && currentTime >= duration) {
      timeline.setCurrentTime(0)
    }
    timeline.togglePlay()
  }
  const [showTemplateControls, setShowTemplateControls] = useState(false)

  useEffect(() => {
    if (selectedTemplate) {
      setShowTemplateControls(true)
    }
  }, [selectedTemplate])

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
      <div className="px-4 py-3">
        <input
          type="range"
          min={0}
          max={safeDuration}
          step={16}
          value={Math.min(currentTime, safeDuration)}
          onChange={(e) => timeline.setCurrentTime(Number(e.target.value))}
          className="w-full accent-emerald-500"
        />
      </div>
      <div className="relative flex-1 w-full px-4 pb-4 overflow-x-auto">
        <div className="space-y-2">
          {isDrawingPath && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 shadow-inner">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-neutral-100">Path Recording</span>
                <span className="text-[10px] text-emerald-400 font-mono">{pathPointCount} pts</span>
              </div>
              <p className="text-[11px] text-neutral-300 mb-2">Click on canvas to add points. Double-click or press Finish.</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onFinishPath?.()}
                  className="inline-flex items-center justify-center rounded-md bg-emerald-500/80 px-3 py-1 text-[11px] font-semibold text-black hover:bg-emerald-400"
                >
                  Finish Path
                </button>
                <button
                  onClick={() => onCancelPath?.()}
                  className="inline-flex items-center justify-center rounded-md border border-white/10 px-3 py-1 text-[11px] font-semibold text-neutral-200 hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {selectedLayerId && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 shadow-inner">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-neutral-200">Size</span>
                <span className="text-[10px] text-neutral-400">Scale: {(selectedSample?.scale ?? 1).toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={3}
                step={0.01}
                value={selectedSample?.scale ?? 1}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  timeline.ensureTrack(selectedLayerId)
                  timeline.setScaleKeyframe(selectedLayerId, { time: currentTime, value: val })
                }}
                className="w-full accent-emerald-500"
              />
            </div>
          )}
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 shadow-inner">
            <button
              className="flex w-full items-center justify-between text-[11px] font-semibold text-neutral-200"
              onClick={() => setShowTemplateControls((v) => !v)}
            >
              <span className="inline-flex items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Template Controls
              </span>
              <span className="text-[10px] text-neutral-400">{showTemplateControls ? 'Hide' : 'Show'}</span>
            </button>
            {showTemplateControls && (
              <div className="mt-3 space-y-4">
                {selectedTemplate === 'roll' && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-neutral-200">Roll Speed</span>
                        <span className="text-[10px] text-neutral-400">{(templateSpeed ?? 1).toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min={0.25}
                        max={3}
                        step={0.05}
                        value={templateSpeed}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          timeline.setTemplateSpeed(val)
                        }}
                        className="w-full accent-emerald-500"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2 mt-1">
                        <span className="text-[11px] font-semibold text-neutral-200">Roll Distance</span>
                        <span className="text-[10px] text-neutral-400">{(rollDistance ?? 0.2).toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min={0.05}
                        max={1}
                        step={0.01}
                        value={rollDistance ?? 0.2}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          timeline.setRollDistance(val)
                        }}
                        className="w-full accent-emerald-500"
                      />
                    </div>
                  </>
                )}
                {selectedTemplate === 'jump' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-neutral-200">Jump Height</span>
                      <span className="text-[10px] text-neutral-400">{(jumpHeight ?? 0.25).toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.05}
                      max={0.8}
                      step={0.01}
                      value={jumpHeight ?? 0.25}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        timeline.setJumpHeight(val)
                      }}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                )}
                {selectedTemplate === 'pop' && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-neutral-200">Scale</span>
                        <span className="text-[10px] text-neutral-400">{(popScale ?? 1.6).toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.05}
                        value={popScale ?? 1.6}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          timeline.setPopScale(val)
                        }}
                        className="w-full accent-emerald-500"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2 mt-2">
                        <span className="text-[11px] font-semibold text-neutral-200">Speed</span>
                        <span className="text-[10px] text-neutral-400">{(popSpeed ?? 1).toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min={0.25}
                        max={3}
                        step={0.05}
                        value={popSpeed ?? 1}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          timeline.setPopSpeed?.(val)
                        }}
                        className="w-full accent-emerald-500"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[11px] font-semibold text-neutral-200">Collapse</span>
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={popCollapse ?? true}
                          onChange={(e) => timeline.setPopCollapse?.(e.target.checked)}
                        />
                        <div className="peer h-4 w-7 rounded-full bg-neutral-700 peer-checked:bg-emerald-500 transition-colors" />
                        <div className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-3" />
                      </label>
                    </div>
                    {!state.popCollapse && (
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-[11px] font-semibold text-neutral-200">Wobble</span>
                        <label className="relative inline-flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={popWobble ?? false}
                            onChange={(e) => timeline.setPopWobble?.(e.target.checked)}
                          />
                          <div className="peer h-4 w-7 rounded-full bg-neutral-700 peer-checked:bg-emerald-500 transition-colors" />
                          <div className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-3" />
                        </label>
                      </div>
                    )}
                  </>
                )}
                {!selectedTemplate && (
                  <p className="text-[11px] text-neutral-500">Select a template to adjust its controls.</p>
                )}
              </div>
            )}
          </div>
          {layers.map((layer, idx) => {
            const track = tracks.find((t) => t.layerId === layer.id)
            const hasPath = (track?.paths?.length ?? 0) > 0
            const keyframeCount =
              (track?.position?.length ?? 0) +
              (track?.scale?.length ?? 0) +
              (track?.rotation?.length ?? 0) +
              (track?.opacity?.length ?? 0)
            return (
              <div key={layer.id} className="flex items-center gap-3 group">
                <div className="w-28 text-[11px] font-medium text-neutral-400 group-hover:text-neutral-200 transition-colors truncate">
                  {layer.shapeKind === 'circle' ? 'Circle' : 'Layer'} {idx + 1}
                </div>
                <div className="h-7 flex-1 rounded-md bg-white/[0.02] border border-white/5 relative overflow-hidden group-hover:bg-white/[0.04] transition-colors">
                  {hasPath && (
                    <div className="absolute left-1 top-1 right-1 h-2 rounded-sm bg-emerald-500/20 border border-emerald-500/30 shadow-[0_0_10px_rgba(52,211,153,0.15)]" />
                  )}
                  {keyframeCount > 1 && (
                    <div className="absolute left-0 top-0 bottom-0 flex items-center gap-1 px-2 text-[10px] text-neutral-500">
                      <span className="inline-block h-1 w-1 rounded-full bg-white/60" />
                      <span>{keyframeCount} keys</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {layers.length === 0 && (
            <div className="text-[12px] text-neutral-500">Add a shape to populate the timeline.</div>
          )}
        </div>
      </div>
    </div>
  )
}

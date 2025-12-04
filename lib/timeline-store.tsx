'use client'

import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import {
  LayerTracks,
  PathClip,
  SampledLayerState,
  TimelineKeyframe,
  Vec2,
  DEFAULT_LAYER_STATE,
  sampleTimeline,
  sampleLayerTracks,
  upsertKeyframe,
} from '@/lib/timeline'
import { PRESET_BUILDERS, TemplateId, rollDistanceForDuration, jumpHeightForDuration, popSpeedForDuration } from '@/lib/presets'

type TimelineState = {
  tracks: LayerTracks[]
  duration: number
  currentTime: number
  isPlaying: boolean
  loop: boolean
  playbackRate: number
  lastTick?: number
  templateSpeed: number
  rollDistance: number
  jumpHeight: number
  jumpVelocity: number
  popScale: number
  popWobble: boolean
  popSpeed: number
  popCollapse: boolean
  popReappear: boolean
  shakeDistance: number
  pulseScale: number
  pulseSpeed: number
  spinSpeed: number
  spinDirection: 1 | -1
  templateClips: Array<{
    id: string
    layerId: string
    template: TemplateId
    start: number
    duration: number
    parameters?: {
      templateSpeed?: number
      rollDistance?: number
      jumpHeight?: number
      jumpVelocity?: number
      popScale?: number
      popWobble?: boolean
      popSpeed?: number
      popCollapse?: boolean
      popReappear?: boolean
      shakeDistance?: number
      pulseScale?: number
      pulseSpeed?: number
      spinSpeed?: number
      spinDirection?: 1 | -1
      pathPoints?: Vec2[]
      pathLength?: number
      layerBase?: {
        position?: Vec2
        scale?: number
        rotation?: number
        opacity?: number
      }
    }
  }>
}

export type TimelineStore = ReturnType<typeof createTimelineStore>

const clampTime = (time: number, duration: number) => {
  const safeTime = Number.isFinite(time) ? time : 0
  const safeDuration = Number.isFinite(duration) ? duration : 0
  return Math.max(0, Math.min(safeTime, safeDuration))
}

const defaultState: TimelineState = {
  tracks: [],
  duration: 4000, // ms
  currentTime: 0,
  isPlaying: false,
  loop: false,
  playbackRate: 1,
  templateSpeed: 1,
  rollDistance: 0.2,
  jumpHeight: 0.25,
  jumpVelocity: 1.5,
  popScale: 1.6,
  popWobble: false,
  popSpeed: 1,
  popCollapse: true,
  popReappear: false,
  shakeDistance: 10,
  pulseScale: 0.2,
  pulseSpeed: 1,
  spinSpeed: 1,
  spinDirection: 1,
  templateClips: [],
}

export function createTimelineStore(initialState?: Partial<TimelineState>) {
  let state: TimelineState = {
    ...defaultState,
    ...initialState,
    tracks: initialState?.tracks ?? defaultState.tracks,
    rollDistance: initialState?.rollDistance ?? defaultState.rollDistance,
    jumpHeight: initialState?.jumpHeight ?? defaultState.jumpHeight,
    jumpVelocity: initialState?.jumpVelocity ?? defaultState.jumpVelocity,
    popScale: initialState?.popScale ?? defaultState.popScale,
    popWobble: initialState?.popWobble ?? defaultState.popWobble,
    popSpeed: initialState?.popSpeed ?? defaultState.popSpeed,
    popCollapse: initialState?.popCollapse ?? defaultState.popCollapse,
    popReappear: initialState?.popReappear ?? defaultState.popReappear,
    shakeDistance: initialState?.shakeDistance ?? defaultState.shakeDistance,
    pulseScale: initialState?.pulseScale ?? defaultState.pulseScale,
    pulseSpeed: initialState?.pulseSpeed ?? defaultState.pulseSpeed,
    spinSpeed: initialState?.spinSpeed ?? defaultState.spinSpeed,
    spinDirection: initialState?.spinDirection ?? defaultState.spinDirection,
    templateClips: initialState?.templateClips ?? defaultState.templateClips,
  }

  const listeners = new Set<() => void>()
  let rafId: number | null = null

  const notify = () => {
    listeners.forEach((cb) => cb())
  }

  const setState = (updater: (prev: TimelineState) => TimelineState) => {
    state = updater(state)
    notify()
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  const ensureTrack = (layerId: string, defaults?: Partial<SampledLayerState>): LayerTracks => {
    const existing = state.tracks.find((t) => t.layerId === layerId)
    if (existing) return existing

    const newTrack: LayerTracks = {
      layerId,
      position: [
        {
          time: 0,
          value: defaults?.position ?? DEFAULT_LAYER_STATE.position,
        },
      ],
      scale: [
        {
          time: 0,
          value: DEFAULT_LAYER_STATE.scale,
        },
      ],
      rotation: [
        {
          time: 0,
          value: defaults?.rotation ?? DEFAULT_LAYER_STATE.rotation,
        },
      ],
      opacity: [
        {
          time: 0,
          value: defaults?.opacity ?? DEFAULT_LAYER_STATE.opacity,
        },
      ],
      paths: [],
    }

    setState((prev) => ({
      ...prev,
      tracks: [...prev.tracks, newTrack],
    }))
    return newTrack
  }

  const setKeyframe = <T,>(
    layerId: string,
    key: keyof Pick<LayerTracks, 'position' | 'scale' | 'rotation' | 'opacity'>,
    frame: TimelineKeyframe<T>
  ) => {
    ensureTrack(layerId)

    setState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((track) =>
        track.layerId === layerId
          ? {
              ...track,
              [key]: upsertKeyframe((track[key] as TimelineKeyframe<T>[]) ?? [], frame),
            }
          : track
      ),
    }))
  }

  const getMaxPathEnd = (tracks: LayerTracks[]) => {
    let maxEnd = 0
    tracks.forEach((t) => {
      (t.paths ?? []).forEach((p) => {
        maxEnd = Math.max(maxEnd, p.startTime + p.duration)
      })
    })
    return maxEnd
  }

  const addPathClip = (layerId: string, clip: PathClip) => {
    ensureTrack(layerId)
    setState((prev) => {
      const tracks = prev.tracks.map((track) =>
        track.layerId === layerId
          ? {
              ...track,
              paths: [...(track.paths ?? []), clip].sort((a, b) => a.startTime - b.startTime),
            }
          : track
      )
      const newDuration = Math.max(getMaxPathEnd(tracks), 1000)
      return {
        ...prev,
        tracks,
        duration: newDuration,
        currentTime: clampTime(prev.currentTime, newDuration),
      }
    })
  }

  const removePathClip = (layerId: string, clipId: string) => {
    setState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((track) =>
        track.layerId === layerId
          ? {
              ...track,
              paths: (track.paths ?? []).filter((p) => p.id !== clipId),
            }
          : track
      ),
    }))
  }

  const updatePathClip = (
    layerId: string,
    clipId: string,
    updates: Partial<Pick<PathClip, 'startTime' | 'duration' | 'points'>>
  ) => {
    setState((prev) => {
      let updatedDuration = 0
      const tracks = prev.tracks.map((track) => {
        if (track.layerId !== layerId) return track
        const paths = (track.paths ?? []).map((clip) => {
          if (clip.id !== clipId) return clip
          const next = { ...clip, ...updates }
          const end = next.startTime + next.duration
          updatedDuration = Math.max(updatedDuration, end)
          return next
        })
        return { ...track, paths }
      })
      const maxEnd = Math.max(getMaxPathEnd(tracks), 1000, updatedDuration)
      return {
        ...prev,
        tracks,
        duration: maxEnd,
        currentTime: clampTime(prev.currentTime, maxEnd),
      }
    })
  }

  const updateTemplateClip = (
    layerId: string,
    clipId: string,
    updates: Partial<TimelineState['templateClips'][number]>,
    layerScale?: number
  ) => {
    setState((prev) => {
      const updatedClips = prev.templateClips.map((clip) => {
        if (clip.id === clipId && clip.layerId === layerId) {
          return {
            ...clip,
            ...updates,
            // Merge parameters instead of replacing them
            parameters: updates.parameters 
              ? { ...clip.parameters, ...updates.parameters }
              : clip.parameters
          }
        }
        return clip
      })

      // Calculate new parameters for the specific clip being updated
      const layerClips = updatedClips.filter((c) => c.layerId === layerId)
      const rollClip = layerClips.find((c) => c.id === clipId && c.template === 'roll')
      const jumpClip = layerClips.find((c) => c.id === clipId && c.template === 'jump')
      const popClip = layerClips.find((c) => c.id === clipId && c.template === 'pop')
      const shakeClip = layerClips.find((c) => c.id === clipId && c.template === 'shake')
      const pulseClip = layerClips.find((c) => c.id === clipId && c.template === 'pulse')
      const spinClip = layerClips.find((c) => c.id === clipId && c.template === 'spin')

      const nextRollDistance =
        rollClip && typeof rollClip.duration === 'number'
          ? rollDistanceForDuration(rollClip.duration, prev.templateSpeed)
          : prev.rollDistance

      const nextJumpHeight =
        jumpClip && typeof jumpClip.duration === 'number'
          ? jumpHeightForDuration(jumpClip.duration, prev.jumpVelocity)
          : prev.jumpHeight

      const nextPopSpeed =
        popClip && typeof popClip.duration === 'number'
          ? popSpeedForDuration(popClip.duration)
          : prev.popSpeed
      const nextPulseScale = prev.pulseScale
      const nextSpinSpeed = prev.spinSpeed

      
      // For path clips: if duration changed (from dragging the bar), calculate the new speed
      const pathClip = layerClips.find((c) => c.id === clipId && c.template === 'path')
      let updatedPathClip = pathClip
      
      if (pathClip && updates.duration !== undefined && !updates.parameters?.templateSpeed) {
        // Duration was changed (by dragging), so calculate the new speed
        // speed = baseDuration / duration
        const newSpeed = 2000 / updates.duration
        
        // Update the clip with the calculated speed
        updatedPathClip = {
          ...pathClip,
          duration: updates.duration,
          parameters: {
            ...pathClip.parameters,
            templateSpeed: newSpeed
          }
        }
        
        // Replace the clip in updatedClips
        const clipIndex = updatedClips.findIndex(c => c.id === clipId)
        if (clipIndex !== -1) {
          updatedClips[clipIndex] = updatedPathClip
        }
      }

      // Explicitly update parameters for Roll, Jump, and Pop clips if duration changed
      // This ensures rebuildTrackFromClips uses the correct values instead of stale global defaults
      if (rollClip && typeof rollClip.duration === 'number') {
        const clipIndex = updatedClips.findIndex(c => c.id === rollClip.id)
        if (clipIndex !== -1) {
          updatedClips[clipIndex] = {
            ...updatedClips[clipIndex],
            parameters: {
              ...updatedClips[clipIndex].parameters,
              rollDistance: nextRollDistance
            }
          }
        }
      }

      if (jumpClip && typeof jumpClip.duration === 'number') {
        const clipIndex = updatedClips.findIndex(c => c.id === jumpClip.id)
        if (clipIndex !== -1) {
          updatedClips[clipIndex] = {
            ...updatedClips[clipIndex],
            parameters: {
              ...updatedClips[clipIndex].parameters,
              jumpHeight: nextJumpHeight
            }
          }
        }
      }

      if (popClip && typeof popClip.duration === 'number') {
        const clipIndex = updatedClips.findIndex(c => c.id === popClip.id)
        if (clipIndex !== -1) {
          updatedClips[clipIndex] = {
            ...updatedClips[clipIndex],
            parameters: {
              ...updatedClips[clipIndex].parameters,
              popSpeed: nextPopSpeed
            }
          }
        }
      }

      const currentPopClip = updatedClips.find(c => c.id === clipId && c.template === 'pop')
      const parameters = updates.parameters
      const currentParams = currentPopClip?.parameters || {}

      const nextPopReappear = parameters?.popReappear ?? currentParams.popReappear

      if (popClip && typeof popClip.duration === 'number') {
        const clipIndex = updatedClips.findIndex(c => c.id === popClip.id)
        if (clipIndex !== -1) {
          updatedClips[clipIndex] = {
            ...updatedClips[clipIndex],
            parameters: {
              ...updatedClips[clipIndex].parameters,
              popReappear: nextPopReappear
            }
          }
        }
      }

      if (shakeClip && typeof shakeClip.duration === 'number') {
        const clipIndex = updatedClips.findIndex(c => c.id === shakeClip.id)
        if (clipIndex !== -1) {
          updatedClips[clipIndex] = {
            ...updatedClips[clipIndex],
            parameters: {
              ...updatedClips[clipIndex].parameters,
              shakeDistance: updates.parameters?.shakeDistance ?? prev.shakeDistance,
              templateSpeed: updates.parameters?.templateSpeed ?? prev.templateSpeed
            }
          }
        }
      }

      if (pulseClip && typeof pulseClip.duration === 'number') {
        const clipIndex = updatedClips.findIndex(c => c.id === pulseClip.id)
        if (clipIndex !== -1) {
          updatedClips[clipIndex] = {
            ...updatedClips[clipIndex],
            parameters: {
              ...updatedClips[clipIndex].parameters,
              pulseScale: updates.parameters?.pulseScale ?? prev.pulseScale,
              pulseSpeed: updates.parameters?.pulseSpeed ?? prev.pulseSpeed
            }
          }
        }
      }

      if (spinClip && typeof spinClip.duration === 'number') {
        const clipIndex = updatedClips.findIndex(c => c.id === spinClip.id)
        if (clipIndex !== -1) {
          updatedClips[clipIndex] = {
            ...updatedClips[clipIndex],
            parameters: {
              ...updatedClips[clipIndex].parameters,
              spinSpeed: updates.parameters?.spinSpeed ?? prev.spinSpeed,
              spinDirection: updates.parameters?.spinDirection ?? prev.spinDirection,
              templateSpeed: updates.parameters?.templateSpeed ?? prev.templateSpeed
            }
          }
        }
      }


      // Helper to rebuild track from clips
      const rebuildTrackFromClips = (
        layerId: string, 
        currentClips: typeof updatedClips, 
        currentTracks: LayerTracks[], 
        baseScale: number = 1,
        layerPosition?: Vec2,
        layerBase?: { position?: Vec2; scale?: number; rotation?: number; opacity?: number }
      ) => {
        const layerClips = currentClips
          .filter(c => c.layerId === layerId)
          .sort((a, b) => (a.start ?? 0) - (b.start ?? 0))

        const track = currentTracks.find(t => t.layerId === layerId)
        if (!track) return currentTracks

        // Reset track to empty/default state
        let newTrack: LayerTracks = {
          ...track,
          position: [],
          scale: [],
          rotation: [],
          opacity: [],
          paths: []
        }

        // Apply clips sequentially
        let prevClipEnd = 0
        let lastPopStartState: SampledLayerState | null = null
        layerClips.forEach((clip, index) => {
           const start = clip.start ?? 0
           const duration = clip.duration ?? 0
           const end = start + duration
           
           const sampleTime = index === 0 ? 0 : prevClipEnd
            let clipBaseState
          if (index === 0) {
             // Check if this is an In/Out animation
             const isInOutAnimation = [
               'fade_in', 'slide_in', 'grow_in', 'shrink_in', 'spin_in', 'twist_in', 'move_scale_in',
               'fade_out', 'slide_out', 'grow_out', 'shrink_out', 'spin_out', 'twist_out', 'move_scale_out'
             ].includes(clip.template)
             
             if (isInOutAnimation) {
               // For In/Out animations, use authoritative layer base if provided, otherwise fallback
               const basePosition = layerBase?.position ?? layerPosition ?? DEFAULT_LAYER_STATE.position
               const baseScaleFromLayer = layerBase?.scale ?? baseScale
               const baseRotation = layerBase?.rotation ?? DEFAULT_LAYER_STATE.rotation
               const baseOpacity = layerBase?.opacity ?? DEFAULT_LAYER_STATE.opacity
               clipBaseState = {
                 position: basePosition,
                 scale: baseScaleFromLayer,
                 rotation: baseRotation,
                 opacity: baseOpacity,
               }
             } else {
               // For other animations, sample from the track at start
             // For subsequent clips or non In/Out, prefer stored layerBase if present
             const basePositionOverride = layerBase?.position
             const baseScaleOverride = layerBase?.scale
             const baseRotationOverride = layerBase?.rotation
             const baseOpacityOverride = layerBase?.opacity

             const sampledFromOriginal = sampleLayerTracks(track, sampleTime, {
               ...DEFAULT_LAYER_STATE,
               position: basePositionOverride ?? DEFAULT_LAYER_STATE.position,
               scale: baseScaleOverride ?? DEFAULT_LAYER_STATE.scale,
               rotation: baseRotationOverride ?? DEFAULT_LAYER_STATE.rotation,
               opacity: baseOpacityOverride ?? DEFAULT_LAYER_STATE.opacity,
             })
               clipBaseState = {
                 ...sampledFromOriginal,
                 scale: Math.abs(sampledFromOriginal.scale),
               }
             }
          } else {
              // Subsequent clips: sample from the newly built track to get the actual end state
              const sampledFromNew = sampleLayerTracks(newTrack, sampleTime, DEFAULT_LAYER_STATE)
          
          // Preserve the sampled state by default; only force a reset after a collapsing Pop
          const previousClip = layerClips[index - 1]
          const cameFromPop = previousClip?.template === 'pop'
          const popCollapsed = previousClip?.parameters?.popCollapse ?? prev.popCollapse
          const popShouldReappear = previousClip?.parameters?.popReappear ?? prev.popReappear ?? true
          const shouldRestoreFromPop = cameFromPop && popCollapsed && popShouldReappear
          const restoredScale = shouldRestoreFromPop && lastPopStartState ? lastPopStartState.scale : sampledFromNew.scale
          const restoredOpacity = shouldRestoreFromPop && lastPopStartState ? lastPopStartState.opacity : sampledFromNew.opacity

          clipBaseState = {
            position: sampledFromNew.position,
            scale: restoredScale,
            rotation: sampledFromNew.rotation,
            opacity: restoredOpacity
          }
          
          // If we need to restore after Pop, add explicit keyframes at the start of this clip
          if (shouldRestoreFromPop) {
            newTrack.scale = upsertKeyframe(newTrack.scale ?? [], { time: start, value: restoredScale })
            newTrack.opacity = upsertKeyframe(newTrack.opacity ?? [], { time: start, value: restoredOpacity })
          }
        }

       let preset
           if (clip.template === 'roll') {
             preset = PRESET_BUILDERS.roll(clip.parameters?.rollDistance ?? prev.rollDistance, clip.parameters?.templateSpeed ?? prev.templateSpeed)
             // Add explicit scale/opacity/position to prevent multiply mode issues and ensure final state
             const rollDistance = clip.parameters?.rollDistance ?? prev.rollDistance
             preset = {
               ...preset,
               position: preset.position?.length ? preset.position : [
                 { time: 0, value: { x: 0, y: 0 }, easing: 'linear' as const },
                 { time: preset.duration, value: { x: rollDistance, y: 0 }, easing: 'linear' as const }
               ],
               scale: preset.scale?.length ? preset.scale : [
                 { time: 0, value: 1 },
                 { time: preset.duration, value: 1 }
               ],
               opacity: preset.opacity?.length ? preset.opacity : [
                 { time: 0, value: 1 },
                 { time: preset.duration, value: 1 }
               ]
             }
           } else if (clip.template === 'jump') {
           preset = PRESET_BUILDERS.jump(clip.parameters?.jumpHeight ?? prev.jumpHeight, clip.parameters?.jumpVelocity ?? prev.jumpVelocity)
          } else if (clip.template === 'pop') {
             preset = PRESET_BUILDERS.pop(clip.parameters?.popScale ?? prev.popScale, clip.parameters?.popWobble ?? prev.popWobble, clip.parameters?.popSpeed ?? prev.popSpeed, clip.parameters?.popCollapse ?? prev.popCollapse)
             const shouldCapturePopStart = (clip.parameters?.popCollapse ?? prev.popCollapse) && (clip.parameters?.popReappear ?? prev.popReappear ?? true)
             if (shouldCapturePopStart) {
               lastPopStartState = clipBaseState
             } else {
               lastPopStartState = null
             }
           } else if (clip.template === 'shake') {
             preset = PRESET_BUILDERS.shake(clip.parameters?.shakeDistance ?? prev.shakeDistance, clip.parameters?.templateSpeed ?? prev.templateSpeed, clip.duration)
           } else if (clip.template === 'pulse') {
             preset = PRESET_BUILDERS.pulse(clip.parameters?.pulseScale ?? prev.pulseScale, clip.parameters?.pulseSpeed ?? prev.pulseSpeed, clip.duration)
            } else if (clip.template === 'spin') {
              preset = PRESET_BUILDERS.spin(clip.parameters?.spinSpeed ?? prev.spinSpeed, clip.parameters?.spinDirection ?? prev.spinDirection, clip.duration)
            } else if ([
              'fade_in', 'slide_in', 'grow_in', 'shrink_in', 'spin_in', 'twist_in', 'move_scale_in',
              'fade_out', 'slide_out', 'grow_out', 'shrink_out', 'spin_out', 'twist_out', 'move_scale_out'
            ].includes(clip.template)) {
              // @ts-ignore
              preset = PRESET_BUILDERS[clip.template](clip.duration)
            } else if (clip.template === 'path' && clip.parameters?.pathPoints) {
              newTrack.paths = [
                ...(newTrack.paths ?? []),
                {
                  id: clip.id,
                  startTime: start,
                  duration: duration,
                  points: clip.parameters.pathPoints,
                  easing: 'linear'
                }
              ]
              
              // Add a keyframe at the end to hold the position
              // We calculate the delta from the start position (clipBaseState) to the end of the path
              const points = clip.parameters.pathPoints
              const lastPoint = points[points.length - 1]
              
              if (lastPoint) {
                  const delta = { 
                      x: lastPoint.x - clipBaseState.position.x, 
                      y: lastPoint.y - clipBaseState.position.y 
                  }
                  preset = { 
                      duration, 
                      position: [{ time: duration, value: delta }], 
                      scale: [], rotation: [], opacity: [] 
                  }
              } else {
                  preset = { duration, position: [], scale: [], rotation: [], opacity: [] }
              }
           }

           if (!preset) return

            // clipBaseState was calculated above
           
            // If there's a gap between this clip and the previous one, add static keyframes
            if (index > 0 && start > prevClipEnd) {
              // Add keyframe at end of previous clip to hold the state
              newTrack.position?.push({ time: start - 1, value: clipBaseState.position })
              newTrack.scale?.push({ time: start - 1, value: clipBaseState.scale })
              newTrack.rotation?.push({ time: start - 1, value: clipBaseState.rotation })
              newTrack.opacity?.push({ time: start - 1, value: clipBaseState.opacity })
            }
           
           const mergeKeyframes = <T,>(
             existing: TimelineKeyframe<T>[],
             newFrames: TimelineKeyframe<T>[] | undefined,
             baseValue?: T,
             mode: 'add' | 'multiply' | 'replace' = 'replace'
           ) => {
             if (!newFrames) return existing
             
             // Process all frames - deduplication will handle any overlaps
             const framesToProcess = newFrames
             
             const shiftedNew = framesToProcess.map(f => {
               let value = f.value
               if (baseValue !== undefined) {
                 if (mode === 'add') {
                     if (typeof f.value === 'object' && f.value !== null && 'x' in f.value) {
                         const v = f.value as unknown as Vec2
                         const b = baseValue as unknown as Vec2
                         value = { x: v.x + b.x, y: v.y + b.y } as unknown as T
                     } else if (typeof f.value === 'number' && typeof baseValue === 'number') {
                         value = (f.value as number + baseValue) as unknown as T
                     }
                 } else if (mode === 'multiply') {
                     if (typeof f.value === 'number' && typeof baseValue === 'number') {
                         value = (f.value as number * baseValue) as unknown as T
                     }
                 }
               }
               return { ...f, time: f.time + start, value }
             })
             
             // Merge and deduplicate: if multiple keyframes exist at the same time, keep the last one
             const merged = [...existing, ...shiftedNew].sort((a, b) => a.time - b.time)
             const deduplicated: TimelineKeyframe<T>[] = []
             
             for (let i = 0; i < merged.length; i++) {
               const current = merged[i]
               const next = merged[i + 1]
               
               // Only add this keyframe if it's the last one at this timestamp
               if (!next || next.time !== current.time) {
                 deduplicated.push(current)
               }
             }
             
             return deduplicated
           }

           
           // If track is empty for a property, initialize it with baseValue at time 0
           // This ensures we have a starting point for the animation
           if ((newTrack.position?.length ?? 0) === 0 && clipBaseState.position) {
             newTrack.position = [{ time: 0, value: clipBaseState.position }]
           }
          if ((newTrack.scale?.length ?? 0) === 0) {
            newTrack.scale = [{ time: 0, value: 1 }]
          }
           if ((newTrack.rotation?.length ?? 0) === 0 && clipBaseState.rotation !== undefined) {
             newTrack.rotation = [{ time: 0, value: clipBaseState.rotation }]
           }
           // Opacity is special - we might want it to be 0 for fade_in, so don't force it here
           // But for other properties, we need a base to add to.

          const isInOutAnimation = [
            'fade_in', 'slide_in', 'grow_in', 'shrink_in', 'spin_in', 'twist_in', 'move_scale_in',
            'fade_out', 'slide_out', 'grow_out', 'shrink_out', 'spin_out', 'twist_out', 'move_scale_out'
          ].includes(clip.template)

          const isInAnimation = ['fade_in', 'slide_in', 'grow_in', 'shrink_in', 'spin_in', 'twist_in', 'move_scale_in'].includes(clip.template)
          const isOutAnimation = ['fade_out', 'slide_out', 'grow_out', 'shrink_out', 'spin_out', 'twist_out', 'move_scale_out'].includes(clip.template)

          let mergedPosition = isInOutAnimation && preset.position
            ? preset.position.map((f: any, idx: number) => {
                const v = f.value as unknown as Vec2
                const isFirstKeyframe = idx === 0
                const isLastKeyframe = idx === preset.position!.length - 1
                
                // Check if this keyframe represents "base position" (offset is 0,0)
                const isBasePosition = (v?.x ?? 0) === 0 && (v?.y ?? 0) === 0
                
                // Round clipBaseState position to avoid accumulated floating point errors
                const baseX = Math.round((clipBaseState.position?.x ?? 0) * 1e6) / 1e6
                const baseY = Math.round((clipBaseState.position?.y ?? 0) * 1e6) / 1e6
                
                let resultX: number, resultY: number
                
                if (isInAnimation) {
                  // For IN animations: keyframes with {0,0} should use base position, others add offset
                  if (isBasePosition) {
                    resultX = baseX
                    resultY = baseY
                  } else {
                    // Round to avoid floating point precision errors (e.g., 0.3 + (-0.2) = 0.09999...)
                    resultX = Math.round((baseX + (v?.x ?? 0)) * 1e6) / 1e6
                    resultY = Math.round((baseY + (v?.y ?? 0)) * 1e6) / 1e6
                  }
                } else if (isOutAnimation) {
                  // For OUT animations: first keyframe uses base, others add offset
                  if (isFirstKeyframe) {
                    resultX = baseX
                    resultY = baseY
                  } else {
                    resultX = Math.round((baseX + (v?.x ?? 0)) * 1e6) / 1e6
                    resultY = Math.round((baseY + (v?.y ?? 0)) * 1e6) / 1e6
                  }
                } else {
                  resultX = Math.round((baseX + (v?.x ?? 0)) * 1e6) / 1e6
                  resultY = Math.round((baseY + (v?.y ?? 0)) * 1e6) / 1e6
                }
                
                const result = {
                  ...f,
                  value: { x: resultX, y: resultY },
                }
                
                return result
              })
            : preset.position

          const mergedScale = preset.scale // keep multipliers; layer.scale applied at render

          const mergedRotation = isInOutAnimation && preset.rotation
            ? preset.rotation.map((f: any, idx: number) => {
                const v = f.value as number
                const isFirstKeyframe = idx === 0
                
                // For rotation: value of 0 means "use base rotation"
                const isBaseRotation = v === 0
                
                let resultValue: number
                
                if (isInAnimation) {
                  // For IN animations: rotation of 0 should use base rotation, others add to base
                  if (isBaseRotation) {
                    resultValue = clipBaseState.rotation ?? 0
                  } else {
                    resultValue = (clipBaseState.rotation ?? 0) + v
                  }
                } else if (isOutAnimation) {
                  // For OUT animations: first keyframe uses base rotation, others add to base
                  if (isFirstKeyframe) {
                    resultValue = clipBaseState.rotation ?? 0
                  } else {
                    resultValue = (clipBaseState.rotation ?? 0) + v
                  }
                } else {
                  resultValue = v
                }
                
                return { ...f, value: resultValue }
              })
            : preset.rotation

          newTrack = {
            ...newTrack,
            position: mergeKeyframes(newTrack.position ?? [], mergedPosition, isInOutAnimation ? undefined : clipBaseState.position, isInOutAnimation ? 'replace' : 'add'),
            scale: mergeKeyframes(newTrack.scale ?? [], mergedScale, undefined, 'replace'),
            rotation: mergeKeyframes(newTrack.rotation ?? [], mergedRotation, isInOutAnimation ? undefined : clipBaseState.rotation, isInOutAnimation ? 'replace' : 'add'),
            opacity: mergeKeyframes(newTrack.opacity ?? [], preset.opacity, isInOutAnimation ? undefined : clipBaseState.opacity, isInOutAnimation ? 'replace' : 'multiply'),
          }
          
           // Update prevClipEnd for next iteration
           prevClipEnd = end
         })
         
        // CRITICAL: Ensure static start keyframes
        // If the first clip doesn't start at time 0, we need a static keyframe at 0
        // to keep the shape in its initial position until the clip starts
        const initialState = sampleLayerTracks(track, 0, DEFAULT_LAYER_STATE)
        const firstClipStart = layerClips.length > 0 ? (layerClips[0].start ?? 0) : 0
        
        // Always add a keyframe at time 0 if it doesn't exist or if first clip starts later
        if (firstClipStart > 0 || (newTrack.position?.length ?? 0) === 0) {
          // Check each property independently for keyframe at time 0
          const hasPositionAtZero = newTrack.position?.some(kf => kf.time === 0)
          const hasScaleAtZero = newTrack.scale?.some(kf => kf.time === 0)
          const hasRotationAtZero = newTrack.rotation?.some(kf => kf.time === 0)
          const hasOpacityAtZero = newTrack.opacity?.some(kf => kf.time === 0)
          
          if (!hasPositionAtZero) {
            newTrack.position = [{ time: 0, value: initialState.position }, ...(newTrack.position ?? [])]
          }
          if (!hasScaleAtZero) {
            newTrack.scale = [{ time: 0, value: initialState.scale }, ...(newTrack.scale ?? [])]
          }
          if (!hasRotationAtZero) {
            newTrack.rotation = [{ time: 0, value: initialState.rotation }, ...(newTrack.rotation ?? [])]
          }
          if (!hasOpacityAtZero) {
            newTrack.opacity = [{ time: 0, value: initialState.opacity }, ...(newTrack.opacity ?? [])]
          }
          
          // CRITICAL: Add duplicate keyframe at clip start time to prevent interpolation
          // If first clip starts at time T > 0, we need keyframes at both 0 and T-1 with the same value
          // This prevents the shape from interpolating between 0 and T
          if (firstClipStart > 0) {
            // Insert keyframe just before the clip starts (at firstClipStart - 1ms)
            // This ensures no interpolation happens before the clip
            const insertIndex = newTrack.position?.findIndex(kf => kf.time >= firstClipStart) ?? 0
            newTrack.position?.splice(insertIndex, 0, { time: firstClipStart - 1, value: initialState.position })
            newTrack.scale?.splice(insertIndex, 0, { time: firstClipStart - 1, value: initialState.scale })
            newTrack.rotation?.splice(insertIndex, 0, { time: firstClipStart - 1, value: initialState.rotation })
            newTrack.opacity?.splice(insertIndex, 0, { time: firstClipStart - 1, value: initialState.opacity })
          }
        }
        
        // Fallback: if track is still empty, add defaults
        if ((newTrack.position?.length ?? 0) === 0) newTrack.position = [{ time: 0, value: initialState.position }]
            if ((newTrack.scale?.length ?? 0) === 0) newTrack.scale = [{ time: 0, value: 1 }]
        if ((newTrack.rotation?.length ?? 0) === 0) newTrack.rotation = [{ time: 0, value: initialState.rotation }]
        if ((newTrack.opacity?.length ?? 0) === 0) newTrack.opacity = [{ time: 0, value: initialState.opacity }]

        return currentTracks.map(t => t.layerId === layerId ? newTrack : t)
      }

      const targetClip = updatedClips.find(c => c.id === clipId)
      const layerBaseForRebuild = targetClip?.parameters?.layerBase
      const newTracks = rebuildTrackFromClips(
        layerId,
        updatedClips,
        prev.tracks,
        1,
        layerBaseForRebuild?.position,
        layerBaseForRebuild
      )

      const getTrackEnd = (track: LayerTracks) => {
        const times: number[] = []
        if (track.position?.length) times.push(track.position[track.position.length - 1].time)
        if (track.scale?.length) times.push(track.scale[track.scale.length - 1].time)
        if (track.rotation?.length) times.push(track.rotation[track.rotation.length - 1].time)
        if (track.opacity?.length) times.push(track.opacity[track.opacity.length - 1].time)
        return times.length ? Math.max(...times) : 0
      }

      const tracksEnd = newTracks.reduce((max, t) => Math.max(max, getTrackEnd(t)), 0)
      const clipsEnd = updatedClips.reduce((max, c) => Math.max(max, (c.start ?? 0) + (c.duration ?? 0)), 0)
      const pathsEnd = getMaxPathEnd(newTracks)
      const newDuration = Math.max(tracksEnd, clipsEnd, pathsEnd, 4000)
      
      // If path clip speed was updated, also update global templateSpeed
      const nextTemplateSpeed = updatedPathClip?.parameters?.templateSpeed ?? prev.templateSpeed

      return {
        ...prev,
        templateClips: updatedClips,
        tracks: newTracks,
        duration: newDuration,
        currentTime: clampTime(prev.currentTime, newDuration),
        rollDistance: nextRollDistance,
        jumpHeight: nextJumpHeight,
        popSpeed: nextPopSpeed,
        templateSpeed: nextTemplateSpeed,
      }
    })
  }

  const replaceTracks = (tracks: LayerTracks[]) => {
    setState((prev) => ({
      ...prev,
      tracks,
    }))
  }

  const applyPresetToLayer = (
    layerId: string,
    template: TemplateId,
    base?: { position?: Vec2; scale?: number; rotation?: number; opacity?: number },
    options?: { 
      append?: boolean; 
      startAt?: number; 
      targetDuration?: number;
      parameters?: {
        rollDistance?: number;
        jumpHeight?: number;
        jumpVelocity?: number;
        popScale?: number;
        popWobble?: boolean;
        popSpeed?: number;
        popCollapse?: boolean;
        shakeDistance?: number;
        pulseScale?: number;
        pulseSpeed?: number;
        spinSpeed?: number;
        spinDirection?: 1 | -1;
        templateSpeed?: number;
      }
      layerScale?: number;
      layerPosition?: Vec2;
      layerBase?: {
        position?: Vec2
        scale?: number
        rotation?: number
        opacity?: number
      }
    }
  ) => {
    const preset =
      template === 'roll'
        ? PRESET_BUILDERS.roll(options?.parameters?.rollDistance ?? state.rollDistance, state.templateSpeed)
        : template === 'jump'
          ? PRESET_BUILDERS.jump(
              options?.parameters?.jumpHeight ?? state.jumpHeight, 
              options?.parameters?.jumpVelocity ?? state.jumpVelocity
            )
          : template === 'pop'
            ? PRESET_BUILDERS.pop(
                options?.parameters?.popScale ?? state.popScale, 
                options?.parameters?.popWobble ?? state.popWobble, 
                options?.parameters?.popSpeed ?? state.popSpeed, 
                options?.parameters?.popCollapse ?? state.popCollapse
              )
          : template === 'shake'
            ? PRESET_BUILDERS.shake(options?.parameters?.shakeDistance ?? state.shakeDistance, options?.parameters?.templateSpeed ?? state.templateSpeed, options?.targetDuration)
          : template === 'pulse'
            ? PRESET_BUILDERS.pulse(options?.parameters?.pulseScale ?? state.pulseScale, options?.parameters?.pulseSpeed ?? state.pulseSpeed, options?.targetDuration)
          : template === 'spin'
            ? PRESET_BUILDERS.spin(options?.parameters?.spinSpeed ?? state.spinSpeed, options?.parameters?.spinDirection ?? state.spinDirection, options?.targetDuration)
            : [
                'fade_in', 'slide_in', 'grow_in', 'shrink_in', 'spin_in', 'twist_in', 'move_scale_in',
                'fade_out', 'slide_out', 'grow_out', 'shrink_out', 'spin_out', 'twist_out', 'move_scale_out'
              ].includes(template)
              // @ts-ignore
              ? PRESET_BUILDERS[template](options?.targetDuration)
              : PRESET_BUILDERS.roll(options?.parameters?.rollDistance ?? state.rollDistance, state.templateSpeed)
    if (!preset) return
    ensureTrack(layerId)

    // Note: We'll insert layerPosition/layerScale keyframes in the main setState block below
    // to avoid race conditions

    const getTrackEndTime = (track: LayerTracks): number => {
      const times: number[] = []
      if (track.position && track.position.length) times.push(track.position[track.position.length - 1].time)
      if (track.scale && track.scale.length) times.push(track.scale[track.scale.length - 1].time)
      if (track.rotation && track.rotation.length) times.push(track.rotation[track.rotation.length - 1].time)
      if (track.opacity && track.opacity.length) times.push(track.opacity[track.opacity.length - 1].time)
      return times.length ? Math.max(...times) : 0
    }

    const normalizePositionFrame = (frame: TimelineKeyframe<Vec2>, overrideBase?: Vec2): TimelineKeyframe<Vec2> => {
      const basePos = overrideBase ?? base?.position
      if (!basePos) return frame
      const isNormalized = basePos.x <= 1 && basePos.y <= 1
      const offset = frame.value
      const next: Vec2 = {
        x: basePos.x + offset.x * (isNormalized ? 1 : 1),
        y: basePos.y + offset.y * (isNormalized ? 1 : 1),
      }
      return { ...frame, value: next }
    }

    const normalizeNumberFrame = (frame: TimelineKeyframe<number>, baseValue?: number, additive = false): TimelineKeyframe<number> => {
      if (baseValue === undefined) return frame
      const nextValue = additive ? baseValue + frame.value : baseValue + (frame.value - 1)
      return { ...frame, value: nextValue }
    }

    setState((prev) => {
      const speed = prev.templateSpeed || 1
      const durationScale = options?.targetDuration ? options.targetDuration / Math.max(1, preset.duration || 1) : 1
      const scaleTime = (t: number) => (t * durationScale) / speed
      let appliedStartOffset = 0
      const priorClipForLayer = prev.templateClips
        .filter((c) => c.layerId === layerId && (c.start ?? 0) <= (options?.startAt ?? 0))
        .sort((a, b) => (b.start ?? 0) - (a.start ?? 0))[0]
      const shouldRestoreFromPop =
        priorClipForLayer?.template === 'pop' &&
        (priorClipForLayer.parameters?.popCollapse ?? prev.popCollapse) &&
        (priorClipForLayer.parameters?.popReappear ?? prev.popReappear ?? true)
      const targetTrackBefore = prev.tracks.find((t) => t.layerId === layerId)
      const popStartState = shouldRestoreFromPop && priorClipForLayer && targetTrackBefore
        ? sampleLayerTracks(targetTrackBefore, priorClipForLayer.start ?? 0, DEFAULT_LAYER_STATE)
        : null

      // Check if we're replacing an existing clip BEFORE mapping tracks
      // We need these variables accessible both inside and outside the map
      let existingClip = prev.templateClips.find(
        (c) => c.layerId === layerId && Math.abs(c.start - (options?.startAt ?? 0)) < 1 && c.template === template
      )
      
      // If no clip found at target position, check if we're updating an existing clip's parameters
      if (!existingClip && !options?.append) {
        const clipsForTemplate = prev.templateClips
          .filter((c) => c.layerId === layerId && c.template === template)
          .sort((a, b) => b.start - a.start)
        
        if (clipsForTemplate.length > 0 && Math.abs(clipsForTemplate[0].start - (options?.startAt ?? 0)) < 100) {
          existingClip = clipsForTemplate[0]
        }
      }

      // Generate clipId after finding existingClip
      const newClipId = existingClip ? existingClip.id : (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `clip-${Date.now()}-${Math.random()}`)

      const tracks = prev.tracks.map((track) => {
        if (track.layerId !== layerId) return track

        const append = options?.append ?? false
        const startOffset = typeof options?.startAt === 'number' ? options.startAt : append ? getTrackEndTime(track) : 0
        appliedStartOffset = startOffset
        
        // CRITICAL: If layerPosition is provided and startOffset is 0, insert it at time 0 BEFORE sampling
        // This ensures the track has the correct position when we sample it
        let trackWithLayerPosition = track
        if (options?.layerPosition && startOffset === 0) {
          trackWithLayerPosition = {
            ...track,
            position: upsertKeyframe(track.position ?? [], { time: 0, value: options.layerPosition })
          }
        }
        
        const trimFrames = <T,>(frames: TimelineKeyframe<T>[] | undefined) =>
          (frames ?? []).filter((f) => f.time < startOffset)

        const baseSample = sampleLayerTracks(
          trackWithLayerPosition,
          startOffset,
          {
            ...DEFAULT_LAYER_STATE,
            // Keep scale sampling independent of layer scale; layer.scale is applied at render time
            scale: DEFAULT_LAYER_STATE.scale,
            position: options?.layerPosition ?? DEFAULT_LAYER_STATE.position,
          }
        )
        
        // CRITICAL: Use the authoritative layer base if provided; otherwise fall back to sampling
        const layerBasePosition = options?.layerBase?.position ?? options?.layerPosition
        const layerBaseScale = options?.layerBase?.scale
        const layerBaseRotation = options?.layerBase?.rotation
        const layerBaseOpacity = options?.layerBase?.opacity

        const basePosition = base?.position ?? layerBasePosition ?? baseSample.position
        // Track scale is always a multiplier; base layer scale lives on the layer itself
        const baseScale = layerBaseScale ?? popStartState?.scale ?? baseSample.scale ?? 1
        const baseRotation = base?.rotation ?? layerBaseRotation ?? baseSample.rotation
        const baseOpacity = base?.opacity ?? layerBaseOpacity ?? (popStartState?.opacity ?? baseSample.opacity)

        const clearedTrack: LayerTracks = {
          ...track,
          position: trimFrames(track.position),
          scale: trimFrames(track.scale),
          rotation: trimFrames(track.rotation),
          opacity: trimFrames(track.opacity),
        }
        
        // When appending, add a keyframe at startOffset with the sampled state to ensure continuity
        // When appending, add a keyframe at startOffset with the sampled state to ensure continuity
        if (append && startOffset > 0) {
          clearedTrack.position = [
            ...(clearedTrack.position ?? []),
            {
              time: startOffset,
              value: basePosition,
            },
          ]
          clearedTrack.scale = [
            ...(clearedTrack.scale ?? []),
            {
              time: startOffset,
              value: baseScale,
            },
          ]
          clearedTrack.rotation = [
            ...(clearedTrack.rotation ?? []),
            {
              time: startOffset,
              value: baseRotation,
            },
          ]
          clearedTrack.opacity = [
            ...(clearedTrack.opacity ?? []),
            {
              time: startOffset,
              value: baseOpacity,
            },
          ]
        } else if (!append && startOffset === 0) {
          const isInOutAnimation = [
            'fade_in', 'slide_in', 'grow_in', 'shrink_in', 'spin_in', 'twist_in', 'move_scale_in',
            'fade_out', 'slide_out', 'grow_out', 'shrink_out', 'spin_out', 'twist_out', 'move_scale_out'
          ].includes(template)
          
          clearedTrack.position = [
            {
              time: 0,
              value: basePosition,
            },
          ]
          clearedTrack.scale = [
            {
              time: 0,
              value: baseScale,
            },
          ]
          clearedTrack.rotation = [
            {
              time: 0,
              value: baseRotation,
            },
          ]
          clearedTrack.opacity = [
            {
              time: 0,
              value: baseOpacity,
            },
          ]
          // For In/Out animations, don't set initial opacity - let the animation define it
          clearedTrack.opacity = isInOutAnimation ? [] : [
            {
              time: 0,
              value: baseOpacity,
            },
          ]
        }

        const baseState = sampleLayerTracks(clearedTrack, startOffset, DEFAULT_LAYER_STATE)

        const mergeFrames = <T,>(existing: TimelineKeyframe<T>[] | undefined, incoming: TimelineKeyframe<T>[]) =>
          incoming.reduce((acc, frame) => upsertKeyframe(acc, frame), existing ?? [])

        const mappedPosition =
          preset.position?.map((frame: TimelineKeyframe<Vec2>) => ({
            ...normalizePositionFrame(frame, baseState.position),
            time: startOffset + scaleTime(frame.time),
            clipId: newClipId, // Tag with clip ID for deletion
          })) ?? []

        const mappedScale =
          preset.scale?.map((f: TimelineKeyframe<number>) => ({
            ...f,
            time: startOffset + scaleTime(f.time),
            clipId: newClipId, // Tag with clip ID for deletion
          })) ?? []

        const mappedRotation =
          preset.rotation?.map((f: TimelineKeyframe<number>) => ({
            ...normalizeNumberFrame(f, baseState.rotation, true),
            time: startOffset + scaleTime(f.time),
            clipId: newClipId, // Tag with clip ID for deletion
          })) ?? []

        const isInOutAnimation = [
          'fade_in', 'slide_in', 'grow_in', 'shrink_in', 'spin_in', 'twist_in', 'move_scale_in',
          'fade_out', 'slide_out', 'grow_out', 'shrink_out', 'spin_out', 'twist_out', 'move_scale_out'
        ].includes(template)

        const mappedOpacity = isInOutAnimation
          ? preset.opacity?.map((f: TimelineKeyframe<number>) => ({
              ...f,
              time: startOffset + scaleTime(f.time),
              clipId: newClipId, // Tag with clip ID for deletion
            })) ?? []
          : preset.opacity?.map((f: TimelineKeyframe<number>) => ({
              ...normalizeNumberFrame(f, baseState.opacity, false),
              time: startOffset + scaleTime(f.time),
              clipId: newClipId, // Tag with clip ID for deletion
            })) ?? []

        const finalOpacity = mergeFrames(clearedTrack.opacity, mappedOpacity).sort((a, b) => a.time - b.time)
        
        const finalPosition = mergeFrames(clearedTrack.position, mappedPosition).sort((a, b) => a.time - b.time)
        
        return {
          ...track,
          position: finalPosition,
          scale: mergeFrames(clearedTrack.scale, mappedScale).sort((a, b) => a.time - b.time),
          rotation: mergeFrames(clearedTrack.rotation, mappedRotation).sort((a, b) => a.time - b.time),
          opacity: finalOpacity,
        }
      })

      const contentEnd = tracks.reduce((max, t) => Math.max(max, getTrackEndTime(t)), 0)
      const pathsEnd = getMaxPathEnd(tracks)
      const segmentDuration = scaleTime(preset.duration ?? 0)

      // newClipId already generated above (before tracks.map) for tagging keyframes

      const nextClips = [
        ...prev.templateClips.filter((c) => c.id !== newClipId),
        {
          id: newClipId,
          layerId,
          template,
          start: appliedStartOffset,
          duration: segmentDuration,
          parameters: {
            templateSpeed: prev.templateSpeed,
            rollDistance: options?.parameters?.rollDistance ?? prev.rollDistance,
            jumpHeight: prev.jumpHeight,
            jumpVelocity: prev.jumpVelocity,
            popScale: prev.popScale,
            popWobble: prev.popWobble,
            popSpeed: prev.popSpeed,
            popCollapse: prev.popCollapse,
            shakeDistance: options?.parameters?.shakeDistance ?? prev.shakeDistance,
            pulseScale: options?.parameters?.pulseScale ?? prev.pulseScale,
            pulseSpeed: options?.parameters?.pulseSpeed ?? prev.pulseSpeed,
            spinSpeed: options?.parameters?.spinSpeed ?? prev.spinSpeed,
            spinDirection: options?.parameters?.spinDirection ?? prev.spinDirection,
            layerBase: options?.layerBase ?? existingClip?.parameters?.layerBase,
          },
        },
      ]
      const clipsEnd = nextClips.reduce((max, c) => Math.max(max, c.start + c.duration), 0)

      const newDuration = Math.max(contentEnd, pathsEnd, appliedStartOffset + segmentDuration, clipsEnd, 4000)

      return {
        ...prev,
        tracks,
        templateClips: nextClips,
        duration: newDuration,
        currentTime: clampTime(prev.currentTime, newDuration),
      }
    })
  }

  const addTemplateClip = (
    layerId: string,
    template: TemplateId,
    start: number,
    duration: number,
    parameters?: TimelineState['templateClips'][number]['parameters'],
    layerScale?: number,
    layerBase?: { position?: Vec2; scale?: number; rotation?: number; opacity?: number }
  ) => {
    const clipId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `clip-${Date.now()}-${Math.random()}`
      
    setState((prev) => {
      const newClip = {
        id: clipId,
        layerId,
        template,
        start,
        duration,
        parameters: {
          templateSpeed: prev.templateSpeed,
          rollDistance: prev.rollDistance,
          jumpHeight: prev.jumpHeight,
          jumpVelocity: prev.jumpVelocity,
          popScale: prev.popScale,
          popWobble: prev.popWobble,
          popSpeed: prev.popSpeed,
          popCollapse: prev.popCollapse,
            popReappear: prev.popReappear,
            shakeDistance: prev.shakeDistance,
            pulseScale: prev.pulseScale,
            pulseSpeed: prev.pulseSpeed,
            spinSpeed: prev.spinSpeed,
            spinDirection: prev.spinDirection,
            ...parameters,
            layerBase,
        }
      }

      const nextClips = [...prev.templateClips, newClip]
      
      // Rebuild tracks
      // We can reuse the logic from updateTemplateClip by extracting it, 
      // but for now let's just trigger a rebuild by calling a helper or duplicating minimal logic
      // Actually, we can just call updateTemplateClip internally? No, that updates an existing clip.
      
      // Let's copy the rebuild logic or extract it.
      // Since I can't easily extract in this tool call, I'll duplicate the rebuild call for this layer.
      
      // Helper to rebuild track from clips (duplicated from updateTemplateClip for now)
      // Ideally this should be a shared function outside setState
      const rebuildTrackFromClips = (
        layerId: string,
        currentClips: typeof nextClips,
        currentTracks: LayerTracks[],
        baseScale: number = 1,
        layerPosition?: Vec2,
        layerBase?: { position?: Vec2; scale?: number; rotation?: number; opacity?: number }
      ) => {
        const layerClips = currentClips
          .filter(c => c.layerId === layerId)
          .sort((a, b) => (a.start ?? 0) - (b.start ?? 0))

        const track = currentTracks.find(t => t.layerId === layerId)
        if (!track) return currentTracks

        let newTrack: LayerTracks = {
          ...track,
          position: [],
          scale: [],
          rotation: [],
          opacity: [],
          paths: []
        }

        let prevClipEnd = 0
        let lastPopStartState: SampledLayerState | null = null
        layerClips.forEach((clip, index) => {
           const start = clip.start ?? 0
           const duration = clip.duration ?? 0
           const end = start + duration
           
           const sampleTime = index === 0 ? 0 : prevClipEnd
          const previousClip = layerClips[index - 1]
          
           let clipBaseState
           if (index === 0) {
              // First clip: check if this is the very first animation (no other clips)
              const isFirstAnimation = layerClips.length === 1
              
              if (isFirstAnimation) {
                // This is the very first animation, use default state with provided layer scale
                clipBaseState = {
                  position: layerBase?.position ?? DEFAULT_LAYER_STATE.position,
                  scale: layerBase?.scale ?? baseScale,
                  rotation: layerBase?.rotation ?? DEFAULT_LAYER_STATE.rotation,
                  opacity: layerBase?.opacity ?? DEFAULT_LAYER_STATE.opacity,
                }
              } else {
                // Has other clips, sample from track
                const sampledFromOriginal = sampleLayerTracks(track, sampleTime, {
                  ...DEFAULT_LAYER_STATE,
                  position: layerBase?.position ?? DEFAULT_LAYER_STATE.position,
                  scale: layerBase?.scale ?? DEFAULT_LAYER_STATE.scale,
                  rotation: layerBase?.rotation ?? DEFAULT_LAYER_STATE.rotation,
                  opacity: layerBase?.opacity ?? DEFAULT_LAYER_STATE.opacity,
                })
                clipBaseState = {
                  ...sampledFromOriginal,
                  scale: Math.abs(sampledFromOriginal.scale), // Prevent negative scales
                }
              }
           } else {
             // Subsequent clips: sample from the newly built track to get the actual end state
             const sampledFromNew = sampleLayerTracks(newTrack, sampleTime, {
               ...DEFAULT_LAYER_STATE,
               position: layerBase?.position ?? DEFAULT_LAYER_STATE.position,
               scale: layerBase?.scale ?? DEFAULT_LAYER_STATE.scale,
               rotation: layerBase?.rotation ?? DEFAULT_LAYER_STATE.rotation,
               opacity: layerBase?.opacity ?? DEFAULT_LAYER_STATE.opacity,
             })
             
             // If newTrack doesn't have keyframes for a property, it means previous clips didn't animate it.
             // In that case, we should fallback to the original track's state at that time.
             const fallbackState = sampleLayerTracks(track, sampleTime, {
               ...DEFAULT_LAYER_STATE,
               position: layerBase?.position ?? DEFAULT_LAYER_STATE.position,
               scale: layerBase?.scale ?? DEFAULT_LAYER_STATE.scale,
               rotation: layerBase?.rotation ?? DEFAULT_LAYER_STATE.rotation,
               opacity: layerBase?.opacity ?? DEFAULT_LAYER_STATE.opacity,
             })
             
             if ((newTrack.position?.length ?? 0) === 0) sampledFromNew.position = fallbackState.position
             if ((newTrack.scale?.length ?? 0) === 0) sampledFromNew.scale = fallbackState.scale
             if ((newTrack.rotation?.length ?? 0) === 0) sampledFromNew.rotation = fallbackState.rotation
             if ((newTrack.opacity?.length ?? 0) === 0) sampledFromNew.opacity = fallbackState.opacity

             // Preserve the sampled state by default; only force a reset after a collapsing Pop
             const previousClip = layerClips[index - 1]
             const cameFromPop = previousClip?.template === 'pop'
             const popCollapsed = previousClip?.parameters?.popCollapse ?? prev.popCollapse
             const popShouldReappear = previousClip?.parameters?.popReappear ?? prev.popReappear ?? true
             const shouldRestoreFromPop = cameFromPop && popCollapsed && popShouldReappear
             const restoredScale = shouldRestoreFromPop && lastPopStartState ? lastPopStartState.scale : sampledFromNew.scale
             const restoredOpacity = shouldRestoreFromPop && lastPopStartState ? lastPopStartState.opacity : sampledFromNew.opacity

             clipBaseState = {
               position: sampledFromNew.position,
               scale: restoredScale,
               rotation: sampledFromNew.rotation,
               opacity: restoredOpacity
             }
             
             // If we need to restore after Pop, add explicit keyframes at the start of this clip
             if (shouldRestoreFromPop) {
               newTrack.scale = upsertKeyframe(newTrack.scale ?? [], { time: start, value: restoredScale })
               newTrack.opacity = upsertKeyframe(newTrack.opacity ?? [], { time: start, value: restoredOpacity })
             }
           }

           let preset
           if (clip.template === 'roll') {
             preset = PRESET_BUILDERS.roll(clip.parameters?.rollDistance ?? prev.rollDistance, clip.parameters?.templateSpeed ?? prev.templateSpeed)
           } else if (clip.template === 'jump') {
             preset = PRESET_BUILDERS.jump(clip.parameters?.jumpHeight ?? prev.jumpHeight, clip.parameters?.jumpVelocity ?? prev.jumpVelocity)
           } else if (clip.template === 'pop') {
             preset = PRESET_BUILDERS.pop(clip.parameters?.popScale ?? prev.popScale, clip.parameters?.popWobble ?? prev.popWobble, clip.parameters?.popSpeed ?? prev.popSpeed, clip.parameters?.popCollapse ?? prev.popCollapse)
             const shouldCapturePopStart = (clip.parameters?.popCollapse ?? prev.popCollapse) && (clip.parameters?.popReappear ?? prev.popReappear ?? true)
             if (shouldCapturePopStart) {
               lastPopStartState = clipBaseState
             } else {
               lastPopStartState = null
             }
           } else if (clip.template === 'shake') {
             preset = PRESET_BUILDERS.shake(clip.parameters?.shakeDistance ?? prev.shakeDistance, clip.parameters?.templateSpeed ?? prev.templateSpeed, clip.duration)
           } else if (clip.template === 'pulse') {
             preset = PRESET_BUILDERS.pulse(clip.parameters?.pulseScale ?? prev.pulseScale, clip.parameters?.pulseSpeed ?? prev.pulseSpeed, clip.duration)
           } else if (clip.template === 'spin') {
             preset = PRESET_BUILDERS.spin(clip.parameters?.spinSpeed ?? prev.spinSpeed, clip.parameters?.spinDirection ?? prev.spinDirection, clip.duration)
           } else if ([
             'fade_in', 'slide_in', 'grow_in', 'shrink_in', 'spin_in', 'twist_in', 'move_scale_in',
             'fade_out', 'slide_out', 'grow_out', 'shrink_out', 'spin_out', 'twist_out', 'move_scale_out'
           ].includes(clip.template)) {
             // @ts-ignore
             preset = PRESET_BUILDERS[clip.template](clip.duration)
           }
           else if (clip.template === 'path' && clip.parameters?.pathPoints) {
              newTrack.paths = [
                ...(newTrack.paths ?? []),
                {
                  id: clip.id,
                  startTime: start,
                  duration: duration,
                  points: clip.parameters.pathPoints,
                  easing: 'linear'
                }
              ]
              
              const points = clip.parameters.pathPoints
              const lastPoint = points[points.length - 1]
              
              if (lastPoint) {
                  const delta = { 
                      x: lastPoint.x - clipBaseState.position.x, 
                      y: lastPoint.y - clipBaseState.position.y 
                  }
                  preset = { 
                      duration, 
                      position: [{ time: duration, value: delta }], 
                      scale: [], rotation: [], opacity: [] 
                  }
              } else {
                  preset = { duration, position: [], scale: [], rotation: [], opacity: [] }
              }
           }

          if (!preset) return



          // clipBaseState was calculated above
                      if (index > 0 && start > prevClipEnd) {
              // Sample from the newly built track at prevClipEnd to get the actual state
              const gapState = sampleLayerTracks(newTrack, prevClipEnd, DEFAULT_LAYER_STATE)
              newTrack.position?.push({ time: start - 1, value: gapState.position })
              newTrack.scale?.push({ time: start - 1, value: gapState.scale })
              newTrack.rotation?.push({ time: start - 1, value: gapState.rotation })
              newTrack.opacity?.push({ time: start - 1, value: gapState.opacity })
            }
           
           const mergeKeyframes = <T,>(
             existing: TimelineKeyframe<T>[],
             newFrames: TimelineKeyframe<T>[] | undefined,
             baseValue?: T,
             mode: 'add' | 'multiply' | 'replace' = 'replace'
           ) => {
             if (!newFrames) return existing
             
             const shiftedNew = newFrames.map(f => {
               let value = f.value
               if (baseValue !== undefined) {
                 if (mode === 'add') {
                     if (typeof f.value === 'object' && f.value !== null && 'x' in f.value) {
                         const v = f.value as unknown as Vec2
                         const b = baseValue as unknown as Vec2
                         value = { x: v.x + b.x, y: v.y + b.y } as unknown as T
                     } else if (typeof f.value === 'number' && typeof baseValue === 'number') {
                         value = (f.value as number + baseValue) as unknown as T
                     }
                 } else if (mode === 'multiply') {
                     if (typeof f.value === 'number' && typeof baseValue === 'number') {
                         value = (f.value as number * baseValue) as unknown as T
                     }
                 }
               }
               return { ...f, time: f.time + start, value }
             })
             
             return [...existing, ...shiftedNew].sort((a, b) => a.time - b.time)
           }

            // If track is empty for a property, initialize it with baseValue at time 0
            // This ensures we have a starting point for the animation
            if ((newTrack.position?.length ?? 0) === 0 && clipBaseState.position) {
              newTrack.position = [{ time: 0, value: clipBaseState.position }]
            }
            if ((newTrack.scale?.length ?? 0) === 0 && clipBaseState.scale !== undefined) {
              newTrack.scale = [{ time: 0, value: clipBaseState.scale }]
            }
            if ((newTrack.rotation?.length ?? 0) === 0 && clipBaseState.rotation !== undefined) {
              newTrack.rotation = [{ time: 0, value: clipBaseState.rotation }]
            }

            const isInOutAnimation = [ 'fade_in', 'slide_in', 'grow_in', 'shrink_in', 'spin_in', 'twist_in', 'move_scale_in', 'fade_out', 'slide_out', 'grow_out', 'shrink_out', 'spin_out', 'twist_out', 'move_scale_out' ].includes(clip.template)

            const isInAnimation = ['fade_in', 'slide_in', 'grow_in', 'shrink_in', 'spin_in', 'twist_in', 'move_scale_in'].includes(clip.template)
            const isOutAnimation = ['fade_out', 'slide_out', 'grow_out', 'shrink_out', 'spin_out', 'twist_out', 'move_scale_out'].includes(clip.template)

            let mergedPosition = isInOutAnimation && preset.position
              ? preset.position.map((f: any, idx: number) => {
                  const v = f.value as unknown as Vec2
                  const isFirstKeyframe = idx === 0
                  
                  // Check if this keyframe represents "base position" (offset is 0,0)
                  const isBasePosition = (v?.x ?? 0) === 0 && (v?.y ?? 0) === 0
                  
                  // Round clipBaseState position to avoid accumulated floating point errors
                  const baseX = Math.round((clipBaseState.position?.x ?? 0) * 1e6) / 1e6
                  const baseY = Math.round((clipBaseState.position?.y ?? 0) * 1e6) / 1e6
                  
                  let resultX: number, resultY: number
                  
                  if (isInAnimation) {
                    // For IN animations: keyframes with {0,0} should use base position, others add offset
                    if (isBasePosition) {
                      resultX = baseX
                      resultY = baseY
                    } else {
                      // Round to avoid floating point precision errors
                      resultX = Math.round((baseX + (v?.x ?? 0)) * 1e6) / 1e6
                      resultY = Math.round((baseY + (v?.y ?? 0)) * 1e6) / 1e6
                    }
                  } else if (isOutAnimation) {
                    // For OUT animations: first keyframe uses base, others add offset
                    if (isFirstKeyframe) {
                      resultX = baseX
                      resultY = baseY
                    } else {
                      resultX = Math.round((baseX + (v?.x ?? 0)) * 1e6) / 1e6
                      resultY = Math.round((baseY + (v?.y ?? 0)) * 1e6) / 1e6
                    }
                  } else {
                    resultX = Math.round((baseX + (v?.x ?? 0)) * 1e6) / 1e6
                    resultY = Math.round((baseY + (v?.y ?? 0)) * 1e6) / 1e6
                  }
                  
                  return {
                    ...f,
                    value: { x: resultX, y: resultY },
                  }
                })
              : preset.position

            const mergedScale = preset.scale // keep multipliers; layer.scale applied at render

            const mergedRotation = isInOutAnimation && preset.rotation
              ? preset.rotation.map((f: any, idx: number) => {
                  const v = f.value as number
                  const isFirstKeyframe = idx === 0
                  
                  // For rotation: value of 0 means "use base rotation"
                  const isBaseRotation = v === 0
                  
                  let resultValue: number
                  
                  if (isInAnimation) {
                    // For IN animations: rotation of 0 should use base rotation, others add to base
                    if (isBaseRotation) {
                      resultValue = clipBaseState.rotation ?? 0
                    } else {
                      resultValue = (clipBaseState.rotation ?? 0) + v
                    }
                  } else if (isOutAnimation) {
                    // For OUT animations: first keyframe uses base rotation, others add to base
                    if (isFirstKeyframe) {
                      resultValue = clipBaseState.rotation ?? 0
                    } else {
                      resultValue = (clipBaseState.rotation ?? 0) + v
                    }
                  } else {
                    resultValue = v
                  }
                  
                  return { ...f, value: resultValue }
                })
              : preset.rotation

            newTrack = {
              ...newTrack,
              position: mergeKeyframes(newTrack.position ?? [], mergedPosition, isInOutAnimation ? undefined : clipBaseState.position, isInOutAnimation ? 'replace' : 'add'),
              scale: mergeKeyframes(newTrack.scale ?? [], mergedScale, undefined, 'replace'),
              rotation: mergeKeyframes(newTrack.rotation ?? [], mergedRotation, isInOutAnimation ? undefined : clipBaseState.rotation, isInOutAnimation ? 'replace' : 'add'),
              opacity: mergeKeyframes(newTrack.opacity ?? [], preset.opacity, isInOutAnimation ? undefined : clipBaseState.opacity, isInOutAnimation ? 'replace' : 'multiply'),
            }
            
           prevClipEnd = end
         })
         
        // Ensure static start keyframes
        const initialState = sampleLayerTracks(track, 0, DEFAULT_LAYER_STATE)
        const firstClipStart = layerClips.length > 0 ? (layerClips[0].start ?? 0) : 0
        
        const ensureStartKeyframes = <T,>(
            frames: TimelineKeyframe<T>[] | undefined, 
            defaultValue: T
        ): TimelineKeyframe<T>[] => {
            const fs = [...(frames ?? [])]
            const hasKeyframeAtZero = fs.some(kf => kf.time === 0)
            
            if (!hasKeyframeAtZero) {
                fs.unshift({ time: 0, value: defaultValue })
            }
            
            if (firstClipStart > 0) {
                const insertIndex = fs.findIndex(kf => kf.time >= firstClipStart)
                const effectiveIndex = insertIndex === -1 ? fs.length : insertIndex
                fs.splice(effectiveIndex, 0, { time: firstClipStart - 1, value: defaultValue })
            }
            
            return fs.sort((a, b) => a.time - b.time)
        }

        newTrack.position = ensureStartKeyframes(newTrack.position, initialState.position)
        newTrack.scale = ensureStartKeyframes(newTrack.scale, initialState.scale)
        newTrack.rotation = ensureStartKeyframes(newTrack.rotation, initialState.rotation)
        newTrack.opacity = ensureStartKeyframes(newTrack.opacity, initialState.opacity)
        
        if ((newTrack.position?.length ?? 0) === 0) newTrack.position = [{ time: 0, value: initialState.position }]
            if ((newTrack.scale?.length ?? 0) === 0) newTrack.scale = [{ time: 0, value: 1 }]
        if ((newTrack.rotation?.length ?? 0) === 0) newTrack.rotation = [{ time: 0, value: initialState.rotation }]
        if ((newTrack.opacity?.length ?? 0) === 0) newTrack.opacity = [{ time: 0, value: initialState.opacity }]

        return currentTracks.map(t => t.layerId === layerId ? newTrack : t)
      }

      const newTracks = rebuildTrackFromClips(
        layerId,
        nextClips,
        prev.tracks,
        layerScale ?? 1,
        parameters?.layerBase?.position,
        parameters?.layerBase
      )
      
      // Recalculate duration
      const getMaxPathEnd = (tracks: LayerTracks[]) => {
        let maxEnd = 0
        tracks.forEach((t) => {
          (t.paths ?? []).forEach((p) => {
            maxEnd = Math.max(maxEnd, p.startTime + p.duration)
          })
        })
        return maxEnd
      }
      
      const getTrackEndTime = (track: LayerTracks): number => {
        const times: number[] = []
        if (track.position && track.position.length) times.push(track.position[track.position.length - 1].time)
        return times.length ? Math.max(...times) : 0
      }

      const tracksEnd = newTracks.reduce((max, t) => Math.max(max, getTrackEndTime(t)), 0)
      const clipsEnd = nextClips.reduce((max, c) => Math.max(max, (c.start ?? 0) + (c.duration ?? 0)), 0)
      const pathsEnd = getMaxPathEnd(newTracks)
      const newDuration = Math.max(tracksEnd, clipsEnd, pathsEnd, 4000)

      return {
        ...prev,
        templateClips: nextClips,
        tracks: newTracks,
        duration: newDuration,
        currentTime: clampTime(prev.currentTime, newDuration),
      }
    })
    
    return clipId
  }

  const removeTemplateClip = (
    clipId: string,
    layerBase?: { position?: Vec2; scale?: number; rotation?: number; opacity?: number }
  ) => {
    setState((prev) => {
      const clipToRemove = prev.templateClips.find((c) => c.id === clipId)
      if (!clipToRemove) return prev
      
      // Remove the clip from templateClips
      const nextClips = prev.templateClips.filter((c) => c.id !== clipId)
      
      // Filter keyframes by clipId - remove all keyframes belonging to this clip
      const nextTracks = prev.tracks.map((track) => {
        if (track.layerId !== clipToRemove.layerId) return track
        
        const clipStart = clipToRemove.start ?? 0
        const clipEnd = clipStart + (clipToRemove.duration ?? 0)
        
        // Filter out keyframes with matching clipId OR within the clip's time range
        // This handles both new keyframes (with clipId) and old keyframes (without clipId)
        const filterKeyframes = <T,>(frames: TimelineKeyframe<T>[] | undefined) => {
          return (frames ?? []).filter((f) => {
            // Always keep base keyframes at time=0
            if (f.time === 0) return true
            
            // If keyframe has clipId, check if it matches the deleted clip
            if (f.clipId) {
              return f.clipId !== clipId
            }
            
            // For old keyframes without clipId, filter by time range
            // Keep keyframes outside the deleted clip's time range
            // IMPORTANT: Use <= for start to keep keyframes at exactly clipStart
            // Those keyframes belong to the PREVIOUS clip's end, not this clip's start
            return f.time <= clipStart || f.time >= clipEnd
          })
        }
        
        return {
          ...track,
          position: filterKeyframes(track.position),
          scale: filterKeyframes(track.scale),
          rotation: filterKeyframes(track.rotation),
          opacity: filterKeyframes(track.opacity),
          // Paths don't have clipId, keep them as is for now
          paths: track.paths,
        }
      })
      
      // Recompute duration
      const clipsEnd = nextClips.reduce((max, c) => {
        const start = Number.isFinite(c.start) ? (c.start as number) : 0
        const dur = Number.isFinite(c.duration) ? (c.duration as number) : 0
        return Math.max(max, start + dur)
      }, 0)
      
      const tracksEnd = nextTracks.reduce((max, t) => {
        const times: number[] = []
        if (t.position?.length) times.push(t.position[t.position.length - 1].time)
        if (t.scale?.length) times.push(t.scale[t.scale.length - 1].time)
        if (t.rotation?.length) times.push(t.rotation[t.rotation.length - 1].time)
        if (t.opacity?.length) times.push(t.opacity[t.opacity.length - 1].time)
        const filtered = times.filter(Number.isFinite)
        return Math.max(max, filtered.length ? Math.max(...filtered) : 0)
      }, 0)
      
      const newDuration = Math.max(clipsEnd, tracksEnd, 4000)

      return {
        ...prev,
        templateClips: nextClips,
        tracks: nextTracks,
        duration: newDuration,
        currentTime: clampTime(prev.currentTime, newDuration),
      }
    })
  }

  const setCurrentTime = (time: number) => {
    setState((prev) => ({
      ...prev,
      currentTime: clampTime(time, prev.duration),
      isPlaying: false,
      lastTick: undefined,
    }))
  }

  const setDuration = (duration: number) => {
    setState((prev) => ({
      ...prev,
      duration: Math.max(0, duration),
      currentTime: clampTime(prev.currentTime, duration),
    }))
  }

  const setLoop = (loop: boolean) => {
    setState((prev) => ({
      ...prev,
      loop,
    }))
  }

  const setPlaybackRate = (rate: number) => {
    setState((prev) => ({
      ...prev,
      playbackRate: Math.max(0.1, rate),
    }))
  }

  const setRollDistance = (dist: number) => {
    const clamped = Math.max(0.01, Math.min(1, dist))
    setState((prev) => ({
      ...prev,
      rollDistance: clamped,
    }))
  }

  const setJumpHeight = (height: number) => {
    const clamped = Math.max(0.05, Math.min(1, height))
    setState((prev) => ({
      ...prev,
      jumpHeight: clamped,
    }))
  }

  const setJumpVelocity = (velocity: number) => {
    const clamped = Math.max(0.2, Math.min(6, velocity))
    setState((prev) => ({
      ...prev,
      jumpVelocity: clamped,
    }))
  }

  const setPopScale = (scale: number) => {
    const clamped = Math.max(1, Math.min(3, scale))
    setState((prev) => ({
      ...prev,
      popScale: clamped,
    }))
  }

  const setPopWobble = (enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      popWobble: enabled,
    }))
  }

  const setPopSpeed = (speed: number) => {
    const clamped = Math.max(0.25, Math.min(3, speed))
    setState((prev) => ({
      ...prev,
      popSpeed: clamped,
    }))
  }

  const setPopCollapse = (collapse: boolean) => {
    setState((prev) => ({ ...prev, popCollapse: collapse }))
  }

  const setPopReappear = (reappear: boolean) => {
    setState((prev) => ({ ...prev, popReappear: reappear }))
  }

  const setShakeDistance = (distance: number) => {
    const clamped = Math.max(0, Math.min(100, distance))
    setState((prev) => ({ ...prev, shakeDistance: clamped }))
  }

  const setPulseScale = (scale: number) => {
    const clamped = Math.max(0.05, Math.min(1, scale))
    setState((prev) => ({ ...prev, pulseScale: clamped }))
  }

  const setPulseSpeed = (speed: number) => {
    const clamped = Math.max(0.1, Math.min(5, speed))
    setState((prev) => ({ ...prev, pulseSpeed: clamped }))
  }

  const setSpinSpeed = (speed: number) => {
    const clamped = Math.max(0.1, Math.min(10, speed))
    setState((prev) => ({ ...prev, spinSpeed: clamped }))
  }

  const setSpinDirection = (dir: 1 | -1) => {
    setState((prev) => ({ ...prev, spinDirection: dir }))
  }

  const setTemplateSpeed = (speed: number) => {
    const clamped = Math.max(0.1, Math.min(4, speed))
    setState((prev) => ({
      ...prev,
      templateSpeed: clamped,
    }))
  }

  const stopTicker = () => {
    if (rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafId)
    }
    rafId = null
  }

  const tick = (timestamp: number) => {
    setState((prev) => {
      if (!prev.isPlaying) return prev
      const lastTick = prev.lastTick ?? timestamp
      const deltaMs = (timestamp - lastTick) * prev.playbackRate
      let nextTime = prev.currentTime + deltaMs
      let playing: boolean = prev.isPlaying

      // Calculate actual content duration to loop/stop correctly
      // We want to loop at the end of the clips, not the full timeline view duration (which is min 4000ms)
      const tracksEnd = prev.tracks.reduce((max, t) => {
        const times: number[] = []
        if (t.position?.length) times.push(t.position[t.position.length - 1].time)
        if (t.scale?.length) times.push(t.scale[t.scale.length - 1].time)
        if (t.rotation?.length) times.push(t.rotation[t.rotation.length - 1].time)
        if (t.opacity?.length) times.push(t.opacity[t.opacity.length - 1].time)
        return Math.max(max, times.length ? Math.max(...times) : 0)
      }, 0)
      const clipsEnd = prev.templateClips.reduce((max, c) => Math.max(max, (c.start ?? 0) + (c.duration ?? 0)), 0)
      const pathsEnd = getMaxPathEnd(prev.tracks)
      
      // Use a minimum of 100ms to avoid instant looping on empty timeline
      const contentDuration = Math.max(100, tracksEnd, clipsEnd, pathsEnd)

      if (nextTime >= contentDuration) {
        if (prev.loop && contentDuration > 0) {
          nextTime = nextTime % contentDuration
        } else {
          nextTime = contentDuration
          playing = false
        }
      }

      return {
        ...prev,
        currentTime: nextTime,
        isPlaying: playing,
        lastTick: timestamp,
      }
    })

    if (state.isPlaying && typeof requestAnimationFrame !== 'undefined') {
      rafId = requestAnimationFrame(tick)
    } else {
      stopTicker()
    }
  }

  const setPlaying = (playing: boolean) => {
    setState((prev) => ({
      ...prev,
      isPlaying: playing,
      lastTick: playing ? undefined : prev.lastTick,
    }))
    if (playing) {
      if (typeof requestAnimationFrame !== 'undefined') {
        stopTicker()
        rafId = requestAnimationFrame(tick)
      }
    } else {
      stopTicker()
    }
  }

  const togglePlay = () => {
    setPlaying(!state.isPlaying)
  }

  const clear = () => {
    stopTicker()
    setState(() => defaultState)
  }

  const sampleAt = (time?: number) => {
    const target = typeof time === 'number' ? time : state.currentTime
    return sampleTimeline(state.tracks, target)
  }

  const selectClip = (clipId: string) => {
    const clip = state.templateClips.find((c) => c.id === clipId)
    if (!clip || !clip.parameters) return

    setState((prev) => ({
      ...prev,
      templateSpeed: clip.parameters?.templateSpeed ?? prev.templateSpeed,
      rollDistance: clip.parameters?.rollDistance ?? prev.rollDistance,
      jumpHeight: clip.parameters?.jumpHeight ?? prev.jumpHeight,
      jumpVelocity: clip.parameters?.jumpVelocity ?? prev.jumpVelocity,
      popScale: clip.parameters?.popScale ?? prev.popScale,
      popWobble: clip.parameters?.popWobble ?? prev.popWobble,
      popSpeed: clip.parameters?.popSpeed ?? prev.popSpeed,
      popCollapse: clip.parameters?.popCollapse ?? prev.popCollapse,
     popReappear: clip.parameters?.popReappear ?? prev.popReappear,
     shakeDistance: clip.parameters?.shakeDistance ?? prev.shakeDistance,
     pulseScale: clip.parameters?.pulseScale ?? prev.pulseScale,
     pulseSpeed: clip.parameters?.pulseSpeed ?? prev.pulseSpeed,
      spinSpeed: clip.parameters?.spinSpeed ?? prev.spinSpeed,
      spinDirection: clip.parameters?.spinDirection ?? prev.spinDirection,
    }))
  }

  return {
    subscribe,
    getState: () => state,
    ensureTrack,
    updateTemplateClip,
    selectClip,
    addTemplateClip,
    removeTemplateClip,
    setCurrentTime,
    setDuration,
    setLoop,
    setPlaybackRate,
    setRollDistance,
    setJumpHeight,
    setJumpVelocity,
    setPopScale,
    setPopSpeed,
    setPopWobble,
    setPopCollapse,
    setPopReappear,
    setShakeDistance,
    setPulseScale,
    setPulseSpeed,
    setSpinSpeed,
    setSpinDirection,
    setTemplateSpeed,
    setPlaying,
    togglePlay,
    templateClips: state.templateClips,
    setPositionKeyframe: (layerId: string, frame: TimelineKeyframe<Vec2>) =>
      setKeyframe(layerId, 'position', frame),
    setScaleKeyframe: (layerId: string, frame: TimelineKeyframe<number>) =>
      setKeyframe(layerId, 'scale', frame),
    setRotationKeyframe: (layerId: string, frame: TimelineKeyframe<number>) =>
      setKeyframe(layerId, 'rotation', frame),
    setOpacityKeyframe: (layerId: string, frame: TimelineKeyframe<number>) =>
      setKeyframe(layerId, 'opacity', frame),
    addPathClip,
    removePathClip,
    updatePathClip,
    replaceTracks,
    applyPresetToLayer,
    clear,
    sampleAt,
  }
}

const TimelineStoreContext = createContext<TimelineStore | null>(null)

export const TimelineProvider = ({ children }: { children: ReactNode }) => {
  const store = useMemo(() => createTimelineStore(), [])
  return <TimelineStoreContext.Provider value={store}>{children}</TimelineStoreContext.Provider>
}

const useTimelineStoreContext = () => {
  const store = useContext(TimelineStoreContext)
  if (!store) {
    throw new Error('useTimeline must be used within a TimelineProvider')
  }
  return store
}

export const useTimeline = <T,>(selector: (state: TimelineState) => T): T => {
  const store = useTimelineStoreContext()
  const snapshot = useSyncExternalStore(store.subscribe, store.getState, store.getState)
  return selector(snapshot)
}

export const useTimelineActions = () => useTimelineStoreContext()

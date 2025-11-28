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
  templateClips: Array<{
    id: string
    layerId: string
    template: TemplateId
    start: number
    duration: number
  }>
}

export type TimelineStore = ReturnType<typeof createTimelineStore>

const clampTime = (time: number, duration: number) => Math.max(0, Math.min(time, duration))

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
          value: defaults?.scale ?? DEFAULT_LAYER_STATE.scale,
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
    updates: Partial<Pick<TimelineState['templateClips'][number], 'start' | 'duration'>>
  ) => {
    setState((prev) => {
      const updatedClips = prev.templateClips.map((clip) =>
        clip.id === clipId && clip.layerId === layerId ? { ...clip, ...updates } : clip
      )

      // Calculate new parameters for the specific clip being updated
      const layerClips = updatedClips.filter((c) => c.layerId === layerId)
      const rollClip = layerClips.find((c) => c.id === clipId && c.template === 'roll')
      const jumpClip = layerClips.find((c) => c.id === clipId && c.template === 'jump')
      const popClip = layerClips.find((c) => c.id === clipId && c.template === 'pop')

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

      // Helper to rebuild track from clips
      const rebuildTrackFromClips = (layerId: string, currentClips: typeof updatedClips, currentTracks: LayerTracks[]) => {
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
          opacity: []
        }

        // Apply clips sequentially
        let prevClipEnd = 0
        layerClips.forEach((clip, index) => {
           const start = clip.start ?? 0
           const duration = clip.duration ?? 0
           const end = start + duration
           
           let preset
           if (clip.template === 'roll') {
             preset = PRESET_BUILDERS.roll(nextRollDistance, prev.templateSpeed)
           } else if (clip.template === 'jump') {
             preset = PRESET_BUILDERS.jump(nextJumpHeight, prev.jumpVelocity)
           } else if (clip.template === 'pop') {
             preset = PRESET_BUILDERS.pop(prev.popScale, prev.popWobble, nextPopSpeed, prev.popCollapse)
           }

           if (!preset) return

           // CRITICAL: Sample the base state correctly for sequential clips
           // For the FIRST clip: sample at time 0 to capture manual position/scale changes
           // For SUBSEQUENT clips: sample at the END of the PREVIOUS clip to maintain continuity
           const sampleTime = index === 0 ? 0 : prevClipEnd
           const clipBaseState = sampleLayerTracks(track, sampleTime, DEFAULT_LAYER_STATE)
           
           console.log('[CLIP DEBUG] Processing clip:', {
             index,
             template: clip.template,
             start,
             end,
             prevClipEnd,
             sampleTime,
             clipBaseState: clipBaseState.position
           })
           
           // If there's a gap between this clip and the previous one, add static keyframes
           if (index > 0 && start > prevClipEnd) {
             console.log('[CLIP DEBUG] Gap detected, adding static keyframes from', prevClipEnd, 'to', start - 1)
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

           newTrack = {
             ...newTrack,
             position: mergeKeyframes(newTrack.position ?? [], preset.position, clipBaseState.position, 'add'),
             scale: mergeKeyframes(newTrack.scale ?? [], preset.scale, clipBaseState.scale, 'multiply'),
             rotation: mergeKeyframes(newTrack.rotation ?? [], preset.rotation, clipBaseState.rotation, 'add'),
             opacity: mergeKeyframes(newTrack.opacity ?? [], preset.opacity, clipBaseState.opacity, 'multiply'),
           }
           
           // Update prevClipEnd for next iteration
           prevClipEnd = end
         })
         
        // CRITICAL: Ensure static start keyframes
        // If the first clip doesn't start at time 0, we need a static keyframe at 0
        // to keep the shape in its initial position until the clip starts
        const initialState = sampleLayerTracks(track, 0, DEFAULT_LAYER_STATE)
        const firstClipStart = layerClips.length > 0 ? (layerClips[0].start ?? 0) : 0
        
        console.log('[KEYFRAME DEBUG] Rebuild track:', {
          layerId,
          firstClipStart,
          initialState: initialState.position,
          currentPositionKeyframes: newTrack.position?.map(kf => ({ time: kf.time, value: kf.value }))
        })
        
        // Always add a keyframe at time 0 if it doesn't exist or if first clip starts later
        if (firstClipStart > 0 || (newTrack.position?.length ?? 0) === 0) {
          // Ensure we have a keyframe at time 0
          const hasKeyframeAtZero = newTrack.position?.some(kf => kf.time === 0)
          if (!hasKeyframeAtZero) {
            console.log('[KEYFRAME DEBUG] Adding static keyframe at time 0')
            newTrack.position = [{ time: 0, value: initialState.position }, ...(newTrack.position ?? [])]
            newTrack.scale = [{ time: 0, value: initialState.scale }, ...(newTrack.scale ?? [])]
            newTrack.rotation = [{ time: 0, value: initialState.rotation }, ...(newTrack.rotation ?? [])]
            newTrack.opacity = [{ time: 0, value: initialState.opacity }, ...(newTrack.opacity ?? [])]
          } else {
            console.log('[KEYFRAME DEBUG] Keyframe at time 0 already exists')
          }
          
          // CRITICAL: Add duplicate keyframe at clip start time to prevent interpolation
          // If first clip starts at time T > 0, we need keyframes at both 0 and T-1 with the same value
          // This prevents the shape from interpolating between 0 and T
          if (firstClipStart > 0) {
            console.log('[KEYFRAME DEBUG] Adding duplicate keyframe at time:', firstClipStart - 1)
            // Insert keyframe just before the clip starts (at firstClipStart - 1ms)
            // This ensures no interpolation happens before the clip
            const insertIndex = newTrack.position?.findIndex(kf => kf.time >= firstClipStart) ?? 0
            newTrack.position?.splice(insertIndex, 0, { time: firstClipStart - 1, value: initialState.position })
            newTrack.scale?.splice(insertIndex, 0, { time: firstClipStart - 1, value: initialState.scale })
            newTrack.rotation?.splice(insertIndex, 0, { time: firstClipStart - 1, value: initialState.rotation })
            newTrack.opacity?.splice(insertIndex, 0, { time: firstClipStart - 1, value: initialState.opacity })
          }
        }
        
        console.log('[KEYFRAME DEBUG] Final position keyframes:', newTrack.position?.map(kf => ({ time: kf.time, value: kf.value })))
        
        // Fallback: if track is still empty, add defaults
        if ((newTrack.position?.length ?? 0) === 0) newTrack.position = [{ time: 0, value: initialState.position }]
        if ((newTrack.scale?.length ?? 0) === 0) newTrack.scale = [{ time: 0, value: initialState.scale }]
        if ((newTrack.rotation?.length ?? 0) === 0) newTrack.rotation = [{ time: 0, value: initialState.rotation }]
        if ((newTrack.opacity?.length ?? 0) === 0) newTrack.opacity = [{ time: 0, value: initialState.opacity }]

        return currentTracks.map(t => t.layerId === layerId ? newTrack : t)
      }

      const adjustedTracks = rebuildTrackFromClips(layerId, updatedClips, prev.tracks)

      const getTrackEnd = (track: LayerTracks) => {
        const times: number[] = []
        if (track.position?.length) times.push(track.position[track.position.length - 1].time)
        if (track.scale?.length) times.push(track.scale[track.scale.length - 1].time)
        if (track.rotation?.length) times.push(track.rotation[track.rotation.length - 1].time)
        if (track.opacity?.length) times.push(track.opacity[track.opacity.length - 1].time)
        return times.length ? Math.max(...times) : 0
      }

      const tracksEnd = adjustedTracks.reduce((max, t) => Math.max(max, getTrackEnd(t)), 0)
      const clipsEnd = updatedClips.reduce((max, c) => Math.max(max, (c.start ?? 0) + (c.duration ?? 0)), 0)
      const pathsEnd = getMaxPathEnd(adjustedTracks)
      const newDuration = Math.max(tracksEnd, clipsEnd, pathsEnd, 4000)

      return {
        ...prev,
        templateClips: updatedClips,
        tracks: adjustedTracks,
        duration: newDuration,
        currentTime: clampTime(prev.currentTime, newDuration),
        rollDistance: nextRollDistance,
        jumpHeight: nextJumpHeight,
        popSpeed: nextPopSpeed,
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
            : undefined
    if (!preset) return
    ensureTrack(layerId)

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

      const tracks = prev.tracks.map((track) => {
        if (track.layerId !== layerId) return track

        const append = options?.append ?? false
        const startOffset = typeof options?.startAt === 'number' ? options.startAt : append ? getTrackEndTime(track) : 0
        appliedStartOffset = startOffset
        
        console.log('[APPLY_PRESET DEBUG]', {
          layerId,
          template,
          append,
          optionsStartAt: options?.startAt,
          startOffset,
          appliedStartOffset
        })

        const trimFrames = <T,>(frames: TimelineKeyframe<T>[] | undefined) =>
          (frames ?? []).filter((f) => f.time < startOffset)

        const baseSample = sampleLayerTracks(track, startOffset, DEFAULT_LAYER_STATE)
        const basePosition = base?.position ?? baseSample.position
        const baseScale = base?.scale ?? baseSample.scale
        const baseRotation = base?.rotation ?? baseSample.rotation
        const baseOpacity = base?.opacity ?? baseSample.opacity

        const clearedTrack: LayerTracks = {
          ...track,
          position: trimFrames(track.position),
          scale: trimFrames(track.scale),
          rotation: trimFrames(track.rotation),
          opacity: trimFrames(track.opacity),
        }
        
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
        }

        const baseState = sampleLayerTracks(clearedTrack, startOffset, DEFAULT_LAYER_STATE)

        const mergeFrames = <T,>(existing: TimelineKeyframe<T>[] | undefined, incoming: TimelineKeyframe<T>[]) =>
          incoming.reduce((acc, frame) => upsertKeyframe(acc, frame), existing ?? [])

        const mappedPosition =
          preset.position?.map((frame: TimelineKeyframe<Vec2>) => ({
            ...normalizePositionFrame(frame, baseState.position),
            time: startOffset + scaleTime(frame.time),
          })) ?? []

        const mappedScale =
          preset.scale?.map((f: TimelineKeyframe<number>) => ({
            ...normalizeNumberFrame(f, baseState.scale, false),
            time: startOffset + scaleTime(f.time),
          })) ?? []

        const mappedRotation =
          preset.rotation?.map((f: TimelineKeyframe<number>) => ({
            ...normalizeNumberFrame(f, baseState.rotation, true),
            time: startOffset + scaleTime(f.time),
          })) ?? []

        const mappedOpacity =
          preset.opacity?.map((f: TimelineKeyframe<number>) => ({
            ...normalizeNumberFrame(f, baseState.opacity, false),
            time: startOffset + scaleTime(f.time),
          })) ?? []

        return {
          ...track,
          position: mergeFrames(clearedTrack.position, mappedPosition).sort((a, b) => a.time - b.time),
          scale: mergeFrames(clearedTrack.scale, mappedScale).sort((a, b) => a.time - b.time),
          rotation: mergeFrames(clearedTrack.rotation, mappedRotation).sort((a, b) => a.time - b.time),
          opacity: mergeFrames(clearedTrack.opacity, mappedOpacity).sort((a, b) => a.time - b.time),
        }
      })

      const contentEnd = tracks.reduce((max, t) => Math.max(max, getTrackEndTime(t)), 0)
      const pathsEnd = getMaxPathEnd(tracks)
      const segmentDuration = scaleTime(preset.duration ?? 0)
      
      // Check if we're replacing an existing clip
      // Priority 1: Find clip at the exact target position (for re-applying at same position)
      // Priority 2: Find the most recent clip for this template (for parameter updates)
      let existingClip = prev.templateClips.find(
        (c) => c.layerId === layerId && Math.abs(c.start - appliedStartOffset) < 1 && c.template === template
      )
      
      // If no clip found at target position, check if we're updating an existing clip's parameters
      // This handles the case where user changes template controls (e.g., Jump Height)
      // IMPORTANT: Only do this for the SAME template to avoid replacing different templates
      if (!existingClip && !options?.append) {
        const clipsForTemplate = prev.templateClips
          .filter((c) => c.layerId === layerId && c.template === template)
          .sort((a, b) => b.start - a.start) // Sort by start time, descending
        
        // Only use the most recent clip if it's at a similar position (within 100ms)
        // This prevents replacing clips when switching templates
        if (clipsForTemplate.length > 0 && Math.abs(clipsForTemplate[0].start - appliedStartOffset) < 100) {
          existingClip = clipsForTemplate[0]
          console.log('[CLIP UPDATE] Found existing clip to update:', existingClip.id, 'at', existingClip.start)
        }
      }

      const clipId = existingClip ? existingClip.id : (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `clip-${Date.now()}-${Math.random()}`)

      const nextClips = [
        ...prev.templateClips.filter((c) => c.id !== clipId),
        {
          id: clipId,
          layerId,
          template,
          start: appliedStartOffset,
          duration: segmentDuration,
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

  const setPopCollapse = (enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      popCollapse: enabled,
    }))
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

  return {
    subscribe,
    getState: () => state,
    ensureTrack,
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
    setTemplateSpeed,
    setPlaying,
    togglePlay,
    templateClips: state.templateClips,
    updateTemplateClip,
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

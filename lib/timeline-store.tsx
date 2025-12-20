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
  rollRotation: number
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
      rollRotation?: number
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
      // Counter animation parameters
      counterStart?: number
      counterEnd?: number
      counterPrefix?: string
      counterSuffix?: string
      counterDecimals?: number
      pathPoints?: Vec2[]
      pathEasing?: 'linear' | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad'
      pathLength?: number
      layerBase?: {
        position?: Vec2
        scale?: number
        rotation?: number
        opacity?: number
      }
      // Pan & Zoom parameters
      panZoomStartRegion?: { x: number; y: number; width: number; height: number }
      panZoomEndRegion?: { x: number; y: number; width: number; height: number }
      panZoomHoldDuration?: number
      panZoomIntensity?: number // Zoom level (1.2 - 3.0)
      panZoomEasing?: 'linear' | 'ease-in-out' | 'smooth'
      panZoomBlurIntensity?: number // Blur intensity (0 = no blur, 10 = max blur)
      // Mask Center parameters
      maskAngle?: number // Angle in degrees (0 = horizontal, 90 = vertical)
      maskEasing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
      // Text animation parameters
      textAnimation?: 'typewriter' | 'bounce_in' | 'bounce_out' | 'scramble' | 'fade_in_char' | 'fade_out_char'
      showCursor?: boolean
      // Transition parameters
      transitionToLayerId?: string
      transitionType?: 'fade' | 'slide' | 'zoom' | 'blur'
      slideDirection?: 'top' | 'bottom' | 'left' | 'right'
      // Color parameters
      colorFrom?: number
      colorTo?: number
      colorEasing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
      // Resize parameters
      resizeFromWidth?: number
      resizeFromHeight?: number
      resizeToWidth?: number
      resizeToHeight?: number
      resizeEasing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
      resizeAnchor?: 'middle' | 'top' | 'bottom' | 'left' | 'right'
      // Rotation parameters
      rotateFromAngle?: number
      rotateToAngle?: number
      rotateEasing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
    }
  }>
  // Click markers for click animation effect
  clickMarkers: Array<{
    id: string
    layerId: string
    time: number  // when the click happens (in ms)
  }>
  // Effect clips (glow, confetti, blur, etc.) - work like template clips with timing
  effectClips: Array<{
    id: string
    layerId: string
    effectType: 'glow' | 'dropShadow' | 'blur' | 'glitch' | 'pixelate' | 'sparkles' | 'confetti'
    start: number       // ms
    duration: number    // ms
    params: {
      // Glow params
      glowColor?: number
      glowIntensity?: number
      glowDistance?: number
      // Blur params
      blurStrength?: number
      // Confetti/Particles params
      particleCount?: number
      particleSpeed?: number
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
  duration: 5000, // 5 seconds minimum for free playhead movement
  currentTime: 0,
  isPlaying: false,
  loop: false,
  playbackRate: 1,
  templateSpeed: 1,
  rollDistance: 0.2,
  rollRotation: 1,  // Default 1 full rotation during roll
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
  clickMarkers: [],
  effectClips: [],
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
    clickMarkers: initialState?.clickMarkers ?? defaultState.clickMarkers,
    effectClips: initialState?.effectClips ?? defaultState.effectClips,
  }

  const listeners = new Set<() => void>()
  let rafId: number | null = null
  
  // Internal time tracking for high-performance playback
  // This allows PixiJS to read the current time at 60fps without React re-renders
  let internalCurrentTime = state.currentTime
  let lastUiUpdateTime = 0
  const UI_UPDATE_INTERVAL = 33 // ~30fps for UI updates (React state)
  
  // CACHED content duration - avoids expensive per-frame calculations
  let cachedContentDuration = 5000
  
  // Helper to recalculate content duration (called only when tracks/clips change)
  const recalculateContentDuration = () => {
    const tracksEnd = state.tracks.reduce((max, t) => {
      const times: number[] = []
      if (t.position?.length) times.push(t.position[t.position.length - 1].time)
      if (t.scale?.length) times.push(t.scale[t.scale.length - 1].time)
      if (t.rotation?.length) times.push(t.rotation[t.rotation.length - 1].time)
      if (t.opacity?.length) times.push(t.opacity[t.opacity.length - 1].time)
      return Math.max(max, times.length ? Math.max(...times) : 0)
    }, 0)
    const clipsEnd = state.templateClips.reduce((max, c) => Math.max(max, (c.start ?? 0) + (c.duration ?? 0)), 0)
    const pathsEnd = getMaxPathEnd(state.tracks)
    const layersEnd = state.tracks.reduce((max, t) => Math.max(max, (t.startTime ?? 0) + (t.duration ?? 0)), 0)
    const effectClipsEnd = state.effectClips.reduce((max, c) => Math.max(max, (c.start ?? 0) + (c.duration ?? 0)), 0)
    const clickMarkersEnd = state.clickMarkers.reduce((max, m) => Math.max(max, m.time), 0)
    
    const hasContent = state.tracks.length > 0 || state.templateClips.length > 0 || state.effectClips.length > 0
    cachedContentDuration = hasContent 
      ? Math.max(100, tracksEnd, clipsEnd, pathsEnd, layersEnd, effectClipsEnd, clickMarkersEnd)
      : Math.max(5000, clickMarkersEnd + 500)
  }

  const notify = () => {
    listeners.forEach((cb) => cb())
  }

  const setState = (updater: (prev: TimelineState) => TimelineState) => {
    state = updater(state)
    recalculateContentDuration() // Keep cache in sync
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
      startTime: (() => {
        // Auto-sequencing: Start after the last clip ends
        // But if there are no clips, start at 0
        // Add 5ms gap between shapes for slight visual separation
        const maxEndTime = state.tracks.reduce((max, t) => {
          const start = t.startTime ?? 0
          const dur = t.duration ?? 0
          return Math.max(max, start + dur)
        }, 0)
        return maxEndTime > 0 ? maxEndTime + 5 : 0  // Add 5ms gap if not first shape
      })(),
      duration: 2000, // Default 2s duration
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

    setState((prev) => {
      const newLayerEnd = newTrack.startTime! + newTrack.duration!
      const newDuration = Math.max(prev.duration, newLayerEnd + 500) // Extend if needed, with 500ms buffer
      
      return {
        ...prev,
        tracks: [...prev.tracks, newTrack],
        duration: newDuration,
        currentTime: clampTime(prev.currentTime, newDuration),
      }
    })
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

  // Click marker methods
  const addClickMarker = (layerId: string, time?: number) => {
    const markerId = `click-${layerId}-${Date.now()}`
    const markerTime = time ?? state.currentTime
    
    setState((prev) => {
      const updatedMarkers = [
        ...prev.clickMarkers,
        { id: markerId, layerId, time: markerTime }
      ].sort((a, b) => a.time - b.time)
      
      // Extend duration if marker is placed beyond current duration
      const maxMarkerTime = Math.max(...updatedMarkers.map(m => m.time), 0)
      const newDuration = Math.max(prev.duration, maxMarkerTime + 500) // Add 500ms padding
      
      return {
        ...prev,
        clickMarkers: updatedMarkers,
        duration: newDuration,
      }
    })
    
    return markerId
  }

  const removeClickMarker = (markerId: string) => {
    setState((prev) => ({
      ...prev,
      clickMarkers: prev.clickMarkers.filter((m) => m.id !== markerId)
    }))
  }

  // Effect clip methods (glow, blur, confetti, etc.)
  const addEffectClip = (
    layerId: string,
    effectType: TimelineState['effectClips'][number]['effectType'],
    start?: number,
    duration?: number,
    params?: TimelineState['effectClips'][number]['params']
  ) => {
    const clipId = `effect-${effectType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const clipStart = start ?? state.currentTime
    const clipDuration = duration ?? 1000 // Default 1 second
    
    setState((prev) => {
      const newClip: TimelineState['effectClips'][number] = {
        id: clipId,
        layerId,
        effectType,
        start: clipStart,
        duration: clipDuration,
        params: params ?? {}
      }
      
      return {
        ...prev,
        effectClips: [...prev.effectClips, newClip]
      }
    })
    
    return clipId
  }

  const removeEffectClip = (clipId: string) => {
    setState((prev) => ({
      ...prev,
      effectClips: prev.effectClips.filter((c) => c.id !== clipId)
    }))
  }

  const updateEffectClip = (
    clipId: string,
    updates: Partial<Pick<TimelineState['effectClips'][number], 'start' | 'duration' | 'params'>>
  ) => {
    setState((prev) => ({
      ...prev,
      effectClips: prev.effectClips.map((c) => 
        c.id === clipId 
          ? { ...c, ...updates, params: { ...c.params, ...updates.params } }
          : c
      )
    }))
  }

  const updateLayer = (
    layerId: string,
    updates: { startTime?: number; duration?: number }
  ) => {
    setState((prev) => {
      const track = prev.tracks.find((t) => t.layerId === layerId)
      if (!track) return prev

      const oldStart = track.startTime ?? 0
      const newStart = updates.startTime !== undefined ? updates.startTime : oldStart
      const delta = newStart - oldStart

      // Update the track itself
      const updatedTracks = prev.tracks.map((t) => {
        if (t.layerId !== layerId) return t
        return {
          ...t,
          startTime: newStart,
          duration: updates.duration !== undefined ? updates.duration : t.duration,
          // Shift keyframes if start time changed
          position: delta !== 0 && t.position ? t.position.map(k => ({ ...k, time: k.time + delta })) : t.position,
          scale: delta !== 0 && t.scale ? t.scale.map(k => ({ ...k, time: k.time + delta })) : t.scale,
          rotation: delta !== 0 && t.rotation ? t.rotation.map(k => ({ ...k, time: k.time + delta })) : t.rotation,
          opacity: delta !== 0 && t.opacity ? t.opacity.map(k => ({ ...k, time: k.time + delta })) : t.opacity,
          // Shift paths
          paths: delta !== 0 && t.paths ? t.paths.map(p => ({ ...p, startTime: p.startTime + delta })) : t.paths
        }
      })

      // Shift template clips
      const updatedClips = delta !== 0 
        ? prev.templateClips.map((c) => 
            c.layerId === layerId ? { ...c, start: c.start + delta } : c
          )
        : prev.templateClips

      // Shift click markers
      const updatedMarkers = delta !== 0
        ? prev.clickMarkers.map((m) =>
            m.layerId === layerId ? { ...m, time: m.time + delta } : m
          )
        : prev.clickMarkers

      // Update total duration
      let maxEnd = 0
      updatedTracks.forEach(t => {
        maxEnd = Math.max(maxEnd, (t.startTime ?? 0) + (t.duration ?? 0))
      })
      // Also check paths inside tracks (though they should be contained in duration)
      // And clips
      updatedClips.forEach(c => {
         maxEnd = Math.max(maxEnd, c.start + c.duration)
      })

      const newDuration = Math.max(prev.duration, maxEnd + 1000)

      return {
        ...prev,
        tracks: updatedTracks,
        templateClips: updatedClips,
        clickMarkers: updatedMarkers,
        duration: newDuration,
        currentTime: clampTime(prev.currentTime, newDuration)
      }
    })
  }

  const updateClickMarker = (markerId: string, time: number) => {
    setState((prev) => {
      const updatedMarkers = prev.clickMarkers
        .map((m) => m.id === markerId ? { ...m, time } : m)
        .sort((a, b) => a.time - b.time)
      
      // Extend duration if marker is placed beyond current duration
      const maxMarkerTime = Math.max(...updatedMarkers.map(m => m.time), 0)
      const newDuration = Math.max(prev.duration, maxMarkerTime + 500) // Add 500ms padding
      
      return {
        ...prev,
        clickMarkers: updatedMarkers,
        duration: newDuration,
      }
    })
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
      const newClips = prev.templateClips.map((clip) => {
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

      // Auto-Expand Logic for updateTemplateClip:
      // If the updated clip extends beyond the layer's current duration, expand the layer.
      let expandedTracks = prev.tracks
      const updatedClip = newClips.find(c => c.id === clipId)
      if (updatedClip) {
        const clipEnd = (updatedClip.start ?? 0) + (updatedClip.duration ?? 0)
        const layerTrack = prev.tracks.find(t => t.layerId === layerId)
        if (layerTrack) {
          const currentLayerEnd = (layerTrack.startTime ?? 0) + (layerTrack.duration ?? 2000)
          if (clipEnd > currentLayerEnd) {
            // Expand layer duration
            const newLayerDuration = clipEnd - (layerTrack.startTime ?? 0)
            expandedTracks = prev.tracks.map(t => 
              t.layerId === layerId ? { ...t, duration: newLayerDuration } : t
            )
          }
        }
      }

      // Calculate new parameters for the specific clip being updated
      const layerClips = newClips.filter((c) => c.layerId === layerId)
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

      // If jumpHeight is explicitly passed in updates.parameters, use that value
      // Only recalculate from duration if duration was changed (timeline bar drag) AND jumpHeight wasn't explicitly set
      const explicitJumpHeight = updates.parameters?.jumpHeight
      const nextJumpHeight =
        explicitJumpHeight !== undefined
          ? explicitJumpHeight  // Use explicitly passed jumpHeight (from canvas drag or slider)
          : jumpClip && typeof jumpClip.duration === 'number' && updates.duration !== undefined
            ? jumpHeightForDuration(jumpClip.duration, prev.jumpVelocity)  // Recalculate from duration change
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
        
        // Replace the clip in newClips
        const clipIndex = newClips.findIndex(c => c.id === clipId)
        if (clipIndex !== -1) {
          newClips[clipIndex] = updatedPathClip
        }
      }

      // Explicitly update parameters for Roll, Jump, and Pop clips if duration changed
      // This ensures rebuildTrackFromClips uses the correct values instead of stale global defaults
      if (rollClip && typeof rollClip.duration === 'number') {
        const clipIndex = newClips.findIndex(c => c.id === rollClip.id)
        if (clipIndex !== -1) {
          newClips[clipIndex] = {
            ...newClips[clipIndex],
            parameters: {
              ...newClips[clipIndex].parameters,
              rollDistance: nextRollDistance
            }
          }
        }
      }

      if (jumpClip && typeof jumpClip.duration === 'number') {
        const clipIndex = newClips.findIndex(c => c.id === jumpClip.id)
        if (clipIndex !== -1) {
          newClips[clipIndex] = {
            ...newClips[clipIndex],
            parameters: {
              ...newClips[clipIndex].parameters,
              jumpHeight: nextJumpHeight
            }
          }
        }
      }

      if (popClip && typeof popClip.duration === 'number') {
        const clipIndex = newClips.findIndex(c => c.id === popClip.id)
        if (clipIndex !== -1) {
          newClips[clipIndex] = {
            ...newClips[clipIndex],
            parameters: {
              ...newClips[clipIndex].parameters,
              popSpeed: nextPopSpeed
            }
          }
        }
      }

      const currentPopClip = newClips.find(c => c.id === clipId && c.template === 'pop')
      const parameters = updates.parameters
      const currentParams = currentPopClip?.parameters || {}

      const nextPopReappear = parameters?.popReappear ?? currentParams.popReappear

      if (popClip && typeof popClip.duration === 'number') {
        const clipIndex = newClips.findIndex(c => c.id === popClip.id)
        if (clipIndex !== -1) {
          newClips[clipIndex] = {
            ...newClips[clipIndex],
            parameters: {
              ...newClips[clipIndex].parameters,
              popReappear: nextPopReappear
            }
          }
        }
      }

      if (shakeClip && typeof shakeClip.duration === 'number') {
        const clipIndex = newClips.findIndex(c => c.id === shakeClip.id)
        if (clipIndex !== -1) {
          newClips[clipIndex] = {
            ...newClips[clipIndex],
            parameters: {
              ...newClips[clipIndex].parameters,
              shakeDistance: updates.parameters?.shakeDistance ?? prev.shakeDistance,
              templateSpeed: updates.parameters?.templateSpeed ?? prev.templateSpeed
            }
          }
        }
      }

      if (pulseClip && typeof pulseClip.duration === 'number') {
        const clipIndex = newClips.findIndex(c => c.id === pulseClip.id)
        if (clipIndex !== -1) {
          newClips[clipIndex] = {
            ...newClips[clipIndex],
            parameters: {
              ...newClips[clipIndex].parameters,
              pulseScale: updates.parameters?.pulseScale ?? prev.pulseScale,
              pulseSpeed: updates.parameters?.pulseSpeed ?? prev.pulseSpeed
            }
          }
        }
      }

      if (spinClip && typeof spinClip.duration === 'number') {
        const clipIndex = newClips.findIndex(c => c.id === spinClip.id)
        if (clipIndex !== -1) {
          newClips[clipIndex] = {
            ...newClips[clipIndex],
            parameters: {
              ...newClips[clipIndex].parameters,
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
        currentClips: typeof newClips, 
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

        // Reset track to empty/default state, but initialize clipKeyframes for unified sampling
        const newClipKeyframes: Record<string, { position?: any[]; scale?: any[]; rotation?: any[]; opacity?: any[]; maskScale?: any[]; color?: any[]; width?: any[]; height?: any[] }> = {}
        
        let newTrack: LayerTracks = {
          ...track,
          position: [],
          scale: [],
          rotation: [],
          opacity: [],
          maskScale: [],
          paths: [],
          clipKeyframes: newClipKeyframes  // Will be populated by the loop below
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
               'fade_in', 'slide_in', 'grow_in', 'shrink_in', 'spin_in', 'twist_in', 'move_scale_in', 'bounce_in', 'scramble',
               'fade_out', 'slide_out', 'grow_out', 'shrink_out', 'spin_out', 'twist_out', 'move_scale_out', 'bounce_out'
             ].includes(clip.template)
             
             if (isInOutAnimation) {
               // For In/Out animations, use authoritative layer base if provided, otherwise fallback
               const basePosition = layerBase?.position ?? layerPosition ?? DEFAULT_LAYER_STATE.position
               const baseScaleFromLayer = layerBase?.scale ?? baseScale
               // Rotation is always 0 in keyframes - layer.rotation applied separately
               const baseRotation = 0
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
             // Rotation is always 0 in keyframes - layer.rotation applied separately
             const baseRotationOverride = 0
             const baseOpacityOverride = layerBase?.opacity

             const sampledFromOriginal = sampleLayerTracks(track, sampleTime, {
               ...DEFAULT_LAYER_STATE,
               position: basePositionOverride ?? DEFAULT_LAYER_STATE.position,
               scale: baseScaleOverride ?? DEFAULT_LAYER_STATE.scale,
               rotation: baseRotationOverride,
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
             preset = PRESET_BUILDERS.roll(clip.parameters?.rollDistance ?? prev.rollDistance, clip.parameters?.templateSpeed ?? prev.templateSpeed, clip.parameters?.rollRotation ?? prev.rollRotation ?? 2)
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
            } else if (clip.template === 'mask_center') {
               preset = PRESET_BUILDERS.mask_center(clip.duration)
            } else if (clip.template === 'mask_top') {
               preset = PRESET_BUILDERS.mask_top(clip.duration)
            } else if (clip.template === 'mask_center_out') {
               preset = PRESET_BUILDERS.mask_center_out(clip.duration)
            } else if (clip.template === 'mask_top_out') {
               preset = PRESET_BUILDERS.mask_top_out(clip.duration)
            } else if ([
              'fade_in', 'slide_in', 'grow_in', 'shrink_in', 'spin_in', 'twist_in', 'move_scale_in', 'bounce_in',
              'fade_out', 'slide_out', 'grow_out', 'shrink_out', 'spin_out', 'twist_out', 'move_scale_out',
              'bounce_in'
            ].includes(clip.template)) {
              // @ts-ignore
              preset = PRESET_BUILDERS[clip.template](clip.duration)
            } else if (clip.template === 'color') {
              preset = PRESET_BUILDERS.color(
                clip.duration,
                clip.parameters?.colorFrom,
                clip.parameters?.colorTo,
                clip.parameters?.colorEasing
              )
            } else if (clip.template === 'resize') {
              preset = PRESET_BUILDERS.resize(
                clip.duration,
                clip.parameters?.resizeFromWidth,
                clip.parameters?.resizeFromHeight,
                clip.parameters?.resizeToWidth,
                clip.parameters?.resizeToHeight,
                clip.parameters?.resizeEasing
              )
            } else if (clip.template === 'rotate') {
              preset = PRESET_BUILDERS.rotate(
                clip.duration,
                clip.parameters?.rotateFromAngle,
                clip.parameters?.rotateToAngle,
                clip.parameters?.rotateEasing
              )
            } else if (clip.template === 'path' && clip.parameters?.pathPoints) {
              newTrack.paths = [
                ...(newTrack.paths ?? []),
                {
                  id: clip.id,
                  startTime: start,
                  duration: duration,
                  points: clip.parameters.pathPoints,
                  easing: (clip.parameters?.pathEasing as any) || 'linear'
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
           else if (clip.template === 'pan_zoom') {
             // Pan & Zoom: use target region for zoom in + hold + zoom out

             preset = PRESET_BUILDERS.pan_zoom(
               clip.duration ?? 2000,
               clip.parameters?.panZoomEndRegion,
               clip.parameters?.panZoomHoldDuration ?? 500,
               clip.parameters?.panZoomEasing,
               clip.parameters?.panZoomIntensity ?? 1.5
             )

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
           // For pan_zoom: use {0,0} since MotionCanvas adds base at render time
           if ((newTrack.position?.length ?? 0) === 0 && clipBaseState.position) {
             const initialPos = clip.template === 'pan_zoom' 
               ? { x: 0, y: 0 } 
               : clipBaseState.position
             newTrack.position = [{ time: 0, value: initialPos }]
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
            'fade_in', 'slide_in', 'grow_in', 'shrink_in', 'spin_in', 'twist_in', 'move_scale_in', 'bounce_in',
            'fade_out', 'slide_out', 'grow_out', 'shrink_out', 'spin_out', 'twist_out', 'move_scale_out'
          ].includes(clip.template)

          const isInAnimation = ['fade_in', 'slide_in', 'grow_in', 'shrink_in', 'spin_in', 'twist_in', 'move_scale_in', 'bounce_in'].includes(clip.template)
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
                } else if (clip.template === 'pan_zoom') {
                  // pan_zoom: keep offsets pure, MotionCanvas adds base at render time
                  resultX = v?.x ?? 0
                  resultY = v?.y ?? 0
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
            maskScale: mergeKeyframes(newTrack.maskScale ?? [], preset.maskScale, undefined, 'replace'),
          }
          
          // CRITICAL: Populate clipKeyframes for unified sampling (with local 0-based times)
          newClipKeyframes[clip.id] = {
            position: preset.position?.map((f: any) => ({ ...f })),  // Already 0-based in preset
            scale: preset.scale?.map((f: any) => ({ ...f })),
            rotation: preset.rotation?.map((f: any) => ({ ...f })),
            opacity: preset.opacity?.map((f: any) => ({ ...f })),
            maskScale: preset.maskScale?.map((f: any) => ({ ...f })),
            color: preset.color?.map((f: any) => ({ ...f })),
            width: preset.width?.map((f: any) => ({ ...f })),
            height: preset.height?.map((f: any) => ({ ...f })),
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



      const targetClip = newClips.find(c => c.id === clipId)
      const layerBaseForRebuild = targetClip?.parameters?.layerBase
      const rebuiltTracks = rebuildTrackFromClips(
        layerId,
        newClips,
        expandedTracks, // Use tracks with expanded layer duration
        1,
        layerBaseForRebuild?.position,
        layerBaseForRebuild
      )

      // Merge layer visibility properties (startTime, duration) from expandedTracks into rebuiltTracks
      const newTracks = rebuiltTracks.map(track => {
        const originalTrack = expandedTracks.find(t => t.layerId === track.layerId)
        if (originalTrack) {
          return {
            ...track,
            startTime: originalTrack.startTime,
            duration: originalTrack.duration,
          }
        }
        return track
      })

      const getTrackEnd = (track: LayerTracks) => {
        const times: number[] = []
        if (track.position?.length) times.push(track.position[track.position.length - 1].time)
        if (track.scale?.length) times.push(track.scale[track.scale.length - 1].time)
        if (track.rotation?.length) times.push(track.rotation[track.rotation.length - 1].time)
        if (track.opacity?.length) times.push(track.opacity[track.opacity.length - 1].time)
        return times.length ? Math.max(...times) : 0
      }

      const tracksEnd = newTracks.reduce((max, t) => Math.max(max, getTrackEnd(t)), 0)
      const clipsEnd = newClips.reduce((max, c) => Math.max(max, (c.start ?? 0) + (c.duration ?? 0)), 0)
      const pathsEnd = getMaxPathEnd(newTracks)
      // Include layer visibility bars in duration calculation
      const layersEnd = newTracks.reduce((max, t) => Math.max(max, (t.startTime ?? 0) + (t.duration ?? 0)), 0)
      const newDuration = Math.max(tracksEnd, clipsEnd, pathsEnd, layersEnd, 4000)
      
      // If path clip speed was updated, also update global templateSpeed
      const nextTemplateSpeed = updatedPathClip?.parameters?.templateSpeed ?? prev.templateSpeed

      return {
        ...prev,
        templateClips: newClips,
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
        rollRotation?: number;
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
        ? PRESET_BUILDERS.roll(options?.parameters?.rollDistance ?? state.rollDistance, state.templateSpeed, options?.parameters?.rollRotation ?? state.rollRotation ?? 2)
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
          : template === 'counter'
            // Counter doesn't use keyframes - it updates text content during render
            // Just return a minimal "preset" with duration info
            ? { duration: options?.targetDuration ?? 2000, segments: [] }
            : [
                'fade_in', 'slide_in', 'grow_in', 'shrink_in', 'spin_in', 'twist_in', 'move_scale_in', 'bounce_in',
                'fade_out', 'slide_out', 'grow_out', 'shrink_out', 'spin_out', 'twist_out', 'move_scale_out'
              ].includes(template)
              // @ts-ignore
              ? PRESET_BUILDERS[template](options?.targetDuration)
              : PRESET_BUILDERS.roll(options?.parameters?.rollDistance ?? state.rollDistance, state.templateSpeed, options?.parameters?.rollRotation ?? state.rollRotation ?? 2)
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
        // Rotation keyframes always start at 0 - layer.rotation is applied separately in MotionCanvas
        const baseRotation = 0
        const baseOpacity = base?.opacity ?? layerBaseOpacity ?? (popStartState?.opacity ?? baseSample.opacity)

        const clearedTrack: LayerTracks = {
          ...track,
          position: trimFrames(track.position),
          // IMPORTANT: Scale must always start at base value (1), not from old animation keyframes
          scale: [{ time: 0, value: layerBaseScale ?? 1 }],
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
            'fade_in', 'slide_in', 'grow_in', 'shrink_in', 'spin_in', 'twist_in', 'move_scale_in', 'bounce_in',
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
              // For scale-based animations (grow_in, shrink_in), base scale should be 1
              // The animation's scale values (0→1) are multipliers applied to this base
              value: layerBaseScale ?? 1,
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
            ...frame,  // Store raw offset values (no normalization)
            time: startOffset + scaleTime(frame.time),
            clipId: newClipId,
          })) ?? []

        const mappedScale =
          preset.scale?.map((f: TimelineKeyframe<number>) => ({
            ...f,
            time: startOffset + scaleTime(f.time),
            clipId: newClipId, // Tag with clip ID for deletion
          })) ?? []

        const mappedRotation =
          preset.rotation?.map((f: TimelineKeyframe<number>) => ({
            ...f,  // Store raw offset values (no normalization)
            time: startOffset + scaleTime(f.time),
            clipId: newClipId,
          })) ?? []

        const isInOutAnimation = [
          'fade_in', 'slide_in', 'grow_in', 'shrink_in', 'spin_in', 'twist_in', 'move_scale_in', 'bounce_in',
          'fade_out', 'slide_out', 'grow_out', 'shrink_out', 'spin_out', 'twist_out', 'move_scale_out'
        ].includes(template)

        const mappedOpacity =
          preset.opacity?.map((f: TimelineKeyframe<number>) => ({
            ...f,  // Store raw values (no normalization)
            time: startOffset + scaleTime(f.time),
            clipId: newClipId,
          })) ?? []

        const finalOpacity = mergeFrames(clearedTrack.opacity, mappedOpacity).sort((a, b) => a.time - b.time)
        
        const finalPosition = mergeFrames(clearedTrack.position, mappedPosition).sort((a, b) => a.time - b.time)

        // For mask templates, ignore template speed and map directly to the clip duration
        const isMaskTemplate = ['mask_center', 'mask_top', 'mask_center_out', 'mask_top_out'].includes(template)
        const maskScaleTime = isMaskTemplate
          ? (t: number) => {
              const clipDuration = options?.targetDuration || preset.duration || 1000
              const presetDuration = preset.duration || clipDuration || 1
              return (t * clipDuration) / presetDuration
            }
          : scaleTime
        const mappedMaskScale =
          preset.maskScale?.map((f: TimelineKeyframe<number>) => ({
            ...f,
            time: startOffset + maskScaleTime(f.time),
            clipId: newClipId,
          })) ?? []

        // Create per-clip keyframes with LOCAL times (0-based, relative to clip start)
        const clipPositionKeyframes = preset.position?.map((f: TimelineKeyframe<Vec2>) => ({
          ...f,
          time: scaleTime(f.time),  // Local time, not absolute
          clipId: newClipId,
        })) ?? []

        const clipScaleKeyframes = preset.scale?.map((f: TimelineKeyframe<number>) => ({
          ...f,
          time: scaleTime(f.time),
          clipId: newClipId,
        })) ?? []

        const clipRotationKeyframes = preset.rotation?.map((f: TimelineKeyframe<number>) => ({
          ...f,
          time: scaleTime(f.time),
          clipId: newClipId,
        })) ?? []

        const clipOpacityKeyframes = preset.opacity?.map((f: TimelineKeyframe<number>) => ({
          ...f,
          time: scaleTime(f.time),
          clipId: newClipId,
        })) ?? []

        const clipMaskScaleKeyframes = preset.maskScale?.map((f: TimelineKeyframe<number>) => ({
          ...f,
          time: maskScaleTime(f.time),
          clipId: newClipId,
        })) ?? []

        // Merge new clip keyframes into existing clipKeyframes
        const existingClipKeyframes = track.clipKeyframes ?? {}
        const newClipKeyframes = {
          ...existingClipKeyframes,
          [newClipId]: {
            position: clipPositionKeyframes.length > 0 ? clipPositionKeyframes : undefined,
            scale: clipScaleKeyframes.length > 0 ? clipScaleKeyframes : undefined,
            rotation: clipRotationKeyframes.length > 0 ? clipRotationKeyframes : undefined,
            opacity: clipOpacityKeyframes.length > 0 ? clipOpacityKeyframes : undefined,
            maskScale: clipMaskScaleKeyframes.length > 0 ? clipMaskScaleKeyframes : undefined,
          },
        }

        return {
          ...track,
          clipKeyframes: newClipKeyframes,  // Per-clip keyframes for unified sampling
          // IMPORTANT: Legacy arrays now store BASE VALUES ONLY for sampling to read
          // All animation data is in clipKeyframes
          position: clearedTrack.position,  // Keep base position only
          scale: clearedTrack.scale,        // Keep base scale only
          rotation: clearedTrack.rotation,  // Keep base rotation only
          opacity: clearedTrack.opacity,    // Keep base opacity only
          maskScale: mergeFrames(clearedTrack.maskScale, mappedMaskScale).sort((a, b) => a.time - b.time),
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

            // Auto-Expand Logic:
      // If the new clip extends beyond the layer's current duration, expand the layer.
      let updatedTracks = prev.tracks
      const clipEnd = start + duration
      const layerTrack = prev.tracks.find(t => t.layerId === layerId)
      
      if (layerTrack) {
        const currentLayerEnd = (layerTrack.startTime ?? 0) + (layerTrack.duration ?? 2000)
        if (clipEnd > currentLayerEnd) {
          // Expand layer duration
          const newLayerDuration = clipEnd - (layerTrack.startTime ?? 0)
          updatedTracks = prev.tracks.map(t => 
             t.layerId === layerId ? { ...t, duration: newLayerDuration } : t // Exact fit
          )
        }
      }
      
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

        // Reset track and initialize clipKeyframes for unified sampling
        const newClipKeyframes: Record<string, { position?: any[]; scale?: any[]; rotation?: any[]; opacity?: any[]; maskScale?: any[]; color?: any[]; width?: any[]; height?: any[] }> = {}
        
        let newTrack: LayerTracks = {
          ...track,
          position: [],
          scale: [],
          rotation: [],
          opacity: [],
          maskScale: [],
          paths: [],
          clipKeyframes: newClipKeyframes
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
             preset = PRESET_BUILDERS.roll(clip.parameters?.rollDistance ?? prev.rollDistance, clip.parameters?.templateSpeed ?? prev.templateSpeed, clip.parameters?.rollRotation ?? prev.rollRotation ?? 2)
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
             'fade_in', 'slide_in', 'grow_in', 'shrink_in', 'spin_in', 'twist_in', 'move_scale_in', 'bounce_in', 'scramble',
             'fade_out', 'slide_out', 'grow_out', 'shrink_out', 'spin_out', 'twist_out', 'move_scale_out', 'bounce_out'
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
            else if (clip.template === 'pan_zoom') {
              // Pan & Zoom: use target region for zoom in + hold + zoom out
              preset = PRESET_BUILDERS.pan_zoom(
                clip.duration ?? 2000,
                clip.parameters?.panZoomEndRegion,
                clip.parameters?.panZoomHoldDuration ?? 500,
                clip.parameters?.panZoomEasing,
                clip.parameters?.panZoomIntensity ?? 1.5
              )
            } else if (clip.template === 'color') {
              preset = PRESET_BUILDERS.color(
                clip.duration,
                clip.parameters?.colorFrom,
                clip.parameters?.colorTo,
                clip.parameters?.colorEasing
              )
            } else if (clip.template === 'resize') {
              preset = PRESET_BUILDERS.resize(
                clip.duration,
                clip.parameters?.resizeFromWidth,
                clip.parameters?.resizeFromHeight,
                clip.parameters?.resizeToWidth,
                clip.parameters?.resizeToHeight,
                clip.parameters?.resizeEasing
              )
            } else if (clip.template === 'rotate') {
              preset = PRESET_BUILDERS.rotate(
                clip.duration,
                clip.parameters?.rotateFromAngle,
                clip.parameters?.rotateToAngle,
                clip.parameters?.rotateEasing
              )
            } else if (clip.template === 'mask_center') {
              preset = PRESET_BUILDERS.mask_center(clip.duration)
            } else if (clip.template === 'mask_top') {
              preset = PRESET_BUILDERS.mask_top(clip.duration)
            } else if (clip.template === 'mask_center_out') {
              preset = PRESET_BUILDERS.mask_center_out(clip.duration)
            } else if (clip.template === 'mask_top_out') {
              preset = PRESET_BUILDERS.mask_top_out(clip.duration)
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
            // For pan_zoom: use {0,0} since MotionCanvas adds base at render time
            if ((newTrack.position?.length ?? 0) === 0 && clipBaseState.position) {
              const initialPos = clip.template === 'pan_zoom' 
                ? { x: 0, y: 0 } 
                : clipBaseState.position
              newTrack.position = [{ time: 0, value: initialPos }]
            }
            if ((newTrack.scale?.length ?? 0) === 0 && clipBaseState.scale !== undefined) {
              newTrack.scale = [{ time: 0, value: clipBaseState.scale }]
            }
            if ((newTrack.rotation?.length ?? 0) === 0 && clipBaseState.rotation !== undefined) {
              newTrack.rotation = [{ time: 0, value: clipBaseState.rotation }]
            }

            const isInOutAnimation = [ 'fade_in', 'slide_in', 'grow_in', 'shrink_in', 'spin_in', 'twist_in', 'move_scale_in', 'bounce_in', 'fade_out', 'slide_out', 'grow_out', 'shrink_out', 'spin_out', 'twist_out', 'move_scale_out' ].includes(clip.template)

            const isInAnimation = ['fade_in', 'slide_in', 'grow_in', 'shrink_in', 'spin_in', 'twist_in', 'move_scale_in', 'bounce_in'].includes(clip.template)
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
                  } else if (clip.template === 'pan_zoom') {
                    // pan_zoom: keep offsets pure, MotionCanvas adds base at render time
                    resultX = v?.x ?? 0
                    resultY = v?.y ?? 0
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
              // IMPORTANT: Don't merge animation scale into legacy array - keep base scale only
              // Animation scale goes in clipKeyframes (stored in inner addTemplateClip)
              scale: newTrack.scale?.length ? newTrack.scale : [{ time: 0, value: 1 }],
              rotation: mergeKeyframes(newTrack.rotation ?? [], mergedRotation, isInOutAnimation ? undefined : clipBaseState.rotation, isInOutAnimation ? 'replace' : 'add'),
              opacity: mergeKeyframes(newTrack.opacity ?? [], preset.opacity, isInOutAnimation ? undefined : clipBaseState.opacity, isInOutAnimation ? 'replace' : 'multiply'),
              maskScale: mergeKeyframes(newTrack.maskScale ?? [], preset.maskScale, undefined, 'replace'),
            }
            
            // CRITICAL: Populate clipKeyframes for unified sampling (with local 0-based times)
            newClipKeyframes[clip.id] = {
              position: preset.position?.map((f: any) => ({ ...f })),
              scale: preset.scale?.map((f: any) => ({ ...f })),
              rotation: preset.rotation?.map((f: any) => ({ ...f })),
              opacity: preset.opacity?.map((f: any) => ({ ...f })),
              maskScale: preset.maskScale?.map((f: any) => ({ ...f })),
              color: preset.color?.map((f: any) => ({ ...f })),
              width: preset.width?.map((f: any) => ({ ...f })),
              height: preset.height?.map((f: any) => ({ ...f })),
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

      const rebuiltTracks = rebuildTrackFromClips(
        layerId,
        nextClips,
        updatedTracks, // Use tracks with expanded layer duration
        layerScale ?? 1,
        parameters?.layerBase?.position,
        parameters?.layerBase
      )
      
      
      // Merge layer visibility properties (startTime, duration) from updatedTracks into rebuiltTracks
      const newTracks = rebuiltTracks.map(track => {
        const originalTrack = updatedTracks.find(t => t.layerId === track.layerId)
        if (originalTrack) {
          return {
            ...track,
            startTime: originalTrack.startTime,
            duration: originalTrack.duration,
          }
        }
        return track
      })
      
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
      // Include layer visibility bars in duration calculation
      const layersEnd = newTracks.reduce((max, t) => Math.max(max, (t.startTime ?? 0) + (t.duration ?? 0)), 0)
      const newDuration = Math.max(tracksEnd, clipsEnd, pathsEnd, layersEnd, 4000)

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
            // Use > (not >=) for clipEnd to exclude keyframes exactly at the clip's end
            return f.time <= clipStart || f.time > clipEnd
          })
        }
        
        // Remove from clipKeyframes
        const { [clipId]: removed, ...remainingClipKeyframes } = track.clipKeyframes ?? {}
        
        return {
          ...track,
          clipKeyframes: remainingClipKeyframes,
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
      
      // Use actual content duration, or 4000ms minimum if no content
      const contentDuration = Math.max(clipsEnd, tracksEnd)
      const newDuration = contentDuration > 0 ? contentDuration : 4000

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
    const clampedTime = clampTime(time, state.duration)
    // Sync internal time for PixiJS
    internalCurrentTime = clampedTime
    setState((prev) => ({
      ...prev,
      currentTime: clampedTime,
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

  const setRollRotation = (rotations: number) => {
    const clamped = Math.max(0, Math.min(10, rotations))
    setState((prev) => ({
      ...prev,
      rollRotation: clamped,
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
    // Read current state without triggering React
    const prev = state
    if (!prev.isPlaying) {
      stopTicker()
      return
    }
    
    const lastTick = prev.lastTick ?? timestamp
    const deltaMs = (timestamp - lastTick) * prev.playbackRate
    let nextTime = internalCurrentTime + deltaMs
    let shouldStop = false

    // Use CACHED content duration (calculated only when tracks/clips change)
    const contentDuration = cachedContentDuration

    if (nextTime >= contentDuration) {
      if (prev.loop && contentDuration > 0) {
        nextTime = nextTime % contentDuration
      } else {
        nextTime = contentDuration
        shouldStop = true
      }
    }

    // Always update internal time (60fps for PixiJS)
    internalCurrentTime = nextTime

    // Throttle React state updates to ~30fps for UI (timeline panel, playhead)
    const timeSinceLastUiUpdate = timestamp - lastUiUpdateTime
    if (timeSinceLastUiUpdate >= UI_UPDATE_INTERVAL || shouldStop) {
      lastUiUpdateTime = timestamp
      setState((current) => ({
        ...current,
        currentTime: nextTime,
        isPlaying: !shouldStop,
        lastTick: timestamp,
      }))
    } else {
      // Just update lastTick without triggering full React update
      state = { ...state, lastTick: timestamp }
    }

    if (!shouldStop && typeof requestAnimationFrame !== 'undefined') {
      rafId = requestAnimationFrame(tick)
    } else {
      stopTicker()
    }
  }

  const setPlaying = (playing: boolean) => {
    setState((prev) => {
      let newTime = prev.currentTime
      
      // If starting to play and playhead is at the end, reset to 0
      if (playing) {
        // Calculate content end (same logic as tick function)
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
        const layersEnd = prev.tracks.reduce((max, t) => Math.max(max, (t.startTime ?? 0) + (t.duration ?? 0)), 0)
        const hasLayers = prev.tracks.length > 0
        const hasClips = prev.templateClips.length > 0 || tracksEnd > 0 || pathsEnd > 0 || hasLayers
        const contentDuration = hasClips 
          ? Math.max(100, tracksEnd, clipsEnd, pathsEnd, layersEnd)
          : 5000
        
        // If at or near the end, reset to 0
        if (prev.currentTime >= contentDuration - 50) {
          newTime = 0
        }
      }
      
      return {
        ...prev,
        currentTime: newTime,
        isPlaying: playing,
        lastTick: playing ? undefined : prev.lastTick,
      }
    })
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

  // Build tracks from clips, optionally using provided layer base map
  const buildTracksFromClips = (
    clipsToRebuild: typeof state.templateClips,
    layerBaseMap?: Record<
      string,
      {
        position?: Vec2
        scale?: number
        rotation?: number
        opacity?: number
      }
    >
  ) => {


    const clipsByLayer: Record<string, typeof clipsToRebuild> = {}
    clipsToRebuild.forEach((clip) => {
      if (!clipsByLayer[clip.layerId]) clipsByLayer[clip.layerId] = []
      clipsByLayer[clip.layerId].push(clip)
    })

    const nextTracks: LayerTracks[] = []
    let clipsEnd = 0

    Object.entries(clipsByLayer).forEach(([layerId, clips]) => {
      const sorted = [...clips].sort((a, b) => (a.start ?? 0) - (b.start ?? 0))
      const baseFromClip = sorted.find((c) => c.parameters?.layerBase)?.parameters?.layerBase
      const layerBase = layerBaseMap?.[layerId]
      const basePos = layerBase?.position ?? baseFromClip?.position ?? DEFAULT_LAYER_STATE.position
      const baseScale = layerBase?.scale ?? baseFromClip?.scale ?? DEFAULT_LAYER_STATE.scale
      // Rotation keyframes should always start at 0 - layer.rotation is applied separately in MotionCanvas
      const baseRot = 0
      const baseOpacity = layerBase?.opacity ?? baseFromClip?.opacity ?? DEFAULT_LAYER_STATE.opacity

      let track: LayerTracks = {
        layerId,
        position: [{ time: 0, value: basePos }],
        scale: [{ time: 0, value: baseScale }],
        rotation: [{ time: 0, value: baseRot }],
        opacity: [{ time: 0, value: baseOpacity }],
        maskScale: [],
        paths: [],
      }

      const addFrames = <T,>(arr: TimelineKeyframe<T>[] | undefined, frames: TimelineKeyframe<T>[]) => [
        ...(arr ?? []),
        ...(frames ?? []),
      ]

      sorted.forEach((clip, index) => {

        // Handle path templates - add them to track.paths
        if (clip.template === 'path' && clip.parameters?.pathPoints) {
          const start = Number.isFinite(clip.start) ? (clip.start as number) : 0
          const duration = Number.isFinite(clip.duration) ? (clip.duration as number) : 0
          
          track.paths = [
            ...(track.paths ?? []),
            {
              id: clip.id,
              startTime: start,
              duration: duration,
              points: clip.parameters.pathPoints,
              easing: (clip.parameters?.pathEasing as any) || 'linear'
            }
          ]
          return // Skip rest of processing for path clips
        }
        
        const start = Number.isFinite(clip.start) ? (clip.start as number) : 0
        const duration = Number.isFinite(clip.duration) ? (clip.duration as number) : 0
        
        // For the first clip, use layerBase from layerBaseMap or clip parameters
        // For subsequent clips, sample the track at the clip's start time
        let clipBase: { position?: Vec2; scale?: number; rotation?: number; opacity?: number }
        
        if (index === 0) {
          // First clip: use provided layerBase or clip's stored layerBase
          clipBase = layerBase ?? clip.parameters?.layerBase ?? {
            position: basePos,
            scale: baseScale,
            rotation: baseRot,
            opacity: baseOpacity,
          }
        } else {
          // Subsequent clips: sample the track at this clip's start time
          const sample = sampleLayerTracks(track, start, {
            position: basePos,
            scale: baseScale,
            rotation: baseRot,
            opacity: baseOpacity,
          })
          clipBase = {
            position: sample.position,
            scale: sample.scale,
            rotation: sample.rotation,
            opacity: sample.opacity,
          }
        }

        clipsEnd = Math.max(clipsEnd, start + duration)

        // Call preset with correct parameters based on template type
        let built: any
        const params = clip.parameters
        
        switch (clip.template) {
          case 'roll':
            built = PRESET_BUILDERS.roll(params?.rollDistance, params?.templateSpeed, params?.rollRotation ?? 2)
            break
          case 'jump':
            built = PRESET_BUILDERS.jump(params?.jumpHeight, params?.jumpVelocity)
            break
          case 'pop':
            built = PRESET_BUILDERS.pop(params?.popScale, params?.popWobble, params?.popSpeed, params?.popCollapse)
            break
          case 'shake':
            built = PRESET_BUILDERS.shake(params?.shakeDistance, params?.templateSpeed, duration)
            break
          case 'pulse':
            built = PRESET_BUILDERS.pulse(params?.pulseScale, params?.pulseSpeed, duration)
            break
          case 'spin':
            built = PRESET_BUILDERS.spin(params?.spinSpeed, params?.spinDirection, duration)
            break
          case 'fade_in':
            built = PRESET_BUILDERS.fade_in(duration)
            break
          case 'slide_in':
            built = PRESET_BUILDERS.slide_in(duration)
            break
          case 'grow_in':
            built = PRESET_BUILDERS.grow_in(duration)
            break
          case 'shrink_in':
            built = PRESET_BUILDERS.shrink_in(duration)
            break
          case 'spin_in':
            built = PRESET_BUILDERS.spin_in(duration)
            break
          case 'twist_in':
            built = PRESET_BUILDERS.twist_in(duration)
            break
          case 'move_scale_in':
            built = PRESET_BUILDERS.move_scale_in(duration)
            break
          case 'fade_out':
            built = PRESET_BUILDERS.fade_out(duration)
            break
          case 'slide_out':
            built = PRESET_BUILDERS.slide_out(duration)
            break
          case 'grow_out':
            built = PRESET_BUILDERS.grow_out(duration)
            break
          case 'shrink_out':
            built = PRESET_BUILDERS.shrink_out(duration)
            break
          case 'spin_out':
            built = PRESET_BUILDERS.spin_out(duration)
            break
          case 'twist_out':
            built = PRESET_BUILDERS.twist_out(duration)
            break
          case 'move_scale_out':
            built = PRESET_BUILDERS.move_scale_out(duration)
            break
          case 'pan_zoom':

            built = PRESET_BUILDERS.pan_zoom(
              duration, 
              params?.panZoomEndRegion, // target region (where to zoom)
              params?.panZoomHoldDuration ?? 500, // hold duration in ms
              params?.panZoomEasing,
              params?.panZoomIntensity ?? 1.5
            )

            break
          case 'mask_center':
            built = PRESET_BUILDERS.mask_center(duration)
            break
          case 'mask_top':
            built = PRESET_BUILDERS.mask_top(duration)
            break
          case 'mask_center_out':
            built = PRESET_BUILDERS.mask_center_out(duration)
            break
          case 'mask_top_out':
            built = PRESET_BUILDERS.mask_top_out(duration)
            break
          default:
            console.warn(`Unknown template: ${clip.template}`)
            return
        }

        // Shift keyframes by clip start time
        const shift = <T,>(frames: TimelineKeyframe<T>[] | undefined) =>
          (frames ?? []).map((f) => ({
            ...f,
            time: start + (Number.isFinite(f.time) ? (f.time as number) : 0),
          }))

        // Convert position offsets to absolute by adding clipBase position
        // This matches the logic in addTemplateClip's mergedPosition
        const shiftPositionWithBase = (frames: TimelineKeyframe<Vec2>[] | undefined) => {
          const clipBasePos = clipBase.position ?? basePos
          return (frames ?? []).map((f) => ({
            ...f,
            time: start + (Number.isFinite(f.time) ? (f.time as number) : 0),
            // Add clip base position to offset to get absolute position
            value: {
              x: clipBasePos.x + (f.value?.x ?? 0),
              y: clipBasePos.y + (f.value?.y ?? 0),
            },
          }))
        }

        track = {
          ...track,
          // Use shiftPositionWithBase for position (converts offset to absolute)
          position: addFrames(track.position, shiftPositionWithBase(built.position)),
          scale: addFrames(track.scale, shift(built.scale)),
          rotation: addFrames(track.rotation, shift(built.rotation)),
          opacity: addFrames(track.opacity, shift(built.opacity)),
          maskScale: addFrames(track.maskScale, shift(built.maskScale)),
          // Paths are not part of PresetResult, they're handled separately
        }
      })

      const sortFrames = <T,>(arr: TimelineKeyframe<T>[]) => [...arr].sort((a, b) => a.time - b.time)
      const ensureZero = <T,>(arr: TimelineKeyframe<T>[], value: T) =>
        arr.some((f) => f.time === 0) ? arr : [{ time: 0, value }, ...arr]

      // Calculate track's visibility range from all clips for this layer
      // startTime = earliest clip start, endTime = latest clip end
      const clipStartTimes = sorted.map(c => c.start ?? 0)
      const clipEndTimes = sorted.map(c => (c.start ?? 0) + (c.duration ?? 0))
      const trackStartTime = Math.min(...clipStartTimes)
      const trackEndTime = Math.max(...clipEndTimes)
      const trackDuration = trackEndTime - trackStartTime

      track = {
        ...track,
        startTime: trackStartTime,
        duration: trackDuration,
        position: sortFrames(ensureZero(track.position ?? [], basePos)),
        scale: sortFrames(ensureZero(track.scale ?? [], baseScale)),
        rotation: sortFrames(ensureZero(track.rotation ?? [], baseRot)),
        opacity: sortFrames(ensureZero(track.opacity ?? [], baseOpacity)),
        maskScale: sortFrames(track.maskScale ?? []), // Don't force zero keyframe for mask if empty
      }

      nextTracks.push(track)
    })

    const pathsEnd = getMaxPathEnd(nextTracks)
    const nextDuration = Math.max(clipsEnd, pathsEnd, 4000)

    return { tracks: nextTracks, duration: nextDuration }
  }

  // Undo/Redo: Rebuild all tracks from current templateClips
  const rebuildAllTracks = (clipsOverride?: typeof state.templateClips, layerBaseMap?: Record<string, { position?: Vec2; scale?: number; rotation?: number; opacity?: number }>) => {
    const { tracks, duration } = buildTracksFromClips(clipsOverride ?? state.templateClips, layerBaseMap)
    setState((prev) => ({
      ...prev,
      tracks,
      duration,
      currentTime: clampTime(prev.currentTime, duration),
    }))
  }

  return {
    subscribe,
    getState: () => state,
    // Get the real-time playhead position (60fps during playback, for PixiJS)
    getPlayheadTime: () => state.isPlaying ? internalCurrentTime : state.currentTime,
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
    setRollRotation,
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
    // Click markers
    addClickMarker,
    removeClickMarker,
    updateClickMarker,
    // Effect clips
    addEffectClip,
    removeEffectClip,
    updateEffectClip,
    effectClips: state.effectClips,
    replaceTracks,
    applyPresetToLayer,
    clear,
    sampleAt,
    updateLayer,
    
    // Undo/Redo: Get snapshotable state
    // IMPORTANT: Deep copy arrays to prevent reference mutation affecting older snapshots
    getSnapshot: () => ({
      templateClips: state.templateClips.map(clip => ({
        ...clip,
        parameters: clip.parameters ? { ...clip.parameters } : undefined
      })),
      effectClips: state.effectClips.map(effect => ({
        ...effect,
        params: { ...effect.params }
      })),
      // Capture track visibility timing (layer bars)
      trackTimings: state.tracks.map(track => ({
        layerId: track.layerId,
        startTime: track.startTime ?? 0,
        duration: track.duration ?? 3000,
      })),
      templateSpeed: state.templateSpeed,
      rollDistance: state.rollDistance,
      jumpHeight: state.jumpHeight,
      jumpVelocity: state.jumpVelocity,
      popScale: state.popScale,
      popWobble: state.popWobble,
      popSpeed: state.popSpeed,
      popCollapse: state.popCollapse,
      popReappear: state.popReappear,
      shakeDistance: state.shakeDistance,
      pulseScale: state.pulseScale,
      pulseSpeed: state.pulseSpeed,
      spinSpeed: state.spinSpeed,
      spinDirection: state.spinDirection,
      clickMarkers: state.clickMarkers.map(marker => ({ ...marker })),
    }),
    
    // Undo/Redo: Restore from snapshot
    restoreSnapshot: (snapshot: Partial<{
      templateClips: typeof state.templateClips
      effectClips: typeof state.effectClips
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
      layers: { id: string; x: number; y: number; scale: number; rotation?: number; opacity?: number }[]
      clickMarkers: typeof state.clickMarkers
      trackTimings: Array<{ layerId: string; startTime: number; duration: number }>
    }>) => {
      const layerBaseMap: Record<string, { position?: Vec2; scale?: number; rotation?: number; opacity?: number }> = {}
      snapshot.layers?.forEach((layer) => {
        layerBaseMap[layer.id] = {
          position: { x: layer.x, y: layer.y },
          scale: layer.scale,
          rotation: layer.rotation ?? 0,
          opacity: layer.opacity ?? 1,
        }
      })

      const clips = snapshot.templateClips ?? state.templateClips
      const { tracks: rebuiltTracks, duration } = buildTracksFromClips(clips, layerBaseMap)
      
      // Apply saved track visibility timing from snapshot (overrides recalculated timing)
      const tracksWithTiming = rebuiltTracks.map(track => {
        const savedTiming = snapshot.trackTimings?.find(t => t.layerId === track.layerId)
        if (savedTiming) {
          return {
            ...track,
            startTime: savedTiming.startTime,
            duration: savedTiming.duration,
          }
        }
        return track
      })

      setState((prev) => ({
        ...prev,
        templateClips: clips,
        effectClips: snapshot.effectClips ?? prev.effectClips,
        templateSpeed: snapshot.templateSpeed ?? prev.templateSpeed,
        rollDistance: snapshot.rollDistance ?? prev.rollDistance,
        jumpHeight: snapshot.jumpHeight ?? prev.jumpHeight,
        jumpVelocity: snapshot.jumpVelocity ?? prev.jumpVelocity,
        popScale: snapshot.popScale ?? prev.popScale,
        popWobble: snapshot.popWobble ?? prev.popWobble,
        popSpeed: snapshot.popSpeed ?? prev.popSpeed,
        popCollapse: snapshot.popCollapse ?? prev.popCollapse,
        popReappear: snapshot.popReappear ?? prev.popReappear,
        shakeDistance: snapshot.shakeDistance ?? prev.shakeDistance,
        pulseScale: snapshot.pulseScale ?? prev.pulseScale,
        pulseSpeed: snapshot.pulseSpeed ?? prev.pulseSpeed,
        spinSpeed: snapshot.spinSpeed ?? prev.spinSpeed,
        spinDirection: snapshot.spinDirection ?? prev.spinDirection,
        clickMarkers: snapshot.clickMarkers ?? prev.clickMarkers,
        tracks: tracksWithTiming,
        duration,
        currentTime: clampTime(prev.currentTime, duration),
      }))
    },
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

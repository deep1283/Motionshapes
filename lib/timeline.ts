// Timeline domain model and pure helpers for keyframe-based interpolation.

export type Easing =
  | 'linear'
  | 'easeInQuad'
  | 'easeOutQuad'
  | 'easeInOutQuad'
  | 'easeOutBack'

export interface Vec2 {
  x: number
  y: number
}

export interface TimelineKeyframe<T> {
  time: number // milliseconds
  value: T
  easing?: Easing
  clipId?: string // Track which clip this keyframe belongs to
}

export interface PathClip {
  id: string
  startTime: number // ms
  duration: number // ms
  points: Vec2[] // normalized 0-1 space
  easing?: Easing
}

// NEW: Per-clip keyframe storage for additive blending
// Keyframes here are OFFSETS (not absolute values)
// Position: offset from {0,0}
// Scale: multiplier from 1
// Rotation: offset from 0
export interface ClipKeyframes {
  position?: TimelineKeyframe<Vec2>[]
  scale?: TimelineKeyframe<number>[]
  rotation?: TimelineKeyframe<number>[]
  opacity?: TimelineKeyframe<number>[]
  maskScale?: TimelineKeyframe<number>[]
}

export interface LayerTracks {
  layerId: string
  startTime?: number // ms - The "birth" time of the layer
  duration?: number // ms - The lifespan of the layer
  
  // NEW: Per-clip keyframe storage (clipId -> keyframes)
  clipKeyframes?: Record<string, ClipKeyframes>
  
  // LEGACY: Merged keyframe arrays (keep for backward compatibility)
  position?: TimelineKeyframe<Vec2>[]
  scale?: TimelineKeyframe<number>[]
  rotation?: TimelineKeyframe<number>[]
  opacity?: TimelineKeyframe<number>[]
  maskScale?: TimelineKeyframe<number>[] // Controls the scale of the circle mask
  paths?: PathClip[]
}

export interface SampledLayerState {
  position: Vec2
  scale: number
  rotation: number
  opacity: number
  maskScale?: number // If defined, apply a circle mask scaled by this value
  activePathId?: string
}

export const DEFAULT_LAYER_STATE: SampledLayerState = {
  position: { x: 0.5, y: 0.5 },
  scale: 1,
  rotation: 0,
  opacity: 1,
  maskScale: undefined,
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

const applyEasing = (t: number, easing: Easing = 'linear') => {
  switch (easing) {
    case 'easeInQuad':
      return t * t
    case 'easeOutQuad':
      return 1 - (1 - t) * (1 - t)
    case 'easeInOutQuad':
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    case 'easeOutBack': {
      const c1 = 1.70158
      const c3 = c1 + 1
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
    }
    default:
      return t
  }
}

const interpolateNumber = (a: number, b: number, t: number) => a + (b - a) * t

const interpolateVec2 = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: interpolateNumber(a.x, b.x, t),
  y: interpolateNumber(a.y, b.y, t),
})

const findSegment = <T extends TimelineKeyframe<unknown>>(frames: T[], time: number) => {
  let prev = frames[0]
  let next = frames[frames.length - 1]
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].time <= time) {
      prev = frames[i]
    }
    if (frames[i].time >= time) {
      next = frames[i]
      break
    }
  }
  return { prev, next }
}

export const sortKeyframes = <T>(frames: TimelineKeyframe<T>[]) =>
  [...frames].sort((a, b) => a.time - b.time)

export const upsertKeyframe = <T>(
  frames: TimelineKeyframe<T>[],
  frame: TimelineKeyframe<T>
): TimelineKeyframe<T>[] => {
  const next = frames.filter((f) => f.time !== frame.time)
  next.push(frame)
  return sortKeyframes(next)
}

export const sampleNumberTrack = (
  frames: TimelineKeyframe<number>[] | undefined,
  time: number,
  fallback: number
): number => {
  if (!frames || frames.length === 0) return fallback
  if (frames.length === 1) return frames[0].value
  const { prev, next } = findSegment(frames, time)
  if (prev.time === next.time) return prev.value
  const t = clamp01((time - prev.time) / (next.time - prev.time))
  const eased = applyEasing(t, next.easing ?? 'linear')
  return interpolateNumber(prev.value, next.value, eased)
}

export const sampleVec2Track = (
  frames: TimelineKeyframe<Vec2>[] | undefined,
  time: number,
  fallback: Vec2
): Vec2 => {
  if (!frames || frames.length === 0) return fallback
  if (frames.length === 1) return frames[0].value
  const { prev, next } = findSegment(frames, time)
  if (prev.time === next.time) return prev.value
  const t = clamp01((time - prev.time) / (next.time - prev.time))
  const eased = applyEasing(t, next.easing ?? 'linear')
  return interpolateVec2(prev.value, next.value, eased)
}

const samplePathPoint = (rawPoints: Vec2[], t: number): Vec2 => {
  const points = rawPoints.filter((p) => p && typeof p.x === 'number' && typeof p.y === 'number')
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return points[0]
  const distances: number[] = [0]
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    total += d
    distances.push(total)
  }
  const target = clamp01(t) * total
  for (let i = 1; i < points.length; i++) {
    if (distances[i] >= target) {
      const segLen = distances[i] - distances[i - 1]
      const localT = segLen === 0 ? 0 : (target - distances[i - 1]) / segLen
      return interpolateVec2(points[i - 1], points[i], localT)
    }
  }
  return points[points.length - 1]
}

export const samplePathClip = (clip: PathClip, time: number): Vec2 | null => {
  if (clip.points.length === 0) return null
  if (time < clip.startTime || time > clip.startTime + clip.duration) return null
  const t = clamp01((time - clip.startTime) / clip.duration)
  const eased = applyEasing(t, clip.easing ?? 'linear')
  return samplePathPoint(clip.points, eased)
}

// Minimal clip info needed for additive sampling
export interface ClipInfo {
  id: string
  start: number
  duration: number
}

// NEW: Additive sampling using per-clip keyframes
export const sampleLayerTracksAdditive = (
  layer: LayerTracks,
  clips: ClipInfo[], // Template clips for this layer
  time: number,
  defaults: SampledLayerState
): SampledLayerState => {
  // If no clipKeyframes, fall back to legacy sampling
  if (!layer.clipKeyframes || Object.keys(layer.clipKeyframes).length === 0) {
    return sampleLayerTracks(layer, time, defaults)
  }

  // Get the layer's BASE state from legacy keyframes at time 0
  // This is the user's positioned shape BEFORE any animations
  const layerBasePosition = layer.position?.[0]?.value ?? defaults.position
  const layerBaseScale = layer.scale?.[0]?.value ?? defaults.scale
  const layerBaseRotation = layer.rotation?.[0]?.value ?? defaults.rotation
  const layerBaseOpacity = layer.opacity?.[0]?.value ?? defaults.opacity
  const layerBaseMaskScale = layer.maskScale?.[0]?.value ?? defaults.maskScale

  // Start with layer's base state (not the default)
  let pos = { ...layerBasePosition }
  let scale = layerBaseScale
  let rotation = layerBaseRotation
  let opacity = layerBaseOpacity
  let maskScale = layerBaseMaskScale

  // Process each clip (sorted by start time for deterministic order)
  const sortedClips = [...clips].sort((a, b) => a.start - b.start)

  for (const clip of sortedClips) {
    const clipKf = layer.clipKeyframes[clip.id]
    if (!clipKf) continue

    const clipStart = clip.start
    const clipEnd = clipStart + clip.duration
    const clipDuration = clip.duration

    // Determine local time within clip (0 to duration)
    let localTime: number
    let isActive = false
    let isEnded = false

    if (time >= clipStart && time <= clipEnd) {
      // Currently within clip
      localTime = time - clipStart
      isActive = true
    } else if (time > clipEnd) {
      // Clip has ended - use final offset (carry forward)
      localTime = clipDuration
      isEnded = true
    } else {
      // Before clip starts - no contribution
      continue
    }

    // Sample this clip's keyframes at local time
    if (clipKf.position) {
      const offset = sampleVec2Track(clipKf.position, localTime, { x: 0, y: 0 })
      pos.x += offset.x
      pos.y += offset.y
    }

    if (clipKf.rotation) {
      const offset = sampleNumberTrack(clipKf.rotation, localTime, 0)
      rotation += offset
    }

    if (clipKf.scale) {
      // Scale is multiplicative - sample relative to 1
      const factor = sampleNumberTrack(clipKf.scale, localTime, 1)
      scale *= factor
    }

    if (clipKf.opacity && (isActive || isEnded)) {
      // Opacity: use the clip's value directly (not additive)
      const clipOpacity = sampleNumberTrack(clipKf.opacity, localTime, 1)
      opacity *= clipOpacity
    }

    if (clipKf.maskScale && (isActive || isEnded)) {
      const clipMaskScale = sampleNumberTrack(clipKf.maskScale, localTime, 0)
      maskScale = clipMaskScale // Mask takes precedence, not additive
    }
  }

  // Handle paths (unchanged)
  let pathResult: Vec2 | null = null
  let activePathId: string | undefined
  if (layer.paths && layer.paths.length > 0) {
    for (const clip of layer.paths) {
      const p = samplePathClip(clip, time)
      if (p) {
        pathResult = p
        activePathId = clip.id
        break
      }
    }
  }

  return {
    position: pathResult ?? pos,
    scale,
    rotation,
    opacity,
    maskScale: maskScale !== undefined && maskScale > 0 ? maskScale : undefined,
    activePathId,
  }
}

// LEGACY: Original sampling for backward compatibility
export const sampleLayerTracks = (
  layer: LayerTracks,
  time: number,
  defaults: SampledLayerState = DEFAULT_LAYER_STATE
): SampledLayerState => {
  const pos = sampleVec2Track(layer.position, time, defaults.position)
  const scale = sampleNumberTrack(layer.scale, time, defaults.scale)
  const rotation = sampleNumberTrack(layer.rotation, time, defaults.rotation)
  const opacity = sampleNumberTrack(layer.opacity, time, defaults.opacity)
  const maskScale = sampleNumberTrack(layer.maskScale, time, defaults.maskScale ?? 0)

  let pathResult: Vec2 | null = null
  let activePathId: string | undefined
  if (layer.paths && layer.paths.length > 0) {
    for (const clip of layer.paths) {
      const p = samplePathClip(clip, time)
      if (p) {
        pathResult = p
        activePathId = clip.id
        break
      }
    }
  }

  return {
    position: pathResult ?? pos,
    scale,
    rotation,
    opacity,
    maskScale: layer.maskScale && layer.maskScale.length > 0 ? maskScale : undefined,
    activePathId,
  }
}

// NEW: Additive sampling with clip info
export const sampleTimelineAdditive = (
  layers: LayerTracks[],
  clips: ClipInfo[], // All template clips
  time: number,
  defaults: SampledLayerState = DEFAULT_LAYER_STATE
): Record<string, SampledLayerState> => {
  const result: Record<string, SampledLayerState> = {}
  layers.forEach((layer) => {
    // Filter clips for this specific layer
    const layerClips = clips.filter(c => {
      // Check if clip belongs to this layer by matching clipId in clipKeyframes
      return layer.clipKeyframes && layer.clipKeyframes[c.id]
    })
    result[layer.layerId] = sampleLayerTracksAdditive(layer, layerClips, time, defaults)
  })
  return result
}

// LEGACY: Original sampling for backward compatibility
export const sampleTimeline = (
  layers: LayerTracks[],
  time: number,
  defaults: SampledLayerState = DEFAULT_LAYER_STATE
): Record<string, SampledLayerState> => {
  const result: Record<string, SampledLayerState> = {}
  layers.forEach((layer) => {
    result[layer.layerId] = sampleLayerTracks(layer, time, defaults)
  })
  return result
}

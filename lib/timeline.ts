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

// Per-clip keyframe storage for unified animation system
// Values are OFFSETS (position/rotation) or MULTIPLIERS (scale) or ABSOLUTE (opacity)
export interface ClipKeyframes {
  position?: TimelineKeyframe<Vec2>[]   // Offset from {0,0}
  scale?: TimelineKeyframe<number>[]     // Multiplier (1 = no change)
  rotation?: TimelineKeyframe<number>[]  // Offset from 0
  opacity?: TimelineKeyframe<number>[]   // Absolute 0-1
  maskScale?: TimelineKeyframe<number>[] // Absolute 0-1
}

// Clip info for sampling
export interface ClipInfo {
  id: string
  layerId: string
  template: string
  start: number
  duration: number
}

// Templates that support additive blending (can stack)
export const ADDITIVE_TEMPLATES = [
  'roll', 'jump', 'pop', 'shake', 'pulse', 'spin', 'path'
] as const

export const isAdditiveTemplate = (template: string): boolean =>
  ADDITIVE_TEMPLATES.includes(template as any)

export interface LayerTracks {
  layerId: string
  startTime?: number // ms - The "birth" time of the layer
  duration?: number // ms - The lifespan of the layer
  
  // NEW: Per-clip keyframe storage (clipId -> keyframes)
  clipKeyframes?: Record<string, ClipKeyframes>
  
  // Base keyframes (for storing base position at time 0)
  position?: TimelineKeyframe<Vec2>[]
  scale?: TimelineKeyframe<number>[]
  rotation?: TimelineKeyframe<number>[]
  opacity?: TimelineKeyframe<number>[]
  maskScale?: TimelineKeyframe<number>[]
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

export const sampleLayerTracks = (
  layer: LayerTracks,
  time: number,
  defaults: SampledLayerState = DEFAULT_LAYER_STATE
): SampledLayerState => {
  const pos = sampleVec2Track(layer.position, time, defaults.position)
  const scale = sampleNumberTrack(layer.scale, time, defaults.scale)
  const rotation = sampleNumberTrack(layer.rotation, time, defaults.rotation)
  const opacity = sampleNumberTrack(layer.opacity, time, defaults.opacity)
  const maskScale = sampleNumberTrack(layer.maskScale, time, defaults.maskScale ?? 0) // Default to 0 if undefined? No, fallback handles it.

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
    maskScale: layer.maskScale && layer.maskScale.length > 0 ? maskScale : undefined, // Only set if track has actual keyframes
    activePathId,
  }
}

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

// UNIFIED: Sampling with per-clip keyframes and proper blending
export const sampleLayerTracksUnified = (
  layer: LayerTracks,
  clips: ClipInfo[],
  time: number,
  baseState: SampledLayerState
): SampledLayerState => {
  // Get base state - for position, scale, and rotation, use baseState
  // because layer arrays can be corrupted by animation keyframes being merged into legacy arrays
  const layerBasePosition = baseState.position  // Always use passed baseState, not layer.position
  const layerBaseScale = baseState.scale  // Always use 1 from baseState, not layer.scale
  const layerBaseRotation = baseState.rotation  // Always use 0 from baseState, not layer.rotation
  const layerBaseOpacity = layer.opacity?.[0]?.value ?? baseState.opacity
  const layerBaseMaskScale = layer.maskScale?.[0]?.value ?? baseState.maskScale

  // Start with base state
  let pos = { ...layerBasePosition }
  let scale = layerBaseScale
  let rotation = layerBaseRotation
  let opacity = layerBaseOpacity
  let maskScale = layerBaseMaskScale

  // If no clipKeyframes, fall back to legacy sampling
  if (!layer.clipKeyframes || Object.keys(layer.clipKeyframes).length === 0) {
    return sampleLayerTracks(layer, time, baseState)
  }

  // Sort clips by start time for deterministic order
  const sortedClips = [...clips].sort((a, b) => a.start - b.start)

  for (const clip of sortedClips) {
    const kf = layer.clipKeyframes[clip.id]
    if (!kf) continue

    const clipStart = clip.start
    const clipEnd = clipStart + clip.duration

    // Determine local time within clip
    let localTime: number
    let isActive = false

    if (time >= clipStart && time <= clipEnd) {
      localTime = time - clipStart
      isActive = true
    } else if (time > clipEnd) {
      // Clip ended - carry forward final value
      localTime = clip.duration
    } else {
      // Before clip starts - skip
      continue
    }

    const isAdditive = isAdditiveTemplate(clip.template)

    // Position: always additive (offset)
    if (kf.position) {
      const offset = sampleVec2Track(kf.position, localTime, { x: 0, y: 0 })
      pos.x += offset.x
      pos.y += offset.y
    }

    // Rotation: always additive (offset)
    if (kf.rotation) {
      const offset = sampleNumberTrack(kf.rotation, localTime, 0)
      rotation += offset
    }

    // Scale: always multiplicative
    if (kf.scale) {
      const factor = sampleNumberTrack(kf.scale, localTime, 1)
      scale *= factor
    }

    // Opacity: last wins (absolute)
    if (kf.opacity) {
      opacity = sampleNumberTrack(kf.opacity, localTime, 1)
    }

    // MaskScale: last wins (absolute)
    if (kf.maskScale) {
      maskScale = sampleNumberTrack(kf.maskScale, localTime, 0)
    }
  }

  // Handle paths
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

// UNIFIED: Main timeline sampling function
export const sampleTimelineUnified = (
  layers: LayerTracks[],
  clips: ClipInfo[],
  time: number,
  defaults: SampledLayerState = DEFAULT_LAYER_STATE,
  // Optional: per-layer base states from dashboard layer state (position, rotation, scale)
  layerBaseStates?: Record<string, { x: number; y: number; rotation?: number; scale?: number }>
): Record<string, SampledLayerState> => {
  const result: Record<string, SampledLayerState> = {}
  layers.forEach((layer) => {
    // Filter clips for this layer
    const layerClips = clips.filter(c => c.layerId === layer.layerId)
    // Use per-layer base state if provided (position, rotation, scale from dashboard layer)
    const layerBase = layerBaseStates?.[layer.layerId]
    const layerDefaults = layerBase
      ? { 
          ...defaults, 
          position: { x: layerBase.x, y: layerBase.y },
          rotation: layerBase.rotation ?? defaults.rotation,
          scale: layerBase.scale ?? defaults.scale
        }
      : defaults
    result[layer.layerId] = sampleLayerTracksUnified(layer, layerClips, time, layerDefaults)
  })
  return result
}

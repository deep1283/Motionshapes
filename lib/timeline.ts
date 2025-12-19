// Timeline domain model and pure helpers for keyframe-based interpolation.

export type Easing =
  | 'linear'
  | 'easeInQuad'
  | 'easeOutQuad'
  | 'easeInOutQuad'
  | 'easeInOutQuint'
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
  color?: TimelineKeyframe<number>[]     // Absolute hex color (0xRRGGBB)
  width?: TimelineKeyframe<number>[]     // Absolute width in pixels
  height?: TimelineKeyframe<number>[]    // Absolute height in pixels
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
  'roll', 'jump', 'pop', 'shake', 'pulse', 'spin', 'path', 'color', 'resize'
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
  color?: TimelineKeyframe<number>[]
  paths?: PathClip[]
}

export interface SampledLayerState {
  position: Vec2
  scale: number
  rotation: number
  opacity: number
  maskScale?: number // If defined, apply a circle mask scaled by this value
  color?: number // If defined, override layer color
  width?: number // If defined, override layer width
  height?: number // If defined, override layer height
  activePathId?: string
}

export const DEFAULT_LAYER_STATE: SampledLayerState = {
  position: { x: 0.5, y: 0.5 },
  scale: 1,
  rotation: 0,
  opacity: 1,
  maskScale: undefined,
  color: undefined,
  width: undefined,
  height: undefined,
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
    case 'easeInOutQuint':
      // Exponential S-curve - very aggressive (Jitter-like)
      // Uses power of 7 for extremely sharp acceleration in the middle
      return t < 0.5 
        ? 64 * t * t * t * t * t * t * t   // t^7 * 64
        : 1 - Math.pow(-2 * t + 2, 7) / 2
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

const interpolateColor = (c1: number, c2: number, t: number): number => {
  const r1 = (c1 >> 16) & 0xff
  const g1 = (c1 >> 8) & 0xff
  const b1 = c1 & 0xff
  const r2 = (c2 >> 16) & 0xff
  const g2 = (c2 >> 8) & 0xff
  const b2 = c2 & 0xff
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return (r << 16) | (g << 8) | b
}

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

export const sampleColorTrack = (
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
  return interpolateColor(prev.value, next.value, eased)
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
  // Before clip starts - return null (shape at base position)
  if (time < clip.startTime) return null
  // After clip ends - return the LAST point (shape stays at final position)
  if (time > clip.startTime + clip.duration) {
    return clip.points[clip.points.length - 1]
  }
  // During clip - interpolate along path
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
    // First pass: find a path that is CURRENTLY within its time range (actively animating)
    for (const clip of layer.paths) {
      if (time >= clip.startTime && time <= clip.startTime + clip.duration) {
        const p = samplePathClip(clip, time)
        if (p) {
          pathResult = p
          activePathId = clip.id
          break
        }
      }
    }
    // Second pass: if no active path, use the last completed path (most recent end position)
    if (!pathResult) {
      let latestEndTime = -Infinity
      for (const clip of layer.paths) {
        if (time > clip.startTime + clip.duration) {
          const endTime = clip.startTime + clip.duration
          if (endTime > latestEndTime) {
            latestEndTime = endTime
            pathResult = clip.points[clip.points.length - 1]
            activePathId = clip.id
          }
        }
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
  // IMPORTANT: Use baseState.color (from layer.fillColor) as the authoritative base color
  // Only fall back to layer.color track (animation keyframes) if baseState.color is not provided
  const layerBaseColor = baseState.color ?? layer.color?.[0]?.value
  const layerBaseWidth = baseState.width
  const layerBaseHeight = baseState.height

  // Start with base state
  let pos = { ...layerBasePosition }
  let scale = layerBaseScale
  let rotation = layerBaseRotation
  let opacity = layerBaseOpacity
  let maskScale = layerBaseMaskScale
  let color = layerBaseColor
  let width = layerBaseWidth
  let height = layerBaseHeight

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
    // SKIP path clips - their position is handled separately via layer.paths
    if (kf.position && clip.template !== 'path') {
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

    // Color: last wins (absolute)
    if (kf.color) {
      color = sampleColorTrack(kf.color, localTime, color ?? 0xffffff)
    }

    // Width: last wins (absolute)
    if (kf.width) {
      width = sampleNumberTrack(kf.width, localTime, width ?? 100)
    }

    // Height: last wins (absolute)
    if (kf.height) {
      height = sampleNumberTrack(kf.height, localTime, height ?? 100)
    }
  }

  // Handle paths - prioritize active paths over completed ones
  // IMPORTANT: Paths are stored in absolute screen coordinates (where user drew them)
  // We need to convert them to RELATIVE motion so they follow the shape's current position
  // AND accumulate offsets from ALL completed paths
  let pathResult: Vec2 | null = null
  let pathFirstPoint: Vec2 | null = null
  let activePathId: string | undefined
  let accumulatedPathOffset = { x: 0, y: 0 } // Track total offset from all completed paths
  
  if (layer.paths && layer.paths.length > 0) {
    // Sort paths by start time to process in order
    const sortedPaths = [...layer.paths].sort((a, b) => a.startTime - b.startTime)
    
    // Accumulate offsets from all COMPLETED paths (those that ended before current time)
    for (const clip of sortedPaths) {
      const clipEnd = clip.startTime + clip.duration
      if (time > clipEnd && clip.points.length > 1) {
        // This path is complete - add its full offset (end - start)
        const startPt = clip.points[0]
        const endPt = clip.points[clip.points.length - 1]
        accumulatedPathOffset.x += endPt.x - startPt.x
        accumulatedPathOffset.y += endPt.y - startPt.y
      }
    }
    
    // Find the ACTIVE path (currently animating)
    for (const clip of sortedPaths) {
      if (time >= clip.startTime && time <= clip.startTime + clip.duration) {
        const p = samplePathClip(clip, time)
        if (p && clip.points.length > 0) {
          pathResult = p
          pathFirstPoint = clip.points[0] // Store first point as origin
          activePathId = clip.id
          break
        }
      }
    }
    
    // If no active path but we have accumulated offset, apply it
    if (!pathResult && (accumulatedPathOffset.x !== 0 || accumulatedPathOffset.y !== 0)) {
      // Use a dummy point to trigger offset application
      pathResult = { x: 0, y: 0 }
      pathFirstPoint = { x: 0, y: 0 }
    }
  }

  // Calculate final position
  // For paths: treat path as RELATIVE motion from the shape's current animated position
  // The path's first point is the "origin" - we calculate offset from there and apply to `pos`
  let finalPosition: Vec2
  if (pathResult && pathFirstPoint) {
    // Calculate how far along the current path we've moved from its first point
    const currentPathOffset = {
      x: pathResult.x - pathFirstPoint.x,
      y: pathResult.y - pathFirstPoint.y
    }
    // Apply BOTH accumulated offset from completed paths AND current path offset
    finalPosition = {
      x: pos.x + accumulatedPathOffset.x + currentPathOffset.x,
      y: pos.y + accumulatedPathOffset.y + currentPathOffset.y
    }
  } else {
    finalPosition = pos
  }

  return {
    position: finalPosition,
    scale,
    rotation,
    opacity,
    maskScale: maskScale !== undefined && maskScale > 0 ? maskScale : undefined,
    color,
    width,
    height,
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
  layerBaseStates?: Record<string, { x: number; y: number; rotation?: number; scale?: number; color?: number }>
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
          scale: layerBase.scale ?? defaults.scale,
          color: layerBase.color ?? defaults.color // Use layer color from dashboard if provided
        }
      : defaults
    result[layer.layerId] = sampleLayerTracksUnified(layer, layerClips, time, layerDefaults)
  })
  return result
}

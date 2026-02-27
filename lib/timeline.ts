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
  ADDITIVE_TEMPLATES.includes(template as UnsafeAny)

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
    case 'easeInOutQuint': {
      // Custom smooth easing with 5 zones:
      // 0-10%: slow (ease-in)
      // 10-30%: medium-fast (accelerating)
      // 30-80%: fast (linear-ish at peak speed)
      // 80-90%: medium-fast (decelerating)
      // 90-100%: slow (ease-out)
      
      // Zone boundaries (input time)
      const z1 = 0.10  // end of slow start
      const z2 = 0.30  // end of medium-fast start
      const z3 = 0.80  // end of fast middle
      const z4 = 0.90  // end of medium-fast end
      
      // Corresponding output progress at zone boundaries
      // Slow zones cover less progress, fast zone covers more
      const p1 = 0.03  // progress at 10% time (slow)
      const p2 = 0.15  // progress at 30% time (medium)
      const p3 = 0.85  // progress at 80% time (fast covers 70%)
      const p4 = 0.97  // progress at 90% time (medium)
      
      // Smooth ease function for zone transitions
      const smoothstep = (x: number) => x * x * (3 - 2 * x)
      
      if (t <= z1) {
        // Zone 1: Slow start (0-10% → 0-3% progress)
        const localT = t / z1
        return p1 * smoothstep(localT)
      } else if (t <= z2) {
        // Zone 2: Medium-fast (10-30% → 3-15% progress)
        const localT = (t - z1) / (z2 - z1)
        return p1 + (p2 - p1) * smoothstep(localT)
      } else if (t <= z3) {
        // Zone 3: Fast middle (30-80% → 15-85% progress)
        const localT = (t - z2) / (z3 - z2)
        return p2 + (p3 - p2) * localT  // Linear in fast zone
      } else if (t <= z4) {
        // Zone 4: Medium-fast (80-90% → 85-97% progress)
        const localT = (t - z3) / (z4 - z3)
        return p3 + (p4 - p3) * smoothstep(localT)
      } else {
        // Zone 5: Slow end (90-100% → 97-100% progress)
        const localT = (t - z4) / (1 - z4)
        return p4 + (1 - p4) * smoothstep(localT)
      }
    }
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

const findSegment = <T extends TimelineKeyframe<UnsafeAny>>(frames: T[], time: number) => {
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
  const pos = { ...layerBasePosition }
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

    if (time >= clipStart && time <= clipEnd) {
      localTime = time - clipStart
    } else if (time > clipEnd) {
      // Clip ended - carry forward final value
      localTime = clip.duration
    } else {
      // Before clip starts - skip
      continue
    }

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
  if (layer.paths && layer.paths.length > 0) {
    // Sort paths by start time to process in order
    const sortedPaths = [...layer.paths].sort((a, b) => a.startTime - b.startTime)
    
    // Track the COMPLETED path's end point and end time for subsequent templates
    let completedPathEndPoint: Vec2 | null = null
    let completedPathEndTime: number = 0
    let isPathActive: boolean = false
    
    // Process all COMPLETED paths to find the final end point and latest end time
    for (const clip of sortedPaths) {
      const clipEnd = clip.startTime + clip.duration
      if (time > clipEnd && clip.points.length > 0) {
        // This path is complete - store its end point and end time
        completedPathEndPoint = clip.points[clip.points.length - 1]
        completedPathEndTime = clipEnd  // Track when path ended
      }
    }
    
    // Find the ACTIVE path (currently animating)
    for (const clip of sortedPaths) {
      if (time >= clip.startTime && time <= clip.startTime + clip.duration) {
        const p = samplePathClip(clip, time)
        if (p && clip.points.length > 0) {
          pathResult = p
          pathFirstPoint = clip.points[0]
          activePathId = clip.id
          isPathActive = true
          break
        }
      }
    }
    
    // If no active path but there was a completed path, use its end point
    if (!pathResult && completedPathEndPoint) {
      pathResult = completedPathEndPoint
      pathFirstPoint = completedPathEndPoint
      isPathActive = false
    }
    
    // Store metadata for later use
    if (pathResult) {
      const activeFlag = isPathActive
      const endTime = completedPathEndTime;
      (pathResult as UnsafeAny)._isActivelyAnimating = activeFlag;
      (pathResult as UnsafeAny)._pathEndTime = endTime
    }
  }

  // Calculate final position
  // ABSOLUTE PATH POSITIONING:
  // - During path: shape IS at pathResult (absolute coordinates where user drew)
  // - After path: shape is at path end point + templates that started AFTER path ended
  // - Templates BEFORE path are already accounted for (user drew path at visual position)
  let finalPosition: Vec2
  if (pathResult && pathFirstPoint) {
    const isActivelyAnimating = (pathResult as UnsafeAny)._isActivelyAnimating ?? false
    const pathEndTime = (pathResult as UnsafeAny)._pathEndTime ?? 0
    
    if (isActivelyAnimating) {
      // DURING PATH: Shape is at ABSOLUTE path point (no offset)
      finalPosition = pathResult
    } else {
      // AFTER PATH: Calculate offset only from templates that started AFTER path ended
      // Re-calculate position from only those clips
      const afterPathOffset = { x: 0, y: 0 }
      
      if (pathEndTime > 0) {
        // Sort clips by start time
        const sortedClips = [...clips].sort((a, b) => a.start - b.start)
        
        for (const clip of sortedClips) {
          const kf = layer.clipKeyframes?.[clip.id]
          if (!kf) continue
          
          // Only include templates that START at or after path end time
          if (clip.start < pathEndTime) continue
          
          const clipStart = clip.start
          const clipEnd = clipStart + clip.duration
          
          let localTime: number
          if (time >= clipStart && time <= clipEnd) {
            localTime = time - clipStart
          } else if (time > clipEnd) {
            localTime = clip.duration
          } else {
            continue
          }
          
          // Add position offset from this template (skip path clips)
          if (kf.position && clip.template !== 'path') {
            const offset = sampleVec2Track(kf.position, localTime, { x: 0, y: 0 })
            afterPathOffset.x += offset.x
            afterPathOffset.y += offset.y
          }
        }
      }
      
      // Final position = path end point + offsets from templates after path
      finalPosition = {
        x: pathResult.x + afterPathOffset.x,
        y: pathResult.y + afterPathOffset.y
      }
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

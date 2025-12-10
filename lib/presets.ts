import { TimelineKeyframe, Vec2 } from '@/lib/timeline'

export type TemplateId =
  | 'roll' | 'jump' | 'pop' | 'path' | 'shake' | 'pulse' | 'spin' | 'counter' | 'pan_zoom'
  | 'fade_in' | 'slide_in' | 'grow_in' | 'shrink_in' | 'spin_in' | 'twist_in' | 'move_scale_in'
  | 'fade_out' | 'slide_out' | 'grow_out' | 'shrink_out' | 'spin_out' | 'twist_out' | 'move_scale_out'
  | 'mask_center' | 'mask_top' | 'mask_center_out' | 'mask_top_out'
  | 'typewriter' // Text animations

export interface PresetResult {
  position?: TimelineKeyframe<Vec2>[]
  scale?: TimelineKeyframe<number>[]
  rotation?: TimelineKeyframe<number>[]
  opacity?: TimelineKeyframe<number>[]
  maskScale?: TimelineKeyframe<number>[]
  duration: number
  meta?: {
    rollDistance?: number // normalized/pixel offset for roll
    jumpHeight?: number
    popScale?: number
    wobble?: boolean
    collapse?: boolean
    shakeDistance?: number
    pulseScale?: number
    spinSpeed?: number
    spinDirection?: 1 | -1
    // Pan & Zoom
    panZoomStartRegion?: { x: number; y: number; width: number; height: number }
    panZoomEndRegion?: { x: number; y: number; width: number; height: number }
    panZoomEasing?: 'linear' | 'ease-in-out' | 'smooth'
    panZoomIntensity?: number
  }
}

export const ROLL_BASE_DISTANCE = 0.2
export const ROLL_BASE_DURATION = 1200
export const ROLL_BASE_SPEED = 1.0
// Fix: define BASE_ROLL_DISTANCE as alias or use ROLL_BASE_DISTANCE directly
const BASE_ROLL_DISTANCE = ROLL_BASE_DISTANCE

// duration = distance / speed (conceptually)
// We scale based on the ratio: (distance / baseDistance) / speed
export const rollDurationForDistance = (distance: number = ROLL_BASE_DISTANCE, speed: number = ROLL_BASE_SPEED) =>
  Math.max(300, ((Math.max(0.05, distance) / ROLL_BASE_DISTANCE) / Math.max(0.1, speed)) * ROLL_BASE_DURATION)

// Inverse: distance = (duration * speed) / baseDuration * baseDistance
export const rollDistanceForDuration = (duration: number = ROLL_BASE_DURATION, speed: number = ROLL_BASE_SPEED) =>
  Math.max(0.05, ((Math.max(300, duration) / ROLL_BASE_DURATION) * Math.max(0.1, speed)) * ROLL_BASE_DISTANCE)

const rollPreset = (distance: number = BASE_ROLL_DISTANCE, speed: number = ROLL_BASE_SPEED): PresetResult => {
  const clampedDistance = Math.max(0.05, distance)
  const clampedSpeed = Math.max(0.1, speed)
  // duration = distance / speed (scaled by base values)
  const duration = rollDurationForDistance(clampedDistance, clampedSpeed)
  return {
    duration,
    position: [
      { time: 0, value: { x: 0, y: 0 }, easing: 'linear' },
      // treat as horizontal offset; normalized if base is normalized, pixels if base is pixels
      { time: duration, value: { x: distance, y: 0 }, easing: 'linear' },
    ],
    rotation: [
      { time: 0, value: 0, easing: 'linear' },
      // rotation is additive offset
      { time: duration, value: Math.PI * 4, easing: 'linear' },
    ],
    meta: { rollDistance: distance },
  }
}

export const GRAVITY = 9.8 // normalized units per second^2

// Inverse of jumpPreset duration calculation
// Given duration and velocity, calculate height
export const jumpHeightForDuration = (duration: number, velocity: number = 1.5) => {
  const timeUpSec = Math.max(0.15, duration / 2000) // t = T/2
  const clampedVelocity = Math.max(0.2, velocity)
  
  // Check if the velocity is sufficient for this duration
  // Max duration for velocity v0 is T = 2*v0/g
  const maxDurationForVelocity = (2 * clampedVelocity / GRAVITY) * 1000
  
  if (duration <= maxDurationForVelocity) {
    // Regime 1: Velocity is sufficient. Calculate height on the trajectory.
    // h = v0*t - 0.5*g*t^2
    const height = clampedVelocity * timeUpSec - 0.5 * GRAVITY * timeUpSec * timeUpSec
    return Math.max(0.05, height)
  } else {
    // Regime 2: Velocity is insufficient. We must scale up.
    // We assume the optimal trajectory where v0 scales to match duration.
    // h = 1/8 * g * T^2 (where T is duration in seconds)
    const durationSec = duration / 1000
    const height = 0.125 * GRAVITY * durationSec * durationSec
    return Math.max(0.05, height)
  }
}

const jumpPreset = (height: number = 0.25, initialVelocity: number = 1.5): PresetResult => {
  const clampedHeight = Math.max(0.05, height)
  const clampedVelocity = Math.max(0.2, initialVelocity)
  // ensure chosen velocity can reach desired height: v0^2 / (2g) >= h
  const minVelocityForHeight = Math.sqrt(2 * GRAVITY * clampedHeight)
  const v0 = Math.max(clampedVelocity, minVelocityForHeight)
  // time to reach specified height on the way up: h = v0*t - 0.5*g*t^2 -> t = (v0 - sqrt(v0^2 - 2gh)) / g
  const underRoot = Math.max(0, v0 * v0 - 2 * GRAVITY * clampedHeight)
  const timeUpSec = (v0 - Math.sqrt(underRoot)) / GRAVITY
  // Remove 2400ms clamp to allow longer jumps
  const duration = Math.max(300, timeUpSec * 2 * 1000)
  return {
    duration,
    position: [
      { time: 0, value: { x: 0, y: 0 } },
      // vertical offset (normalized or pixels depending on base)
      { time: duration * 0.5, value: { x: 0, y: -clampedHeight }, easing: 'easeOutQuad' },
      { time: duration, value: { x: 0, y: 0 }, easing: 'easeInQuad' },
    ],
    scale: [
      { time: 0, value: 1 },
      { time: duration * 0.2, value: 0.95, easing: 'easeOutQuad' },
      { time: duration * 0.5, value: 1.05, easing: 'easeOutQuad' },
      // landing squish
      { time: duration * 0.85, value: 0.93, easing: 'easeInQuad' },
      { time: duration, value: 1, easing: 'easeOutQuad' },
    ],
    meta: { jumpHeight: height },
  }
}

// For Pop: duration = 1000 / speed, so speed = 1000 / duration
export const popSpeedForDuration = (duration: number) => {
  // Lower min speed to 0.05 to allow durations up to 20s
  return Math.max(0.05, 1000 / Math.max(100, duration))
}

const popPreset = (peakScale: number = 1.6, wobble: boolean = false, speed: number = 1, collapse: boolean = true): PresetResult => {
  // Lower min speed to 0.05 to allow durations up to 20s
  const duration = 1000 / Math.max(0.05, speed) // higher speed -> shorter time to peak/burst
  const burstStart = duration * 0.52
  const burstEnd = duration * 0.62
  const wobbleScale = wobble ? peakScale * 0.92 : peakScale * 0.9
  return {
    duration,
    scale: [
      { time: 0, value: 1 },
      { time: duration * 0.5, value: peakScale, easing: 'easeOutQuad' as any },
      ...(collapse
        ? [
            { time: burstStart, value: wobble ? wobbleScale : peakScale, easing: (wobble ? 'easeOutBack' : 'easeOutQuad') as any },
            { time: burstEnd, value: 0, easing: 'easeInQuad' as any },
          ]
        : [
            { time: burstStart, value: wobble ? wobbleScale : peakScale, easing: (wobble ? 'easeOutBack' : 'easeOutQuad') as any },
            // hold scale at peak; only opacity will drop
            { time: burstEnd, value: peakScale, easing: 'linear' as any },
          ]),
    ],
    opacity: [
      { time: 0, value: 1 },
      ...(collapse
        ? [
            { time: burstStart, value: 1 },
            { time: burstEnd, value: 0, easing: 'easeInQuad' as any },
          ]
        : [
            { time: burstStart, value: 1 },
            { time: burstEnd, value: 0, easing: 'easeInQuad' as any },
          ]),
    ],
    meta: { popScale: peakScale, wobble, collapse },
  }
}

export const SHAKE_BASE_DISTANCE = 10 // pixels
export const SHAKE_BASE_DURATION = 500 // ms

const shakePreset = (distance: number = SHAKE_BASE_DISTANCE, speed: number = 1, targetDuration?: number): PresetResult => {
  // duration is driven by the clip (purple bar); use base when not provided
  const duration = targetDuration ?? SHAKE_BASE_DURATION
  // Convert pixel distance to normalized coordinates (assuming ~1000px canvas width)
  // 10px = 0.01 normalized units
  const normalizedDist = Math.max(1, distance) / 1000

  // Speed controls how many oscillations happen within the fixed duration
  const cycles = Math.max(1, Math.round(Math.max(0.1, speed) * 3))
  const keyframes = []
  keyframes.push({ time: 0, value: { x: 0, y: 0 } })
  const steps = cycles * 2 // left/right per cycle
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * duration
    const dir = i % 2 === 0 ? 1 : -1
    keyframes.push({ time: t, value: { x: dir * normalizedDist, y: 0 } })
  }
  keyframes.push({ time: duration, value: { x: 0, y: 0 } })

  return {
    duration,
    position: keyframes,
    meta: { shakeDistance: distance },
  }
}

export const PULSE_BASE_SCALE = 0.2 // +20% peak
export const PULSE_BASE_DURATION = 800 // ms

const pulsePreset = (scaleAmount: number = PULSE_BASE_SCALE, speed: number = 1, targetDuration?: number): PresetResult => {
  const duration = targetDuration ?? PULSE_BASE_DURATION
  const amplitude = Math.max(0.05, scaleAmount)
  const cycles = Math.max(1, Math.round(Math.max(0.1, speed) * 2))
  const steps = cycles * 2

  const frames: TimelineKeyframe<number>[] = []
  frames.push({ time: 0, value: 1 })
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * duration
    // alternate between peak and trough
    const isPeak = i % 2 === 1
    const value = isPeak ? 1 + amplitude : Math.max(0.05, 1 - amplitude * 0.35)
    frames.push({ time: t, value, easing: 'easeInOutQuad' })
  }
  frames.push({ time: duration, value: 1 })

  return {
    duration,
    scale: frames,
    meta: { pulseScale: scaleAmount },
  }
}

export const SPIN_BASE_SPEED = 1 // rotations per duration
export const SPIN_BASE_DURATION = 1200 // ms

const spinPreset = (speed: number = SPIN_BASE_SPEED, direction: 1 | -1 = 1, targetDuration?: number): PresetResult => {
  const duration = targetDuration ?? SPIN_BASE_DURATION
  const rotations = Math.max(0.1, speed)
  const endRotation = direction * rotations * Math.PI * 2
  return {
    duration,
    rotation: [
      { time: 0, value: 0, easing: 'linear' },
      { time: duration, value: endRotation, easing: 'linear' },
    ],
    meta: { spinSpeed: speed, spinDirection: direction },
  }
}

export const ANIMATION_BASE_DURATION = 1500

const fadeInPreset = (duration: number = ANIMATION_BASE_DURATION): PresetResult => ({
  duration,
  opacity: [
    { time: 0, value: 0, easing: 'easeInOutQuad' as any },
    { time: duration, value: 1, easing: 'easeInOutQuad' as any },
  ]
})

const slideInPreset = (duration: number = ANIMATION_BASE_DURATION): PresetResult => ({
  duration,
  // Shape slides in during first 50%, opacity fades in over full duration
  position: [
    { time: 0, value: { x: -0.2, y: 0 }, easing: 'easeOutQuad' as any },
    { time: duration * 0.5, value: { x: 0, y: 0 }, easing: 'easeOutQuad' as any },
    { time: duration, value: { x: 0, y: 0 }, easing: 'easeOutQuad' as any },
  ],
  opacity: [
    { time: 0, value: 0, easing: 'easeInOutQuad' as any },
    { time: duration, value: 1, easing: 'easeInOutQuad' as any },
  ]
})

const growInPreset = (duration: number = ANIMATION_BASE_DURATION): PresetResult => ({
  duration,
  scale: [
    { time: 0, value: 0, easing: 'easeOutBack' as any },
    { time: duration, value: 1, easing: 'easeOutBack' as any },
  ],
  opacity: [
    { time: 0, value: 0 },
    { time: duration * 0.1, value: 1 },
  ]
})

const shrinkInPreset = (duration: number = ANIMATION_BASE_DURATION): PresetResult => ({
  duration,
  scale: [
    { time: 0, value: 2, easing: 'easeOutExpo' as any },
    { time: duration, value: 1, easing: 'easeOutExpo' as any },
  ],
  opacity: [
    { time: 0, value: 0 },
    { time: duration * 0.2, value: 1 },
  ]
})

const spinInPreset = (duration: number = ANIMATION_BASE_DURATION): PresetResult => ({
  duration,
  rotation: [
    { time: 0, value: -Math.PI * 2, easing: 'easeOutBack' as any },
    { time: duration, value: 0, easing: 'easeOutBack' as any },
  ],
  scale: [
    { time: 0, value: 0, easing: 'easeOutBack' as any },
    { time: duration, value: 1, easing: 'easeOutBack' as any },
  ],
  opacity: [
    { time: 0, value: 0 },
    { time: duration * 0.1, value: 1 },
  ]
})

const twistInPreset = (duration: number = ANIMATION_BASE_DURATION): PresetResult => ({
  duration,
  rotation: [
    { time: 0, value: -Math.PI / 2, easing: 'easeInOutQuad' as any }, // -90deg
    { time: duration, value: 0, easing: 'easeInOutQuad' as any },
  ],
  scale: [
    { time: 0, value: 0, easing: 'easeInOutQuad' as any },
    { time: duration, value: 1, easing: 'easeInOutQuad' as any },
  ],
  opacity: [
    { time: 0, value: 0, easing: 'easeInOutQuad' as any },
    { time: duration, value: 1, easing: 'easeInOutQuad' as any },
  ]
})

const moveScaleInPreset = (duration: number = ANIMATION_BASE_DURATION): PresetResult => ({
  duration,
  position: [
    { time: 0, value: { x: 0, y: 0.2 }, easing: 'easeOutBack' as any },
    { time: duration, value: { x: 0, y: 0 }, easing: 'easeOutBack' as any },
  ],
  scale: [
    { time: 0, value: 0.5, easing: 'easeOutBack' as any },
    { time: duration, value: 1, easing: 'easeOutBack' as any },
  ],
  opacity: [
    { time: 0, value: 0 },
    { time: duration * 0.2, value: 1 },
  ]
})

// OUT Presets (Mirrors of IN)
const fadeOutPreset = (duration: number = ANIMATION_BASE_DURATION): PresetResult => ({
  duration,
  opacity: [
    { time: 0, value: 1, easing: 'easeInQuad' as any },
    { time: duration, value: 0, easing: 'easeInQuad' as any },
  ]
})

const slideOutPreset = (duration: number = ANIMATION_BASE_DURATION): PresetResult => ({
  duration,
  // Shape stays in place for first 50%, then slides out during second half
  position: [
    { time: 0, value: { x: 0, y: 0 }, easing: 'easeInQuad' as any },
    { time: duration * 0.5, value: { x: 0, y: 0 }, easing: 'easeInQuad' as any },
    { time: duration, value: { x: 0.2, y: 0 }, easing: 'easeInQuad' as any },
  ],
  // Opacity fades over the full duration
  opacity: [
    { time: 0, value: 1 },
    { time: duration, value: 0 },
  ]
})

const growOutPreset = (duration: number = ANIMATION_BASE_DURATION): PresetResult => ({
  duration,
  scale: [
    { time: 0, value: 1, easing: 'easeInBack' as any },
    { time: duration, value: 2, easing: 'easeInBack' as any },
  ],
  opacity: [
    { time: duration * 0.5, value: 1 },
    { time: duration, value: 0 },
  ]
})

const shrinkOutPreset = (duration: number = ANIMATION_BASE_DURATION): PresetResult => ({
  duration,
  scale: [
    { time: 0, value: 1, easing: 'easeInBack' as any },
    { time: duration, value: 0, easing: 'easeInBack' as any },
  ],
  opacity: [
    { time: duration * 0.8, value: 1 },
    { time: duration, value: 0 },
  ]
})

const spinOutPreset = (duration: number = ANIMATION_BASE_DURATION): PresetResult => ({
  duration,
  rotation: [
    { time: 0, value: 0, easing: 'easeInBack' as any },
    { time: duration, value: Math.PI * 2, easing: 'easeInBack' as any },
  ],
  scale: [
    { time: 0, value: 1, easing: 'easeInBack' as any },
    { time: duration, value: 0, easing: 'easeInBack' as any },
  ],
  opacity: [
    { time: duration * 0.8, value: 1 },
    { time: duration, value: 0 },
  ]
})

const twistOutPreset = (duration: number = ANIMATION_BASE_DURATION): PresetResult => ({
  duration,
  rotation: [
    { time: 0, value: 0, easing: 'easeInOutQuad' as any },
    { time: duration, value: Math.PI / 2, easing: 'easeInOutQuad' as any }, // +90deg
  ],
  scale: [
    { time: 0, value: 1, easing: 'easeInOutQuad' as any },
    { time: duration, value: 2, easing: 'easeInOutQuad' as any },
  ],
  opacity: [
    { time: 0, value: 1, easing: 'easeInOutQuad' as any },
    { time: duration, value: 0, easing: 'easeInOutQuad' as any },
  ]
})

const moveScaleOutPreset = (duration: number = ANIMATION_BASE_DURATION): PresetResult => ({
  duration,
  position: [
    { time: 0, value: { x: 0, y: 0 }, easing: 'easeInBack' as any },
    { time: duration, value: { x: 0, y: 0.2 }, easing: 'easeInBack' as any },
  ],
  scale: [
    { time: 0, value: 1, easing: 'easeInBack' as any },
    { time: duration, value: 0.5, easing: 'easeInBack' as any },
  ],
  opacity: [
    { time: duration * 0.8, value: 1 },
    { time: duration, value: 0 },
  ]
})

// Pan & Zoom Preset - animates position and scale based on start/end regions
export const PAN_ZOOM_BASE_DURATION = 2000

const panZoomPreset = (
  duration: number = PAN_ZOOM_BASE_DURATION,
  targetRegion?: { x: number; y: number; width: number; height: number },
  holdDuration: number = 500, // ms to stay zoomed
  easing: 'linear' | 'ease-in-out' | 'smooth' = 'ease-in-out',
  intensity: number = 1.5 // Zoom level (1.2 - 3.0)
): PresetResult => {
  // Default: zoom to center region
  const target = targetRegion ?? { x: 0.25, y: 0.25, width: 0.5, height: 0.5 }
  
  // Calculate animation timing
  // zoomInTime + holdTime + zoomOutTime = totalDuration
  const actualHold = Math.min(holdDuration, duration * 0.8) // max 80% of duration for hold
  const animTime = (duration - actualHold) / 2 // split remaining between zoom in and out
  const zoomInEnd = animTime
  const holdEnd = animTime + actualHold
  
  // Calculate zoom target position offset (from layer center)
  // For camera zoom effect: the target rectangle should stay FIXED in center
  // while the layer scales around it
  const targetCenterX = target.x + target.width / 2
  const targetCenterY = target.y + target.height / 2
  
  // Calculate offset to keep target center fixed during scale
  // When scaling by S from center, a point at distance D from center moves to S*D
  // We need to offset by -(S-1)*targetOffset to keep target fixed
  // targetOffset = targetCenter - layerCenter (where layerCenter = 0.5, 0.5 in normalized coords)
  const targetOffsetFromCenterX = targetCenterX - 0.5
  const targetOffsetFromCenterY = targetCenterY - 0.5
  
  // Offset to keep target fixed: compensate for scale expansion
  const offsetX = -targetOffsetFromCenterX * (intensity - 1)
  const offsetY = -targetOffsetFromCenterY * (intensity - 1)
  
  // Scale: use intensity directly (not calculated from rectangle)
  const targetScale = Math.max(1.1, Math.min(intensity, 4)) // Clamp between 1.1 and 4
  
  // Determine easing function
  const getEasing = (easingType: string) => {
    switch (easingType) {
      case 'linear': return 'linear' as any
      case 'smooth': return 'easeInOutCubic' as any
      case 'ease-in-out': 
      default: return 'easeInOutQuad' as any
    }
  }
  const animEasing = getEasing(easing)
  

  
  return {
    duration,
    // Position animation: pan layer so rectangle focal point centers on screen
    position: [
      // Start: no offset (normal position)
      { time: 0, value: { x: 0, y: 0 }, easing: animEasing },
      // Zoom in complete: offset to center target rectangle
      { time: zoomInEnd, value: { x: offsetX, y: offsetY }, easing: animEasing },
      // Hold: stay at offset
      { time: holdEnd, value: { x: offsetX, y: offsetY }, easing: 'linear' as any },
      // Zoom out complete: back to normal
      { time: duration, value: { x: 0, y: 0 }, easing: animEasing },
    ],
    scale: [
      // Start: normal scale (1)
      { time: 0, value: 1, easing: animEasing },
      // Zoom in complete: scaled up
      { time: zoomInEnd, value: targetScale, easing: animEasing },
      // Hold: stay scaled
      { time: holdEnd, value: targetScale, easing: 'linear' as any },
      // Zoom out complete: back to normal
      { time: duration, value: 1, easing: animEasing },
    ],
    meta: {
      panZoomStartRegion: { x: 0, y: 0, width: 1, height: 1 },
      panZoomEndRegion: target,
      panZoomEasing: easing,
      panZoomIntensity: intensity,
    },
  }
}

// Mask Center: vertical expansion from horizontal line to full circle
const maskCenterPreset = (duration: number = 1000): PresetResult => ({
  duration,
  position: [],
  scale: [],
  rotation: [],
  opacity: [],
  maskScale: [
    { time: 0, value: 0, easing: 'linear' },
    { time: duration, value: 1, easing: 'linear' },
  ],
})

// Mask Top: reveals from top edge downward
const maskTopPreset = (duration: number = 1000): PresetResult => ({
  duration,
  position: [],
  scale: [],
  rotation: [],
  opacity: [],
  maskScale: [
    { time: 0, value: 0, easing: 'linear' },
    { time: duration, value: 1, easing: 'linear' },
  ],
})

// Mask Center Out: disappears into center
const maskCenterOutPreset = (duration: number = 1000): PresetResult => ({
  duration,
  position: [],
  scale: [],
  rotation: [],
  opacity: [],
  maskScale: [
    { time: 0, value: 1, easing: 'linear' },
    { time: duration, value: 0, easing: 'linear' },
  ],
})

// Mask Top Out: disappears into top edge
const maskTopOutPreset = (duration: number = 1000): PresetResult => ({
  duration,
  position: [],
  scale: [],
  rotation: [],
  opacity: [],
  maskScale: [
    { time: 0, value: 1, easing: 'linear' },
    { time: duration, value: 0, easing: 'linear' },
  ],
})
// Typewriter: reveals text character by character
export const TYPEWRITER_BASE_DURATION = 2000

const typewriterPreset = (duration: number = TYPEWRITER_BASE_DURATION, showCursor: boolean = true): PresetResult => ({
  duration,
  // Typewriter doesn't use standard keyframes - it's handled specially in MotionCanvas
  // The progress (0-1) determines how many characters are visible
  opacity: [
    { time: 0, value: 1 },
    { time: duration, value: 1 },
  ],
  meta: {
    textAnimation: 'typewriter',
    showCursor,
  } as any,
})

export const PRESET_BUILDERS = {
  roll: rollPreset,
  jump: jumpPreset,
  pop: popPreset,
  shake: shakePreset,
  pulse: pulsePreset,
  spin: spinPreset,
  mask_center: maskCenterPreset,
  mask_top: maskTopPreset,
  mask_center_out: maskCenterOutPreset,
  mask_top_out: maskTopOutPreset,
  // Animations
  fade_in: fadeInPreset,
  slide_in: slideInPreset,
  grow_in: growInPreset,
  shrink_in: shrinkInPreset,
  spin_in: spinInPreset,
  twist_in: twistInPreset,
  move_scale_in: moveScaleInPreset,
  // Out
  fade_out: fadeOutPreset,
  slide_out: slideOutPreset,
  grow_out: growOutPreset,
  shrink_out: shrinkOutPreset,
  spin_out: spinOutPreset,
  twist_out: twistOutPreset,
  move_scale_out: moveScaleOutPreset,
  pan_zoom: panZoomPreset,
  // Text animations
  typewriter: typewriterPreset,
} as const

export type PresetBuilderMap = typeof PRESET_BUILDERS

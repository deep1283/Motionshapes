import { TimelineKeyframe, Vec2 } from '@/lib/timeline'

export type TemplateId =
  | 'roll' | 'jump' | 'pop' | 'path' | 'shake' | 'pulse' | 'spin'
  | 'fade_in' | 'slide_in' | 'grow_in' | 'shrink_in' | 'spin_in' | 'twist_in' | 'move_scale_in'
  | 'fade_out' | 'slide_out' | 'grow_out' | 'shrink_out' | 'spin_out' | 'twist_out' | 'move_scale_out'

export interface PresetResult {
  position?: TimelineKeyframe<Vec2>[]
  scale?: TimelineKeyframe<number>[]
  rotation?: TimelineKeyframe<number>[]
  opacity?: TimelineKeyframe<number>[]
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
  position: [
    { time: 0, value: { x: -0.5, y: 0 }, easing: 'easeOutExpo' as any }, // Start off-screen left
    { time: duration, value: { x: 0, y: 0 }, easing: 'easeOutExpo' as any },
  ],
  opacity: [
    { time: 0, value: 0 },
    { time: duration * 0.2, value: 1 },
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
    { time: 0, value: -Math.PI, easing: 'easeOutExpo' as any },
    { time: duration, value: 0, easing: 'easeOutExpo' as any },
  ],
  opacity: [
    { time: 0, value: 0, easing: 'easeOutQuad' as any },
    { time: duration, value: 1, easing: 'easeOutQuad' as any },
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
  position: [
    { time: 0, value: { x: 0, y: 0 }, easing: 'easeInExpo' as any },
    { time: duration, value: { x: 0.5, y: 0 }, easing: 'easeInExpo' as any },
  ],
  opacity: [
    { time: duration * 0.8, value: 1 },
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
    { time: 0, value: 0, easing: 'easeInExpo' as any },
    { time: duration, value: Math.PI, easing: 'easeInExpo' as any },
  ],
  opacity: [
    { time: 0, value: 1, easing: 'easeInQuad' as any },
    { time: duration, value: 0, easing: 'easeInQuad' as any },
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

export const PRESET_BUILDERS = {
  roll: rollPreset,
  jump: jumpPreset,
  pop: popPreset,
  shake: shakePreset,
  pulse: pulsePreset,
  spin: spinPreset,
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
} as const

export type PresetBuilderMap = typeof PRESET_BUILDERS

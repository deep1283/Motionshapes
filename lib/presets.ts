import { TimelineKeyframe, Vec2 } from '@/lib/timeline'

export type TemplateId = 'roll' | 'jump' | 'pop'

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
// duration = timeUp * 2 * 1000, so timeUp = duration / 2000
// From physics: h = v0*t - 0.5*g*t^2 where t = timeUp
// We use the provided velocity to calculate the height that would produce this duration
export const jumpHeightForDuration = (duration: number, velocity: number = 1.5) => {
  const timeUpSec = Math.max(0.15, duration / 2000) // Ensure min duration
  const clampedVelocity = Math.max(0.2, velocity)
  // h = v0*t - 0.5*g*t^2
  const height = clampedVelocity * timeUpSec - 0.5 * GRAVITY * timeUpSec * timeUpSec
  return Math.max(0.05, height)
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
  const duration = Math.max(300, Math.min(2400, timeUpSec * 2 * 1000))
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
  return Math.max(0.2, 1000 / Math.max(100, duration))
}

const popPreset = (peakScale: number = 1.6, wobble: boolean = false, speed: number = 1, collapse: boolean = true): PresetResult => {
  const duration = 1000 / Math.max(0.2, speed) // higher speed -> shorter time to peak/burst
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

export const PRESET_BUILDERS = {
  roll: rollPreset,
  jump: jumpPreset,
  pop: popPreset,
} as const

export type PresetBuilderMap = typeof PRESET_BUILDERS

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
  }
}

const BASE_ROLL_DISTANCE = 0.2
const BASE_ROLL_DURATION = 1200

const rollPreset = (distance: number = BASE_ROLL_DISTANCE): PresetResult => {
  const clampedDistance = Math.max(0.05, distance)
  // distance = speed * time with speed set by baseDistance/baseDuration; duration scales with distance
  const duration = Math.max(300, (clampedDistance / BASE_ROLL_DISTANCE) * BASE_ROLL_DURATION)
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

const GRAVITY = 9.8 // normalized units per second^2

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

const popPreset = (peakScale: number = 1.6, wobble: boolean = false, speed: number = 1, collapse: boolean = true): PresetResult => {
  const duration = 1000 / Math.max(0.2, speed) // higher speed -> shorter time to peak/burst
  const burstStart = duration * 0.52
  const burstEnd = duration * 0.62
  const wobbleScale = wobble ? peakScale * 0.92 : peakScale * 0.9
  return {
    duration,
    scale: [
      { time: 0, value: 1 },
      { time: duration * 0.5, value: peakScale, easing: 'easeOutQuad' },
      ...(collapse
        ? [
            { time: burstStart, value: wobble ? wobbleScale : peakScale, easing: wobble ? 'easeOutBack' : 'easeOutQuad' },
            { time: burstEnd, value: 0, easing: 'easeInQuad' },
          ]
        : [
            { time: burstStart, value: wobble ? wobbleScale : peakScale, easing: wobble ? 'easeOutBack' : 'easeOutQuad' },
            // hold scale at peak; only opacity will drop
            { time: burstEnd, value: peakScale, easing: 'linear' },
          ]),
    ],
    opacity: [
      { time: 0, value: 1 },
      ...(collapse
        ? [
            { time: burstStart, value: 1 },
            { time: burstEnd, value: 0, easing: 'easeInQuad' },
          ]
        : [
            { time: burstStart, value: 1 },
            { time: burstEnd, value: 0, easing: 'easeInQuad' },
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

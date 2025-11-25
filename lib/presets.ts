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

const rollPreset = (distance: number = 0.2): PresetResult => {
  const duration = 1200
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

const jumpPreset = (height: number = 0.25): PresetResult => {
  const duration = 1000
  return {
    duration,
    position: [
      { time: 0, value: { x: 0, y: 0 } },
      // vertical offset (normalized or pixels depending on base)
      { time: duration * 0.5, value: { x: 0, y: -height }, easing: 'easeOutQuad' },
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

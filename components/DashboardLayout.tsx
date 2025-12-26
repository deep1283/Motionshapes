'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import Image from 'next/image'
import type { SVGProps } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import {
  Layout,
  Settings,
  LogOut,
  Plus,
  Minus,
  ChevronLeft,
  Play,
  Share2,
  Download,
  Upload,
  MousePointer2,
  Layers,
  Zap,
  Activity,
  Circle,
  Square,
  MessageCircle,
  Send,
  ThumbsUp,
  MousePointer,
  Pill,
  Star,
  Triangle,
  SlidersHorizontal,
  LayoutTemplate,
  Shapes,
  PenTool,
  Wand2,
  Undo,
  Redo,
  Type,
  Sparkles,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Trash2,
  Image as ImageIcon,
  X,
  RefreshCw
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { EffectPreview } from '@/components/EffectPreview'
import { TemplatePreview } from '@/components/TemplatePreview'
import TimelinePanel from '@/components/TimelinePanel'
import FontPicker from '@/components/FontPicker'
import { ExploreShapesModal } from '@/components/ExploreShapesModal'
import ConfirmDialog from '@/components/ConfirmDialog'
import { ExportModal } from '@/components/ExportModal'
import { SaveMotionModal } from '@/components/SaveMotionModal'
import { saveMotion, uploadToCloudflare } from '@/lib/library-api'
import { useTimeline, useTimelineActions } from '@/lib/timeline-store'

const parseNum = (value: string, fallback: number = 0): number => {
  const num = parseFloat(value)
  return isNaN(num) ? fallback : num
}

const EASING_OPTIONS = [
  { label: 'None', value: 'linear' },
  { label: 'Ease In', value: 'easeInQuad' },
  { label: 'Ease Out', value: 'easeOutQuad' },
  { label: 'Ease In Out', value: 'easeInOutQuad' },
  { label: 'Jittery (Quint)', value: 'easeInOutQuint' }
]

const ResizeClipItem = ({
  clip,
  index,
  timeline,
}: {
  clip: any
  index: number
  timeline: any
}) => {
  const [expanded, setExpanded] = useState(true)
  const [widthFrom, setWidthFrom] = useState(String(clip.parameters?.resizeFromWidth ?? 100))
  const [heightFrom, setHeightFrom] = useState(String(clip.parameters?.resizeFromHeight ?? 100))
  const [widthTo, setWidthTo] = useState(String(clip.parameters?.resizeToWidth ?? 100))
  const [heightTo, setHeightTo] = useState(String(clip.parameters?.resizeToHeight ?? 100))
  const [duration, setDuration] = useState(String(clip.duration ?? 800))

  const [easing, setEasing] = useState(clip.parameters?.resizeEasing ?? 'linear')
  const [anchor, setAnchor] = useState(clip.parameters?.resizeAnchor ?? 'middle')

  useEffect(() => {
    setWidthFrom(String(clip.parameters?.resizeFromWidth ?? 100))
    setHeightFrom(String(clip.parameters?.resizeFromHeight ?? 100))
    setWidthTo(String(clip.parameters?.resizeToWidth ?? 100))
    setHeightTo(String(clip.parameters?.resizeToHeight ?? 100))
    setDuration(String(clip.duration ?? 800))

    setEasing(clip.parameters?.resizeEasing ?? 'linear')
    setAnchor(clip.parameters?.resizeAnchor ?? 'middle')
  }, [clip])

  const updateParam = (key: string, value: any) => {
    timeline.updateTemplateClip(clip.layerId, clip.id, { parameters: { [key]: value } })
  }

  return (
    <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/5 overflow-hidden">
      <div 
        className="flex items-center justify-between p-3 bg-violet-500/10 cursor-pointer hover:bg-violet-500/20 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <ChevronRight className={cn("w-3 h-3 text-violet-400 transition-transform", expanded && "rotate-90")} />
          <span className="text-[10px] uppercase text-violet-300 font-medium">Resize {index + 1}</span>
        </div>
        <button
          className="p-1 hover:bg-white/10 rounded group"
          onClick={(e) => {
            e.stopPropagation()
            timeline.removeTemplateClip(clip.id)
          }}
        >
          <Trash2 className="w-3 h-3 text-neutral-500 group-hover:text-red-400 transition-colors" />
        </button>
      </div>
      {expanded && (
        <div className="p-4 pt-0 space-y-4 pt-4 border-t border-violet-500/20 bg-black/20">
          {/* From */}
          <div>
            <span className="text-[10px] text-neutral-400 block mb-2">Initial value</span>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-500">Width</span>
                <input type="text" inputMode="numeric" value={widthFrom} 
                  onChange={e => setWidthFrom(e.target.value)}
                  onBlur={e => {
                    const v = parseNum(e.target.value, 0)
                    setWidthFrom(String(v))
                    updateParam('resizeFromWidth', v)
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                  className="w-20 px-2 py-1 text-[10px] bg-white/5 border border-white/10 rounded text-neutral-400 text-right focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-500">Height</span>
                <input type="text" inputMode="numeric" value={heightFrom}
                  onChange={e => setHeightFrom(e.target.value)}
                  onBlur={e => {
                    const v = parseNum(e.target.value, 0)
                    setHeightFrom(String(v))
                    updateParam('resizeFromHeight', v)
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                  className="w-20 px-2 py-1 text-[10px] bg-white/5 border border-white/10 rounded text-neutral-400 text-right focus:outline-none focus:border-violet-500/50"
                />
              </div>
            </div>
          </div>
          <div className="h-px bg-white/10" />
          {/* To */}
          <div>
            <span className="text-[10px] text-neutral-400 block mb-2">To</span>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-500">Width</span>
                <input type="text" inputMode="numeric" value={widthTo}
                  onChange={e => setWidthTo(e.target.value)}
                  onBlur={e => {
                    const v = parseNum(e.target.value, 0)
                    setWidthTo(String(v))
                    updateParam('resizeToWidth', v)
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                  className="w-20 px-2 py-1 text-[10px] bg-white/5 border border-white/10 rounded text-neutral-200 text-right focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-500">Height</span>
                <input type="text" inputMode="numeric" value={heightTo}
                  onChange={e => setHeightTo(e.target.value)}
                  onBlur={e => {
                    const v = parseNum(e.target.value, 0)
                    setHeightTo(String(v))
                    updateParam('resizeToHeight', v)
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                  className="w-20 px-2 py-1 text-[10px] bg-white/5 border border-white/10 rounded text-neutral-200 text-right focus:outline-none focus:border-violet-500/50"
                />
              </div>
            </div>
          </div>
          <div className="h-px bg-white/10" />
          {/* Duration & Easing */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-neutral-400">Duration</span>
              <div className="relative w-16">
                <input type="text" inputMode="numeric" value={parseFloat(duration) / 1000}
                  onChange={e => {
                    const val = parseFloat(e.target.value)
                    if (!isNaN(val) && val > 0) {
                      setDuration(String(val * 1000))
                      timeline.updateTemplateClip(clip.layerId, clip.id, { duration: val * 1000 })
                    }
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                  className="w-full px-2 py-1 text-[10px] bg-white/5 border border-white/10 rounded text-neutral-200 text-right pr-4 focus:outline-none focus:border-violet-500/50"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500">s</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-neutral-400">Easing</span>
              <select value={easing}
                onChange={e => {
                  setEasing(e.target.value)
                  updateParam('resizeEasing', e.target.value)
                }}
                className="px-2 py-1 text-[10px] bg-white/5 border border-white/10 rounded text-neutral-200"
              >
                {EASING_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-neutral-400">Anchor</span>
              <select value={anchor}
                onChange={e => {
                  setAnchor(e.target.value)
                  updateParam('resizeAnchor', e.target.value)
                }}
                className="px-2 py-1 text-[10px] bg-white/5 border border-white/10 rounded text-neutral-200"
              >
                <option value="middle">Middle</option>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const RotateClipItem = ({
  clip,
  index,
  timeline,
}: {
  clip: any
  index: number
  timeline: any
}) => {
  const [expanded, setExpanded] = useState(true)
  const [angleFrom, setAngleFrom] = useState(String(clip.parameters?.rotateFromAngle ?? 0))
  const [angleTo, setAngleTo] = useState(String(clip.parameters?.rotateToAngle ?? 0))
  const [duration, setDuration] = useState(String(clip.duration ?? 800))
  const [easing, setEasing] = useState(clip.parameters?.rotateEasing ?? 'linear')

  useEffect(() => {
    setAngleFrom(String(clip.parameters?.rotateFromAngle ?? 0))
    setAngleTo(String(clip.parameters?.rotateToAngle ?? 0))
    setDuration(String(clip.duration ?? 800))
    setEasing(clip.parameters?.rotateEasing ?? 'linear')
  }, [clip])

  const updateParam = (key: string, value: any) => {
    timeline.updateTemplateClip(clip.layerId, clip.id, { parameters: { [key]: value } })
  }

  return (
    <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/5 overflow-hidden">
      <div 
        className="flex items-center justify-between p-3 bg-violet-500/10 cursor-pointer hover:bg-violet-500/20 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <ChevronRight className={cn("w-3 h-3 text-violet-400 transition-transform", expanded && "rotate-90")} />
          <span className="text-[10px] uppercase text-violet-300 font-medium">Rotate {index + 1}</span>
        </div>
        <button className="p-1 hover:bg-white/10 rounded group" onClick={(e) => { e.stopPropagation(); timeline.removeTemplateClip(clip.id) }}>
          <Trash2 className="w-3 h-3 text-neutral-500 group-hover:text-red-400 transition-colors" />
        </button>
      </div>
      {expanded && (
        <div className="p-4 pt-0 space-y-4 pt-4 border-t border-violet-500/20 bg-black/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-500">From</span>
            <div className="relative w-20">
              <input type="text" inputMode="numeric" value={angleFrom}
                onChange={e => setAngleFrom(e.target.value)}
                onBlur={e => {
                  const v = parseNum(e.target.value, 0)
                  setAngleFrom(String(v))
                  updateParam('rotateFromAngle', v)
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                className="w-full px-2 py-1 text-[10px] bg-white/5 border border-white/10 rounded text-neutral-400 text-right pr-4 focus:outline-none focus:border-violet-500/50"
              />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500">°</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-500">To</span>
            <div className="relative w-20">
              <input type="text" inputMode="numeric" value={angleTo}
                onChange={e => setAngleTo(e.target.value)}
                onBlur={e => {
                  const v = parseNum(e.target.value, 0)
                  setAngleTo(String(v))
                  updateParam('rotateToAngle', v)
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                className="w-full px-2 py-1 text-[10px] bg-white/5 border border-white/10 rounded text-neutral-200 text-right pr-4 focus:outline-none focus:border-violet-500/50"
              />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500">°</span>
            </div>
          </div>
          <div className="h-px bg-white/10" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-400">Duration</span>
            <div className="relative w-16">
              <input type="text" inputMode="numeric" value={parseFloat(duration) / 1000}
                onChange={e => {
                   const val = parseFloat(e.target.value)
                   if (!isNaN(val) && val > 0) {
                     setDuration(String(val * 1000))
                     timeline.updateTemplateClip(clip.layerId, clip.id, { duration: val * 1000 })
                   }
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                className="w-full px-2 py-1 text-[10px] bg-white/5 border border-white/10 rounded text-neutral-200 text-right pr-4 focus:outline-none focus:border-violet-500/50"
              />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500">s</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-400">Easing</span>
            <select value={easing} onChange={e => { setEasing(e.target.value); updateParam('rotateEasing', e.target.value) }}
              className="px-2 py-1 text-[10px] bg-white/5 border border-white/10 rounded text-neutral-200"
            >
               {EASING_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}

const ColorClipItem = ({
  clip,
  index,
  timeline,
}: {
  clip: any
  index: number
  timeline: any
}) => {
  const [expanded, setExpanded] = useState(true)
  const [colorFrom, setColorFrom] = useState(() => '#' + (clip.parameters?.colorFrom ?? 0xffffff).toString(16).toUpperCase().padStart(6, '0'))
  const [colorTo, setColorTo] = useState(() => '#' + (clip.parameters?.colorTo ?? 0xffffff).toString(16).toUpperCase().padStart(6, '0'))
  const [duration, setDuration] = useState(String(clip.duration ?? 800))
  const [easing, setEasing] = useState(clip.parameters?.colorEasing ?? 'linear')

  useEffect(() => {
    setColorFrom('#' + (clip.parameters?.colorFrom ?? 0xffffff).toString(16).toUpperCase().padStart(6, '0'))
    setColorTo('#' + (clip.parameters?.colorTo ?? 0xffffff).toString(16).toUpperCase().padStart(6, '0'))
    setDuration(String(clip.duration ?? 800))
    setEasing(clip.parameters?.colorEasing ?? 'linear')
  }, [clip])

  const updateParam = (key: string, value: any) => {
    timeline.updateTemplateClip(clip.layerId, clip.id, { parameters: { [key]: value } })
  }

  const handleColorChange = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (key === 'colorFrom') setColorFrom(val)
    else setColorTo(val)
    
    // If valid hex, update
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
       const num = parseInt(val.substring(1), 16)
       updateParam(key, num)
    }
  }

  return (
     <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/5 overflow-hidden">
      <div 
        className="flex items-center justify-between p-3 bg-violet-500/10 cursor-pointer hover:bg-violet-500/20 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <ChevronRight className={cn("w-3 h-3 text-violet-400 transition-transform", expanded && "rotate-90")} />
          <span className="text-[10px] uppercase text-violet-300 font-medium">Color {index + 1}</span>
        </div>
        <button className="p-1 hover:bg-white/10 rounded group" onClick={(e) => { e.stopPropagation(); timeline.removeTemplateClip(clip.id) }}>
          <Trash2 className="w-3 h-3 text-neutral-500 group-hover:text-red-400 transition-colors" />
        </button>
      </div>
      {expanded && (
        <div className="p-4 pt-0 space-y-4 pt-4 border-t border-violet-500/20 bg-black/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-500">From</span>
            <div className="flex items-center gap-2">
               <input type="color" value={colorFrom} onChange={e => handleColorChange('colorFrom', e)} className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer" />
               <input type="text" value={colorFrom} onChange={e => handleColorChange('colorFrom', e)} 
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                className="w-16 px-2 py-1 text-[10px] bg-white/5 border border-white/10 rounded text-neutral-400 text-right focus:outline-none focus:border-violet-500/50" 
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-500">To</span>
            <div className="flex items-center gap-2">
               <input type="color" value={colorTo} onChange={e => handleColorChange('colorTo', e)} className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer" />
               <input type="text" value={colorTo} onChange={e => handleColorChange('colorTo', e)} 
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                className="w-16 px-2 py-1 text-[10px] bg-white/5 border border-white/10 rounded text-neutral-200 text-right focus:outline-none focus:border-violet-500/50" 
              />
            </div>
          </div>
          <div className="h-px bg-white/10" />
           <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-400">Duration</span>
            <div className="relative w-16">
              <input type="text" inputMode="numeric" value={parseFloat(duration) / 1000}
                onChange={e => {
                   const val = parseFloat(e.target.value)
                   if (!isNaN(val) && val > 0) {
                     setDuration(String(val * 1000))
                     timeline.updateTemplateClip(clip.layerId, clip.id, { duration: val * 1000 })
                   }
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                className="w-full px-2 py-1 text-[10px] bg-white/5 border border-white/10 rounded text-neutral-200 text-right pr-4 focus:outline-none focus:border-violet-500/50"
              />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500">s</span>
            </div>
          </div>
           <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-400">Easing</span>
            <select value={easing} onChange={e => { setEasing(e.target.value); updateParam('colorEasing', e.target.value) }}
              className="px-2 py-1 text-[10px] bg-white/5 border border-white/10 rounded text-neutral-200"
            >
               {EASING_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>
      )}
     </div>
  )
}

export type BackgroundSettings = {
  mode: 'transparent' | 'solid' | 'gradient' | 'image'
  solid: string
  from: string
  to: string
  opacity: number
  gradientType?: 'linear' | 'radial'
  gradientPosition?: number  // 0-1, default 0.5 (center)
  // Image background
  image?: string  // dataURL or URL
  imageMode?: 'cover' | 'contain' | 'stretch'
}

export type EffectType = 'glow' | 'dropShadow' | 'blur' | 'glitch' | 'pixelate' | 'sparkles' | 'confetti'

export interface Effect {
  id: string
  type: EffectType
  isEnabled: boolean
  params: Record<string, any>
}

type ShapeKind =
  | 'circle'
  | 'square'
  | 'heart'
  | 'star'
  | 'triangle'
  | 'pill'
  | 'like'
  | 'comment'
  | 'share'
  | 'cursor'
  | 'counter'

interface DashboardLayoutProps {
  children: React.ReactNode
  selectedTemplate: string
  onSelectTemplate: (template: string) => void
  onAddShape?: (shapeKind?: ShapeKind) => void
  onAddSvg?: (iconName: string, svgUrl: string) => void
  onAddText?: () => void
  onImportImage?: (file: File) => void
  onStartDrawPath?: () => void
  onStartDrawLine?: () => void
  showSelectShapeHint?: boolean
  layers: Array<{ 
    id: string; 
    shapeKind: ShapeKind; 
    type?: 'shape' | 'image' | 'svg' | 'text'; 
    x: number; 
    y: number; 
    width: number; 
    height: number; 
    scale: number; 
    rotation?: number;
    text?: string;
    fontSize?: number;
    fillColor?: number;
    fontFamily?: string;
    // Counter properties
    isCounter?: boolean;
    counterStart?: number;
    counterEnd?: number;
    counterPrefix?: string;
  }>
  layerOrder?: string[]
  onReorderLayers?: (order: string[]) => void
  selectedLayerId?: string
  isDrawingPath?: boolean
  isDrawingLine?: boolean
  onFinishPath?: () => void
  onCancelPath?: () => void
  pathPointCount?: number
  background: BackgroundSettings
  onBackgroundChange: (value: BackgroundSettings) => void
  // Timeline controls
  templateSpeed?: number
  rollDistance?: number
  rollRotation?: number
  jumpHeight?: number
  jumpVelocity?: number
  popScale?: number
  popSpeed?: number
  popCollapse?: boolean
  popReappear?: boolean
  onTemplateSpeedChange?: (value: number) => void
  onRollDistanceChange?: (value: number) => void
  onRollRotationChange?: (value: number) => void
  onJumpHeightChange?: (value: number) => void
  onJumpVelocityChange?: (value: number) => void
  onPopScaleChange?: (scale: number) => void
  onPopWobbleChange?: (wobble: boolean) => void
  onPopSpeedChange?: (speed: number) => void
  onPopCollapseChange?: (collapse: boolean) => void
  onPopReappearChange?: (reappear: boolean) => void
  pulseScale?: number
  pulseSpeed?: number
  onPulseScaleChange?: (value: number) => void
  onPulseSpeedChange?: (value: number) => void
  spinSpeed?: number
  spinDirection?: 1 | -1
  onSpinSpeedChange?: (value: number) => void
  onSpinDirectionChange?: (value: 1 | -1) => void
  shakeDistance?: number
  onShakeDistanceChange?: (value: number) => void
  selectedLayerScale?: number
  onSelectedLayerScaleChange?: (value: number) => void
  selectedClipDuration?: number
  onClipDurationChange?: (value: number) => void
  onClipClick?: (clip: { id: string; template: string }) => void
  onDeselectShape?: () => void
  // Effects
  activeEffectId?: string
  onSelectEffect?: (effectId: string) => void
  onUpdateEffect?: (effectId: string, params: Record<string, any>) => void
  onToggleEffect?: (effectId: string, isEnabled: boolean) => void
  layerEffects?: Effect[]
  selectedClipId?: string
  // Click animation
  onAddClickMarker?: (layerId: string) => void
  // Pan & Zoom animation
  onAddPanZoom?: (layerId: string) => void
  onAddMaskCenter?: (layerId: string) => void
  onAddMaskTop?: (layerId: string) => void
  onAddMaskCenterOut?: (layerId: string) => void
  onAddMaskTopOut?: (layerId: string) => void
  // History
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onPushSnapshot?: () => void
  onUpdateLayerPosition?: (id: string, x: number, y: number) => void
  onUpdateLayerRotation?: (id: string, rotation: number) => void
  onUpdateLayerSize?: (id: string, width: number, height: number) => void
  userEmail?: string | null
  onUpdateLayerText?: (id: string, text: string) => void
  onUpdateLayerFontSize?: (id: string, fontSize: number) => void
  onUpdateLayerColor?: (id: string, color: number) => void
  onUpdateLayerFontFamily?: (id: string, fontFamily: string) => void
  onRedo?: () => void
  onSelectLayer?: (layerId: string) => void
  // Counter
  onAddCounter?: () => void
  onUpdateCounterStart?: (id: string, value: number) => void
  onUpdateCounterEnd?: (id: string, value: number) => void
  onUpdateCounterPrefix?: (id: string, value: string) => void
  onAIGenerateImage?: (prompt: string) => Promise<void>
  onAIEditImage?: (layerId: string, prompt: string) => Promise<void>
  // Path smoothing
  showSmoothPathButton?: boolean
  onSmoothPath?: () => void
  onAddTypewriter?: (layerId: string) => void
  onAddBounceIn?: (layerId: string) => void
  onAddBounceOut?: (layerId: string) => void
  onAddScramble?: (layerId: string) => void
  onAddFadeInChar?: (layerId: string) => void
  onAddFadeOutChar?: (layerId: string) => void
  // Transitions
  onAddTransition?: (fromLayerId: string, toLayerId: string, transitionType: 'fade' | 'slide' | 'zoom' | 'blur') => void
  // Export support - refs from parent for canvas access
  exportCanvasRef?: React.MutableRefObject<HTMLCanvasElement | null>
  exportRenderRef?: React.MutableRefObject<(() => void) | null>
  exportHideHandlesRef?: React.MutableRefObject<(() => void) | null>
  exportShowHandlesRef?: React.MutableRefObject<(() => void) | null>
  exportResetStagePositionRef?: React.MutableRefObject<(() => void) | null>
  exportRestoreStagePositionRef?: React.MutableRefObject<(() => void) | null>
  exportResizeForExportRef?: React.MutableRefObject<((width: number, height: number) => void) | null>
  exportRestoreFromExportRef?: React.MutableRefObject<(() => void) | null>
  // Project name
  projectName?: string
  onProjectNameChange?: (name: string) => void
  // Reset project
  onReset?: () => void
  // Canvas persistence
  initialCanvasWidth?: number
  initialCanvasHeight?: number
  onCanvasDimensionsChange?: (width: number, height: number) => void
}

export default function DashboardLayout({ 
  children, 
  selectedTemplate, 
  onSelectTemplate, 
  onAddShape,
  onAddSvg,
  onAddText,
  onImportImage, 
  onStartDrawPath, 
  onStartDrawLine,
  showSelectShapeHint, 
  layers,
  layerOrder,
  onReorderLayers,
  selectedLayerId, 
  isDrawingPath, 
  isDrawingLine,
  onFinishPath, 
  onCancelPath, 
  pathPointCount = 0, 
  background, 
  onBackgroundChange,
  templateSpeed = 1,
  rollDistance = 0.2,
  rollRotation = 1,
  jumpHeight = 0.25,
  jumpVelocity = 1.5,
  popScale = 1.6,
  popSpeed = 1,
  pulseScale = 0.2,
  pulseSpeed = 1,
  popCollapse,
  popReappear,
  spinSpeed = 1,
  spinDirection = 1,
  shakeDistance,
  onTemplateSpeedChange,
  onRollDistanceChange,
  onRollRotationChange,
  onJumpHeightChange,
  onJumpVelocityChange,
  onPopScaleChange,
  onPopWobbleChange,
  onPopSpeedChange,
  onPopCollapseChange,
  onPopReappearChange,
  onPulseScaleChange,
  onPulseSpeedChange,
  onSpinSpeedChange,
  onSpinDirectionChange,
  onShakeDistanceChange,
  selectedLayerScale = 1,
  onSelectedLayerScaleChange,
  selectedClipDuration,
  onClipDurationChange,
  onClipClick,
  onDeselectShape,
  activeEffectId,
  onSelectEffect,
  onUpdateEffect,
  onToggleEffect,
  layerEffects = [],
  selectedClipId,
  onAddClickMarker,
  onAddPanZoom,
  onAddMaskCenter,
  onAddMaskTop,
  onAddMaskCenterOut,
  onAddMaskTopOut,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onPushSnapshot,
  onUpdateLayerPosition,
  onUpdateLayerRotation,
  onUpdateLayerSize,
  onUpdateLayerText,
  onUpdateLayerFontSize,
  onUpdateLayerColor,
  onUpdateLayerFontFamily,
  onSelectLayer,

  // Counter
  onAddCounter,
  onUpdateCounterStart,
  onUpdateCounterEnd,
  onUpdateCounterPrefix,
  onAIGenerateImage,
  onAIEditImage,
  // Path smoothing
  showSmoothPathButton,
  onSmoothPath,
  // Text animations
  onAddTypewriter,
  onAddBounceIn,
  onAddBounceOut,
  onAddScramble,
  onAddFadeInChar,
  onAddFadeOutChar,
  onAddTransition,
  exportCanvasRef,
  exportRenderRef,
  exportHideHandlesRef,
  exportShowHandlesRef,
  exportResetStagePositionRef,
  exportRestoreStagePositionRef,
  exportResizeForExportRef,
  exportRestoreFromExportRef,
  projectName = 'Untitled Project',
  onProjectNameChange,
  onReset,
  initialCanvasWidth,
  initialCanvasHeight,
  onCanvasDimensionsChange,
  userEmail
}: DashboardLayoutProps) {
  const router = useRouter()
  const supabase = createClient()
  // showToast is already available from useToast hook if needed, but checking for dupes
  // If showToast is duplicated, remove one.
  // const { showToast } = useToast() <- REMOVED
  
  const [isSaveLibraryOpen, setIsSaveLibraryOpen] = useState(false)
  const [isSavingLibrary, setIsSavingLibrary] = useState(false)

  const handleSaveToLibrary = async (data: { name: string, category: string }) => {
    setIsSavingLibrary(true)
    try {
       const canvas = exportCanvasRef?.current
       if (!canvas) throw new Error('No canvas found')
  
       timeline.setPlaying(false)
       timeline.setCurrentTime(0)
       exportHideHandlesRef?.current?.() // Hide handles for clean recording
       await new Promise(r => setTimeout(r, 500)) // Wait for render

       // Calculate viewport bounds (same logic as export)
       const dpr = window.devicePixelRatio || 1
       const physicalViewportWidth = canvasWidth * dpr
       const physicalViewportHeight = canvasHeight * dpr
       const physicalCanvasX = canvasX * dpr
       const physicalCanvasY = canvasY * dpr
       const workspaceWidth = canvas.width
       const workspaceHeight = canvas.height
       const vpX = (workspaceWidth - physicalViewportWidth) / 2 + physicalCanvasX
       const vpY = (workspaceHeight - physicalViewportHeight) / 2 + physicalCanvasY

       // 1. Thumbnail - crop to viewport
       const thumbCanvas = document.createElement('canvas')
       thumbCanvas.width = canvasWidth  // Logical pixels for output
       thumbCanvas.height = canvasHeight
       const thumbCtx = thumbCanvas.getContext('2d')!
       thumbCtx.drawImage(
         canvas,
         vpX, vpY, physicalViewportWidth, physicalViewportHeight,  // Source (physical pixels)
         0, 0, canvasWidth, canvasHeight  // Dest (logical pixels)
       )
       const thumbnailDataUrl = thumbCanvas.toDataURL('image/png', 0.8)
       const thumbnailBlob = await (await fetch(thumbnailDataUrl)).blob()
       const thumbnailKey = `thumbnails/${Date.now()}.png`
       const thumbnailUrl = await uploadToCloudflare(thumbnailBlob, thumbnailKey)
  
       // 2. Video Preview - capture cropped viewport only
       const previewCanvas = document.createElement('canvas')
       previewCanvas.width = canvasWidth  // Logical pixels
       previewCanvas.height = canvasHeight
       const previewCtx = previewCanvas.getContext('2d')!
       
       const stream = previewCanvas.captureStream(30)
       const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' })
       const chunks: Blob[] = []
       
       recorder.ondataavailable = e => {
         if (e.data.size > 0) chunks.push(e.data)
       }
       
       const recordingPromise = new Promise<string>((resolve, reject) => {
          recorder.onstop = async () => {
             const blob = new Blob(chunks, { type: 'video/webm' })
             const key = `previews/${Date.now()}.webm`
             try {
                const url = await uploadToCloudflare(blob, key)
                resolve(url)
             } catch(e) { reject(e) }
          }
       })
  
       // Frame loop to copy cropped viewport to preview canvas
       let isRecording = true
       const drawFrame = () => {
         if (!isRecording) return
         previewCtx.drawImage(
           canvas,
           vpX, vpY, physicalViewportWidth, physicalViewportHeight,
           0, 0, canvasWidth, canvasHeight
         )
         requestAnimationFrame(drawFrame)
       }
       
       recorder.start()
       timeline.setPlaying(true)
       drawFrame()
       
       // Calculate total duration based on tracks AND template clips
       const snapshot = timeline.getSnapshot()
       const tracks = (snapshot as any).tracks || []
       const clips = (snapshot as any).templateClips || []
       const trackEndTimes = tracks.map((t: any) => (t.startTime||0) + (t.duration||0))
       const clipEndTimes = clips.map((c: any) => (c.start||0) + (c.duration||0))
       const totalDuration = Math.max(3000, ...trackEndTimes, ...clipEndTimes) // Min 3s
       
       await new Promise(r => setTimeout(r, totalDuration + 200)) 
       
       isRecording = false
       timeline.setPlaying(false)
       recorder.stop()
       exportShowHandlesRef?.current?.() // Show handles again
       const previewUrl = await recordingPromise
  
       // 3. Save Data
       await saveMotion({
         name: data.name,
         category: data.category,
         thumbnail_url: thumbnailUrl,
         preview_url: previewUrl,
         data: {
            layers,
            layerOrder,
            timeline: snapshot,
            background,
            canvasWidth: initialCanvasWidth, // Use initialCanvasWidth from props
            canvasHeight: initialCanvasHeight // Use initialCanvasHeight from props
         },
         status: 'approved',
         is_featured: false
       })
       
       showToast('Saved to Library', 'success')
       setIsSaveLibraryOpen(false)     
    } catch (error) {
       console.error(error)
       showToast('Failed to save to library', 'error')
    } finally {
       setIsSavingLibrary(false)
       timeline.setPlaying(false)
    }
  }
  const templateClips = useTimeline((s) => s.templateClips)
  const effectClips = useTimeline((s) => s.effectClips)
  const timelineTracks = useTimeline((s) => s.tracks)
  const clickMarkers = useTimeline((s) => s.clickMarkers)
  const timelineDuration = useTimeline((s) => s.duration)
  const timeline = useTimelineActions()
  const { showToast } = useToast()
  
  // Helper to safely parse number input - defaults to 0 if empty or NaN
  const parseNum = (value: string, fallback: number = 0): number => {
    if (value === '' || value === null || value === undefined) return fallback
    const num = parseFloat(value)
    return isNaN(num) ? fallback : num
  }
  
  // Calculate actual content duration for export (not fixed 5s)
  const contentDuration = useMemo(() => {
    const clipsEnd = templateClips.reduce((max, c) => Math.max(max, (c.start ?? 0) + (c.duration ?? 0)), 0)
    const layersEnd = timelineTracks.reduce((max, t) => Math.max(max, (t.startTime ?? 0) + (t.duration ?? 0)), 0)
    const effectsEnd = effectClips.reduce((max, c) => Math.max(max, (c.start ?? 0) + (c.duration ?? 0)), 0)
    const markersEnd = clickMarkers.reduce((max, m) => Math.max(max, m.time), 0)
    // Return max of all, minimum 100ms to avoid empty exports
    return Math.max(100, clipsEnd, layersEnd, effectsEnd, markersEnd)
  }, [templateClips, timelineTracks, effectClips, clickMarkers])
  const [showBackgroundPanel, setShowBackgroundPanel] = useState(false)
  const [isBackgroundPanelCollapsed, setIsBackgroundPanelCollapsed] = useState(false)
  const [bgPrompt, setBgPrompt] = useState('')
  const [bgGenerating, setBgGenerating] = useState(false)
  const [isTransformPanelCollapsed, setIsTransformPanelCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<'templates' | 'shapes' | 'effects' | 'animations' | 'transitions' | 'custom'>('shapes')
  const [animationType, setAnimationType] = useState<'in' | 'out' | 'custom'>('in')
  const [showExploreModal, setShowExploreModal] = useState(false)
  
  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  
  // Mobile sidebar state (replaces CSS checkbox hack for better UX)
  const [isMobileLeftOpen, setIsMobileLeftOpen] = useState(false)
  const [isMobileRightOpen, setIsMobileRightOpen] = useState(false)
  
  // Custom animation state - Set allows multiple panels to be expanded simultaneously
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  // Clip order - most recently added/clicked clip ID appears first
  const [clipOrder, setClipOrder] = useState<string[]>([])
  
  // Helper to bring a clip to the front of the order
  const bringClipToFront = (clipId: string) => {
    setClipOrder(prev => {
      const filtered = prev.filter(id => id !== clipId)
      return [clipId, ...filtered]
    })
  }
  
  const [customColorFrom, setCustomColorFrom] = useState('#FFFFFF')
  const [customColorTo, setCustomColorTo] = useState('#FF9042')
  const [customColorDuration, setCustomColorDuration] = useState(800) // in ms
  const [customColorEasing, setCustomColorEasing] = useState<'none' | 'ease-in' | 'ease-out' | 'ease-in-out'>('none')

  // Sync color animation controls with timeline clip (for real-time updates when bar is dragged)
  useEffect(() => {
    if (selectedLayerId) {
      const colorClip = templateClips.find(c => c.layerId === selectedLayerId && c.template === 'color')
      if (colorClip) {
        // Update duration from clip
        setCustomColorDuration(colorClip.duration || 1000)
        // Also sync other params if they exist
        const params = colorClip.parameters || {}
        if (params.colorFrom !== undefined) {
          setCustomColorFrom('#' + params.colorFrom.toString(16).toUpperCase().padStart(6, '0'))
        }
        if (params.colorTo !== undefined) {
          setCustomColorTo('#' + params.colorTo.toString(16).toUpperCase().padStart(6, '0'))
        }
        if (params.colorEasing) {
          setCustomColorEasing(params.colorEasing === 'linear' ? 'none' : params.colorEasing as any)
        }
      }
    }
  }, [templateClips, selectedLayerId])


  // Resize animation state - using string to allow empty input while typing
  const [customResizeFromWidth, setCustomResizeFromWidth] = useState<string>('100')
  const [customResizeFromHeight, setCustomResizeFromHeight] = useState<string>('100')
  const [customResizeToWidth, setCustomResizeToWidth] = useState<string>('100')
  const [customResizeToHeight, setCustomResizeToHeight] = useState<string>('100')
  const [customResizeDuration, setCustomResizeDuration] = useState(800) // in ms

  const [customResizeEasing, setCustomResizeEasing] = useState<'none' | 'ease-in' | 'ease-out' | 'ease-in-out'>('none')
  const [customResizeAnchor, setCustomResizeAnchor] = useState<'middle' | 'top' | 'bottom' | 'left' | 'right'>('middle')

  // Sync resize animation controls with timeline clip
  useEffect(() => {
    if (selectedLayerId) {
      const resizeClip = templateClips.find(c => c.layerId === selectedLayerId && c.template === 'resize')
      if (resizeClip) {
        setCustomResizeDuration(resizeClip.duration || 800)
        const params = resizeClip.parameters || {}
        if (params.resizeFromWidth !== undefined) setCustomResizeFromWidth(String(params.resizeFromWidth))
        if (params.resizeFromHeight !== undefined) setCustomResizeFromHeight(String(params.resizeFromHeight))
        if (params.resizeToWidth !== undefined) setCustomResizeToWidth(String(params.resizeToWidth))
        if (params.resizeToHeight !== undefined) setCustomResizeToHeight(String(params.resizeToHeight))
        if (params.resizeEasing) {
          setCustomResizeEasing(params.resizeEasing === 'linear' ? 'none' : params.resizeEasing as any)
        }
        if (params.resizeAnchor) {
          setCustomResizeAnchor(params.resizeAnchor as any)
        }
      }
    }
  }, [templateClips, selectedLayerId])

  // Rotation animation state
  const [customRotateFromAngle, setCustomRotateFromAngle] = useState(0)
  const [customRotateToAngle, setCustomRotateToAngle] = useState(45)
  const [customRotateDuration, setCustomRotateDuration] = useState(800) // in ms
  const [customRotateEasing, setCustomRotateEasing] = useState<'none' | 'ease-in' | 'ease-out' | 'ease-in-out'>('none')

  // Sync rotation animation controls with timeline clip
  useEffect(() => {
    if (selectedLayerId) {
      const rotateClip = templateClips.find(c => c.layerId === selectedLayerId && c.template === 'rotate')
      if (rotateClip) {
        setCustomRotateDuration(rotateClip.duration || 800)
        const params = rotateClip.parameters || {}
        if (params.rotateFromAngle !== undefined) setCustomRotateFromAngle(params.rotateFromAngle)
        if (params.rotateToAngle !== undefined) setCustomRotateToAngle(params.rotateToAngle)
        if (params.rotateEasing) {
          setCustomRotateEasing(params.rotateEasing === 'linear' ? 'none' : params.rotateEasing as any)
        }
      } else {
        // Read initial angle from layer's rotation property
        const layer = layers?.find(l => l.id === selectedLayerId)
        if (layer?.rotation !== undefined) {
          // Convert radians to degrees
          const angleDeg = Math.round((layer.rotation * 180) / Math.PI)
          setCustomRotateFromAngle(angleDeg)
        }
      }
    }
  }, [templateClips, selectedLayerId, layers])

  // Timeline-Panel Sync: Auto-expand panel when a custom animation clip is selected on the timeline
  useEffect(() => {
    if (selectedClipId) {
      const selectedClip = templateClips.find(c => c.id === selectedClipId)
      if (selectedClip && ['color', 'resize', 'rotate'].includes(selectedClip.template)) {
        setExpandedSections(prev => new Set(prev).add(selectedClip.template))
        bringClipToFront(selectedClipId)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClipId]) // Only run when selectedClipId changes, not on every templateClips update

  const [showTextColorPicker, setShowTextColorPicker] = useState(false)
  
  // AI State
  const [showAIModal, setShowAIModal] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const [aiMode, setAiMode] = useState<'generate' | 'edit'>('generate')
  const [aiEditLayerId, setAiEditLayerId] = useState<string | null>(null)

  // Compute selectedLayer for text animation checks
  const selectedLayer = layers?.find(l => l.id === selectedLayerId)

  /* Buffered Input Component */
  interface BufferedInputProps {
    value: number
    onCommit: (val: number) => void
    label: string
  }

  function BufferedInput({ value, onCommit, label }: BufferedInputProps) {
    const [localValue, setLocalValue] = useState(String(value))

    // Sync local value when prop changes (e.g. undo/redo or external update)
    useEffect(() => {
      setLocalValue(String(value))
    }, [value])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const rawVal = e.currentTarget.value.replace(/[^0-9]/g, '')
        if (rawVal === '') return 
        const val = Math.max(0, parseInt(rawVal))
        onCommit(val)
        e.currentTarget.blur()
      }
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // Commit the value on blur (clicking away)
      const rawVal = e.currentTarget.value.replace(/[^0-9]/g, '')
      if (rawVal === '') {
        // If empty, reset to original value
        setLocalValue(String(value))
        return
      }
      const val = Math.max(0, parseInt(rawVal))
      onCommit(val)
    }

    return (
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          style={{ 
            width: '50px',
            padding: '6px 6px 6px 24px',
            color: '#ffffff',
            backgroundColor: '#333',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px'
          }}
        />
        <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: '#888', fontWeight: 'bold' }}>{label}</span>
      </div>
    )
  }


  const DEFAULT_CANVAS_WIDTH = 680
  const DEFAULT_CANVAS_HEIGHT = 445
  const MIN_CANVAS_WIDTH = 400
  const MIN_CANVAS_HEIGHT = 225

  const [canvasWidth, setCanvasWidth] = useState(() => {
    // Priority: props from Supabase > localStorage > defaults
    if (initialCanvasWidth && initialCanvasWidth > 0) return initialCanvasWidth
    if (typeof window === 'undefined') return DEFAULT_CANVAS_WIDTH
    // Mobile detection: use 9:16 aspect ratio as default
    const isMobile = window.innerWidth < 768
    if (isMobile) {
      const saved = localStorage.getItem('canvasWidth')
      // Default to 9:16 portrait (180x320) on mobile
      return saved ? Math.max(MIN_CANVAS_WIDTH, parseInt(saved)) : 180
    }
    const saved = localStorage.getItem('canvasWidth')
    return saved ? Math.max(MIN_CANVAS_WIDTH, parseInt(saved)) : DEFAULT_CANVAS_WIDTH
  })

  const [canvasHeight, setCanvasHeight] = useState(() => {
    // Priority: props from Supabase > localStorage > defaults
    if (initialCanvasHeight && initialCanvasHeight > 0) return initialCanvasHeight
    if (typeof window === 'undefined') return DEFAULT_CANVAS_HEIGHT
    // Mobile detection: use 9:16 aspect ratio as default
    const isMobile = window.innerWidth < 768
    if (isMobile) {
      const saved = localStorage.getItem('canvasHeight')
      // Default to 9:16 portrait (180x320) on mobile
      return saved ? Math.max(MIN_CANVAS_HEIGHT, parseInt(saved)) : 320
    }
    const saved = localStorage.getItem('canvasHeight')
    return saved ? Math.max(MIN_CANVAS_HEIGHT, parseInt(saved)) : DEFAULT_CANVAS_HEIGHT
  })

  const [canvasX, setCanvasX] = useState(() => {
    if (typeof window === 'undefined') return 0
    // Fixed viewport on mobile - always center
    const isMobile = window.innerWidth < 768
    if (isMobile) return 0
    const saved = localStorage.getItem('canvasX')
    return saved ? parseInt(saved) : 0
  })

  const [canvasY, setCanvasY] = useState(() => {
    if (typeof window === 'undefined') return 0
    // Fixed viewport on mobile - shift up to reduce gap from floating tabs
    const isMobile = window.innerWidth < 768
    if (isMobile) return -50
    const saved = localStorage.getItem('canvasY')
    return saved ? parseInt(saved) : 0
  })

  // Notify parent when canvas dimensions change (for Supabase persistence)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    onCanvasDimensionsChange?.(canvasWidth, canvasHeight)
  }, [canvasWidth, canvasHeight]) // Intentionally omitting callback to prevent infinite loops

  const [isResizingCanvas, setIsResizingCanvas] = useState(false)
  const [isMovingCanvas, setIsMovingCanvas] = useState(false)
  const [isCanvasSelected, setIsCanvasSelected] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  
  const canvasResizeRef = useRef<{
    startX: number
    startY: number
    startWidth: number
    startHeight: number
    startCanvasX: number
    startCanvasY: number
    handle: string
  } | null>(null)

  const canvasMoveRef = useRef<{
    startX: number
    startY: number
    startCanvasX: number
    startCanvasY: number
  } | null>(null)

  // Handle canvas click to select
  const handleCanvasClick = (e: React.MouseEvent) => {
    e.stopPropagation()

    setIsCanvasSelected(true)
  }

  // Handle label click specifically
  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation()

    setIsCanvasSelected(true)
  }

  // Allow dragging the viewport via the Canvas label
  const handleLabelPointerDown = (e: React.PointerEvent) => {
    setIsCanvasSelected(true)
    startCanvasMove(e, true)
  }

  // Deselect canvas when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-canvas-container]') && !target.closest('aside')) {
        setIsCanvasSelected(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle mouse wheel for panning or zooming (pinch)
  // Attached via ref to support non-passive listener
  useEffect(() => {
    const container = canvasContainerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      
      // Check for pinch gesture (ctrlKey + wheel)
      if (e.ctrlKey) {
        // Pinch to resize
        // deltaY is negative when zooming in (expanding), positive when zooming out (shrinking)
        const zoomSensitivity = 0.01
        const scale = 1 - (e.deltaY * zoomSensitivity)
        
        const newWidth = Math.max(MIN_CANVAS_WIDTH, Math.round(canvasWidth * scale))
        const newHeight = Math.max(MIN_CANVAS_HEIGHT, Math.round(canvasHeight * scale))
        
        setCanvasWidth(newWidth)
        setCanvasHeight(newHeight)
      } else {
        // Pan
        setCanvasX(prev => prev - e.deltaX)
        setCanvasY(prev => prev - e.deltaY)
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [canvasWidth, canvasHeight]) // Re-bind when dimensions change to capture current values



  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const templates = [
    { 
      id: 'roll', 
      name: 'Roll', 
      icon: (props: SVGProps<SVGSVGElement>) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2v20" className="opacity-30" />
          <path d="M2 12h20" className="opacity-30" />
          <path d="M12 2a10 10 0 0 1 10 10" className="opacity-50" />
        </svg>
      )
    },
    { 
      id: 'jump', 
      name: 'Jump', 
      icon: (props: SVGProps<SVGSVGElement>) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
          <path d="M4 22h16" />
          <path d="M8 22c0-8 4-14 8-14" />
          <circle cx="16" cy="8" r="2" />
        </svg>
      )
    },
    { 
      id: 'pop', 
      name: 'Pop Burst', 
      icon: (props: SVGProps<SVGSVGElement>) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 5V3" />
          <path d="M12 21v-2" />
          <path d="M5 12H3" />
          <path d="M21 12h-2" />
          <path d="M17 17l1.4 1.4" />
          <path d="M17 7l1.4-1.4" />
          <path d="M7 17l-1.4 1.4" />
          <path d="M7 7l-1.4-1.4" />
        </svg>
      )
    },
    { 
      id: 'shake', 
      name: 'Shake', 
      icon: (props: SVGProps<SVGSVGElement>) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="M5 5l14 14" className="opacity-30" />
          <path d="M5 19l14-14" className="opacity-30" />
          <rect x="8" y="8" width="8" height="8" rx="2" />
        </svg>
      )
    },
    { 
      id: 'pulse', 
      name: 'Pulse', 
      icon: (props: SVGProps<SVGSVGElement>) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
          <circle cx="12" cy="12" r="9" className="opacity-40" />
          <path d="M5 12h2l2-5 3 10 2-5h3" />
        </svg>
      )
    },
    { 
      id: 'spin', 
      name: 'Spin', 
      icon: (props: SVGProps<SVGSVGElement>) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
          <path d="M4 12a8 8 0 0 1 8-8" />
          <path d="M20 12a8 8 0 0 1-8 8" />
          <path d="M8 12h2" />
          <path d="M14 12h2" />
          <path d="M12 8v2" />
          <path d="M12 14v2" />
        </svg>
      )
    },
  ]

  const availableEffects: { id: EffectType; name: string; icon: any }[] = [
    { id: 'glow', name: 'Glow', icon: Wand2 },
    { id: 'dropShadow', name: 'Drop Shadow', icon: Wand2 },
    { id: 'blur', name: 'Blur', icon: Wand2 },
    { id: 'glitch', name: 'Glitch', icon: Wand2 },
    { id: 'pixelate', name: 'Pixelate', icon: Wand2 },
    { id: 'sparkles', name: 'Sparkles', icon: Wand2 },
    { id: 'confetti', name: 'Confetti', icon: Wand2 },
  ]

  const updateBackground = (patch: Partial<BackgroundSettings>) => {
    onBackgroundChange({ ...background, ...patch })
  }

  const normalizeHex = (value: string) => {
    if (!value) return '#000000'
    const trimmed = value.trim().replace(/[^#a-fA-F0-9]/g, '')
    const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
    return withHash.slice(0, 7)
  }

  const hexToRgba = (hex: string, alpha = 1) => {
    const normalized = normalizeHex(hex)
    const raw = normalized.slice(1)
    const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.padEnd(6, '0').slice(0, 6)
    const r = Number.parseInt(full.slice(0, 2), 16) || 0
    const g = Number.parseInt(full.slice(2, 4), 16) || 0
    const b = Number.parseInt(full.slice(4, 6), 16) || 0
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  // Canvas resize handlers
  const startCanvasResize = (e: React.PointerEvent, handle: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    const target = e.target as HTMLElement
    target.setPointerCapture(e.pointerId)
    
    setIsResizingCanvas(true)
    setResizeHandle(handle)
    canvasResizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: canvasWidth,
      startHeight: canvasHeight,
      startCanvasX: canvasX,
      startCanvasY: canvasY,
      handle
    }
  }

  const startCanvasMove = (e: React.PointerEvent, allowLabelMove = false) => {
    // Don't start move if clicking on a resize handle
    if ((e.target as HTMLElement).hasAttribute('data-resize-handle')) {
      return
    }
    
    // Don't start move if clicking on a shape (SVG elements or canvas children)
    const target = e.target as HTMLElement
    if (!allowLabelMove) {
      if (target.tagName === 'svg' || target.tagName === 'circle' || target.tagName === 'path' || 
          target.tagName === 'rect' || target.tagName === 'ellipse' || target.tagName === 'line' ||
          target.tagName === 'polygon' || target.tagName === 'polyline' || target.tagName === 'text' ||
          target.closest('svg')) {
        return
      }
      
      // Only start move if clicking directly on the canvas background
      if (!target.hasAttribute('data-canvas-clickable')) {
        return
      }
    }
    
    e.preventDefault()
    e.stopPropagation()
    
    const targetEl = (e.currentTarget as HTMLElement) || (e.target as HTMLElement)
    targetEl.setPointerCapture(e.pointerId)
    
    setIsMovingCanvas(true)
    canvasMoveRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startCanvasX: canvasX,
      startCanvasY: canvasY
    }
  }

  // Handle canvas resize
  useEffect(() => {
    if (!isResizingCanvas) return

    const handleMove = (e: PointerEvent) => {
      if (!canvasResizeRef.current) return
      
      const { startX, startY, startWidth, startHeight, startCanvasX, startCanvasY, handle } = canvasResizeRef.current
      const deltaX = e.clientX - startX
      const deltaY = e.clientY - startY

      let newWidth = startWidth
      let newHeight = startHeight
      let newX = startCanvasX
      let newY = startCanvasY

      // Handle different resize directions
      if (handle.includes('e')) { // East (right)
        const potentialWidth = Math.max(MIN_CANVAS_WIDTH, startWidth + deltaX)
        const widthChange = potentialWidth - startWidth
        newWidth = potentialWidth
        newX = startCanvasX + widthChange / 2
      } else if (handle.includes('w')) { // West (left)
        const potentialWidth = Math.max(MIN_CANVAS_WIDTH, startWidth - deltaX)
        const widthChange = potentialWidth - startWidth
        newWidth = potentialWidth
        newX = startCanvasX - widthChange / 2
      }

      if (handle.includes('s')) { // South (bottom)
        const potentialHeight = Math.max(MIN_CANVAS_HEIGHT, startHeight + deltaY)
        const heightChange = potentialHeight - startHeight
        newHeight = potentialHeight
        newY = startCanvasY + heightChange / 2
      } else if (handle.includes('n')) { // North (top)
        const potentialHeight = Math.max(MIN_CANVAS_HEIGHT, startHeight - deltaY)
        const heightChange = potentialHeight - startHeight
        newHeight = potentialHeight
        newY = startCanvasY - heightChange / 2
      }

      setCanvasWidth(Math.round(newWidth))
      setCanvasHeight(Math.round(newHeight))
      setCanvasX(Math.round(newX))
      setCanvasY(Math.round(newY))
    }

    const handleEnd = () => {
      setIsResizingCanvas(false)
      setResizeHandle(null)
      if (typeof window !== 'undefined') {
        localStorage.setItem('canvasWidth', canvasWidth.toString())
        localStorage.setItem('canvasHeight', canvasHeight.toString())
        localStorage.setItem('canvasX', canvasX.toString())
        localStorage.setItem('canvasY', canvasY.toString())
      }
      canvasResizeRef.current = null
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleEnd)
    
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleEnd)
    }
  }, [isResizingCanvas, MIN_CANVAS_WIDTH, MIN_CANVAS_HEIGHT])

  // Handle canvas move
  useEffect(() => {
    if (!isMovingCanvas) return

    const handleMove = (e: PointerEvent) => {
      if (!canvasMoveRef.current) return
      
      const { startX, startY, startCanvasX, startCanvasY } = canvasMoveRef.current
      const deltaX = e.clientX - startX
      const deltaY = e.clientY - startY

      setCanvasX(Math.round(startCanvasX + deltaX))
      setCanvasY(Math.round(startCanvasY + deltaY))
    }

    const handleEnd = () => {
      setIsMovingCanvas(false)
      if (typeof window !== 'undefined') {
        localStorage.setItem('canvasX', canvasX.toString())
        localStorage.setItem('canvasY', canvasY.toString())
      }
      canvasMoveRef.current = null
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleEnd)
    
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleEnd)
    }
  }, [isMovingCanvas])

  // Prevent text selection during resize/move
  useEffect(() => {
    if (isResizingCanvas || isMovingCanvas) {
      document.body.style.userSelect = 'none'
      document.body.style.cursor = isResizingCanvas ? (resizeHandle?.includes('n') || resizeHandle?.includes('s') ? 'ns-resize' : 'ew-resize') : 'move'
    } else {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    return () => {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isResizingCanvas, isMovingCanvas, resizeHandle])

  const canvasBgStyle =
    background.mode === 'transparent'
      ? {
          backgroundColor: 'transparent',
        }
      : background.mode === 'gradient'
      ? {
          backgroundImage: (() => {
            const pos = Math.round((background.gradientPosition ?? 0.5) * 100);
            if (background.gradientType === 'radial') {
              return `radial-gradient(circle at center, ${hexToRgba(background.from, background.opacity)} ${pos}%, ${hexToRgba(background.to, background.opacity)})`;
            }
            return `linear-gradient(135deg, ${hexToRgba(background.from, background.opacity)} ${pos}%, ${hexToRgba(background.to, background.opacity)})`;
          })(),
        }
      : background.mode === 'image' && background.image
      ? {
          backgroundImage: `url(${background.image})`,
          backgroundSize: background.imageMode === 'stretch' ? '100% 100%' : background.imageMode || 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }
      : {
          backgroundColor: hexToRgba(background.solid, background.opacity),
        }

  // Handle background click (when not clicking a shape)
  const handleBackgroundClick = (e: React.PointerEvent) => {
    // Check if the click is on the canvas element itself
    const target = e.target as HTMLElement
    if (target.tagName === 'CANVAS') {
      // Clicking on the PixiJS canvas - let MotionCanvas handle it
      return
    }
    
    // Disable canvas drag on mobile - keep viewport fixed
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
    if (isMobile) {
      // On mobile, just deselect if clicking outside canvas
      setIsCanvasSelected(false)
      return
    }
    
    // Calculate viewport bounds
    const viewportCenterX = window.innerWidth / 2 + canvasX
    const viewportCenterY = window.innerHeight / 2 + canvasY
    const halfWidth = canvasWidth / 2
    const halfHeight = canvasHeight / 2
    
    const isInsideViewport = 
      e.clientX >= viewportCenterX - halfWidth &&
      e.clientX <= viewportCenterX + halfWidth &&
      e.clientY >= viewportCenterY - halfHeight &&
      e.clientY <= viewportCenterY + halfHeight

    if (isInsideViewport) {
      // Clicked inside viewport (but not on canvas) -> Start Drag
      setIsCanvasSelected(true)
      startCanvasMove(e)
    } else {
      // Clicked outside viewport -> Deselect
      setIsCanvasSelected(false)
    }
  }
  
  // Sidebar Resize Logic
  const [sidebarWidth, setSidebarWidth] = useState(256)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const savedWidth = localStorage.getItem('motion-sidebar-width')
    if (savedWidth) {
      setSidebarWidth(parseInt(savedWidth))
    }
  }, [])

  const startSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizingSidebar(true)
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    if (!isResizingSidebar) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(120, Math.min(480, e.clientX))
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizingSidebar(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem('motion-sidebar-width', sidebarWidth.toString())
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingSidebar, sidebarWidth])

  // Right Sidebar Resize Logic
  const [rightSidebarWidth, setRightSidebarWidth] = useState(320)
  const [isResizingRightSidebar, setIsResizingRightSidebar] = useState(false)
  const rightSidebarRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const savedWidth = localStorage.getItem('motion-right-sidebar-width')
    if (savedWidth) {
      setRightSidebarWidth(parseInt(savedWidth))
    }
  }, [])

  const startRightSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizingRightSidebar(true)
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    if (!isResizingRightSidebar) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(240, Math.min(600, window.innerWidth - e.clientX))
      setRightSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizingRightSidebar(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem('motion-right-sidebar-width', rightSidebarWidth.toString())
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingRightSidebar, rightSidebarWidth])

  return (
    <div className="flex h-screen w-screen flex-col bg-[#0a0a0a] text-white overflow-hidden font-sans selection:bg-white/20 relative group/dash">

      {/* Top Navbar */}
      <header className="flex h-14 items-center justify-between border-b border-white/5 bg-[#0a0a0a]/80 px-4 backdrop-blur-xl z-50 supports-[backdrop-filter]:bg-[#0a0a0a]/60 shrink-0">
        <div className="flex items-center gap-3">
          {/* Mobile: Hamburger Button (Left Sidebar Toggle) */}
          <button 
            onClick={() => setIsMobileLeftOpen(!isMobileLeftOpen)}
            className="md:hidden p-2 -ml-2 text-neutral-400 hover:text-white cursor-pointer active:scale-95 transition-transform relative z-[80]"
            aria-label={isMobileLeftOpen ? "Close left sidebar" : "Open left sidebar"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <Button variant="ghost" size="icon" className="hidden md:flex h-8 w-8 text-neutral-400 hover:text-white hover:bg-white/5" onClick={handleLogout} title="Logout">
             <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="hidden md:flex items-center">
            <img src="/resources/wordmark.png" alt="MotionShapes" className="h-6 w-auto" />
          </div>
        </div>

        {/* Center - Editable Project Name */}
        {/* Center - Editable Project Name */}
        <div className="flex items-center justify-center absolute left-10 md:left-1/2 md:-translate-x-1/2 max-w-[100px] md:max-w-[300px]">
          <input
            type="text"
            value={projectName}
            onChange={(e) => onProjectNameChange?.(e.target.value)}
            className="bg-transparent text-center text-xs md:text-sm text-neutral-200 font-medium border border-transparent hover:border-white/10 focus:border-violet-500/50 outline-none focus:ring-4 focus:ring-violet-500/10 rounded-full px-2 py-1 md:px-4 md:py-1.5 hover:bg-white/5 focus:bg-white/5 transition-all duration-200 w-full placeholder:text-neutral-600 truncate"
            placeholder="Untitled Project"
          />
        </div>
        
        {/* Right Side - Actions */}
        <div className="flex items-center gap-1.5 md:gap-3">
            {/* Hidden file input for image import */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file && onImportImage) {
                  onImportImage(file)
                }
                // Reset input so the same file can be selected again
                e.target.value = ''
              }}
            />
            <Button 
                onClick={() => setShowResetConfirm(true)}
                variant="ghost"
                size="sm"
                className="flex h-9 w-9 md:h-8 md:w-8 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 text-xs rounded-full border border-transparent hover:border-red-500/20 transition-all duration-200"
                title="Reset Project"
            >
                <RefreshCw className="h-4 w-4 md:h-3.5 md:w-3.5" />
            </Button>
            <Button 
                onClick={() => fileInputRef.current?.click()}
                variant="ghost"
                size="sm"
                className="flex h-9 w-9 md:h-8 md:w-auto md:px-3 gap-2 text-neutral-400 hover:text-white hover:bg-white/5 text-xs rounded-full border border-transparent hover:border-white/10 transition-all duration-200"
            >
                <ChevronUp className="h-5 w-5 md:hidden" />
                <Upload className="hidden md:block h-3.5 w-3.5" />
                <span className="hidden md:inline">Import</span>
            </Button>
            <Button 
                onClick={() => setShowExportModal(true)}
                variant="ghost"
                size="sm"
                className="flex h-9 w-9 md:h-8 md:w-auto md:px-3 gap-2 bg-white text-black hover:bg-neutral-200 hover:text-black text-xs rounded-full font-medium transition-all duration-200 shadow-sm shadow-white/5 border border-transparent"
            >
                <ChevronDown className="h-5 w-5 md:hidden" />
                <Download className="hidden md:block h-3.5 w-3.5" />
                <span className="hidden md:inline">Export</span>
            </Button>
            
            {userEmail === 'deepmishra1283@gmail.com' && (
              <Button 
                  onClick={() => setIsSaveLibraryOpen(true)}
                  variant="ghost"
                  size="sm"
                  className="flex h-9 w-9 md:h-8 md:w-auto md:px-3 gap-2 bg-purple-600 text-white hover:bg-purple-700 text-xs rounded-full font-medium transition-all duration-200"
              >
                  <Upload className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Save Motion</span>
              </Button>
            )}

            {/* Mobile: Settings Toggle (Right Sidebar Toggle) */}
            <button 
              onClick={() => setIsMobileRightOpen(!isMobileRightOpen)}
              className="md:hidden p-2 text-neutral-400 hover:text-white cursor-pointer active:scale-95 transition-transform relative z-[80]"
              aria-label={isMobileRightOpen ? "Close right sidebar" : "Open right sidebar"}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
        </div>
      </header>
      

      
      {/* Mobile Drawer Backdrops - Click to close */}
      {isMobileLeftOpen && (
        <button 
          onClick={() => setIsMobileLeftOpen(false)}
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity"
          aria-label="Close left sidebar"
        />
      )}
      {isMobileRightOpen && (
        <button 
          onClick={() => setIsMobileRightOpen(false)}
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity"
          aria-label="Close right sidebar"
        />
      )}

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0 relative">
        {/* Left Sidebar Wrapper - Mobile: Off-screen Drawer (Left) | Desktop: Fixed (Left) */}
        <div className={cn(
          "fixed md:relative top-12 md:top-0 bottom-0 left-0 z-[70] w-[280px] md:w-auto md:flex-shrink-0 h-[calc(100vh-3rem)] md:h-full bg-[#0a0a0a] flex flex-col border-r border-white/5 transition-transform duration-300 order-last md:order-first shadow-2xl md:shadow-none",
          isMobileLeftOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}>
        {/* Resize Handle - Outside scrollable area to span full height */}
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-purple-500/50 active:bg-purple-500/50 transition-colors z-50"
          onMouseDown={startSidebarResize}
        />
        <aside 
            ref={sidebarRef}
            style={{ width: sidebarWidth }}
            className="relative w-full h-full flex flex-col gap-6 overflow-y-auto overscroll-contain p-4 min-h-0"
        >
          


          {/* Templates Tab Content */}
          {activeTab === 'templates' && (
            <div className="flex-1 min-h-0 pr-1">
              <div className="flex flex-col gap-4 pb-[150vh]">
                <div>
                  <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-600 px-2">
                    Custom
                  </h2>
                  <button
                    onClick={() => onStartDrawPath?.()}
                    className={cn(
                      "group flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition-all duration-200 border border-transparent",
                      isDrawingPath
                        ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
                        : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200 hover:border-white/5"
                    )}
                  >
                    <PenTool className={cn("h-4 w-4", isDrawingPath ? "text-violet-400" : "text-neutral-500 group-hover:text-neutral-300")} />
                    <span className="truncate">Draw a custom path</span>
                  </button>
                  <button
                    onClick={() => onStartDrawLine?.()}
                    className={cn(
                      "group flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition-all duration-200 border border-transparent",
                      isDrawingLine
                        ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
                        : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200 hover:border-white/5"
                    )}
                  >
                    <Minus className={cn("h-4 w-4", isDrawingLine ? "text-violet-400" : "text-neutral-500 group-hover:text-neutral-300")} />
                    <span className="truncate">Draw a line</span>
                  </button>
                </div>

                <div>
                    <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-600 px-2">
                      Templates
                    </h2>
                    <nav className={cn(
                      "grid gap-2",
                      sidebarWidth < 240 ? "grid-cols-1" : "grid-cols-2"
                    )}>
                      {templates.map((template) => (
                        <TemplatePreview
                          key={template.id}
                          id={template.id}
                          name={template.name}
                          isSelected={selectedTemplate === template.id}
                          onClick={() => onSelectTemplate(template.id)}
                        />
                      ))}
                    </nav>
                </div>
              </div>
            </div>
          )}

          {/* Animations Tab Content */}
          {activeTab === 'animations' && (
            <div className="flex-1 min-h-0 pr-1">
              <div className="flex flex-col pb-[100vh]">
              {/* Sub-tabs for IN / OUT */}
              <div className="flex w-full bg-white/5 border-b border-white/5 mb-4">
                <button
                  onClick={() => setAnimationType('in')}
                  className={cn(
                    "flex-1 py-3 text-[11px] font-bold tracking-wider uppercase transition-colors",
                    animationType === 'in'
                      ? "bg-[#8b5cf6] text-white" // Purple active state as requested
                      : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
                  )}
                >
                  In
                </button>
                <button
                  onClick={() => setAnimationType('out')}
                  className={cn(
                    "flex-1 py-3 text-[11px] font-bold tracking-wider uppercase transition-colors",
                    animationType === 'out'
                      ? "bg-[#8b5cf6] text-white"
                      : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
                  )}
                >
                  Out
                </button>
                <button
                  onClick={() => setAnimationType('custom')}
                  className={cn(
                    "flex-1 py-3 text-[11px] font-bold tracking-wider uppercase transition-colors",
                    animationType === 'custom'
                      ? "bg-[#8b5cf6] text-white"
                      : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
                  )}
                >
                  Other
                </button>
              </div>

              <div className={cn(
                "grid gap-2",
                sidebarWidth < 240 ? "grid-cols-1" : "grid-cols-2"
              )}>
                {animationType === 'in' && (
                  <>
                    <div className="col-span-full mb-1 mt-2">
                      <h3 className="text-[11px] font-semibold text-neutral-300">Fade</h3>
                    </div>
                    <TemplatePreview
                      id="fade_in"
                      name="Fade in"
                      isSelected={selectedTemplate === 'fade_in'}
                      onClick={() => onSelectTemplate('fade_in')}
                    />
                    <TemplatePreview
                      id="slide_in"
                      name="Slide in"
                      isSelected={selectedTemplate === 'slide_in'}
                      onClick={() => onSelectTemplate('slide_in')}
                    />

                    <div className="col-span-full mb-1 mt-4">
                      <h3 className="text-[11px] font-semibold text-neutral-300">Scale</h3>
                    </div>
                    <TemplatePreview
                      id="grow_in"
                      name="Grow in"
                      isSelected={selectedTemplate === 'grow_in'}
                      onClick={() => onSelectTemplate('grow_in')}
                    />
                    <TemplatePreview
                      id="shrink_in"
                      name="Shrink in"
                      isSelected={selectedTemplate === 'shrink_in'}
                      onClick={() => onSelectTemplate('shrink_in')}
                    />

                    <div className="col-span-full mb-1 mt-4">
                      <h3 className="text-[11px] font-semibold text-neutral-300">Spin & Twist</h3>
                    </div>
                    <TemplatePreview
                      id="spin_in"
                      name="Spin in"
                      isSelected={selectedTemplate === 'spin_in'}
                      onClick={() => onSelectTemplate('spin_in')}
                    />
                    <TemplatePreview
                      id="twist_in"
                      name="Twist in"
                      isSelected={selectedTemplate === 'twist_in'}
                      onClick={() => onSelectTemplate('twist_in')}
                    />
                    
                    <div className="col-span-full mb-1 mt-4">
                      <h3 className="text-[11px] font-semibold text-neutral-300">Move</h3>
                    </div>
                    <TemplatePreview
                      id="move_scale_in"
                      name="Move & Scale in"
                      isSelected={selectedTemplate === 'move_scale_in'}
                      onClick={() => onSelectTemplate('move_scale_in')}
                    />

                    <div className="col-span-full mb-1 mt-4">
                      <h3 className="text-[11px] font-semibold text-neutral-300">Mask</h3>
                    </div>
                    <TemplatePreview
                      id="mask_center"
                      name="Mask Center"
                      isSelected={false}
                      onClick={() => selectedLayerId && onAddMaskCenter?.(selectedLayerId)}
                    />
                    <TemplatePreview
                      id="mask_top"
                      name="Mask Top"
                      isSelected={false}
                      onClick={() => selectedLayerId && onAddMaskTop?.(selectedLayerId)}
                    />
                  </>
                )}
                {animationType === 'out' && (
                  <>
                    <div className="col-span-full mb-1 mt-2">
                      <h3 className="text-[11px] font-semibold text-neutral-300">Fade</h3>
                    </div>
                    <TemplatePreview
                      id="fade_out"
                      name="Fade out"
                      isSelected={selectedTemplate === 'fade_out'}
                      onClick={() => onSelectTemplate('fade_out')}
                    />
                    <TemplatePreview
                      id="slide_out"
                      name="Slide out"
                      isSelected={selectedTemplate === 'slide_out'}
                      onClick={() => onSelectTemplate('slide_out')}
                    />

                    <div className="col-span-full mb-1 mt-4">
                      <h3 className="text-[11px] font-semibold text-neutral-300">Scale</h3>
                    </div>
                    <TemplatePreview
                      id="grow_out"
                      name="Grow out"
                      isSelected={selectedTemplate === 'grow_out'}
                      onClick={() => onSelectTemplate('grow_out')}
                    />
                    <TemplatePreview
                      id="shrink_out"
                      name="Shrink out"
                      isSelected={selectedTemplate === 'shrink_out'}
                      onClick={() => onSelectTemplate('shrink_out')}
                    />

                    <div className="col-span-full mb-1 mt-4">
                      <h3 className="text-[11px] font-semibold text-neutral-300">Spin & Twist</h3>
                    </div>
                    <TemplatePreview
                      id="spin_out"
                      name="Spin out"
                      isSelected={selectedTemplate === 'spin_out'}
                      onClick={() => onSelectTemplate('spin_out')}
                    />
                    <TemplatePreview
                      id="twist_out"
                      name="Twist out"
                      isSelected={selectedTemplate === 'twist_out'}
                      onClick={() => onSelectTemplate('twist_out')}
                    />

                    <div className="col-span-full mb-1 mt-4">
                      <h3 className="text-[11px] font-semibold text-neutral-300">Move</h3>
                    </div>
                    <TemplatePreview
                      id="move_scale_out"
                      name="Move & Scale out"
                      isSelected={selectedTemplate === 'move_scale_out'}
                      onClick={() => onSelectTemplate('move_scale_out')}
                    />

                    <div className="col-span-full mb-1 mt-4">
                      <h3 className="text-[11px] font-semibold text-neutral-300">Mask</h3>
                    </div>
                    <TemplatePreview
                      id="mask_center_out"
                      name="Mask Center Out"
                      isSelected={false}
                      onClick={() => selectedLayerId && onAddMaskCenterOut?.(selectedLayerId)}
                    />
                    <TemplatePreview
                      id="mask_top_out"
                      name="Mask Top Out"
                      isSelected={false}
                      onClick={() => selectedLayerId && onAddMaskTopOut?.(selectedLayerId)}
                    />
                  </>
                )}
                {animationType === 'custom' && (
                  <>
                    <div className="col-span-full mb-1 mt-2">
                      <h3 className="text-[11px] font-semibold text-neutral-300">Interactive</h3>
                    </div>
                    <button
                      onClick={() => onAddClickMarker?.(selectedLayerId || '')}
                      disabled={!selectedLayerId}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-all",
                        selectedLayerId
                          ? "border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/50 cursor-pointer"
                          : "border-white/5 bg-white/2 opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <div className="w-3 h-3 rounded-full bg-purple-500" />
                      </div>
                      <span className="text-[11px] font-medium text-neutral-300">Click</span>
                    </button>
                    <button
                      onClick={() => {
                        onAddCounter?.()
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-all",
                        "border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/50 cursor-pointer"
                      )}
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px] font-bold text-purple-400">
                        123
                      </div>
                      <span className="text-[11px] font-medium text-neutral-300">Counter</span>
                    </button>
                    <button
                      onClick={() => {
                        if (!selectedLayerId) return
                        onAddPanZoom?.(selectedLayerId)
                      }}
                      disabled={!selectedLayerId}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-all",
                        selectedLayerId
                          ? "border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/50 cursor-pointer"
                          : "border-white/5 bg-white/2 opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-purple-400">
                          <circle cx="11" cy="11" r="6" />
                          <path d="M21 21l-4.35-4.35" />
                          <path d="M11 8v6" />
                          <path d="M8 11h6" />
                        </svg>
                      </div>
                      <span className="text-[11px] font-medium text-neutral-300">Pan & Zoom</span>
                    </button>

                    {/* Text Animations Section */}
                    <div className="col-span-full mb-1 mt-4">
                      <h3 className="text-[11px] font-semibold text-neutral-300">Text</h3>
                    </div>
                    <button
                      onClick={() => {
                        if (!selectedLayerId) return
                        onAddTypewriter?.(selectedLayerId)
                      }}
                      disabled={!selectedLayerId || selectedLayer?.type !== 'text'}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-all",
                        selectedLayerId && selectedLayer?.type === 'text'
                          ? "border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/50 cursor-pointer"
                          : "border-white/5 bg-white/2 opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-purple-400">
                          <path d="M4 7V4h16v3" />
                          <path d="M9 20h6" />
                          <path d="M12 4v16" />
                        </svg>
                      </div>
                      <span className="text-[11px] font-medium text-neutral-300">Typewriter</span>
                    </button>
                    <button
                      onClick={() => {
                        if (!selectedLayerId) return
                        onAddBounceIn?.(selectedLayerId)
                      }}
                      disabled={!selectedLayerId || selectedLayer?.type !== 'text'}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-all",
                        selectedLayerId && selectedLayer?.type === 'text'
                          ? "border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/50 cursor-pointer"
                          : "border-white/5 bg-white/2 opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-purple-400">
                          <path d="M12 3v18" />
                          <path d="M5 13l7 7 7-7" />
                        </svg>
                      </div>
                      <span className="text-[11px] font-medium text-neutral-300">Bounce In</span>
                    </button>
                    <button
                      onClick={() => {
                        if (!selectedLayerId) return
                        onAddBounceOut?.(selectedLayerId)
                      }}
                      disabled={!selectedLayerId || selectedLayer?.type !== 'text'}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-all",
                        selectedLayerId && selectedLayer?.type === 'text'
                          ? "border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/50 cursor-pointer"
                          : "border-white/5 bg-white/2 opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-purple-400">
                          <path d="M12 20V4" />
                          <path d="M5 11l7-7 7 7" />
                        </svg>
                      </div>
                      <span className="text-[11px] font-medium text-neutral-300">Bounce Out</span>
                    </button>
                    <button
                      onClick={() => {
                        if (!selectedLayerId) return
                        onAddScramble?.(selectedLayerId)
                      }}
                      disabled={!selectedLayerId || selectedLayer?.type !== 'text'}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-all",
                        selectedLayerId && selectedLayer?.type === 'text'
                          ? "border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/50 cursor-pointer"
                          : "border-white/5 bg-white/2 opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-purple-400">
                          <path d="M3 7h3m0 0l2-2m-2 2l2 2" />
                          <path d="M21 7h-3m0 0l-2-2m2 2l-2 2" />
                          <path d="M3 17h3m0 0l2-2m-2 2l2 2" />
                          <path d="M21 17h-3m0 0l-2-2m2 2l-2 2" />
                          <rect x="8" y="5" width="8" height="14" rx="1" />
                        </svg>
                      </div>
                      <span className="text-[11px] font-medium text-neutral-300">Scramble</span>
                    </button>
                    <button
                      onClick={() => {
                        if (!selectedLayerId) return
                        onAddFadeInChar?.(selectedLayerId)
                      }}
                      disabled={!selectedLayerId || selectedLayer?.type !== 'text'}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-all",
                        selectedLayerId && selectedLayer?.type === 'text'
                          ? "border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/50 cursor-pointer"
                          : "border-white/5 bg-white/2 opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-purple-400">
                          <path d="M4 7V4h16v3" />
                          <path d="M12 4v16" />
                          <path d="M8 20h8" />
                          <circle cx="12" cy="12" r="2" opacity="0.5" />
                        </svg>
                      </div>
                      <span className="text-[11px] font-medium text-neutral-300">Fade In</span>
                    </button>
                    <button
                      onClick={() => {
                        if (!selectedLayerId) return
                        onAddFadeOutChar?.(selectedLayerId)
                      }}
                      disabled={!selectedLayerId || selectedLayer?.type !== 'text'}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-all",
                        selectedLayerId && selectedLayer?.type === 'text'
                          ? "border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/50 cursor-pointer"
                          : "border-white/5 bg-white/2 opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-purple-400">
                          <path d="M4 7V4h16v3" />
                          <path d="M12 4v16" />
                          <path d="M8 20h8" />
                          <circle cx="12" cy="12" r="2" opacity="0.3" strokeDasharray="2 1" />
                        </svg>
                      </div>
                      <span className="text-[11px] font-medium text-neutral-300">Fade Out</span>
                    </button>

                  </>
                )}
              </div>
              </div>
            </div>
          )}

          {/* Effects Tab Content */}
          {activeTab === 'effects' && (
            <div className="flex-1 min-h-0 pr-1 pb-[150vh]">
              <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-600 px-2">
                Effects
              </h2>
              {!selectedLayerId && (
                <div className="mb-4 px-2 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
                  Select a layer first to add effects
                </div>
              )}
              <div className={cn(
                "grid gap-2",
                sidebarWidth < 240 ? "grid-cols-1" : "grid-cols-2"
              )}>
                {availableEffects.map((effect) => {
                  const isEnabled = layerEffects.some(e => e.type === effect.id && e.isEnabled)
                  const isActive = activeEffectId === effect.id
                  
                  return (
                    <EffectPreview
                      key={effect.id}
                      id={effect.id}
                      name={effect.name}
                      isActive={isActive}
                      isEnabled={isEnabled}
                      onClick={() => {
                        // Add effect clip to timeline - always append after last clip
                        if (!selectedLayerId) return
                        
                        // Calculate start time after all existing clips on this layer
                        const layerClips = templateClips.filter(c => c.layerId === selectedLayerId)
                        const layerEffectClips = effectClips.filter(c => c.layerId === selectedLayerId)
                        const allClips = [...layerClips, ...layerEffectClips]
                        const lastEnd = allClips.length 
                          ? Math.max(...allClips.map(c => (c.start ?? 0) + (c.duration ?? 0)))
                          : 0
                        
                        timeline.addEffectClip(
                          selectedLayerId,
                          effect.id as any, // Cast to effect type
                          lastEnd, // append after existing clips
                          1000 // 1 second duration
                        )
                        // Push snapshot after adding effect for undo/redo
                        onPushSnapshot?.()
                      }}
                      icon={effect.icon}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {/* Shapes Tab Content */}
          {activeTab === 'shapes' && (
            <div className="flex-1 min-h-0 pr-1 pb-[150vh]">
                <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-600 px-2">
                  Shapes
                </h2>
                
                {/* AI Generate/Modify Image - DISABLED for cost savings
                {(() => {
                  const selectedLayer = layers.find(l => l.id === selectedLayerId)
                  const isImageSelected = selectedLayer?.type === 'image' && !!(selectedLayer as any)?.imageUrl
                  
                  return (
                    <div className="mb-4 px-2">
                      <button
                        onClick={() => {
                          if (isImageSelected) {
                            setAiMode('edit')
                            setAiEditLayerId(selectedLayerId ?? null)
                          } else {
                            setAiMode('generate')
                          }
                          setAiPrompt('')
                          setShowAIModal(true)
                        }}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-300 text-sm font-medium ${
                          isImageSelected
                            ? 'bg-gradient-to-r from-amber-600/20 to-orange-600/20 border-amber-500/30 text-amber-300 hover:from-amber-600/30 hover:to-orange-600/30 hover:border-amber-500/50 hover:text-white'
                            : 'bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border-blue-500/30 text-blue-300 hover:from-blue-600/30 hover:to-cyan-600/30 hover:border-blue-500/50 hover:text-white'
                        }`}
                      >
                        <Sparkles className="h-4 w-4" />
                        {isImageSelected ? 'Modify Image' : 'Generate Image'}
                      </button>
                    </div>
                  )
                })()}
                */}

                {/* Explore Shapes Button */}
                <div className="mb-4 px-2">
                  <button
                    onClick={() => setShowExploreModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 text-purple-300 hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-500/50 hover:text-white transition-all duration-300 text-sm font-medium"
                  >
                    <Shapes className="h-4 w-4" />
                    Explore Shapes
                  </button>
                </div>
                
                <div className="grid grid-cols-1 gap-1">
                  <Button onClick={() => onAddText?.()} variant="ghost" className="justify-start text-neutral-400 hover:text-white hover:bg-white/5 h-9 px-2">
                    <Type className="mr-2 h-4 w-4 text-neutral-500" />
                    Text
                  </Button>
                  <Button onClick={() => onAddShape?.('circle')} variant="ghost" className="justify-start text-neutral-400 hover:text-white hover:bg-white/5 h-9 px-2">
                    <Circle className="mr-2 h-4 w-4 text-neutral-500" />
                    Circle
                  </Button>
                  <Button onClick={() => onAddShape?.('square')} variant="ghost" className="justify-start text-neutral-400 hover:text-white hover:bg-white/5 h-9 px-2">
                    <Square className="mr-2 h-4 w-4 text-neutral-500" />
                    Square
                  </Button>
                  <Button onClick={() => onAddShape?.('heart')} variant="ghost" className="justify-start text-neutral-400 hover:text-white hover:bg-white/5 h-9 px-2">
                    <Image
                      src="/icons/heart.svg"
                      alt="Heart"
                      width={16}
                      height={16}
                      className="mr-2 h-4 w-4"
                    />
                    Heart
                  </Button>
                  <Button onClick={() => onAddShape?.('star')} variant="ghost" className="justify-start text-neutral-400 hover:text-white hover:bg-white/5 h-9 px-2">
                    <Star className="mr-2 h-4 w-4 text-neutral-500" />
                    Star
                  </Button>
                  <Button onClick={() => onAddShape?.('triangle')} variant="ghost" className="justify-start text-neutral-400 hover:text-white hover:bg-white/5 h-9 px-2">
                    <Triangle className="mr-2 h-4 w-4 text-neutral-500" />
                    Triangle
                  </Button>
                  <Button onClick={() => onAddShape?.('pill')} variant="ghost" className="justify-start text-neutral-400 hover:text-white hover:bg-white/5 h-9 px-2">
                    <Pill className="mr-2 h-4 w-4 text-neutral-500" />
                    Pill
                  </Button>
                  <Button onClick={() => onAddShape?.('like')} variant="ghost" className="justify-start text-neutral-400 hover:text-white hover:bg-white/5 h-9 px-2">
                    <ThumbsUp className="mr-2 h-4 w-4 text-neutral-500" />
                    Like
                  </Button>
                  <Button onClick={() => onAddShape?.('comment')} variant="ghost" className="justify-start text-neutral-400 hover:text-white hover:bg-white/5 h-9 px-2">
                    <MessageCircle className="mr-2 h-4 w-4 text-neutral-500" />
                    Comment
                  </Button>
                  <Button onClick={() => onAddShape?.('share')} variant="ghost" className="justify-start text-neutral-400 hover:text-white hover:bg-white/5 h-9 px-2">
                    <Send className="mr-2 h-4 w-4 text-neutral-500" />
                    Share
                  </Button>
                  <Button onClick={() => onAddShape?.('cursor')} variant="ghost" className="justify-start text-neutral-400 hover:text-white hover:bg-white/5 h-9 px-2">
                    <MousePointer className="mr-2 h-4 w-4 text-neutral-500" />
                    Cursor
                  </Button>
                </div>
            </div>
          )}

          {/* Transitions Tab Content */}
          {activeTab === 'transitions' && (() => {
            // Filter only image layers
            const imageLayers = layers.filter(l => l.type === 'image')
            
            // Find next image layer based on array order
            const getNextImageLayer = (fromLayerId: string) => {
              const fromIndex = imageLayers.findIndex(l => l.id === fromLayerId)
              if (fromIndex === -1 || fromIndex >= imageLayers.length - 1) return null
              return imageLayers[fromIndex + 1]
            }
            
            // Check if selected layer is a valid "from" image (not the last one)
            const validFromImages = imageLayers.slice(0, -1)
            const isValidFromImage = selectedLayerId && validFromImages.some(l => l.id === selectedLayerId)
            const selectedFromLayer = isValidFromImage ? imageLayers.find(l => l.id === selectedLayerId) : null
            const nextImageLayer = selectedFromLayer ? getNextImageLayer(selectedLayerId!) : null
            
            // Check if transitions can be applied
            const canApplyTransition = selectedFromLayer && nextImageLayer
            
            // Get the index of the selected "from" image for display
            const selectedFromIndex = selectedFromLayer ? imageLayers.findIndex(l => l.id === selectedLayerId) : -1
            const nextImageIndex = nextImageLayer ? imageLayers.findIndex(l => l.id === nextImageLayer.id) : -1
            
            return (
              <div className="flex-1 min-h-0 pr-1 pb-[150vh]">
                <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-600 px-2">
                  Image Transitions
                </h2>
                
                <div className="px-2 mb-4 space-y-4">
                  {/* No images message */}
                  {imageLayers.length === 0 ? (
                    <p className="text-[10px] text-amber-400/80 flex items-center gap-1.5">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      Add at least 2 images to use transitions
                    </p>
                  ) : imageLayers.length < 2 ? (
                    <p className="text-[10px] text-amber-400/80 flex items-center gap-1.5">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      Add at least 2 images to use transitions
                    </p>
                  ) : (
                    <>
                      {/* From Layer Dropdown */}
                      <div className="space-y-2">
                        <label className="text-[10px] text-neutral-400 font-medium">From Image</label>
                        <select
                          value={isValidFromImage ? selectedLayerId : ''}
                          onChange={(e) => onSelectLayer?.(e.target.value)}
                          className="w-full px-3 py-2 text-[11px] bg-white/5 border border-white/10 rounded-lg text-neutral-200 focus:outline-none focus:border-violet-500/50"
                        >
                          <option value="" disabled>Select an image...</option>
                          {validFromImages.map((layer, index) => (
                            <option key={layer.id} value={layer.id}>
                              Image {index + 1}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {/* To Layer (Auto-selected) */}
                      {selectedFromLayer && nextImageLayer && (
                        <div className="space-y-2">
                          <label className="text-[10px] text-neutral-400 font-medium">To Image</label>
                          <div className="w-full px-3 py-2 text-[11px] bg-white/5 border border-white/10 rounded-lg text-neutral-400">
                            <span className="text-neutral-200">
                              Image {nextImageIndex + 1}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* Transition types */}
                      <div className="pt-2">
                        <label className="text-[10px] text-neutral-400 font-medium mb-2 block">Transition Type</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            className={cn(
                              "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all group",
                              canApplyTransition
                                ? "border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/30 cursor-pointer"
                                : "border-white/5 bg-white/2 opacity-50 cursor-not-allowed"
                            )}
                            onClick={() => {
                              if (canApplyTransition) {
                                onAddTransition?.(selectedLayerId!, nextImageLayer!.id, 'fade')
                              }
                            }}
                            disabled={!canApplyTransition}
                          >
                            <svg viewBox="0 0 24 24" className="w-6 h-6 text-neutral-400 group-hover:text-purple-400" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <circle cx="12" cy="12" r="8" strokeDasharray="4 2" />
                            </svg>
                            <span className="text-[10px] font-medium text-neutral-400 group-hover:text-white">Fade</span>
                          </button>
                          
                          <button
                            className={cn(
                              "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all group",
                              canApplyTransition
                                ? "border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/30 cursor-pointer"
                                : "border-white/5 bg-white/2 opacity-50 cursor-not-allowed"
                            )}
                            onClick={() => {
                              if (canApplyTransition) {
                                onAddTransition?.(selectedLayerId!, nextImageLayer!.id, 'slide')
                              }
                            }}
                            disabled={!canApplyTransition}
                          >
                            <svg viewBox="0 0 24 24" className="w-6 h-6 text-neutral-400 group-hover:text-purple-400" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                            <span className="text-[10px] font-medium text-neutral-400 group-hover:text-white">Slide</span>
                          </button>
                          
                          <button
                            className={cn(
                              "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all group",
                              canApplyTransition
                                ? "border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/30 cursor-pointer"
                                : "border-white/5 bg-white/2 opacity-50 cursor-not-allowed"
                            )}
                            onClick={() => {
                              if (canApplyTransition) {
                                onAddTransition?.(selectedLayerId!, nextImageLayer!.id, 'zoom')
                              }
                            }}
                            disabled={!canApplyTransition}
                          >
                            <svg viewBox="0 0 24 24" className="w-6 h-6 text-neutral-400 group-hover:text-purple-400" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <circle cx="12" cy="12" r="3" />
                              <circle cx="12" cy="12" r="8" />
                            </svg>
                            <span className="text-[10px] font-medium text-neutral-400 group-hover:text-white">Zoom</span>
                          </button>
                          
                          <button
                            className={cn(
                              "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all group",
                              canApplyTransition
                                ? "border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/30 cursor-pointer"
                                : "border-white/5 bg-white/2 opacity-50 cursor-not-allowed"
                            )}
                            onClick={() => {
                              if (canApplyTransition) {
                                onAddTransition?.(selectedLayerId!, nextImageLayer!.id, 'blur')
                              }
                            }}
                            disabled={!canApplyTransition}
                          >
                            <svg viewBox="0 0 24 24" className="w-6 h-6 text-neutral-400 group-hover:text-purple-400" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <circle cx="12" cy="12" r="6" strokeDasharray="2 1" />
                              <circle cx="12" cy="12" r="9" strokeDasharray="3 2" opacity="0.5" />
                            </svg>
                            <span className="text-[10px] font-medium text-neutral-400 group-hover:text-white">Blur</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Custom Tab Content */}
          {activeTab === 'custom' && (
            <div className="flex-1 min-h-0 pr-1 pb-[150vh]">
              <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-600 px-2">
                Custom Animation
              </h2>
              
              <div className="px-2 mb-4 space-y-4">
                {/* Info message */}
                {!selectedLayerId ? (
                  <p className="text-[10px] text-amber-400/80 flex items-center gap-1.5">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    Select a layer to create custom animations
                  </p>
                ) : (
                  <p className="text-[10px] text-neutral-400">
                    Create custom keyframe animations for the selected layer
                  </p>
                )}
                
                {/* Custom animation options */}
                <div className="space-y-3">
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-semibold text-neutral-200">Animation Properties</span>
                    
                    {/* Property toggles - each on its own line */}
                    <div className="flex flex-col gap-2">

                      
                      <div className="flex items-center">
                        <button
                          className={cn(
                            "flex-1 flex items-center gap-2 px-3 py-2 rounded-l-lg border-y border-l transition-all text-left",
                            selectedLayerId
                              ? "border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/30"
                              : "border-white/5 bg-white/2 opacity-50 cursor-not-allowed",
                            expandedSections.has('resize') && "border-violet-500/50 bg-violet-500/10",
                            !templateClips.some(c => c.layerId === selectedLayerId && c.template === 'resize') && "rounded-r-lg border-r"
                          )}
                          disabled={!selectedLayerId}
                          onClick={() => {
                            if (selectedLayerId) {
                              const existingClip = templateClips.find(c => c.layerId === selectedLayerId && c.template === 'resize')
                              
                              if (existingClip) {
                                // Toggle panel expansion
                                setExpandedSections(prev => {
                                  const next = new Set(prev)
                                  if (next.has('resize')) next.delete('resize')
                                  else next.add('resize')
                                  return next
                                })
                              } else {
                                // Create new clip and expand panel
                                const layer = layers.find(l => l.id === selectedLayerId)
                                const layerWidth = layer?.width ?? 100
                                const layerHeight = layer?.height ?? 100
                                
                                const newClipId = timeline.addTemplateClip(selectedLayerId, 'resize', 0, 800, {
                                  resizeFromWidth: layerWidth,
                                  resizeFromHeight: layerHeight,
                                  resizeToWidth: layerWidth,
                                  resizeToHeight: layerHeight,
                                  resizeEasing: 'linear',
                                  resizeAnchor: 'middle'
                                })
                                
                                setCustomResizeFromWidth(String(layerWidth))
                                setCustomResizeFromHeight(String(layerHeight))
                                setCustomResizeToWidth(String(layerWidth))
                                setCustomResizeToHeight(String(layerHeight))
                                setCustomResizeDuration(800)
                                setCustomResizeEasing('none')
                                setCustomResizeAnchor('middle')
                                
                                // Expand the panel
                                setExpandedSections(prev => new Set(prev).add('resize'))
                                if (newClipId) bringClipToFront(newClipId)
                                onPushSnapshot?.()
                              }
                            }
                          }}
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="4" y="4" width="16" height="16" rx="2" />
                            <path d="M4 14h6v6" />
                            <path d="M14 4v6h6" />
                          </svg>
                          <span className="text-[10px] text-neutral-300">Resize</span>
                        </button>
                        {/* + button to add additional resize clips */}
                        {selectedLayerId && templateClips.some(c => c.layerId === selectedLayerId && c.template === 'resize') && (
                          <button
                            className="px-2 py-2 rounded-r-lg border border-l-0 border-white/10 bg-white/5 hover:bg-violet-500/20 hover:border-violet-500/50 transition-all"
                            title="Add another resize animation"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (selectedLayerId) {
                                const layer = layers.find(l => l.id === selectedLayerId)
                                const layerWidth = layer?.width ?? 100
                                const layerHeight = layer?.height ?? 100
                                
                                // Find the last resize clip to position after it
                                const resizeClips = templateClips.filter(c => c.layerId === selectedLayerId && c.template === 'resize')
                                const lastClip = resizeClips.reduce((latest, clip) => 
                                  (clip.start ?? 0) + (clip.duration ?? 0) > (latest.start ?? 0) + (latest.duration ?? 0) ? clip : latest
                                , resizeClips[0])
                                const newStart = (lastClip.start ?? 0) + (lastClip.duration ?? 800)
                                
                                const newClipId = timeline.addTemplateClip(selectedLayerId, 'resize', newStart, 800, {
                                  resizeFromWidth: layerWidth,
                                  resizeFromHeight: layerHeight,
                                  resizeToWidth: layerWidth,
                                  resizeToHeight: layerHeight,
                                  resizeEasing: 'linear',
                                  resizeAnchor: 'middle'
                                })
                                
                                // Expand the panel
                                setExpandedSections(prev => new Set(prev).add('resize'))
                                if (newClipId) bringClipToFront(newClipId)
                                onPushSnapshot?.()
                              }
                            }}
                          >
                            <svg viewBox="0 0 24 24" className="w-3 h-3 text-violet-400" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                          </button>
                        )}
                      </div>
                      
                      <div className="flex items-center">
                        <button
                          className={cn(
                            "flex-1 flex items-center gap-2 px-3 py-2 rounded-l-lg border-y border-l transition-all text-left",
                            selectedLayerId
                              ? "border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/30"
                              : "border-white/5 bg-white/2 opacity-50 cursor-not-allowed",
                            expandedSections.has('rotate') && "border-violet-500/50 bg-violet-500/10",
                            !templateClips.some(c => c.layerId === selectedLayerId && c.template === 'rotate') && "rounded-r-lg border-r"
                          )}
                          disabled={!selectedLayerId}
                          onClick={() => {
                            if (selectedLayerId) {
                              const existingClip = templateClips.find(c => c.layerId === selectedLayerId && c.template === 'rotate')
                              
                              if (existingClip) {
                                // Toggle panel expansion
                                setExpandedSections(prev => {
                                  const next = new Set(prev)
                                  if (next.has('rotate')) next.delete('rotate')
                                  else next.add('rotate')
                                  return next
                                })
                              } else {
                                // Create new clip and expand panel
                                const layer = layers.find(l => l.id === selectedLayerId)
                                const layerRotation = layer?.rotation ?? 0
                                const fromAngle = Math.round((layerRotation * 180) / Math.PI)
                                const toAngle = fromAngle + 45
                                
                                const newClipId = timeline.addTemplateClip(selectedLayerId, 'rotate', 0, 800, {
                                  rotateFromAngle: fromAngle,
                                  rotateToAngle: toAngle,
                                  rotateEasing: 'linear'
                                })
                                
                                setCustomRotateFromAngle(fromAngle)
                                setCustomRotateToAngle(toAngle)
                                setCustomRotateDuration(800)
                                setCustomRotateEasing('none')
                                
                                // Expand the panel
                                setExpandedSections(prev => new Set(prev).add('rotate'))
                                if (newClipId) bringClipToFront(newClipId)
                                onPushSnapshot?.()
                              }
                            }
                          }}
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 12a9 9 0 11-6.22-8.56" />
                            <path d="M21 3v5h-5" />
                          </svg>
                          <span className="text-[10px] text-neutral-300">Rotate</span>
                        </button>
                        {/* + button to add additional rotate clips */}
                        {selectedLayerId && templateClips.some(c => c.layerId === selectedLayerId && c.template === 'rotate') && (
                          <button
                            className="px-2 py-2 rounded-r-lg border border-l-0 border-white/10 bg-white/5 hover:bg-violet-500/20 hover:border-violet-500/50 transition-all"
                            title="Add another rotation animation"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (selectedLayerId) {
                                // Find the last rotate clip to position after it
                                const rotateClips = templateClips.filter(c => c.layerId === selectedLayerId && c.template === 'rotate')
                                const lastClip = rotateClips.reduce((latest, clip) => 
                                  (clip.start ?? 0) + (clip.duration ?? 0) > (latest.start ?? 0) + (latest.duration ?? 0) ? clip : latest
                                , rotateClips[0])
                                const newStart = (lastClip.start ?? 0) + (lastClip.duration ?? 800)
                                
                                // Get end angle of last clip as start angle for new clip
                                const fromAngle = lastClip.parameters?.rotateToAngle ?? 0
                                const toAngle = fromAngle + 45
                                
                                const newClipId = timeline.addTemplateClip(selectedLayerId, 'rotate', newStart, 800, {
                                  rotateFromAngle: fromAngle,
                                  rotateToAngle: toAngle,
                                  rotateEasing: 'linear'
                                })
                                
                                // Expand the panel
                                setExpandedSections(prev => new Set(prev).add('rotate'))
                                if (newClipId) bringClipToFront(newClipId)
                                onPushSnapshot?.()
                              }
                            }}
                          >
                            <svg viewBox="0 0 24 24" className="w-3 h-3 text-violet-400" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                          </button>
                        )}
                      </div>
                      
                      <div className="flex items-center">
                        <button
                          className={cn(
                            "flex-1 flex items-center gap-2 px-3 py-2 rounded-l-lg border-y border-l transition-all text-left",
                            selectedLayerId
                              ? "border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/30"
                              : "border-white/5 bg-white/2 opacity-50 cursor-not-allowed",
                            expandedSections.has('color') && "border-violet-500/50 bg-violet-500/10",
                            !templateClips.some(c => c.layerId === selectedLayerId && c.template === 'color') && "rounded-r-lg border-r"
                          )}
                          disabled={!selectedLayerId}
                          onClick={() => {
                            if (selectedLayerId) {
                              const existingClip = templateClips.find(c => c.layerId === selectedLayerId && c.template === 'color')
                              
                              if (existingClip) {
                                // Toggle panel expansion
                                setExpandedSections(prev => {
                                  const next = new Set(prev)
                                  if (next.has('color')) next.delete('color')
                                  else next.add('color')
                                  return next
                                })
                              } else {
                                // Create new clip and expand panel
                                const layer = layers.find(l => l.id === selectedLayerId)
                                const layerColor = layer?.fillColor ?? 0xffffff
                                const fromColor = '#' + layerColor.toString(16).toUpperCase().padStart(6, '0')
                                
                                const newClipId = timeline.addTemplateClip(selectedLayerId, 'color', 0, 1000, {
                                  colorFrom: layerColor,
                                  colorTo: 0xFFFFFF,
                                  colorEasing: 'linear'
                                })
                                
                                setCustomColorFrom(fromColor)
                                setCustomColorTo('#FFFFFF')
                                setCustomColorDuration(1000)
                                setCustomColorEasing('none')
                                
                                // Expand the panel
                                setExpandedSections(prev => new Set(prev).add('color'))
                                if (newClipId) bringClipToFront(newClipId)
                                onPushSnapshot?.()
                              }
                            }
                          }}
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 2a7 7 0 017 7" stroke="url(#colorGrad)" strokeWidth="3" />
                            <defs>
                              <linearGradient id="colorGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#f472b6" />
                                <stop offset="50%" stopColor="#8b5cf6" />
                                <stop offset="100%" stopColor="#06b6d4" />
                              </linearGradient>
                            </defs>
                          </svg>
                          <span className="text-[10px] text-neutral-300">Color</span>
                        </button>
                        {/* + button to add additional color clips */}
                        {selectedLayerId && templateClips.some(c => c.layerId === selectedLayerId && c.template === 'color') && (
                          <button
                            className="px-2 py-2 rounded-r-lg border border-l-0 border-white/10 bg-white/5 hover:bg-violet-500/20 hover:border-violet-500/50 transition-all"
                            title="Add another color animation"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (selectedLayerId) {
                                const layer = layers.find(l => l.id === selectedLayerId)
                                
                                // Find the last color clip to position after it
                                const colorClips = templateClips.filter(c => c.layerId === selectedLayerId && c.template === 'color')
                                const lastClip = colorClips.reduce((latest, clip) => 
                                  (clip.start ?? 0) + (clip.duration ?? 0) > (latest.start ?? 0) + (latest.duration ?? 0) ? clip : latest
                                , colorClips[0])
                                const newStart = (lastClip.start ?? 0) + (lastClip.duration ?? 1000)
                                
                                // Get end color of last clip as start color for new clip
                                const fromColor = lastClip.parameters?.colorTo ?? (layer?.fillColor ?? 0xffffff)
                                
                                const newClipId = timeline.addTemplateClip(selectedLayerId, 'color', newStart, 1000, {
                                  colorFrom: fromColor,
                                  colorTo: 0xFFFFFF,
                                  colorEasing: 'linear'
                                })
                                
                                // Expand the panel
                                setExpandedSections(prev => new Set(prev).add('color'))
                                if (newClipId) bringClipToFront(newClipId)
                                onPushSnapshot?.()
                              }
                            }}
                          >
                            <svg viewBox="0 0 24 24" className="w-3 h-3 text-violet-400" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Panels container - uses flex and order for dynamic ordering */}
                  <div className="flex flex-col">
                  
                  {/* Color Clips */}
                  {selectedLayerId && templateClips.filter(c => c.layerId === selectedLayerId && c.template === 'color').map((clip, i) => (
                    <div key={clip.id} style={{ order: clipOrder.indexOf(clip.id) >= 0 ? clipOrder.indexOf(clip.id) : 99 }}>
                      <ColorClipItem
                        clip={clip}
                        index={i}
                        timeline={timeline}
                      />
                    </div>
                  ))}

                  {/* Resize Clips */}
                  {selectedLayerId && templateClips.filter(c => c.layerId === selectedLayerId && c.template === 'resize').map((clip, i) => (
                    <div key={clip.id} style={{ order: clipOrder.indexOf(clip.id) >= 0 ? clipOrder.indexOf(clip.id) : 99 }}>
                      <ResizeClipItem
                        clip={clip}
                        index={i}
                        timeline={timeline}
                      />
                    </div>
                  ))}

                  {/* Rotation Clips */}
                  {selectedLayerId && templateClips.filter(c => c.layerId === selectedLayerId && c.template === 'rotate').map((clip, i) => (
                    <div key={clip.id} style={{ order: clipOrder.indexOf(clip.id) >= 0 ? clipOrder.indexOf(clip.id) : 99 }}>
                      <RotateClipItem
                        clip={clip}
                        index={i}
                        timeline={timeline}
                      />
                    </div>
                  ))}
                  
                  </div>
                  {/* End of flex container for dynamic panel ordering */}
                  
                  {/* Coming soon notice - show when no custom animations are applied */}
                  {selectedLayerId && !templateClips.some(c => c.layerId === selectedLayerId && ['color', 'resize', 'rotate'].includes(c.template)) && (
                  <div className="mt-6 p-4 rounded-xl border border-violet-500/20 bg-violet-500/5">
                    <div className="flex items-center gap-2 mb-2">
                      <svg viewBox="0 0 24 24" className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v20m10-10H2" />
                      </svg>
                      <span className="text-[11px] font-semibold text-violet-300">Keyframe Editor</span>
                    </div>
                    <p className="text-[10px] text-neutral-400">
                      Add keyframes on the timeline below to create custom animations. Click and drag layer properties to animate.
                    </p>
                  </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </aside>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex flex-col relative min-w-0 h-[50vh] md:h-full order-1 md:order-none z-0">
          
          {/* Floating Navigation Tabs */}
          <div className="absolute top-1 left-1/2 -translate-x-1/2 z-40 flex items-center justify-center max-w-[calc(100%-32px)]">
            <div className="flex items-center gap-1 p-1 rounded-full bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50 ring-1 ring-white/5 overflow-x-auto no-scrollbar max-w-full">
              {['templates', 'animations', 'effects', 'shapes', 'transitions', 'custom'].map((tab) => (
                <button
                   key={tab}
                   onClick={() => {
                     setActiveTab(tab as typeof activeTab)
                     // Auto-open left sidebar on mobile when clicking a tab
                     setIsMobileLeftOpen(true)
                   }}
                   className={cn(
                     "whitespace-nowrap px-4 py-1.5 text-[11px] font-medium rounded-full transition-all duration-200 capitalize shrink-0 leading-none",
                     activeTab === tab
                       ? "bg-violet-500 text-white shadow-sm shadow-violet-500/20"
                       : "text-neutral-400 hover:text-white hover:bg-white/5"
                   )}
                >
                  {tab}
                </button>
             ))}
            </div>
          </div>
          


        {/* Center Canvas Area */}
      <main
        className="relative flex flex-1 flex-col overflow-visible bg-[#050505]"
      >
            {/* Toolbar - commented out for later refinement */}
            {/* <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0a0a0a]/80 px-2 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors">
                    <MousePointer2 className="h-4 w-4" />
                </Button>
                <div className="h-4 w-px bg-white/10 mx-1" />
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "h-8 w-8 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors",
                    showBackgroundPanel ? "bg-white/10 text-white" : ""
                  )}
                  onClick={() => setShowBackgroundPanel((open) => !open)}
                  aria-pressed={showBackgroundPanel}
                  aria-label="Background settings"
                >
                    <Layers className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors">
                    <Zap className="h-4 w-4" />
                </Button>
            </div> */}

            {showBackgroundPanel && (
              <div className="absolute top-16 left-1/2 z-40 w-[360px] -translate-x-1/2 rounded-xl border border-white/10 bg-[#0a0a0a]/95 p-4 shadow-[0_12px_45px_rgba(0,0,0,0.45)] backdrop-blur-md">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Background</div>
                  <div className="flex gap-1">
                    <button
                      className={cn(
                        "px-2 py-1 text-[11px] rounded-md border border-white/10 text-neutral-300 hover:text-white hover:border-white/30 transition-colors",
                        background.mode === 'solid' && "bg-white/10 text-white border-white/30"
                      )}
                      onClick={() => updateBackground({ mode: 'solid' })}
                    >
                      Solid
                    </button>
                    <button
                      className={cn(
                        "px-2 py-1 text-[11px] rounded-md border border-white/10 text-neutral-300 hover:text-white hover:border-white/30 transition-colors",
                        background.mode === 'gradient' && "bg-white/10 text-white border-white/30"
                      )}
                      onClick={() => updateBackground({ mode: 'gradient' })}
                    >
                      Gradient
                    </button>
                  </div>
                </div>

                {background.mode === 'solid' ? (
                  <div className="grid grid-cols-[auto,1fr] items-center gap-3">
                    <input
                      type="color"
                      value={background.solid}
                      onChange={(e) => updateBackground({ solid: normalizeHex(e.target.value) })}
                      className="h-10 w-10 cursor-pointer rounded border border-white/10 bg-transparent p-0"
                      aria-label="Solid background color"
                    />
                    <input
                      type="text"
                      value={background.solid}
                      onChange={(e) => updateBackground({ solid: normalizeHex(e.target.value) })}
                      className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white outline-none transition-colors placeholder:text-neutral-500 focus:border-white/30"
                      placeholder="#0f0f0f"
                    />
                  </div>
                ) : (
                  <div className="grid gap-3">
                    <div className="grid grid-cols-[auto,1fr] items-center gap-3">
                      <input
                        type="color"
                        value={background.from}
                        onChange={(e) => updateBackground({ from: normalizeHex(e.target.value) })}
                        className="h-10 w-10 cursor-pointer rounded border border-white/10 bg-transparent p-0"
                        aria-label="Gradient start color"
                      />
                      <input
                        type="text"
                        value={background.from}
                        onChange={(e) => updateBackground({ from: normalizeHex(e.target.value) })}
                        className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white outline-none transition-colors placeholder:text-neutral-500 focus:border-white/30"
                        placeholder="#0f172a"
                      />
                    </div>
                    <div className="grid grid-cols-[auto,1fr] items-center gap-3">
                      <input
                        type="color"
                        value={background.to}
                        onChange={(e) => updateBackground({ to: normalizeHex(e.target.value) })}
                        className="h-10 w-10 cursor-pointer rounded border border-white/10 bg-transparent p-0"
                        aria-label="Gradient end color"
                      />
                      <input
                        type="text"
                        value={background.to}
                        onChange={(e) => updateBackground({ to: normalizeHex(e.target.value) })}
                        className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white outline-none transition-colors placeholder:text-neutral-500 focus:border-white/30"
                        placeholder="#0b1223"
                        
                      />
                    </div>
                  </div>
                )}

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-neutral-400">
                    <span>Opacity</span>
                    <span className="font-semibold text-white">{Math.round((background.opacity ?? 1) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={background.opacity}
                    onChange={(e) => updateBackground({ opacity: Math.min(1, Math.max(0, parseFloat(e.target.value) || 0)) })}
                    className="w-full accent-white"
                    aria-label="Background opacity"
                  />
                </div>
              </div>
            )}

          <div className="flex flex-1 items-center justify-center p-8 md:p-12 overflow-visible relative">
             {/* Grid Background */}
             <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
             
             {/* Fit to Canvas Button - Floating in top-right (images only) */}
             <AnimatePresence>
               {selectedLayerId && layers.find(l => l.id === selectedLayerId)?.type === 'image' && (
                 <motion.button
                   initial={{ opacity: 0, y: -20 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: -10 }}
                   transition={{ duration: 0.3, ease: "easeOut" }}
                   onClick={() => {
                     const layer = layers.find(l => l.id === selectedLayerId)
                     if (layer) {
                       // Resize to canvas dimensions
                       onUpdateLayerSize?.(selectedLayerId, canvasWidth, canvasHeight)
                       // Center on canvas (positions are normalized 0-1, so center is 0.5, 0.5)
                       onUpdateLayerPosition?.(selectedLayerId, 0.5, 0.5)
                     }
                   }}
                   className="absolute top-14 md:top-4 right-4 z-30 flex items-center gap-2 px-4 py-2 bg-neutral-900/80 backdrop-blur-md border border-white/10 hover:border-purple-500/50 hover:shadow-[0_0_20px_-5px_rgba(168,85,247,0.3)] text-neutral-200 hover:text-white text-xs font-medium rounded-full shadow-2xl group"
                 >
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 text-neutral-400 group-hover:text-purple-400 transition-colors">
                     <rect x="3" y="3" width="18" height="18" rx="2" />
                     <path d="M8 8h8v8H8z" strokeDasharray="2 2" />
                   </svg>
                   Fit to Canvas
                 </motion.button>
               )}
             </AnimatePresence>

             {/* Smooth Path Button - Floating on right side */}
             <AnimatePresence>
               {showSmoothPathButton && (
                 <motion.button
                   initial={{ opacity: 0, x: 20 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: 20 }}
                   transition={{ duration: 0.3, ease: "easeOut" }}
                   onClick={() => onSmoothPath?.()}
                   className="absolute top-28 md:top-16 right-4 z-30 flex items-center gap-2 px-4 py-2 bg-green-600/90 backdrop-blur-md border border-green-400/30 hover:border-green-400/60 hover:shadow-[0_0_20px_-5px_rgba(34,197,94,0.4)] text-white text-xs font-medium rounded-full shadow-2xl group"
                 >
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                     <path d="M4 20C8 12 12 8 20 4" strokeLinecap="round" />
                   </svg>
                   Smooth Path
                 </motion.button>
               )}
             </AnimatePresence>
             
             {/* MotionCanvas - Fills entire workspace */}
              <div 
                ref={canvasContainerRef}
                className="absolute inset-0"
                style={{ touchAction: 'none' }}
                onPointerDown={handleBackgroundClick}
                 onDoubleClick={() => {
                   // Double-click on empty canvas = center viewport (helps when user is "lost")
                   setCanvasX(0)
                   setCanvasY(0)
                 }}
              >
                {/* Background is now rendered via PIXI in MotionCanvas */}

                {/* Viewport grid */}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    width: canvasWidth,
                    height: canvasHeight,
                    left: `calc(50% + ${canvasX}px)`,
                    top: `calc(50% + ${canvasY}px)`,
                    transform: 'translate(-50%, -50%)',
                    backgroundImage:
                      'linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)',
                    backgroundSize: '32px 32px',
                    opacity: 0.6,
                    zIndex: 1,
                  }}
                />

               {React.Children.map(children, child => {
                 if (React.isValidElement(child)) {
                   // @ts-ignore - We know MotionCanvas accepts these props
                   return React.cloneElement(child, { offsetX: canvasX, offsetY: canvasY, viewportWidth: canvasWidth, viewportHeight: canvasHeight })
                 }
                 return child
               })}
             </div>

             {/* Viewport Overlay - Purple box that shows what will be rendered */}
             <div
               data-canvas-container
               className="absolute overflow-visible shadow-[0_0_100px_-20px_rgba(0,0,0,0.7)] z-10 pointer-events-none"
               style={{
                 width: canvasWidth,
                 height: canvasHeight,
                 left: `calc(50% + ${canvasX}px)`,
                 top: `calc(50% + ${canvasY}px)`,
                 transform: 'translate(-50%, -50%)',
               }}
             >
               {/* Canvas Label */}
               <div
                 data-canvas-label
                 className="hidden md:flex absolute -top-10 left-0 flex-col cursor-pointer select-none pointer-events-auto z-20"
                 onClick={handleLabelClick}
                 onPointerDown={handleLabelPointerDown}
               >
                 <div className="flex items-center gap-2">
                   <Play className={`h-3.5 w-3.5 ${isCanvasSelected ? 'text-purple-400' : 'text-neutral-500'}`} />
                   <span className={`text-sm font-medium ${isCanvasSelected ? 'text-purple-300' : 'text-neutral-500'}`}>Canvas</span>
                 </div>
                 <span className="text-[10px] text-neutral-500 ml-5">{canvasWidth}×{canvasHeight}</span>
               </div>
               
               {/* Aspect Ratio Presets - Right side */}
               <div className="hidden md:flex absolute -top-7 right-0 items-center gap-1 select-none pointer-events-auto z-20">
                 {[
                   { label: '9:16', width: 270, height: 480 },
                   { label: '16:9', width: 640, height: 360 },
                   { label: '4:3', width: 533, height: 400 },
                   { label: '1:1', width: 450, height: 450 },
                 ].map((preset) => (
                   <button
                     key={preset.label}
                     onClick={() => {
                       setCanvasWidth(preset.width)
                       setCanvasHeight(preset.height)
                       localStorage.setItem('canvasWidth', preset.width.toString())
                       localStorage.setItem('canvasHeight', preset.height.toString())
                     }}
                     className={cn(
                       "px-2 py-0.5 text-[10px] font-medium rounded transition-all",
                       canvasWidth === preset.width && canvasHeight === preset.height
                         ? "bg-purple-500/30 text-purple-300 border border-purple-500/50"
                         : "bg-white/5 text-neutral-400 border border-white/10 hover:bg-white/10 hover:text-neutral-200"
                     )}
                   >
                     {preset.label}
                   </button>
                 ))}
               </div>

               {/* Viewport Frame - Visual border only, clicks pass through */}
               <div
                 data-canvas-clickable
                 className={`relative w-full h-full border ${isCanvasSelected ? 'border-purple-500' : 'border-white/20'} pointer-events-none`}
                 style={{
                   transition: 'border-color 200ms ease',
                 }}
               />

               {/* Resize Handles - Only show when selected */}
               {isCanvasSelected && (
                 <>
                   {/* Corner Circles */}
                   <div
                     data-resize-handle
                     className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-purple-500 rounded-full cursor-nwse-resize z-20 pointer-events-auto"
                     onPointerDown={(e) => startCanvasResize(e, 'nw')}
                   />
                   <div
                     data-resize-handle
                     className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-purple-500 rounded-full cursor-nesw-resize z-20 pointer-events-auto"
                     onPointerDown={(e) => startCanvasResize(e, 'ne')}
                   />
                   <div
                     data-resize-handle
                     className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-purple-500 rounded-full cursor-nesw-resize z-20 pointer-events-auto"
                     onPointerDown={(e) => startCanvasResize(e, 'sw')}
                   />
                   <div
                     data-resize-handle
                     className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-purple-500 rounded-full cursor-nwse-resize z-20 pointer-events-auto"
                     onPointerDown={(e) => startCanvasResize(e, 'se')}
                   />

                   {/* Edge Circles */}
                   <div
                     data-resize-handle
                     className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-purple-500 rounded-full cursor-ns-resize z-20 pointer-events-auto"
                     onPointerDown={(e) => startCanvasResize(e, 'n')}
                   />
                   <div
                     data-resize-handle
                     className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-purple-500 rounded-full cursor-ns-resize z-20 pointer-events-auto"
                     onPointerDown={(e) => startCanvasResize(e, 's')}
                   />
                   <div
                     data-resize-handle
                     className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-purple-500 rounded-full cursor-ew-resize z-20 pointer-events-auto"
                     onPointerDown={(e) => startCanvasResize(e, 'w')}
                   />
                   <div
                     data-resize-handle
                     className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-purple-500 rounded-full cursor-ew-resize z-20 pointer-events-auto"
                     onPointerDown={(e) => startCanvasResize(e, 'e')}
                   />
                 </>
               )}
             </div>
          </div>
        </main>
      </div>

      {/* Timeline Panel - Mobile: Stacked, fixed height or auto */}


        {/* RIGHT PROPERTIES PANEL - Mobile: Off-screen Drawer (Right) | Desktop: Fixed (Right) */}
      {/* Right Sidebar Wrapper */}
      <div className={cn(
        "fixed md:relative inset-y-0 right-0 z-[70] w-[280px] md:w-auto h-full bg-[#0a0a0a] flex flex-col border-l border-white/5 transition-transform duration-300 order-last shadow-2xl md:shadow-none",
        isMobileRightOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
      )}>
        
        {/* Resize Handle - Positioned on the left edge */}
        <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-violet-500/50 active:bg-violet-500/50 transition-colors z-50 -translate-x-1/2"
            onMouseDown={startRightSidebarResize}
        />

        <aside 
            ref={rightSidebarRef}
            style={{ width: rightSidebarWidth }}
            className="relative w-full h-full flex flex-col gap-6 overflow-y-auto overscroll-contain p-4 pb-96 min-h-0"
        >


          {/* Background Settings */}
          <div className="mb-6 space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400">Background</span>
              <button 
                onClick={() => setIsBackgroundPanelCollapsed(!isBackgroundPanelCollapsed)}
                className="text-neutral-500 hover:text-white transition-colors p-1"
                aria-label={isBackgroundPanelCollapsed ? "Expand background panel" : "Collapse background panel"}
              >
                {isBackgroundPanelCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
            </div>
            
            {!isBackgroundPanelCollapsed && (
              <>
            {/* Mode buttons - Segmented Control Look */}
            <div className="grid grid-cols-4 bg-neutral-900 rounded-lg p-1 border border-white/5 gap-0.5">
              <button
                className={cn(
                  "flex items-center justify-center py-1.5 px-0.5 text-[10px] font-medium rounded-md transition-all",
                  background.mode === 'transparent' 
                    ? "bg-white/10 text-white shadow-sm" 
                    : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                )}
                onClick={() => updateBackground({ mode: 'transparent' })}
              >
                None
              </button>
              <button
                className={cn(
                  "flex items-center justify-center py-1.5 px-0.5 text-[10px] font-medium rounded-md transition-all",
                  background.mode === 'solid' 
                    ? "bg-white/10 text-white shadow-sm" 
                    : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                )}
                onClick={() => updateBackground({ mode: 'solid' })}
              >
                Solid
              </button>
              <button
                className={cn(
                  "flex items-center justify-center py-1.5 px-0.5 text-[10px] font-medium rounded-md transition-all",
                  background.mode === 'gradient' 
                    ? "bg-white/10 text-white shadow-sm" 
                    : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                )}
                onClick={() => updateBackground({ mode: 'gradient' })}
              >
                Gradient
              </button>
              <button
                className={cn(
                  "flex items-center justify-center py-1.5 px-0.5 text-[10px] font-medium rounded-md transition-all",
                  background.mode === 'image' 
                    ? "bg-white/10 text-white shadow-sm" 
                    : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                )}
                onClick={() => updateBackground({ mode: 'image', imageMode: background.imageMode || 'cover' })}
              >
                Image
              </button>
            </div>
            
            {/* Color inputs based on mode */}
            {background.mode === 'solid' && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2 bg-neutral-900 p-1.5 rounded-lg border border-white/5">
                  <div className="relative w-8 h-8 rounded shrink-0 overflow-hidden border border-white/10 group">
                    <input
                      type="color"
                      value={background.solid}
                      onChange={(e) => updateBackground({ solid: normalizeHex(e.target.value) })}
                      className="absolute inset-0 w-[200%] h-[200%] -top-[50%] -left-[50%] p-0 m-0 cursor-pointer opacity-0"
                    />
                    <div 
                      className="absolute inset-0 pointer-events-none"
                      style={{ backgroundColor: background.solid }}
                    />
                  </div>
                  <input
                    type="text"
                    value={background.solid}
                    onChange={(e) => updateBackground({ solid: normalizeHex(e.target.value) })}
                    className="flex-1 bg-transparent text-neutral-200 text-xs font-mono outline-none uppercase"
                    spellCheck={false}
                  />
                </div>
              </div>
            )}
            
            {background.mode === 'gradient' && (
              <div className="space-y-4 pt-1">
                {/* Gradient Type Toggle */}
                <div className="flex bg-neutral-900 rounded-lg p-1 border border-white/5">
                  <button
                    className={cn(
                      "flex-1 py-1.5 px-2 text-[10px] font-medium rounded-md transition-all",
                      (!background.gradientType || background.gradientType === 'linear')
                        ? "bg-white/10 text-white shadow-sm" 
                        : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                    )}
                    onClick={() => updateBackground({ gradientType: 'linear' })}
                  >
                    Linear
                  </button>
                  <button
                    className={cn(
                      "flex-1 py-1.5 px-2 text-[10px] font-medium rounded-md transition-all",
                      background.gradientType === 'radial' 
                        ? "bg-white/10 text-white shadow-sm" 
                        : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                    )}
                    onClick={() => updateBackground({ gradientType: 'radial' })}
                  >
                    Radial
                  </button>
                </div>

                {/* Intensity Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Intensity</span>
                    <span className="text-[10px] font-mono text-neutral-400">{Math.round((background.opacity ?? 1) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={background.opacity ?? 1}
                    onChange={(e) => updateBackground({ opacity: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white hover:[&::-webkit-slider-thumb]:scale-110 transition-all"
                  />
                </div>

                {/* Balance Slider - Controls gradient position */}
                <div className="space-y-2">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wider px-1">Balance</span>
                  <div className="flex items-center gap-2">
                    {/* From color swatch */}
                    <div 
                      className="w-4 h-4 rounded shrink-0 border border-white/10"
                      style={{ backgroundColor: background.from }}
                    />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={background.gradientPosition ?? 0.5}
                      onChange={(e) => updateBackground({ gradientPosition: parseFloat(e.target.value) })}
                      className="flex-1 h-1.5 bg-neutral-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white hover:[&::-webkit-slider-thumb]:scale-110 transition-all"
                    />
                    {/* To color swatch */}
                    <div 
                      className="w-4 h-4 rounded shrink-0 border border-white/10"
                      style={{ backgroundColor: background.to }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] text-neutral-500">From</span>
                  </div>
                  <div className="flex items-center gap-2 bg-neutral-900 p-1.5 rounded-lg border border-white/5">
                    <div className="relative w-8 h-8 rounded shrink-0 overflow-hidden border border-white/10">
                      <input
                        type="color"
                        value={background.from}
                        onChange={(e) => updateBackground({ from: normalizeHex(e.target.value) })}
                        className="absolute inset-0 w-[200%] h-[200%] -top-[50%] -left-[50%] p-0 m-0 cursor-pointer opacity-0"
                      />
                      <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{ backgroundColor: background.from }}
                      />
                    </div>
                    <input
                      type="text"
                      value={background.from}
                      onChange={(e) => updateBackground({ from: normalizeHex(e.target.value) })}
                      className="flex-1 bg-transparent text-neutral-200 text-xs font-mono outline-none uppercase"
                      spellCheck={false}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] text-neutral-500">To</span>
                  </div>
                  <div className="flex items-center gap-2 bg-neutral-900 p-1.5 rounded-lg border border-white/5">
                    <div className="relative w-8 h-8 rounded shrink-0 overflow-hidden border border-white/10">
                      <input
                        type="color"
                        value={background.to}
                        onChange={(e) => updateBackground({ to: normalizeHex(e.target.value) })}
                        className="absolute inset-0 w-[200%] h-[200%] -top-[50%] -left-[50%] p-0 m-0 cursor-pointer opacity-0"
                      />
                      <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{ backgroundColor: background.to }}
                      />
                    </div>
                    <input
                      type="text"
                      value={background.to}
                      onChange={(e) => updateBackground({ to: normalizeHex(e.target.value) })}
                      className="flex-1 bg-transparent text-neutral-200 text-xs font-mono outline-none uppercase"
                      spellCheck={false}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {/* Image background controls */}
            {background.mode === 'image' && (
              <div className="space-y-3 pt-2">
                {/* Image upload area */}
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = (event) => {
                          updateBackground({ image: event.target?.result as string })
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                  />
                  {background.image ? (
                    <div className="relative rounded-lg overflow-hidden border border-white/10 bg-neutral-900">
                      <img 
                        src={background.image} 
                        alt="Background preview" 
                        className="w-full h-24 object-cover"
                      />
                      <button
                        className="absolute top-1 right-1 p-1 bg-black/60 rounded hover:bg-red-500/80 transition-colors z-20"
                        onClick={(e) => {
                          e.stopPropagation()
                          updateBackground({ image: undefined })
                        }}
                      >
                        <X size={12} className="text-white" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 py-6 rounded-lg border border-dashed border-white/20 bg-neutral-900/50 hover:bg-neutral-800/50 transition-colors">
                      <ImageIcon size={20} className="text-neutral-500" />
                      <span className="text-[10px] text-neutral-500">Click to upload image</span>
                    </div>
                  )}
                </div>

                {/* AI Background Generation */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-[9px] text-neutral-500 uppercase tracking-wider">or generate with AI</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                  <input
                    type="text"
                    value={bgPrompt}
                    onChange={(e) => setBgPrompt(e.target.value)}
                    placeholder="Describe your background..."
                    className="w-full px-3 py-2 text-xs bg-neutral-900 border border-white/10 rounded-lg text-white placeholder:text-neutral-500 focus:outline-none focus:border-purple-500/50"
                  />
                  <button
                    disabled={!bgPrompt.trim() || bgGenerating}
                    onClick={async () => {
                      if (!bgPrompt.trim()) return
                      setBgGenerating(true)
                      try {
                        // Only include baseImage if it's a valid data URL
                        const isValidBaseImage = background.image && background.image.startsWith('data:image/')
                        const res = await fetch('/api/gemini/generate-image', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ 
                            prompt: bgPrompt,
                            baseImage: isValidBaseImage ? background.image : undefined
                          })
                        })
                        const data = await res.json()
                        if (!res.ok) {
                          // Handle rate limit specifically
                          if (res.status === 429) {
                            showToast(data.message || 'Rate limit exceeded. Try again later.', 'warning')
                            return
                          }
                          throw new Error(data.error || 'Generation failed')
                        }
                        if (data.imageUrl) {
                          // imageUrl is already a complete data URL from the API
                          updateBackground({ image: data.imageUrl })
                          setBgPrompt('') // Clear prompt on success
                        }
                      } catch (err) {
                        showToast(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error')
                      } finally {
                        setBgGenerating(false)
                      }
                    }}
                    className={cn(
                      "w-full py-2 px-3 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-2",
                      bgGenerating 
                        ? "bg-purple-500/30 text-purple-300 cursor-wait"
                        : bgPrompt.trim()
                          ? "bg-purple-500 hover:bg-purple-400 text-white"
                          : "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                    )}
                  >
                    {bgGenerating ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        Generating...
                      </>
                    ) : background.image ? (
                      <>✨ Modify Background</>
                    ) : (
                      <>✨ Generate Background</>
                    )}
                  </button>
                </div>

                {/* Image mode selector */}
                {background.image && (
                  <div className="space-y-2">
                    <span className="text-[10px] text-neutral-500">Fit Mode</span>
                    <div className="flex bg-neutral-900 rounded-lg p-1 border border-white/5">
                      <button
                        className={cn(
                          "flex-1 py-1.5 px-2 text-[10px] font-medium rounded-md transition-all",
                          background.imageMode === 'cover' 
                            ? "bg-white/10 text-white shadow-sm" 
                            : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                        )}
                        onClick={() => updateBackground({ imageMode: 'cover' })}
                      >
                        Cover
                      </button>
                      <button
                        className={cn(
                          "flex-1 py-1.5 px-2 text-[10px] font-medium rounded-md transition-all",
                          background.imageMode === 'contain' 
                            ? "bg-white/10 text-white shadow-sm" 
                            : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                        )}
                        onClick={() => updateBackground({ imageMode: 'contain' })}
                      >
                        Contain
                      </button>
                      <button
                        className={cn(
                          "flex-1 py-1.5 px-2 text-[10px] font-medium rounded-md transition-all",
                          background.imageMode === 'stretch' 
                            ? "bg-white/10 text-white shadow-sm" 
                            : "text-neutral-500 hover:text-neutral-300 hover:bg-white/5"
                        )}
                        onClick={() => updateBackground({ imageMode: 'stretch' })}
                      >
                        Stretch
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
              </>
            )}
          </div>

          {selectedLayerId && (
            <div className="mb-6 space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-400">Transform</span>
                <button 
                  onClick={() => setIsTransformPanelCollapsed(!isTransformPanelCollapsed)}
                  className="text-neutral-500 hover:text-white transition-colors p-1"
                  aria-label={isTransformPanelCollapsed ? "Expand transform panel" : "Collapse transform panel"}
                >
                  {isTransformPanelCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
              </div>
              
              {!isTransformPanelCollapsed && (
                <>
              {/* Size */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase text-neutral-500">Size</span>
                <div className="flex gap-2">
                  <BufferedInput
                    value={layers.find(l => l.id === selectedLayerId)?.width ?? 100}
                    onCommit={(val) => {
                      if (!selectedLayerId) return
                      const layer = layers.find(l => l.id === selectedLayerId)
                      onUpdateLayerSize?.(selectedLayerId, val, layer?.height ?? 100)
                    }}
                    label="W"
                  />
                  <BufferedInput
                    value={layers.find(l => l.id === selectedLayerId)?.height ?? 100}
                    onCommit={(val) => {
                      if (!selectedLayerId) return
                      const layer = layers.find(l => l.id === selectedLayerId)
                      onUpdateLayerSize?.(selectedLayerId, layer?.width ?? 100, val)
                    }}
                    label="H"
                  />
                </div>
              </div>

              {/* Angle */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase text-neutral-500">Angle</span>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="-?[0-9]*"
                    defaultValue={String(layers.find(l => l.id === selectedLayerId)?.rotation ?? 0)}
                    key={`angle-${selectedLayerId}`}
                    className="w-full rounded bg-neutral-800 pl-8 pr-2 py-1.5 text-left text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (!selectedLayerId) return
                        const rawVal = e.currentTarget.value.replace(/[^0-9-]/g, '')
                        const val = rawVal === '' || rawVal === '-' ? 0 : parseInt(rawVal)
                        onUpdateLayerRotation?.(selectedLayerId, val)
                        e.currentTarget.blur()
                      }
                    }}
                    onBlur={(e) => {
                      if (!selectedLayerId) return
                      const rawVal = e.currentTarget.value.replace(/[^0-9-]/g, '')
                      const val = rawVal === '' || rawVal === '-' ? 0 : parseInt(rawVal)
                      onUpdateLayerRotation?.(selectedLayerId, val)
                    }}
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500 font-bold">°</span>
                </div>
              </div>

              {/* Color */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase text-neutral-500">Color</span>
                <div className="flex items-center gap-2 w-full">
                  <input
                    type="text"
                    defaultValue={(() => {
                      const c = layers.find(l => l.id === selectedLayerId)?.fillColor ?? 0xffffff
                      return c.toString(16).toUpperCase().padStart(6, '0')
                    })()}
                    key={`color-${selectedLayerId}`}
                    onChange={(e) => {
                      if (!selectedLayerId) return
                      const val = e.target.value.replace(/[^0-9A-Fa-f]/g, '')
                      if (val.length === 6) {
                        const numColor = parseInt(val, 16)
                        onUpdateLayerColor?.(selectedLayerId, numColor)
                      }
                    }}
                    maxLength={6}
                    className="flex-1 min-w-0 rounded bg-neutral-800 px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <input
                    type="color"
                    value={`#${(layers.find(l => l.id === selectedLayerId)?.fillColor ?? 0xffffff).toString(16).padStart(6, '0')}`}
                    onChange={(e) => {
                      if (!selectedLayerId) return
                      const numColor = parseInt(e.target.value.replace('#', ''), 16)
                      onUpdateLayerColor?.(selectedLayerId, numColor)
                    }}
                    className="w-10 h-10 rounded border-2 border-neutral-600 hover:border-purple-500 cursor-pointer transition-colors flex-shrink-0 p-0 bg-transparent"
                  />
                </div>
              </div>

              {/* Text-specific controls - only for text layers (not counters) */}
              {layers.find(l => l.id === selectedLayerId)?.type === 'text' && !layers.find(l => l.id === selectedLayerId)?.isCounter && (
                <>
                  {/* Text Content */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase text-neutral-500">Content</span>
                    <div className="flex gap-2">
                      <textarea
                        id="text-content-input"
                        defaultValue={layers.find(l => l.id === selectedLayerId)?.text || ''}
                        key={selectedLayerId}
                        placeholder="Enter text..."
                        className="flex-1 rounded bg-neutral-800 px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                        rows={2}
                      />
                      <button
                        onClick={() => {
                          if (!selectedLayerId) return
                          const textarea = document.getElementById('text-content-input') as HTMLTextAreaElement
                          if (textarea) {
                            onUpdateLayerText?.(selectedLayerId, textarea.value)
                          }
                        }}
                        className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                  </div>

                  {/* Font Family */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase text-neutral-500">Font</span>
                    <FontPicker
                      value={layers.find(l => l.id === selectedLayerId)?.fontFamily || 'Inter'}
                      onChange={(fontFamily) => {
                        if (!selectedLayerId) return
                        onUpdateLayerFontFamily?.(selectedLayerId, fontFamily)
                      }}
                    />
                  </div>

                  {/* Font Size */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase text-neutral-500">Font Size</span>
                    <BufferedInput
                      value={layers.find(l => l.id === selectedLayerId)?.fontSize || 48}
                      onCommit={(val) => {
                        if (!selectedLayerId) return
                        onUpdateLayerFontSize?.(selectedLayerId, val)
                      }}
                      label="px"
                    />
                  </div>
                </>
              )}
                </>
              )}
            </div>
          )}



          {/* Counter Controls - Only show for counter layers */}
          {selectedLayerId && layers.find(l => l.id === selectedLayerId)?.isCounter && (
            <div className="mb-6 space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-400">Counter</span>
              </div>
              
              {/* Start Value */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase text-neutral-500">Start Value</span>
                <input
                  type="number"
                  value={layers.find(l => l.id === selectedLayerId)?.counterStart ?? 0}
                  onChange={(e) => {
                    if (!selectedLayerId) return
                    onUpdateCounterStart?.(selectedLayerId, parseNum(e.target.value))
                  }}
                  className="w-full rounded bg-neutral-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* End Value */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase text-neutral-500">End Value</span>
                <input
                  type="number"
                  value={layers.find(l => l.id === selectedLayerId)?.counterEnd ?? 100}
                  onChange={(e) => {
                    if (!selectedLayerId) return
                    onUpdateCounterEnd?.(selectedLayerId, parseNum(e.target.value))
                  }}
                  className="w-full rounded bg-neutral-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Currency Prefix */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase text-neutral-500">Currency Prefix</span>
                <select
                  value={layers.find(l => l.id === selectedLayerId)?.counterPrefix ?? ''}
                  onChange={(e) => {
                    if (!selectedLayerId) return
                    onUpdateCounterPrefix?.(selectedLayerId, e.target.value)
                  }}
                  className="w-full rounded bg-neutral-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="">None</option>
                  <option value="$">$ (USD)</option>
                  <option value="€">€ (EUR)</option>
                  <option value="£">£ (GBP)</option>
                  <option value="¥">¥ (JPY/CNY)</option>
                  <option value="₹">₹ (INR)</option>
                  <option value="₩">₩ (KRW)</option>
                </select>
              </div>

              {/* Font Size */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase text-neutral-500">Font Size</span>
                <input
                  type="number"
                  min="12"
                  max="500"
                  value={layers.find(l => l.id === selectedLayerId)?.fontSize ?? 72}
                  onChange={(e) => {
                    if (!selectedLayerId) return
                    onUpdateLayerFontSize?.(selectedLayerId, parseNum(e.target.value))
                  }}
                  className="w-full rounded bg-neutral-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <p className="text-[10px] text-neutral-500 italic">
                Drag the purple bar to adjust duration. Counter will count {(layers.find(l => l.id === selectedLayerId)?.counterStart ?? 0) > (layers.find(l => l.id === selectedLayerId)?.counterEnd ?? 100) ? 'down' : 'up'}.
              </p>
            </div>
          )}


          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-neutral-200 px-2">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Controls
            </div>
            
            {/* Duration Control - Show if a clip is selected, but NOT for templates that have their own duration slider */}
            {selectedClipDuration !== undefined && !['pulse', 'shake', 'spin', 'counter', 'pan_zoom', 'mask_center', 'mask_top', 'mask_center_out', 'mask_top_out'].includes(selectedTemplate) && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-neutral-200">
                    {selectedTemplate === 'jump' ? 'Jump Height' : 'Duration'}
                  </span>
                  <span className="text-[10px] text-neutral-400">
                    {selectedTemplate === 'jump' 
                      ? jumpHeight.toFixed(2)
                      : `${(selectedClipDuration / 1000).toFixed(2)}s`
                    }
                  </span>
                </div>
                <input
                  type="range"
                  min={100}
                  max={5000}
                  step={100}
                  value={selectedClipDuration}
                  onChange={(e) => onClipDurationChange?.(parseNum(e.target.value))}
                  className="w-full accent-violet-500"
                />
              </div>
            )}
            {selectedTemplate === 'roll' && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-neutral-200">Roll Speed</span>
                    <span className="text-[10px] text-neutral-400">{templateSpeed.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={3}
                    step={0.05}
                    value={templateSpeed}
                    onChange={(e) => onTemplateSpeedChange?.(parseNum(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2 mt-1">
                    <span className="text-[11px] font-semibold text-neutral-200">Roll Distance</span>
                    <span className="text-[10px] text-neutral-400">{rollDistance.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.01}
                    value={rollDistance}
                    onChange={(e) => onRollDistanceChange?.(parseNum(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2 mt-1">
                    <span className="text-[11px] font-semibold text-neutral-200">Rotation</span>
                    <span className="text-[10px] text-neutral-400">{rollRotation?.toFixed(1) ?? '2.0'} rotations</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={0.5}
                    value={rollRotation ?? 2}
                    onChange={(e) => onRollRotationChange?.(parseNum(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
              </>
            )}
            {selectedTemplate === 'pop' && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-neutral-200">Scale</span>
                    <span className="text-[10px] text-neutral-400">{popScale.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.05}
                    value={popScale}
                    onChange={(e) => onPopScaleChange?.(parseNum(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2 mt-2">
                    <span className="text-[11px] font-semibold text-neutral-200">Speed</span>
                    <span className="text-[10px] text-neutral-400">{popSpeed.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={3}
                    step={0.05}
                    value={popSpeed}
                    onChange={(e) => onPopSpeedChange?.(parseNum(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] font-semibold text-neutral-200">Collapse</span>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={popCollapse}
                      onChange={(e) => onPopCollapseChange?.(e.target.checked)}
                    />
                    <div className="peer h-4 w-7 rounded-full bg-neutral-700 peer-checked:bg-violet-500 transition-colors" />
                    <div className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-3" />
                  </label>
                </div>
              </>
            )}
            {selectedTemplate === 'shake' && (
              <>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-neutral-200">Intensity</span>
                    <span className="text-[10px] text-neutral-400">{shakeDistance}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={shakeDistance}
                    onChange={(e) => onShakeDistanceChange?.(parseNum(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-neutral-200">Duration</span>
                    <span className="text-[10px] text-neutral-400">{((selectedClipDuration ?? 500) / 1000).toFixed(2)}s</span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={3000}
                    step={50}
                    value={selectedClipDuration ?? 500}
                    onChange={(e) => onClipDurationChange?.(parseNum(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-neutral-200">Speed</span>
                    <span className="text-[10px] text-neutral-400">{templateSpeed?.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={4}
                    step={0.1}
                    value={templateSpeed}
                    onChange={(e) => onTemplateSpeedChange?.(parseNum(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
              </>
            )}
            {selectedTemplate === 'pulse' && (
              <>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-neutral-200">Scale Amount</span>
                    <span className="text-[10px] text-neutral-400">+{(pulseScale * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.01}
                    value={pulseScale}
                    onChange={(e) => onPulseScaleChange?.(parseNum(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-neutral-200">Speed</span>
                    <span className="text-[10px] text-neutral-400">{pulseSpeed.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={5}
                    step={0.1}
                    value={pulseSpeed}
                    onChange={(e) => onPulseSpeedChange?.(parseNum(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-neutral-200">Duration</span>
                    <span className="text-[10px] text-neutral-400">{((selectedClipDuration ?? 800) / 1000).toFixed(2)}s</span>
                  </div>
                  <input
                    type="range"
                    min={200}
                    max={4000}
                    step={50}
                    value={selectedClipDuration ?? 800}
                    onChange={(e) => onClipDurationChange?.(parseNum(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
              </>
            )}
            {selectedTemplate === 'spin' && (
              <>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-neutral-200">Speed</span>
                    <span className="text-[10px] text-neutral-400">{spinSpeed.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={10}
                    step={0.1}
                    value={spinSpeed}
                    onChange={(e) => onSpinSpeedChange?.(parseNum(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-neutral-200">Direction</span>
                    <span className="text-[10px] text-neutral-400">{spinDirection === 1 ? 'CW' : 'CCW'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSpinDirectionChange?.(1)}
                      className={`flex-1 rounded-md border px-3 py-1 text-[11px] font-semibold ${
                        spinDirection === 1 ? 'border-violet-500 text-violet-400 bg-violet-500/10' : 'border-white/10 text-neutral-300 hover:bg-white/5'
                      }`}
                    >
                      CW
                    </button>
                    <button
                      onClick={() => onSpinDirectionChange?.(-1)}
                      className={`flex-1 rounded-md border px-3 py-1 text-[11px] font-semibold ${
                        spinDirection === -1 ? 'border-violet-500 text-violet-400 bg-violet-500/10' : 'border-white/10 text-neutral-300 hover:bg-white/5'
                      }`}
                    >
                      CCW
                    </button>
                  </div>
                </div>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-neutral-200">Duration</span>
                    <span className="text-[10px] text-neutral-400">{((selectedClipDuration ?? 1200) / 1000).toFixed(2)}s</span>
                  </div>
                  <input
                    type="range"
                    min={200}
                    max={4000}
                    step={50}
                    value={selectedClipDuration ?? 1200}
                    onChange={(e) => onClipDurationChange?.(parseNum(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
              </>
            )}
            {selectedTemplate === 'counter' && (
              <>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-neutral-200">Start Value</span>
                  </div>
                  <input
                    type="number"
                    defaultValue={0}
                    className="w-full bg-neutral-800 border border-white/10 rounded-md px-2 py-1 text-[11px] text-white"
                    onChange={(e) => {
                      const clip = templateClips.find(c => c.id === selectedClipId)
                      if (clip && selectedLayerId) {
                        timeline.updateTemplateClip(selectedLayerId, selectedClipId!, {
                          parameters: { ...clip.parameters, counterStart: parseNum(e.target.value) }
                        })
                      }
                    }}
                  />
                </div>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-neutral-200">End Value</span>
                  </div>
                  <input
                    type="number"
                    defaultValue={100}
                    className="w-full bg-neutral-800 border border-white/10 rounded-md px-2 py-1 text-[11px] text-white"
                    onChange={(e) => {
                      const clip = templateClips.find(c => c.id === selectedClipId)
                      if (clip && selectedLayerId) {
                        timeline.updateTemplateClip(selectedLayerId, selectedClipId!, {
                          parameters: { ...clip.parameters, counterEnd: parseNum(e.target.value) }
                        })
                      }
                    }}
                  />
                </div>
                <div className="mb-4 flex gap-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-neutral-200">Prefix</span>
                    </div>
                    <input
                      type="text"
                      placeholder="$"
                      className="w-full bg-neutral-800 border border-white/10 rounded-md px-2 py-1 text-[11px] text-white"
                      onChange={(e) => {
                        const clip = templateClips.find(c => c.id === selectedClipId)
                        if (clip && selectedLayerId) {
                          timeline.updateTemplateClip(selectedLayerId, selectedClipId!, {
                            parameters: { ...clip.parameters, counterPrefix: e.target.value }
                          })
                        }
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-neutral-200">Suffix</span>
                    </div>
                    <input
                      type="text"
                      placeholder="+"
                      className="w-full bg-neutral-800 border border-white/10 rounded-md px-2 py-1 text-[11px] text-white"
                      onChange={(e) => {
                        const clip = templateClips.find(c => c.id === selectedClipId)
                        if (clip && selectedLayerId) {
                          timeline.updateTemplateClip(selectedLayerId, selectedClipId!, {
                            parameters: { ...clip.parameters, counterSuffix: e.target.value }
                          })
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-neutral-200">Duration</span>
                    <span className="text-[10px] text-neutral-400">{((selectedClipDuration ?? 2000) / 1000).toFixed(2)}s</span>
                  </div>
                  <input
                    type="range"
                    min={500}
                    max={10000}
                    step={100}
                    value={selectedClipDuration ?? 2000}
                    onChange={(e) => onClipDurationChange?.(parseNum(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
              </>
            )}
            
            {/* Pan & Zoom Controls */}
            {selectedTemplate === 'pan_zoom' && selectedClipId && (() => {
              const panZoomClip = templateClips.find(c => c.id === selectedClipId && c.template === 'pan_zoom')
              if (!panZoomClip) return null
              const intensity = panZoomClip.parameters?.panZoomIntensity ?? 1.5
              const holdDuration = panZoomClip.parameters?.panZoomHoldDuration ?? 500
              const easing = panZoomClip.parameters?.panZoomEasing ?? 'ease-in-out'
              
              return (
                <>
                  {/* Zoom Intensity */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-neutral-200">Zoom Intensity</span>
                      <span className="text-[10px] text-neutral-400">{intensity.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min={1.1}
                      max={3}
                      step={0.1}
                      value={intensity}
                      onChange={(e) => {
                        if (selectedLayerId) {
                          timeline.updateTemplateClip(selectedLayerId, selectedClipId!, {
                            parameters: { ...panZoomClip.parameters, panZoomIntensity: parseNum(e.target.value) }
                          })
                        }
                      }}
                      className="w-full accent-violet-500"
                    />
                    <div className="flex justify-between text-[9px] text-neutral-500 mt-1">
                      <span>Subtle</span>
                      <span>Intense</span>
                    </div>
                  </div>
                  
                  {/* Hold Duration */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-neutral-200">Hold Duration</span>
                      <span className="text-[10px] text-neutral-400">{holdDuration}ms</span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={5000}
                      step={100}
                      value={holdDuration}
                      onChange={(e) => {
                        if (selectedLayerId) {
                          timeline.updateTemplateClip(selectedLayerId, selectedClipId!, {
                            parameters: { ...panZoomClip.parameters, panZoomHoldDuration: parseNum(e.target.value) }
                          })
                        }
                      }}
                      className="w-full bg-neutral-800 border border-white/10 rounded-md px-2 py-1 text-[11px] text-white"
                    />
                  </div>
                  
                  {/* Easing */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-neutral-200">Easing</span>
                    </div>
                    <select
                      value={easing}
                      onChange={(e) => {
                        if (selectedLayerId) {
                          timeline.updateTemplateClip(selectedLayerId, selectedClipId!, {
                            parameters: { ...panZoomClip.parameters, panZoomEasing: e.target.value as 'linear' | 'ease-in-out' | 'smooth' }
                          })
                        }
                      }}
                      className="w-full bg-neutral-800 border border-white/10 rounded-md px-2 py-1.5 text-[11px] text-white"
                    >
                      <option value="linear">Linear</option>
                      <option value="ease-in-out">Ease In Out</option>
                      <option value="smooth">Smooth</option>
                    </select>
                  </div>
                  
                  {/* Duration */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-neutral-200">Duration</span>
                      <span className="text-[10px] text-neutral-400">{((selectedClipDuration ?? 2000) / 1000).toFixed(2)}s</span>
                    </div>
                    <input
                      type="range"
                      min={500}
                      max={6000}
                      step={100}
                      value={selectedClipDuration ?? 2000}
                      onChange={(e) => onClipDurationChange?.(parseNum(e.target.value))}
                      className="w-full accent-violet-500"
                    />
                  </div>
                </>
              )
            })()}
            
            {/* Mask Center Controls */}
            {selectedTemplate === 'mask_center' && selectedClipId && (() => {
              const maskClip = templateClips.find(c => c.id === selectedClipId && c.template === 'mask_center')
              if (!maskClip) return null
              const maskAngle = maskClip.parameters?.maskAngle ?? 0
              
              const presetAngles = [
                { angle: 0, icon: '—', label: 'Horizontal' },
                { angle: 90, icon: '|', label: 'Vertical' },
                { angle: 45, icon: '╲', label: 'Diagonal' },
                { angle: 135, icon: '╱', label: 'Diagonal' },
              ]
              
              return (
                <>
                  {/* Angle Selection */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-neutral-200">Angle</span>
                      <span className="text-[10px] text-neutral-400">{maskAngle}°</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {presetAngles.map((preset) => (
                        <button
                          key={preset.angle}
                          onClick={() => {
                            if (selectedLayerId) {
                              timeline.updateTemplateClip(selectedLayerId, selectedClipId!, {
                                parameters: { ...maskClip.parameters, maskAngle: preset.angle }
                              })
                            }
                          }}
                          title={preset.label}
                          className={cn(
                            "flex items-center justify-center w-8 h-8 rounded-md border transition-all text-sm font-bold",
                            maskAngle === preset.angle
                              ? "border-violet-500 bg-violet-500/20 text-violet-300"
                              : "border-white/10 bg-white/5 text-neutral-400 hover:bg-white/10 hover:border-violet-500/50"
                          )}
                        >
                          {preset.icon}
                        </button>
                      ))}
                      <input
                        type="text"
                        inputMode="numeric"
                        defaultValue={maskAngle}
                        key={`mask-angle-${selectedClipId}-${maskAngle}`}
                        onBlur={(e) => {
                          if (selectedLayerId) {
                            const v = parseNum(e.target.value, 0) % 360
                            timeline.updateTemplateClip(selectedLayerId, selectedClipId!, {
                              parameters: { ...maskClip.parameters, maskAngle: v }
                            })
                          }
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                        className="w-12 bg-neutral-800 border border-white/10 rounded-md px-2 py-1 text-[11px] text-white text-center focus:outline-none focus:border-violet-500/50"
                      />
                    </div>
                  </div>
                  
                  {/* Duration */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-neutral-200">Duration</span>
                      <span className="text-[10px] text-neutral-400">{((selectedClipDuration ?? 1000) / 1000).toFixed(2)}s</span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={5000}
                      step={100}
                      value={selectedClipDuration ?? 1000}
                      onChange={(e) => onClipDurationChange?.(parseNum(e.target.value))}
                      className="w-full accent-violet-500"
                    />
                  </div>
                </>
              )
            })()}
            
            {/* Slide Transition Controls */}
            {selectedTemplate === 'transition_slide' && selectedClipId && (() => {
              const slideClip = templateClips.find(c => c.id === selectedClipId && c.template === 'transition_slide')
              if (!slideClip) return null
              const direction = slideClip.parameters?.slideDirection ?? 'top'
              
              const directions = [
                { id: 'top', label: 'Top' },
                { id: 'bottom', label: 'Bottom' },
                { id: 'left', label: 'Left' },
                { id: 'right', label: 'Right' },
              ]
              
              return (
                <>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[11px] font-semibold text-neutral-200">Direction</span>
                       <span className="text-[10px] text-neutral-400 capitalize">{direction}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                       {directions.map((d) => (
                         <button
                           key={d.id}
                           onClick={() => {
                             if (selectedLayerId) {
                               timeline.updateTemplateClip(selectedLayerId, selectedClipId!, {
                                 parameters: { ...slideClip.parameters, slideDirection: d.id as any }
                               })
                             }
                           }}
                           className={`rounded-md border px-3 py-2 text-[11px] font-semibold transition-all ${
                             direction === d.id 
                               ? 'border-violet-500 text-violet-400 bg-violet-500/10' 
                               : 'border-white/10 text-neutral-300 hover:bg-white/5'
                           }`}
                         >
                           {d.label}
                         </button>
                       ))}
                    </div>
                  </div>
                </>
              )
            })()}

            {/* Mask Top Controls */}
            {selectedTemplate === 'mask_top' && selectedClipId && (() => {
              const maskClip = templateClips.find(c => c.id === selectedClipId && c.template === 'mask_top')
              if (!maskClip) return null
              const maskAngle = maskClip.parameters?.maskAngle ?? 0
              
              const presetAngles = [
                { angle: 0, icon: '—', label: 'Horizontal' },
                { angle: 90, icon: '|', label: 'Vertical' },
                { angle: 45, icon: '╲', label: 'Diagonal' },
                { angle: 135, icon: '╱', label: 'Diagonal' },
              ]
              
              return (
                <>
                  {/* Angle Selection */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-neutral-200">Angle</span>
                      <span className="text-[10px] text-neutral-400">{maskAngle}°</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {presetAngles.map((preset) => (
                        <button
                          key={preset.angle}
                          onClick={() => {
                            if (selectedLayerId) {
                              timeline.updateTemplateClip(selectedLayerId, selectedClipId!, {
                                parameters: { ...maskClip.parameters, maskAngle: preset.angle }
                              })
                            }
                          }}
                          title={preset.label}
                          className={cn(
                            "flex items-center justify-center w-8 h-8 rounded-md border transition-all text-sm font-bold",
                            maskAngle === preset.angle
                              ? "border-violet-500 bg-violet-500/20 text-violet-300"
                              : "border-white/10 bg-white/5 text-neutral-400 hover:bg-white/10 hover:border-violet-500/50"
                          )}
                        >
                          {preset.icon}
                        </button>
                      ))}
                      <input
                        type="number"
                        min={0}
                        max={360}
                        step={1}
                        value={maskAngle}
                        onChange={(e) => {
                          if (selectedLayerId) {
                            timeline.updateTemplateClip(selectedLayerId, selectedClipId!, {
                              parameters: { ...maskClip.parameters, maskAngle: parseNum(e.target.value) % 360 }
                            })
                          }
                        }}
                        className="w-12 bg-neutral-800 border border-white/10 rounded-md px-2 py-1 text-[11px] text-white text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                  
                  {/* Duration */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-neutral-200">Duration</span>
                      <span className="text-[10px] text-neutral-400">{((selectedClipDuration ?? 1000) / 1000).toFixed(2)}s</span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={5000}
                      step={100}
                      value={selectedClipDuration ?? 1000}
                      onChange={(e) => onClipDurationChange?.(parseNum(e.target.value))}
                      className="w-full accent-violet-500"
                    />
                  </div>
                </>
              )
            })()}
            
            {/* Mask Center Out Controls */}
            {selectedTemplate === 'mask_center_out' && selectedClipId && (() => {
              const maskClip = templateClips.find(c => c.id === selectedClipId && c.template === 'mask_center_out')
              if (!maskClip) return null
              const maskAngle = maskClip.parameters?.maskAngle ?? 0
              const maskEasing = maskClip.parameters?.maskEasing ?? 'linear'
              
              const presetAngles = [
                { angle: 0, icon: '—', label: 'Horizontal' },
                { angle: 90, icon: '|', label: 'Vertical' },
                { angle: 45, icon: '╲', label: 'Diagonal' },
                { angle: 135, icon: '╱', label: 'Diagonal' },
              ]
              
              return (
                <>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-neutral-200">Angle</span>
                      <span className="text-[10px] text-neutral-400">{maskAngle}°</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {presetAngles.map((preset) => (
                        <button
                          key={preset.angle}
                          onClick={() => {
                            if (selectedLayerId) {
                              timeline.updateTemplateClip(selectedLayerId, selectedClipId!, {
                                parameters: { ...maskClip.parameters, maskAngle: preset.angle }
                              })
                            }
                          }}
                          title={preset.label}
                          className={cn(
                            "flex items-center justify-center w-8 h-8 rounded-md border transition-all text-sm font-bold",
                            maskAngle === preset.angle
                              ? "border-violet-500 bg-violet-500/20 text-violet-300"
                              : "border-white/10 bg-white/5 text-neutral-400 hover:bg-white/10 hover:border-violet-500/50"
                          )}
                        >
                          {preset.icon}
                        </button>
                      ))}
                      <input
                        type="number"
                        min={0}
                        max={360}
                        step={1}
                        value={maskAngle}
                        onChange={(e) => {
                          if (selectedLayerId) {
                            timeline.updateTemplateClip(selectedLayerId, selectedClipId!, {
                              parameters: { ...maskClip.parameters, maskAngle: parseNum(e.target.value) % 360 }
                            })
                          }
                        }}
                        className="w-12 bg-neutral-800 border border-white/10 rounded-md px-2 py-1 text-[11px] text-white text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                  
                  {/* Easing */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-neutral-200">Easing</span>
                    </div>
                    <select
                      value={maskEasing}
                      onChange={(e) => {
                        if (selectedLayerId) {
                          timeline.updateTemplateClip(selectedLayerId, selectedClipId!, {
                            parameters: { ...maskClip.parameters, maskEasing: e.target.value as 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' }
                          })
                        }
                      }}
                      className="w-full bg-neutral-800 border border-white/10 rounded-md px-2 py-1.5 text-[11px] text-white"
                    >
                      <option value="linear">Linear</option>
                      <option value="ease-in">Ease In</option>
                      <option value="ease-out">Ease Out</option>
                      <option value="ease-in-out">Ease In Out</option>
                    </select>
                  </div>
                  
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-neutral-200">Duration</span>
                      <span className="text-[10px] text-neutral-400">{((selectedClipDuration ?? 1000) / 1000).toFixed(2)}s</span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={5000}
                      step={100}
                      value={selectedClipDuration ?? 1000}
                      onChange={(e) => onClipDurationChange?.(parseNum(e.target.value))}
                      className="w-full accent-violet-500"
                    />
                  </div>
                </>
              )
            })()}
            
            {/* Mask Top Out Controls */}
            {selectedTemplate === 'mask_top_out' && selectedClipId && (() => {
              const maskClip = templateClips.find(c => c.id === selectedClipId && c.template === 'mask_top_out')
              if (!maskClip) return null
              const maskAngle = maskClip.parameters?.maskAngle ?? 0
              const maskEasing = maskClip.parameters?.maskEasing ?? 'linear'
              
              const presetAngles = [
                { angle: 0, icon: '—', label: 'Horizontal' },
                { angle: 90, icon: '|', label: 'Vertical' },
                { angle: 45, icon: '╲', label: 'Diagonal' },
                { angle: 135, icon: '╱', label: 'Diagonal' },
              ]
              
              return (
                <>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-neutral-200">Angle</span>
                      <span className="text-[10px] text-neutral-400">{maskAngle}°</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {presetAngles.map((preset) => (
                        <button
                          key={preset.angle}
                          onClick={() => {
                            if (selectedLayerId) {
                              timeline.updateTemplateClip(selectedLayerId, selectedClipId!, {
                                parameters: { ...maskClip.parameters, maskAngle: preset.angle }
                              })
                            }
                          }}
                          title={preset.label}
                          className={cn(
                            "flex items-center justify-center w-8 h-8 rounded-md border transition-all text-sm font-bold",
                            maskAngle === preset.angle
                              ? "border-violet-500 bg-violet-500/20 text-violet-300"
                              : "border-white/10 bg-white/5 text-neutral-400 hover:bg-white/10 hover:border-violet-500/50"
                          )}
                        >
                          {preset.icon}
                        </button>
                      ))}
                      <input
                        type="number"
                        min={0}
                        max={360}
                        step={1}
                        value={maskAngle}
                        onChange={(e) => {
                          if (selectedLayerId) {
                            timeline.updateTemplateClip(selectedLayerId, selectedClipId!, {
                              parameters: { ...maskClip.parameters, maskAngle: parseNum(e.target.value) % 360 }
                            })
                          }
                        }}
                        className="w-12 bg-neutral-800 border border-white/10 rounded-md px-2 py-1 text-[11px] text-white text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                  
                  {/* Easing */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-neutral-200">Easing</span>
                    </div>
                    <select
                      value={maskEasing}
                      onChange={(e) => {
                        if (selectedLayerId) {
                          timeline.updateTemplateClip(selectedLayerId, selectedClipId!, {
                            parameters: { ...maskClip.parameters, maskEasing: e.target.value as 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' }
                          })
                        }
                      }}
                      className="w-full bg-neutral-800 border border-white/10 rounded-md px-2 py-1.5 text-[11px] text-white"
                    >
                      <option value="linear">Linear</option>
                      <option value="ease-in">Ease In</option>
                      <option value="ease-out">Ease Out</option>
                      <option value="ease-in-out">Ease In Out</option>
                    </select>
                  </div>
                  
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-neutral-200">Duration</span>
                      <span className="text-[10px] text-neutral-400">{((selectedClipDuration ?? 1000) / 1000).toFixed(2)}s</span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={5000}
                      step={100}
                      value={selectedClipDuration ?? 1000}
                      onChange={(e) => onClipDurationChange?.(parseNum(e.target.value))}
                      className="w-full accent-violet-500"
                    />
                  </div>
                </>
              )
            })()}
            {/* Effect Controls */}
            {activeTab === 'effects' && activeEffectId && (
              <div className="space-y-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-neutral-200">
                    <Wand2 className="h-3.5 w-3.5" />
                    {availableEffects.find(e => e.id === activeEffectId)?.name} Settings
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={layerEffects.find(e => e.type === activeEffectId)?.isEnabled ?? false}
                      onChange={(e) => onToggleEffect?.(activeEffectId, e.target.checked)}
                    />
                    <div className="peer h-4 w-7 rounded-full bg-neutral-700 peer-checked:bg-violet-500 transition-colors" />
                    <div className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-3" />
                  </label>
                </div>

                {/* Glow Controls */}
                {activeEffectId === 'glow' && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-neutral-200">Intensity</span>
                        <span className="text-[10px] text-neutral-400">
                          {(layerEffects.find(e => e.type === 'glow')?.params.intensity ?? 0).toFixed(1)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={5}
                        step={0.1}
                        value={layerEffects.find(e => e.type === 'glow')?.params.intensity ?? 0}
                        onChange={(e) => onUpdateEffect?.('glow', { intensity: parseNum(e.target.value) })}
                        className="w-full accent-violet-500"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-neutral-200">Blur Radius</span>
                        <span className="text-[10px] text-neutral-400">
                          {(layerEffects.find(e => e.type === 'glow')?.params.blur ?? 0).toFixed(0)}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={50}
                        step={1}
                        value={layerEffects.find(e => e.type === 'glow')?.params.blur ?? 0}
                        onChange={(e) => onUpdateEffect?.('glow', { blur: parseNum(e.target.value) })}
                        className="w-full accent-violet-500"
                      />
                    </div>
                  </>
                )}

                {/* Drop Shadow Controls */}
                {activeEffectId === 'dropShadow' && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-neutral-200">Distance</span>
                        <span className="text-[10px] text-neutral-400">
                          {(layerEffects.find(e => e.type === 'dropShadow')?.params.distance ?? 5).toFixed(0)}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={50}
                        step={1}
                        value={layerEffects.find(e => e.type === 'dropShadow')?.params.distance ?? 5}
                        onChange={(e) => onUpdateEffect?.('dropShadow', { distance: parseNum(e.target.value) })}
                        className="w-full accent-violet-500"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-neutral-200">Blur</span>
                        <span className="text-[10px] text-neutral-400">
                          {(layerEffects.find(e => e.type === 'dropShadow')?.params.blur ?? 2).toFixed(0)}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={20}
                        step={1}
                        value={layerEffects.find(e => e.type === 'dropShadow')?.params.blur ?? 2}
                        onChange={(e) => onUpdateEffect?.('dropShadow', { blur: parseNum(e.target.value) })}
                        className="w-full accent-violet-500"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-neutral-200">Angle</span>
                        <span className="text-[10px] text-neutral-400">
                          {(layerEffects.find(e => e.type === 'dropShadow')?.params.rotation ?? 45).toFixed(0)}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={360}
                        step={15}
                        value={layerEffects.find(e => e.type === 'dropShadow')?.params.rotation ?? 45}
                        onChange={(e) => onUpdateEffect?.('dropShadow', { rotation: parseNum(e.target.value) })}
                        className="w-full accent-violet-500"
                      />
                    </div>
                  </>
                )}

                {/* Blur Controls */}
                {activeEffectId === 'blur' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-neutral-200">Strength</span>
                      <span className="text-[10px] text-neutral-400">
                        {(layerEffects.find(e => e.type === 'blur')?.params.strength ?? 0).toFixed(1)}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={20}
                      step={0.5}
                      value={layerEffects.find(e => e.type === 'blur')?.params.strength ?? 0}
                      onChange={(e) => onUpdateEffect?.('blur', { strength: parseNum(e.target.value) })}
                      className="w-full accent-violet-500"
                    />
                  </div>
                )}

                {/* Glitch Controls */}
                {activeEffectId === 'glitch' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-neutral-200">Intensity</span>
                      <span className="text-[10px] text-neutral-400">
                        {(layerEffects.find(e => e.type === 'glitch')?.params.slices ?? 0).toFixed(0)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={20}
                      step={1}
                      value={layerEffects.find(e => e.type === 'glitch')?.params.slices ?? 0}
                      onChange={(e) => onUpdateEffect?.('glitch', { slices: parseNum(e.target.value) })}
                      className="w-full accent-violet-500"
                    />
                  </div>
                )}

                {/* Pixelate Controls */}
                {activeEffectId === 'pixelate' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-neutral-200">Pixel Size</span>
                      <span className="text-[10px] text-neutral-400">
                        {(layerEffects.find(e => e.type === 'pixelate')?.params.size ?? 10).toFixed(0)}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={50}
                      step={2}
                      value={layerEffects.find(e => e.type === 'pixelate')?.params.size ?? 10}
                      onChange={(e) => onUpdateEffect?.('pixelate', { size: parseNum(e.target.value) })}
                      className="w-full accent-violet-500"
                    />
                  </div>
                )}

                {/* Sparkles/Confetti Controls */}
                {(activeEffectId === 'sparkles' || activeEffectId === 'confetti') && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-neutral-200">Density</span>
                        <span className="text-[10px] text-neutral-400">
                          {(layerEffects.find(e => e.type === activeEffectId)?.params.density ?? 0.5).toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={layerEffects.find(e => e.type === activeEffectId)?.params.density ?? 0.5}
                        onChange={(e) => onUpdateEffect?.(activeEffectId, { density: parseNum(e.target.value) })}
                        className="w-full accent-violet-500"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-neutral-200">Speed</span>
                        <span className="text-[10px] text-neutral-400">
                          {(layerEffects.find(e => e.type === activeEffectId)?.params.speed ?? 1).toFixed(1)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={3}
                        step={0.1}
                        value={layerEffects.find(e => e.type === activeEffectId)?.params.speed ?? 1}
                        onChange={(e) => onUpdateEffect?.(activeEffectId, { speed: parseNum(e.target.value) })}
                        className="w-full accent-violet-500"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            {selectedTemplate === 'path' && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-neutral-200">Path Speed</span>
                    <span className="text-[10px] text-neutral-400">{templateSpeed.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={3}
                    step={0.05}
                    value={templateSpeed}
                    onChange={(e) => onTemplateSpeedChange?.(parseNum(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
                
                {/* Easing dropdown */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-neutral-200">Easing</span>
                    <select
                      value={(() => {
                        // Use selectedClipId to find the specific clicked path clip
                        const clip = selectedClipId 
                          ? templateClips.find(c => c.id === selectedClipId && c.template === 'path')
                          : templateClips.find(c => c.layerId === selectedLayerId && c.template === 'path')
                        return clip?.parameters?.pathEasing || 'linear'
                      })()}
                      onChange={(e) => {
                        // Use selectedClipId to update the specific clicked path clip
                        const clip = selectedClipId 
                          ? templateClips.find(c => c.id === selectedClipId && c.template === 'path')
                          : templateClips.find(c => c.layerId === selectedLayerId && c.template === 'path')
                        if (clip && selectedLayerId) {
                          timeline.updateTemplateClip(selectedLayerId, clip.id, { parameters: { pathEasing: e.target.value as any } })
                        }
                      }}
                      className="px-2 py-1 text-[10px] bg-white/5 border border-white/10 rounded text-neutral-200"
                    >
                      <option value="linear">Linear</option>
                      <option value="easeInOutQuad">Smooth</option>
                      <option value="easeInQuad">Accelerate</option>
                      <option value="easeOutQuad">Decelerate</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
            {!selectedTemplate && <p className="text-[11px] text-neutral-500">Select a template to adjust its controls.</p>}
          </div>
        </aside>
      </div>
      </div>

      {/* Bottom Timeline - Absolute Overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-[90]">
        <TimelinePanel
          layers={layers}
          layerOrder={layerOrder}
          onReorderLayers={onReorderLayers}
          selectedLayerId={selectedLayerId}
          selectedClipId={selectedClipId}
          selectedTemplate={selectedTemplate}
          isDrawingPath={isDrawingPath}
          onFinishPath={onFinishPath}
          onCancelPath={onCancelPath}
          pathPointCount={pathPointCount}
          onClipClick={onClipClick}
          onSelectLayer={onSelectLayer}
        />
      </div>
      
      {/* Explore Shapes Modal */}
      <ExploreShapesModal
        isOpen={showExploreModal}
        onClose={() => setShowExploreModal(false)}
        onSelectIcon={(iconName, svgUrl) => {
          onAddSvg?.(iconName, svgUrl)
          setShowExploreModal(false)
        }}
      />

      {/* AI Prompt Modal */}
      <AnimatePresence>
        {showAIModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-blue-400" />
                    {aiMode === 'generate' ? 'Generate Image' : 'Modify Image'}
                  </h3>
                  <button
                    onClick={() => setShowAIModal(false)}
                    className="rounded-full p-1 text-neutral-400 hover:bg-white/10 hover:text-white"
                  >
                    <Plus className="h-5 w-5 rotate-45" />
                  </button>
                </div>
                
                <div className="mb-6">
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder={aiMode === 'generate' 
                      ? "Describe the image you want to generate..." 
                      : "Describe how you want to modify this image..."}
                    className="w-full h-32 rounded-xl bg-neutral-950 p-4 text-sm text-white placeholder-neutral-500 border border-neutral-800 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none resize-none"
                    autoFocus
                  />
                </div>
                
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowAIModal(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!aiPrompt.trim()) return
                      
                      setIsGeneratingAI(true)
                      try {
                        if (aiMode === 'generate') {
                          await onAIGenerateImage?.(aiPrompt)
                        } else {
                          if (aiEditLayerId) {
                            await onAIEditImage?.(aiEditLayerId, aiPrompt)
                          }
                        }
                        setShowAIModal(false)
                        setAiPrompt('')
                      } catch (error) {
                        console.error('AI Error:', error)
                      } finally {
                        setIsGeneratingAI(false)
                      }
                    }}
                    disabled={isGeneratingAI || !aiPrompt.trim()}
                    className="flex items-center gap-2 px-6 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isGeneratingAI ? (
                      <>
                        <Wand2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      
      {/* Reset Confirmation Modal */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Reset Project"
        message="This will delete all shapes, clips, and start fresh. This action cannot be undone."
        confirmText="Reset"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => {
          setShowResetConfirm(false)
          onReset?.()
        }}
        onCancel={() => setShowResetConfirm(false)}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        defaultFilename={projectName.replace(/[^a-zA-Z0-9_-]/g, '') || 'motionshapes'}
        canvasRef={exportCanvasRef?.current ?? null}
        duration={contentDuration}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
        background={background}
        onSeek={(time) => timeline.setCurrentTime(time)}
        onRender={() => exportRenderRef?.current?.()}
        onSetPlaying={(playing) => timeline.setPlaying(playing)}
        onHideHandles={() => exportHideHandlesRef?.current?.()}
        onShowHandles={() => exportShowHandlesRef?.current?.()}
        getViewportBounds={() => {
          // Calculate viewport bounds in canvas coordinates
          // Viewport is centered in the canvas area
          const canvas = exportCanvasRef?.current
          if (!canvas) return { x: 0, y: 0, width: canvasWidth, height: canvasHeight }
          
          // IMPORTANT: canvas.width/height are in PHYSICAL pixels (scaled by devicePixelRatio)
          // canvasWidth/Height and canvasX/Y are in LOGICAL pixels (CSS pixels)
          // We need to work in physical pixel space for drawImage
          const dpr = window.devicePixelRatio || 1
          
          // Physical pixel dimensions
          const physicalViewportWidth = canvasWidth * dpr
          const physicalViewportHeight = canvasHeight * dpr
          const physicalCanvasX = canvasX * dpr
          const physicalCanvasY = canvasY * dpr
          
          // The canvas fills the workspace. The viewport is centered.
          const workspaceWidth = canvas.width  // Already in physical pixels
          const workspaceHeight = canvas.height
          
          const x = (workspaceWidth - physicalViewportWidth) / 2 + physicalCanvasX
          const y = (workspaceHeight - physicalViewportHeight) / 2 + physicalCanvasY
          
          return { x, y, width: physicalViewportWidth, height: physicalViewportHeight }
        }}
      />

      {/* Save Motion Modal */}
      <SaveMotionModal
        isOpen={isSaveLibraryOpen}
        onClose={() => setIsSaveLibraryOpen(false)}
        onSave={handleSaveToLibrary}
        isSaving={isSavingLibrary}
      />
    </div>
  )
}

'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import type { SVGProps } from 'react'
import { useRouter } from 'next/navigation'
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
  Type
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { EffectPreview } from '@/components/EffectPreview'
import { TemplatePreview } from '@/components/TemplatePreview'
import TimelinePanel from '@/components/TimelinePanel'
import FontPicker from '@/components/FontPicker'
import { ExploreShapesModal } from '@/components/ExploreShapesModal'

export type BackgroundSettings = {
  mode: 'solid' | 'gradient'
  solid: string
  from: string
  to: string
  opacity: number
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
  jumpHeight?: number
  jumpVelocity?: number
  popScale?: number
  popSpeed?: number
  popCollapse?: boolean
  popReappear?: boolean
  onTemplateSpeedChange?: (value: number) => void
  onRollDistanceChange?: (value: number) => void
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
  // History
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onUpdateLayerPosition?: (id: string, x: number, y: number) => void
  onUpdateLayerRotation?: (id: string, rotation: number) => void
  onUpdateLayerSize?: (id: string, width: number, height: number) => void
  onUpdateLayerText?: (id: string, text: string) => void
  onUpdateLayerFontSize?: (id: string, fontSize: number) => void
  onUpdateLayerColor?: (id: string, color: number) => void
  onUpdateLayerFontFamily?: (id: string, fontFamily: string) => void
  onRedo?: () => void
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
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onUpdateLayerPosition,
  onUpdateLayerRotation,
  onUpdateLayerSize,
  onUpdateLayerText,
  onUpdateLayerFontSize,
  onUpdateLayerColor,
  onUpdateLayerFontFamily,
}: DashboardLayoutProps) {
  const router = useRouter()
  const supabase = createClient()
  const [showBackgroundPanel, setShowBackgroundPanel] = useState(false)
  const [activeTab, setActiveTab] = useState<'templates' | 'shapes' | 'effects' | 'animations'>('shapes')
  const [animationType, setAnimationType] = useState<'in' | 'out' | 'custom'>('in')
  const [showExploreModal, setShowExploreModal] = useState(false)
  const [showTextColorPicker, setShowTextColorPicker] = useState(false)

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
      // Reset to current prop value on blur to indicate no change if not committed
      setLocalValue(String(value))
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
    if (typeof window === 'undefined') return DEFAULT_CANVAS_WIDTH
    const saved = localStorage.getItem('canvasWidth')
    return saved ? Math.max(MIN_CANVAS_WIDTH, parseInt(saved)) : DEFAULT_CANVAS_WIDTH
  })

  const [canvasHeight, setCanvasHeight] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_CANVAS_HEIGHT
    const saved = localStorage.getItem('canvasHeight')
    return saved ? Math.max(MIN_CANVAS_HEIGHT, parseInt(saved)) : DEFAULT_CANVAS_HEIGHT
  })

  const [canvasX, setCanvasX] = useState(() => {
    if (typeof window === 'undefined') return 0
    const saved = localStorage.getItem('canvasX')
    return saved ? parseInt(saved) : 0
  })

  const [canvasY, setCanvasY] = useState(() => {
    if (typeof window === 'undefined') return 0
    const saved = localStorage.getItem('canvasY')
    return saved ? parseInt(saved) : 0
  })

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
      if (!target.closest('[data-canvas-container]')) {
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
    background.mode === 'gradient'
      ? {
          backgroundImage: `linear-gradient(135deg, ${hexToRgba(background.from, background.opacity)}, ${hexToRgba(background.to, background.opacity)})`,
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
    <div className="flex h-screen w-screen flex-col bg-[#0a0a0a] text-white overflow-hidden font-sans selection:bg-white/20">
      {/* Top Navbar */}
      <header className="flex h-14 items-center justify-between border-b border-white/5 bg-[#0a0a0a]/80 px-4 backdrop-blur-xl z-50 supports-[backdrop-filter]:bg-[#0a0a0a]/60 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-white/5" onClick={() => router.push('/')}>
             <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-white/10 to-white/5 border border-white/5 shadow-inner">
                <Layout className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold tracking-tight text-sm text-neutral-200">MotionShapes</span>
          </div>
        </div>

        {/* Center Navigation Tabs */}
        <div className="hidden md:flex items-center justify-evenly w-[300px] lg:w-[400px] mx-auto bg-white/5 p-1 rounded-lg border border-white/5">
            <button
              onClick={() => setActiveTab('templates')}
              className={cn(
                "flex-1 border-b-2 py-3 text-[11px] font-medium transition-colors",
                activeTab === 'templates'
                  ? "border-violet-500 text-violet-400"
                  : "border-transparent text-neutral-400 hover:text-neutral-200"
              )}
            >
              Templates
            </button>
            <button
              onClick={() => setActiveTab('animations')}
              className={cn(
                "flex-1 border-b-2 py-3 text-[11px] font-medium transition-colors",
                activeTab === 'animations'
                  ? "border-violet-500 text-violet-400"
                  : "border-transparent text-neutral-400 hover:text-neutral-200"
              )}
            >
              Animations
            </button>
            <button
              onClick={() => setActiveTab('effects')}
              className={cn(
                "flex-1 border-b-2 py-3 text-[11px] font-medium transition-colors",
                activeTab === 'effects'
                  ? "border-violet-500 text-violet-400"
                  : "border-transparent text-neutral-400 hover:text-neutral-200"
              )}
            >
              Effects
            </button>
            <button
              onClick={() => setActiveTab('shapes')}
              className={cn(
                "flex-1 border-b-2 py-3 text-[11px] font-medium transition-colors",
                activeTab === 'shapes'
                  ? "border-violet-500 text-violet-400"
                  : "border-transparent text-neutral-400 hover:text-neutral-200"
              )}
            >
              Shapes
            </button>
        </div>
        
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 mr-2 border-r border-white/10 pr-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-400"
                onClick={onUndo}
                disabled={!canUndo}
                title="Undo (Cmd+Z)"
              >
                <Undo className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-400"
                onClick={onRedo}
                disabled={!canRedo}
                title="Redo (Cmd+Shift+Z)"
              >
                <Redo className="h-4 w-4" />
              </Button>
            </div>
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
                onClick={() => fileInputRef.current?.click()}
                variant="ghost"
                size="sm"
                className="h-8 gap-2 text-neutral-400 hover:text-white hover:bg-white/5 text-xs"
            >
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Import</span>
            </Button>
            <Button 
                onClick={handleLogout}
                variant="ghost"
                size="sm"
                className="h-8 gap-2 text-neutral-400 hover:text-white hover:bg-white/5 text-xs"
            >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
            </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left Sidebar */}
        <aside 
            ref={sidebarRef}
            style={{ width: sidebarWidth }}
            className="relative border-r border-white/5 bg-[#0a0a0a] p-4 flex flex-col gap-6 z-40 shrink-0 overflow-y-auto overscroll-contain min-h-0 max-h-screen pb-24"
        >
          {/* Resize Handle */}
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-purple-500/50 active:bg-purple-500/50 transition-colors z-50"
            onMouseDown={startSidebarResize}
          />

          {/* Templates Tab Content */}
          {activeTab === 'templates' && (
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
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
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <div className="flex flex-col h-full pb-[150vh]">
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
                  Custom
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
                  </>
                )}
              </div>
              </div>
            </div>
          )}

          {/* Effects Tab Content */}
          {activeTab === 'effects' && (
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-[150vh]">
              <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-600 px-2">
                Effects
              </h2>
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
                      onClick={() => onSelectEffect?.(effect.id)}
                      icon={effect.icon}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {/* Shapes Tab Content */}
          {activeTab === 'shapes' && (
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-96">
                <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-600 px-2">
                  Shapes
                </h2>
                
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

        </aside>

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
             
             {/* MotionCanvas - Fills entire workspace */}
              <div 
                ref={canvasContainerRef}
                className="absolute inset-0"
                onPointerDown={handleBackgroundClick}
              >
                {/* Viewport-scoped background */}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    width: canvasWidth,
                    height: canvasHeight,
                    left: `calc(50% + ${canvasX}px)`,
                    top: `calc(50% + ${canvasY}px)`,
                    transform: 'translate(-50%, -50%)',
                    ...(background.mode === 'gradient'
                      ? { backgroundImage: `linear-gradient(135deg, ${background.from}, ${background.to})` }
                      : { backgroundColor: background.solid }),
                    opacity: Math.max(0, Math.min(1, background.opacity ?? 1)),
                    zIndex: 0,
                  }}
                />

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
                   return React.cloneElement(child, { offsetX: canvasX, offsetY: canvasY })
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
                 className="absolute -top-7 left-0 flex items-center gap-2 cursor-pointer select-none pointer-events-auto z-20"
                 onClick={handleLabelClick}
                 onPointerDown={handleLabelPointerDown}
               >
                 <Play className={`h-3.5 w-3.5 ${isCanvasSelected ? 'text-purple-400' : 'text-neutral-500'}`} />
                 <span className={`text-sm font-medium ${isCanvasSelected ? 'text-purple-300' : 'text-neutral-500'}`}>Canvas</span>
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

        {/* Right Sidebar - Template Controls */}
        <aside 
            ref={rightSidebarRef}
            style={{ width: rightSidebarWidth }}
            className="relative border-l border-white/5 bg-[#0a0a0a] p-4 space-y-4 overflow-y-auto overscroll-contain shrink-0 min-h-0 max-h-screen pb-48 scroll-smooth"
        >
          {/* Resize Handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-purple-500/50 active:bg-purple-500/50 transition-colors z-50"
            onMouseDown={startRightSidebarResize}
          />



          {selectedLayerId && (
            <div className="mb-6 space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-400">Transform</span>
              </div>
              
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
                    value={String(layers.find(l => l.id === selectedLayerId)?.rotation ?? 0)}
                    className="w-full rounded bg-neutral-800 pl-8 pr-2 py-1.5 text-left text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    onChange={(e) => {
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
                    key={`fill-hex-${selectedLayerId}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && selectedLayerId) {
                        const hex = e.currentTarget.value.replace('#', '')
                        const numColor = parseInt(hex, 16)
                        if (!isNaN(numColor)) {
                          onUpdateLayerColor?.(selectedLayerId, numColor)
                        }
                      }
                    }}
                    onBlur={(e) => {
                      if (!selectedLayerId) return
                      const hex = e.currentTarget.value.replace('#', '')
                      const numColor = parseInt(hex, 16)
                      if (!isNaN(numColor)) {
                        onUpdateLayerColor?.(selectedLayerId, numColor)
                      }
                    }}
                    placeholder="FFFFFF"
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
            </div>
          )}

          {/* Text Controls - Only show for text layers */}
          {selectedLayerId && layers.find(l => l.id === selectedLayerId)?.type === 'text' && (
            <div className="mb-6 space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-400">Text</span>
              </div>
              
              {/* Text Content */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase text-neutral-500">Content</span>
                <div className="flex gap-2">
                  <textarea
                    id="text-content-input"
                    defaultValue={layers.find(l => l.id === selectedLayerId)?.text || ''}
                    key={selectedLayerId} // Reset when layer changes
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

              {/* Font Color */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase text-neutral-500">Color</span>
                {/* Hex Input + Color Picker Swatch side by side */}
                <div className="flex items-center gap-2 w-full">
                  <input
                    type="text"
                    defaultValue={(() => {
                      const c = layers.find(l => l.id === selectedLayerId)?.fillColor ?? 0xffffff
                      return c.toString(16).toUpperCase().padStart(6, '0')
                    })()}
                    key={selectedLayerId}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && selectedLayerId) {
                        const hex = e.currentTarget.value.replace('#', '')
                        const numColor = parseInt(hex, 16)
                        if (!isNaN(numColor)) {
                          onUpdateLayerColor?.(selectedLayerId, numColor)
                        }
                      }
                    }}
                    onBlur={(e) => {
                      if (!selectedLayerId) return
                      const hex = e.currentTarget.value.replace('#', '')
                      const numColor = parseInt(hex, 16)
                      if (!isNaN(numColor)) {
                        onUpdateLayerColor?.(selectedLayerId, numColor)
                      }
                    }}
                    placeholder="FFFFFF"
                    maxLength={6}
                    className="flex-1 min-w-0 rounded bg-neutral-800 px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  {/* Native Color Picker styled as swatch */}
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
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-neutral-200 px-2">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Controls
            </div>
            
            {/* Duration Control - Always show if a clip is selected */}
            {selectedClipDuration !== undefined && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-neutral-200">Duration</span>
                  <span className="text-[10px] text-neutral-400">{(selectedClipDuration / 1000).toFixed(2)}s</span>
                </div>
                <input
                  type="range"
                  min={100}
                  max={5000}
                  step={100}
                  value={selectedClipDuration}
                  onChange={(e) => onClipDurationChange?.(Number(e.target.value))}
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
                    onChange={(e) => onTemplateSpeedChange?.(Number(e.target.value))}
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
                    onChange={(e) => onRollDistanceChange?.(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
              </>
            )}
            {selectedTemplate === 'jump' && (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-neutral-200">Jump Height</span>
                    <span className="text-[10px] text-neutral-400">{jumpHeight.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.05}
                    max={0.8}
                    step={0.01}
                    value={jumpHeight}
                    onChange={(e) => onJumpHeightChange?.(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-neutral-200">Initial Velocity</span>
                    <span className="text-[10px] text-neutral-400">{jumpVelocity.toFixed(2)} u/s</span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={6}
                    step={0.05}
                    value={jumpVelocity}
                    onChange={(e) => onJumpVelocityChange?.(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
              </div>
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
                    onChange={(e) => onPopScaleChange?.(Number(e.target.value))}
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
                    onChange={(e) => onPopSpeedChange?.(Number(e.target.value))}
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
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] font-semibold text-neutral-200">Reappear</span>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={popReappear}
                      onChange={(e) => onPopReappearChange?.(e.target.checked)}
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
                    onChange={(e) => onShakeDistanceChange?.(Number(e.target.value))}
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
                    onChange={(e) => onClipDurationChange?.(Number(e.target.value))}
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
                    onChange={(e) => onTemplateSpeedChange?.(Number(e.target.value))}
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
                    onChange={(e) => onPulseScaleChange?.(Number(e.target.value))}
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
                    onChange={(e) => onPulseSpeedChange?.(Number(e.target.value))}
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
                    onChange={(e) => onClipDurationChange?.(Number(e.target.value))}
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
                    onChange={(e) => onSpinSpeedChange?.(Number(e.target.value))}
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
                    onChange={(e) => onClipDurationChange?.(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
              </>
            )}
            
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
                        onChange={(e) => onUpdateEffect?.('glow', { intensity: Number(e.target.value) })}
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
                        onChange={(e) => onUpdateEffect?.('glow', { blur: Number(e.target.value) })}
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
                        onChange={(e) => onUpdateEffect?.('dropShadow', { distance: Number(e.target.value) })}
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
                        onChange={(e) => onUpdateEffect?.('dropShadow', { blur: Number(e.target.value) })}
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
                        onChange={(e) => onUpdateEffect?.('dropShadow', { rotation: Number(e.target.value) })}
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
                      onChange={(e) => onUpdateEffect?.('blur', { strength: Number(e.target.value) })}
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
                      onChange={(e) => onUpdateEffect?.('glitch', { slices: Number(e.target.value) })}
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
                      onChange={(e) => onUpdateEffect?.('pixelate', { size: Number(e.target.value) })}
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
                        onChange={(e) => onUpdateEffect?.(activeEffectId, { density: Number(e.target.value) })}
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
                        onChange={(e) => onUpdateEffect?.(activeEffectId, { speed: Number(e.target.value) })}
                        className="w-full accent-violet-500"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            {selectedTemplate === 'path' && (
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
                  onChange={(e) => onTemplateSpeedChange?.(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
              </div>
            )}
            {!selectedTemplate && <p className="text-[11px] text-neutral-500">Select a template to adjust its controls.</p>}
          </div>
        </aside>
      </div>

      {/* Bottom Timeline - Absolute Overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-50">
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
    </div>
  )
}

'use client'

import React, { useState, useEffect, useRef } from 'react'
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
  MousePointer2,
  Layers,
  Zap,
  Activity,
  Circle,
  Square,
  Heart,
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
  PenTool
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { TemplatePreview } from './TemplatePreview'
import { Button } from '@/components/ui/button'
import TimelinePanel from '@/components/TimelinePanel'

export type BackgroundSettings = {
  mode: 'solid' | 'gradient'
  solid: string
  from: string
  to: string
  opacity: number
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
  onStartDrawPath?: () => void
  showSelectShapeHint?: boolean
  layers: Array<{ id: string; shapeKind: ShapeKind }>
  selectedLayerId?: string
  isDrawingPath?: boolean
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
}

export default function DashboardLayout({ 
  children, 
  selectedTemplate, 
  onSelectTemplate, 
  onAddShape, 
  onStartDrawPath, 
  showSelectShapeHint, 
  layers, 
  selectedLayerId, 
  isDrawingPath, 
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
}: DashboardLayoutProps) {
  const router = useRouter()
  const supabase = createClient()
  const [showBackgroundPanel, setShowBackgroundPanel] = useState(false)

  // Canvas resize and move state
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

  // Handle mouse wheel for panning or zooming (pinch)
  const handleCanvasWheel = (e: React.WheelEvent) => {
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
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('canvasWidth', newWidth.toString())
        localStorage.setItem('canvasHeight', newHeight.toString())
      }
    } else {
      // Pan the canvas based on wheel delta
      setCanvasX(prev => prev - e.deltaX)
      setCanvasY(prev => prev - e.deltaY)
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('canvasX', (canvasX - e.deltaX).toString())
        localStorage.setItem('canvasY', (canvasY - e.deltaY).toString())
      }
    }
  }

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

  const startCanvasMove = (e: React.PointerEvent) => {
    // Don't start move if clicking on a resize handle
    if ((e.target as HTMLElement).hasAttribute('data-resize-handle')) {
      return
    }
    
    // Don't start move if clicking on a shape (SVG elements or canvas children)
    const target = e.target as HTMLElement
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
    
    e.preventDefault()
    e.stopPropagation()
    
    const targetEl = e.target as HTMLElement
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
      // Clicked inside viewport (but not on a shape) -> Start Drag

      setIsCanvasSelected(true)
      startCanvasMove(e)
    } else {
      // Clicked outside viewport -> Deselect

      setIsCanvasSelected(false)
    }
  }

  const [activeTab, setActiveTab] = useState<'templates' | 'shapes' | 'draw'>('templates')
  
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
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/5">
            <button
                onClick={() => setActiveTab('templates')}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                    activeTab === 'templates' 
                        ? "bg-white/10 text-white shadow-sm" 
                        : "text-neutral-400 hover:text-white hover:bg-white/5"
                )}
            >
                <LayoutTemplate className="h-3.5 w-3.5" />
                Templates
            </button>
            <button
                onClick={() => setActiveTab('shapes')}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                    activeTab === 'shapes' 
                        ? "bg-white/10 text-white shadow-sm" 
                        : "text-neutral-400 hover:text-white hover:bg-white/5"
                )}
            >
                <Shapes className="h-3.5 w-3.5" />
                Shapes
            </button>
        </div>
        
        <div className="flex items-center gap-3">
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
            className="relative border-r border-white/5 bg-[#0a0a0a] p-4 flex flex-col gap-6 z-40 shrink-0 overflow-y-auto"
        >
          {/* Resize Handle */}
          <div
            className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-purple-500/50 active:bg-purple-500/50 transition-colors z-50"
            onMouseDown={startSidebarResize}
          />

          {/* Templates Tab Content */}
          {activeTab === 'templates' && (
            <div className="flex flex-col gap-4">
                <div>
                  <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-600 px-2">
                    Custom
                  </h2>
                  <button
                    onClick={() => onStartDrawPath?.()}
                    className={cn(
                      "group flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition-all duration-200 border border-transparent",
                      isDrawingPath
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200 hover:border-white/5"
                    )}
                  >
                    <PenTool className={cn("h-4 w-4", isDrawingPath ? "text-emerald-400" : "text-neutral-500 group-hover:text-neutral-300")} />
                    Draw a custom path
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
          )}

          {/* Shapes Tab Content */}
          {activeTab === 'shapes' && (
            <div>
                <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-600 px-2">
                  Shapes
                </h2>
                <div className="grid grid-cols-1 gap-1">
                  <Button onClick={() => onAddShape?.('circle')} variant="ghost" className="justify-start text-neutral-400 hover:text-white hover:bg-white/5 h-9 px-2">
                    <Circle className="mr-2 h-4 w-4 text-neutral-500" />
                    Circle
                  </Button>
                  <Button onClick={() => onAddShape?.('square')} variant="ghost" className="justify-start text-neutral-400 hover:text-white hover:bg-white/5 h-9 px-2">
                    <Square className="mr-2 h-4 w-4 text-neutral-500" />
                    Square
                  </Button>
                  <Button onClick={() => onAddShape?.('heart')} variant="ghost" className="justify-start text-neutral-400 hover:text-white hover:bg-white/5 h-9 px-2">
                    <Heart className="mr-2 h-4 w-4 text-neutral-500" />
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
            {/* Toolbar */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0a0a0a]/80 px-2 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
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
            </div>

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
               className="absolute inset-0"
               onPointerDown={handleBackgroundClick}
               onWheel={handleCanvasWheel}
             >
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
            className="relative border-l border-white/5 bg-[#0a0a0a] p-4 space-y-4 overflow-y-auto shrink-0"
        >
          {/* Resize Handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-purple-500/50 active:bg-purple-500/50 transition-colors z-50"
            onMouseDown={startRightSidebarResize}
          />



          {selectedLayerId && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 shadow-inner">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-neutral-200">Size</span>
                <span className="text-[10px] text-neutral-400">Scale: {selectedLayerScale.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={3}
                step={0.01}
                value={selectedLayerScale}
                onChange={(e) => onSelectedLayerScaleChange?.(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-neutral-200 px-2">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Controls
            </div>
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
                    className="w-full accent-emerald-500"
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
                    className="w-full accent-emerald-500"
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
                    className="w-full accent-emerald-500"
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
                    className="w-full accent-emerald-500"
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
                    className="w-full accent-emerald-500"
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
                    className="w-full accent-emerald-500"
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
                    <div className="peer h-4 w-7 rounded-full bg-neutral-700 peer-checked:bg-emerald-500 transition-colors" />
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
                    <div className="peer h-4 w-7 rounded-full bg-neutral-700 peer-checked:bg-emerald-500 transition-colors" />
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
                    className="w-full accent-emerald-500"
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
                    className="w-full accent-emerald-500"
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
                    className="w-full accent-emerald-500"
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
                    className="w-full accent-emerald-500"
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
                    className="w-full accent-emerald-500"
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
                    className="w-full accent-emerald-500"
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
                    className="w-full accent-emerald-500"
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
                        spinDirection === 1 ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-white/10 text-neutral-300 hover:bg-white/5'
                      }`}
                    >
                      CW
                    </button>
                    <button
                      onClick={() => onSpinDirectionChange?.(-1)}
                      className={`flex-1 rounded-md border px-3 py-1 text-[11px] font-semibold ${
                        spinDirection === -1 ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-white/10 text-neutral-300 hover:bg-white/5'
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
                    className="w-full accent-emerald-500"
                  />
                </div>
              </>
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
                  className="w-full accent-emerald-500"
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
          selectedLayerId={selectedLayerId}
          selectedTemplate={selectedTemplate}
          isDrawingPath={isDrawingPath}
          onFinishPath={onFinishPath}
          onCancelPath={onCancelPath}
          pathPointCount={pathPointCount}
          onClipClick={onClipClick}
        />
      </div>
    </div>
  )
}

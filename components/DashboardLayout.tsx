'use client'

import { useState } from 'react'
import type { SVGProps } from 'react'
import { Layout, Play, Square, Circle, LogOut, Settings, ChevronLeft, Layers, Zap, MousePointer2, SlidersHorizontal } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import TimelinePanel from '@/components/TimelinePanel'

export type BackgroundSettings = {
  mode: 'solid' | 'gradient'
  solid: string
  from: string
  to: string
  opacity: number
}

interface DashboardLayoutProps {
  children: React.ReactNode
  selectedTemplate: string
  onSelectTemplate: (template: string) => void
  onAddShape?: () => void
  onStartDrawPath?: () => void
  showSelectShapeHint?: boolean
  layers: Array<{ id: string; shapeKind: string }>
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
  onTemplateSpeedChange?: (value: number) => void
  onRollDistanceChange?: (value: number) => void
  onJumpHeightChange?: (value: number) => void
  onJumpVelocityChange?: (value: number) => void
  onPopScaleChange?: (value: number) => void
  onPopSpeedChange?: (value: number) => void
  onPopCollapseChange?: (value: boolean) => void
  selectedLayerScale?: number
  onSelectedLayerScaleChange?: (value: number) => void
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
  popCollapse = true,
  onTemplateSpeedChange,
  onRollDistanceChange,
  onJumpHeightChange,
  onJumpVelocityChange,
  onPopScaleChange,
  onPopSpeedChange,
  onPopCollapseChange,
}: DashboardLayoutProps) {
  const router = useRouter()
  const supabase = createClient()
  const [showBackgroundPanel, setShowBackgroundPanel] = useState(false)

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

  const canvasBgStyle =
    background.mode === 'gradient'
      ? {
          backgroundImage: `linear-gradient(135deg, ${hexToRgba(background.from, background.opacity)}, ${hexToRgba(background.to, background.opacity)})`,
        }
      : {
          backgroundColor: hexToRgba(background.solid, background.opacity),
        }

  return (
    <div className="flex h-screen w-screen flex-col bg-[#0a0a0a] text-white overflow-hidden font-sans selection:bg-white/20">
      {/* Top Navbar */}
      <header className="flex h-14 items-center justify-between border-b border-white/5 bg-[#0a0a0a]/80 px-4 backdrop-blur-xl z-50 supports-[backdrop-filter]:bg-[#0a0a0a]/60">
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

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 border-r border-white/5 bg-[#0a0a0a] p-4 flex flex-col gap-6 z-40">
          <div>
              <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-600 px-2">
                Templates
              </h2>
              <nav className="space-y-0.5">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => onSelectTemplate(template.id)}
                    className={cn(
                      "group flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition-all duration-200",
                      selectedTemplate === template.id
                        ? "bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-white/5"
                        : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
                    )}
                  >
                    <template.icon className={cn("h-4 w-4 transition-colors", selectedTemplate === template.id ? "text-white" : "text-neutral-500 group-hover:text-neutral-300")} />
                    {template.name}
                  </button>
                ))}
              </nav>
          </div>

          <div>
            <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-600 px-2">
              Custom
            </h2>
            <div className="space-y-3 px-2">
              <Button
                variant="ghost"
                className="w-full justify-start text-neutral-400 hover:text-white hover:bg-white/5 h-9 px-2"
                onClick={() => onStartDrawPath?.()}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4 text-neutral-500 group-hover:text-white transition-colors">
                  <path d="M4 12c0-6 8-6 8 0s8 6 8 0" />
                </svg>
                Draw Path
              </Button>
              {showSelectShapeHint && (
                <p className="text-[10px] text-amber-400/90 bg-amber-400/10 p-2 rounded border border-amber-400/20">
                  Select a shape first, then click Draw Path.
                </p>
              )}
              <p className="text-[10px] text-neutral-500 leading-relaxed px-2">
                Click "Draw Path" to mark a motion path on the canvas. Double-click to finish.
              </p>
            </div>
          </div>

          <div>
              <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-600 px-2">
                Shapes
              </h2>
              <div className="grid grid-cols-1 gap-1">
                <Button onClick={() => onAddShape?.()} variant="ghost" className="justify-start text-neutral-400 hover:text-white hover:bg-white/5 h-9 px-2">
                  <Circle className="mr-2 h-4 w-4 text-neutral-500" />
                  Circle
                </Button>
              </div>
          </div>

        </aside>

        {/* Center Canvas Area */}
        <main
          className="relative flex flex-1 flex-col overflow-hidden bg-[#050505]"
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

          <div className="flex flex-1 items-center justify-center p-8 md:p-12 overflow-hidden relative">
             {/* Grid Background */}
             <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
             
             {/* 16:9 Aspect Ratio Container */}
            <div
              className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-xl border border-white/5 shadow-[0_0_100px_-20px_rgba(0,0,0,0.7)] ring-1 ring-white/[0.02]"
              style={{
                ...canvasBgStyle,
                transition: 'background 150ms ease, opacity 150ms ease',
              }}
            >
              {children}
            </div>
          </div>
        </main>

        {/* Right Sidebar - Template Controls */}
        <aside className="w-80 border-l border-white/5 bg-[#0a0a0a] p-4 space-y-4 overflow-y-auto">
          {isDrawingPath && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 shadow-inner">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-neutral-100">Path Recording</span>
                <span className="text-[10px] text-emerald-400 font-mono">{pathPointCount} pts</span>
              </div>
              <p className="text-[11px] text-neutral-300 mb-2">Click on canvas to add points. Double-click or press Finish.</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onFinishPath?.()}
                  className="inline-flex items-center justify-center rounded-md bg-emerald-500/80 px-3 py-1 text-[11px] font-semibold text-black hover:bg-emerald-400"
                >
                  Finish Path
                </button>
                <button
                  onClick={() => onCancelPath?.()}
                  className="inline-flex items-center justify-center rounded-md border border-white/10 px-3 py-1 text-[11px] font-semibold text-neutral-200 hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {selectedLayerId && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 shadow-inner">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-neutral-200">Size</span>
                <span className="text-[10px] text-neutral-400">Scale: 1.00</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={3}
                step={0.01}
                defaultValue={1}
                className="w-full accent-emerald-500"
              />
            </div>
          )}

          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 shadow-inner space-y-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-neutral-200">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Template Controls
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
              </>
            )}
            {!selectedTemplate && <p className="text-[11px] text-neutral-500">Select a template to adjust its controls.</p>}
          </div>
        </aside>
      </div>

      {/* Bottom Timeline - Full Width */}
      <TimelinePanel
        layers={layers}
        selectedLayerId={selectedLayerId}
        selectedTemplate={selectedTemplate}
        isDrawingPath={isDrawingPath}
        onFinishPath={onFinishPath}
        onCancelPath={onCancelPath}
        pathPointCount={pathPointCount}
      />
    </div>
  )
}

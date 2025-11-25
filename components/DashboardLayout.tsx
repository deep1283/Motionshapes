'use client'

import { Layout, Play, Square, Circle, LogOut, Settings, ChevronLeft, Layers, Zap, MousePointer2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import TimelinePanel from '@/components/TimelinePanel'

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
}

export default function DashboardLayout({ children, selectedTemplate, onSelectTemplate, onAddShape, onStartDrawPath, showSelectShapeHint, layers, selectedLayerId, isDrawingPath, onFinishPath, onCancelPath, pathPointCount = 0 }: DashboardLayoutProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const templates = [
    { 
      id: 'roll', 
      name: 'Roll', 
      icon: (props: any) => (
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
      icon: (props: any) => (
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
      icon: (props: any) => (
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
                Click “Draw Path” to mark a motion path on the canvas. Double-click to finish.
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
        <main className="relative flex flex-1 flex-col bg-[#050505] overflow-hidden">
            {/* Toolbar */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0a0a0a]/80 px-2 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors">
                    <MousePointer2 className="h-4 w-4" />
                </Button>
                <div className="h-4 w-px bg-white/10 mx-1" />
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors">
                    <Layers className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors">
                    <Zap className="h-4 w-4" />
                </Button>
            </div>

          <div className="flex flex-1 items-center justify-center p-8 md:p-12 overflow-hidden relative">
             {/* Grid Background */}
             <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)] pointer-events-none" />
             
             {/* 16:9 Aspect Ratio Container */}
            <div className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-xl border border-white/5 bg-gray-700 shadow-[0_0_100px_-20px_rgba(0,0,0,0.7)] ring-1 ring-white/[0.02]">
              {children}
            </div>
          </div>

          {/* Bottom Timeline */}
          <TimelinePanel
            layers={layers}
            selectedLayerId={selectedLayerId}
            selectedTemplate={selectedTemplate}
            isDrawingPath={isDrawingPath}
            onFinishPath={onFinishPath}
            onCancelPath={onCancelPath}
            pathPointCount={pathPointCount}
          />
        </main>
      </div>
    </div>
  )
}

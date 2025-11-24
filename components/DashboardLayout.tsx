'use client'

import { Layout, Play, Square, Monitor, Image as ImageIcon, LogOut, Settings, ChevronLeft, Layers, Zap, MousePointer2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface DashboardLayoutProps {
  children: React.ReactNode
  selectedTemplate: string
  onSelectTemplate: (template: string) => void
  onAddShape?: () => void
}

export default function DashboardLayout({ children, selectedTemplate, onSelectTemplate, onAddShape }: DashboardLayoutProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const templates = [
    { id: 'simple-shape', name: 'Simple Shape', icon: Square },
    { id: 'ui-screen', name: 'UI Screen Slide', icon: Monitor },
    { id: 'logo-pop', name: 'Logo Pop', icon: ImageIcon },
  ]

  return (
    <div className="flex h-screen w-screen flex-col bg-[#0a0a0a] text-white overflow-hidden font-sans selection:bg-white/20">
      {/* Top Navbar */}
      <header className="flex h-16 items-center justify-between border-b border-white/10 bg-[#0a0a0a]/50 px-6 backdrop-blur-md z-50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-white" onClick={() => router.push('/')}>
             <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 font-bold tracking-tight">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                <Layout className="h-5 w-5" />
            </div>
            <span>MotionShapes</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs font-medium text-neutral-500 px-3 py-1 rounded-full border border-white/5 bg-white/5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Saved
            </div>
            <Button 
                onClick={handleLogout}
                className="gap-2 text-neutral-400 hover:text-white hover:bg-white/10"
            >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
            </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-72 border-r border-white/10 bg-[#0a0a0a]/50 p-6 backdrop-blur-md flex flex-col gap-8 z-40">
          <div>
              <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-neutral-500">
                Templates
              </h2>
              <nav className="space-y-1">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => onSelectTemplate(template.id)}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      selectedTemplate === template.id
                        ? "bg-white text-black shadow-lg shadow-white/10"
                        : "text-neutral-400 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <template.icon className={cn("h-4 w-4", selectedTemplate === template.id ? "text-black" : "text-neutral-500 group-hover:text-white")} />
                    {template.name}
                  </button>
                ))}
              </nav>
          </div>

          <div>
              <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-neutral-500">
                Shapes
              </h2>
              <div className="grid grid-cols-1 gap-2">
                <Button onClick={() => onAddShape?.()} className="justify-start bg-white/10 text-white hover:bg-white/20">
                  <Square className="mr-2 h-4 w-4 rotate-45" />
                  Circle
                </Button>
              </div>
          </div>

          <div>
            <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-neutral-500">
                Settings
            </h2>
            <div className="space-y-4 rounded-xl border border-white/5 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-400">Duration</span>
                    <span className="text-xs font-mono text-neutral-500">5s</span>
                </div>
                <div className="h-1 w-full rounded-full bg-white/10">
                    <div className="h-full w-1/2 rounded-full bg-white/30"></div>
                </div>
                <div className="flex items-center justify-between pt-2">
                    <span className="text-sm text-neutral-400">Easing</span>
                    <span className="text-xs text-neutral-500">Elastic</span>
                </div>
            </div>
          </div>
        </aside>

        {/* Center Canvas Area */}
        <main className="relative flex flex-1 flex-col bg-[#050505]">
            {/* Toolbar */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full border border-white/10 bg-[#0a0a0a]/80 px-2 py-1.5 shadow-2xl backdrop-blur-xl">
                <Button size="icon" className="h-8 w-8 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white">
                    <MousePointer2 className="h-4 w-4" />
                </Button>
                <div className="h-4 w-px bg-white/10" />
                <Button size="icon" className="h-8 w-8 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white">
                    <Layers className="h-4 w-4" />
                </Button>
                <Button size="icon" className="h-8 w-8 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white">
                    <Zap className="h-4 w-4" />
                </Button>
            </div>

          <div className="flex flex-1 items-center justify-center p-8 md:p-12 overflow-hidden relative">
             {/* Grid Background */}
             <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_100%)] pointer-events-none" />
             
             {/* 16:9 Aspect Ratio Container */}
            <div className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a] shadow-2xl ring-1 ring-white/5">
              {children}
            </div>
          </div>

          {/* Bottom Timeline */}
          <div className="h-64 border-t border-white/10 bg-[#0a0a0a]/50 backdrop-blur-md">
            <div className="flex h-10 items-center justify-between border-b border-white/5 px-4 bg-white/5">
                <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-neutral-500">TIMELINE</span>
                    <div className="h-3 w-px bg-white/10" />
                    <span className="text-xs font-mono text-neutral-600">00:00:00</span>
                </div>
                <div className="flex items-center gap-2">
                     <Button size="icon" className="h-6 w-6 rounded hover:bg-white/10">
                        <Play className="h-3 w-3 fill-current" />
                     </Button>
                </div>
            </div>
            <div className="relative h-full w-full p-4 overflow-x-auto">
               {/* Timeline tracks placeholder */}
               <div className="space-y-2">
                   <div className="flex items-center gap-2">
                       <div className="w-24 text-xs text-neutral-500">Shape 1</div>
                       <div className="h-6 flex-1 rounded bg-white/5 relative overflow-hidden">
                           <div className="absolute left-0 top-0 h-full w-1/3 rounded bg-purple-500/20 border border-purple-500/50"></div>
                       </div>
                   </div>
                   <div className="flex items-center gap-2">
                       <div className="w-24 text-xs text-neutral-500">Text Layer</div>
                       <div className="h-6 flex-1 rounded bg-white/5 relative overflow-hidden">
                           <div className="absolute left-1/4 top-0 h-full w-1/2 rounded bg-blue-500/20 border border-blue-500/50"></div>
                       </div>
                   </div>
                   <div className="flex items-center gap-2">
                       <div className="w-24 text-xs text-neutral-500">Background</div>
                       <div className="h-6 flex-1 rounded bg-white/5 relative overflow-hidden">
                           <div className="absolute left-0 top-0 h-full w-full rounded bg-neutral-500/10 border border-neutral-500/30"></div>
                       </div>
                   </div>
               </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

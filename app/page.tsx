'use client'

import { createClient } from '@/lib/supabase'
import { motion } from 'framer-motion'
import { ArrowRight, Play, Layers, Zap, MousePointer2 } from 'lucide-react'
import { Spotlight } from '@/components/ui/spotlight'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export default function Home() {
  const handleLogin = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    })
  }

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center overflow-hidden bg-gray-950 antialiased bg-grid-white/[0.02]">
      {/* Video Background */}
      <div className="fixed inset-0 z-0">
        <video 
          autoPlay 
          loop 
          muted 
          playsInline
          className="h-full w-full object-cover"
        >
          <source src="/resources/home-bg.mp4" type="video/mp4" />
        </video>
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Spotlight Effect */}
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20"
        fill="white"
      />

      <div className="relative z-10 flex w-full max-w-7xl flex-col items-center px-4 pt-20 md:pt-32">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/5 bg-white/5 px-4 py-1.5 text-sm font-medium text-neutral-300 backdrop-blur-md shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:bg-white/10 transition-colors duration-300"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500"></span>
          </span>
          <span className="tracking-wide text-xs uppercase text-neutral-400">v1.0 is now live</span>
        </motion.div>

        {/* Hero Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-opacity-50 bg-gradient-to-b from-white via-white/90 to-white/50 bg-clip-text text-center text-5xl font-bold tracking-tight text-transparent md:text-7xl lg:text-8xl drop-shadow-sm"
        >
          Motion Animation <br />
          Reimagined
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 max-w-2xl text-center text-lg text-neutral-400 md:text-xl leading-relaxed font-light tracking-wide"
        >
          Create stunning, Apple-quality product animations directly in your browser.
          No heavy software, no steep learning curve. Just pure flow.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
        >


          <Button
            onClick={handleLogin}
            style={{ transition: 'all 300ms ease-in-out' }}
            className="group relative h-12 w-48 overflow-hidden rounded-full bg-white px-8 text-base font-medium text-neutral-950 hover:w-64 hover:bg-neutral-200 hover:scale-105 active:scale-95"
          >
            <div className="absolute inset-0 flex h-full w-full justify-center  group-hover:duration-1000 group-hover:transform-[skew(-12deg)_translateX(100%)]">
              <div className="relative h-full w-8 bg-white/20" />
            </div>
            <span className="flex items-center gap-2">
              Start Creating
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </Button>
        </motion.div>

        {/* Hero Visual / UI Mock */}
        <motion.div
          initial={{ opacity: 0, y: 100, rotateX: 20 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 1, delay: 0.4, type: "spring", bounce: 0.2 }}
          className="mt-20 w-full perspective-1000"
        >
          <div className="relative mx-auto aspect-video w-full max-w-5xl overflow-hidden rounded-xl border border-white/10 bg-neutral-900/50 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] backdrop-blur-md">
            {/* Fake UI Header */}
            <div className="flex h-12 items-center border-b border-white/5 bg-white/5 px-4 backdrop-blur-xl">
              <div className="flex gap-2">
                <div className="h-3 w-3 rounded-full bg-[#FF5F57] shadow-inner" />
                <div className="h-3 w-3 rounded-full bg-[#FEBC2E] shadow-inner" />
                <div className="h-3 w-3 rounded-full bg-[#28C840] shadow-inner" />
              </div>
              <div className="mx-auto h-6 w-64 rounded-md bg-white/5 border border-white/5" />
            </div>

            {/* Fake UI Body */}
            <div className="flex h-full">
              {/* Sidebar */}
              <div className="w-64 border-r border-white/5 bg-neutral-900/30 p-4 hidden md:block backdrop-blur-sm">
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-8 w-full rounded-md bg-white/5 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
              </div>

              {/* Canvas Area */}
              <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-neutral-950 p-8">
                {/* Background Grid - Subtle */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-size-[24px_24px]" />

                {/* Animated Shapes Layer */}
                <div className="absolute inset-0 overflow-hidden">
                    {/* Floating Circle */}
                    <motion.div
                        animate={{ 
                            y: [-10, 10, -10],
                            x: [-5, 5, -5],
                            opacity: [0.3, 0.6, 0.3]
                        }}
                        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute left-1/4 top-1/4 h-12 w-12 rounded-full border-2 border-purple-500/30"
                    />
                    
                    {/* Rotating Cross */}
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                        className="absolute right-1/4 bottom-1/3 text-blue-500/30"
                    >
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                        </svg>
                    </motion.div>

                    {/* Wavy Squiggle */}
                    <motion.div
                        animate={{ 
                            x: [-10, 10, -10],
                            rotate: [0, 5, 0]
                        }}
                        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute left-1/3 bottom-1/4"
                    >
                        <svg width="60" height="20" viewBox="0 0 60 20" stroke="currentColor" className="text-violet-500/30" fill="none" strokeWidth="3">
                            <path d="M2 10 Q 15 -5, 30 10 T 58 10" strokeLinecap="round" />
                        </svg>
                    </motion.div>

                    {/* Triangle */}
                    <motion.div
                        animate={{ 
                            y: [10, -10, 10],
                            rotate: [0, 180, 360]
                        }}
                        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                        className="absolute right-1/3 top-1/3"
                    >
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-yellow-500/30" strokeWidth="2">
                            <path d="M12 2L22 22H2L12 2Z" />
                        </svg>
                    </motion.div>
                </div>

                {/* Floating Elements Animation (Main) */}
                <div className="relative h-64 w-64 z-10">
                   <motion.div
                      animate={{ 
                        y: [-20, 20, -20],
                        rotate: [0, 5, -5, 0],
                        scale: [1, 1.05, 1]
                      }}
                      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-0 rounded-3xl bg-linear-to-br from-purple-500/20 to-blue-500/20 border border-white/10 backdrop-blur-xl"
                   />
                   <motion.div
                      animate={{ 
                        y: [20, -20, 20],
                        rotate: [0, -5, 5, 0],
                        scale: [1.05, 1, 1.05]
                      }}
                      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                      className="absolute inset-8 rounded-2xl bg-linear-to-tr from-violet-500/20 to-cyan-500/20 border border-white/10 backdrop-blur-xl"
                   />
                   
                   {/* Center Icon */}
                   <div className="absolute inset-0 flex items-center justify-center">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="rounded-full bg-white/10 p-6 backdrop-blur-md"
                      >
                        <Play className="h-12 w-12 text-white fill-white" />
                      </motion.div>
                   </div>
                </div>

                {/* Floating UI Cards */}
                <motion.div 
                  animate={{ x: [0, 20, 0], y: [0, -10, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute right-20 top-20 rounded-xl border border-white/10 bg-neutral-900/80 p-4 backdrop-blur-md shadow-xl z-20"
                >
                    <div className="flex items-center gap-3">
                        <Layers className="h-5 w-5 text-blue-400" />
                        <div className="space-y-1">
                            <div className="h-2 w-16 rounded bg-neutral-700" />
                            <div className="h-2 w-10 rounded bg-neutral-800" />
                        </div>
                    </div>
                </motion.div>

                <motion.div 
                  animate={{ x: [0, -20, 0], y: [0, 10, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                  className="absolute left-20 bottom-20 rounded-xl border border-white/10 bg-neutral-900/80 p-4 backdrop-blur-md shadow-xl z-20"
                >
                    <div className="flex items-center gap-3">
                        <Zap className="h-5 w-5 text-yellow-400" />
                        <div className="space-y-1">
                            <div className="h-2 w-20 rounded bg-neutral-700" />
                            <div className="h-2 w-12 rounded bg-neutral-800" />
                        </div>
                    </div>
                </motion.div>
              </div>
            </div>
          </div>
          
          {/* Reflection/Glow under the UI */}
          <div className="absolute -inset-4 -z-10 bg-linear-to-t from-purple-500/20 via-blue-500/10 to-transparent blur-3xl opacity-50" />
        </motion.div>
      </div>

      {/* Simple Footer */}
      <footer className="w-full border-t border-white/5 bg-transparent py-8 text-center text-sm text-neutral-500 backdrop-blur-sm">
        <p>&copy; {new Date().getFullYear()} MotionShapes. All rights reserved.</p>
      </footer>
    </main>
  )
}

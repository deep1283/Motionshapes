'use client'

import { useEffect, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import 'pixi.js/app' // ensure Application plugins (ticker/resize) are registered

interface MotionCanvasProps {
  template: string
  templateVersion: number
  layers?: Array<{
    id: string
    shapeKind: 'circle'
    x: number
    y: number
    width: number
    height: number
    fillColor: number
  }>
}

export default function MotionCanvas({ template, templateVersion, layers = [] }: MotionCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const [isReady, setIsReady] = useState(false)

  // 1. Initialize Pixi App ONCE
  useEffect(() => {
    if (!containerRef.current || appRef.current) return

    const initPixi = async () => {
      const app = new PIXI.Application()
      await app.init({ 
        background: '#0f0f0f',
        resizeTo: containerRef.current!,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
      })
      // ensure the ticker/render loop runs even if autoStart defaults ever change
      app.start()
      app.ticker?.start()
      // enforce canvas sizing inside the container
      app.renderer.canvas.style.width = '100%'
      app.renderer.canvas.style.height = '100%'
      // force an initial resize to the container dimensions in case ResizeObserver hasn't fired yet
      const bounds = containerRef.current?.getBoundingClientRect()
      if (bounds) {
        app.renderer.resize(bounds.width, bounds.height)
      }
      
      if (containerRef.current) {
        containerRef.current.appendChild(app.canvas)
        appRef.current = app
        // keep rendering even if no template animation is running
        app.ticker.add(() => app.render())
        setIsReady(true)
      }
    }

    initPixi()

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true })
        appRef.current = null
      }
    }
  }, [])

  // 2. Handle Template Changes (Draw & Animate)
  useEffect(() => {
    if (!isReady || !appRef.current) return

    const app = appRef.current
    const stage = app.stage
    
    // Cleanup previous scene
    stage.removeChildren()
    
    // We need to define the ticker callback variable so we can remove it later
    let tickerCallback: ((ticker: PIXI.Ticker) => void) | null = null

    const bounds = containerRef.current?.getBoundingClientRect()
    const screenWidth = (bounds?.width && bounds.width > 0 ? bounds.width : containerRef.current?.clientWidth) || app.screen?.width || 800
    const screenHeight = (bounds?.height && bounds.height > 0 ? bounds.height : containerRef.current?.clientHeight) || app.screen?.height || 450
    const centerX = screenWidth / 2
    const centerY = screenHeight / 2
    const tickerCallbacks: Array<(ticker: PIXI.Ticker) => void> = []
    console.log('[MotionCanvas] draw', { template, templateVersion, layersCount: layers.length, screenWidth, screenHeight })

    // If there are layers, render/animate them and skip the built-in preview
    if (layers.length > 0) {
      layers.forEach((layer) => {
        const g = new PIXI.Graphics()
        g.circle(0, 0, layer.width / 2)
        g.fill(layer.fillColor)
        g.pivot.set(layer.width / 2, layer.height / 2)
        const posX = layer.x <= 1 ? layer.x * screenWidth : layer.x
        const posY = layer.y <= 1 ? layer.y * screenHeight : layer.y
        g.x = posX
        g.y = posY
        stage.addChild(g)

        // animate this circle when a template is chosen
        if (template === 'simple-shape') {
          g.alpha = 0
          const startX = -layer.width
          const endX = posX
          let progress = 0
          const cb = (t?: PIXI.Ticker) => {
            if (progress < 1) {
              progress += 0.02 * (t?.deltaTime ?? 1)
              const ease = 1 - Math.pow(1 - progress, 3)
              g.x = startX + (endX - startX) * ease
              g.alpha = progress
            }
          }
          tickerCallbacks.push(cb)
        } else if (template === 'ui-screen') {
          const startY = screenHeight + layer.height
          const endY = posY
          g.y = startY
          let progress = 0
          const cb = (t?: PIXI.Ticker) => {
            if (progress < 1) {
              progress += 0.015 * (t?.deltaTime ?? 1)
              const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
              g.y = startY - (startY - endY) * ease
            }
          }
          tickerCallbacks.push(cb)
        } else if (template === 'logo-pop') {
          g.scale.set(0.3)
          let progress = 0
          const cb = (t?: PIXI.Ticker) => {
            if (progress < 1) {
              progress += 0.01 * (t?.deltaTime ?? 1)
              const c4 = (2 * Math.PI) / 3
              const ease = progress === 0 ? 0 : progress === 1 ? 1 : Math.pow(2, -10 * progress) * Math.sin((progress * 10 - 0.75) * c4) + 1
              const currentScale = 0.3 + (1 - 0.3) * ease
              g.scale.set(currentScale)
            }
          }
          tickerCallbacks.push(cb)
        }
      })

      tickerCallbacks.forEach((cb) => app.ticker.add(cb))
      if (tickerCallbacks.length > 0) {
        console.log('[MotionCanvas] animating layers', tickerCallbacks.length)
      }
      if (tickerCallbacks.length > 0) {
        app.ticker.start()
      }

      // render once to show the shapes even if no animation selected
      app.render()

      return () => {
        tickerCallbacks.forEach((cb) => app.ticker.remove(cb))
        stage.removeChildren()
      }
    }

    // No layers -> show built-in template preview
    if (template === 'simple-shape') {
        console.log('[MotionCanvas] preview simple-shape')
        const graphics = new PIXI.Graphics()
        graphics.circle(0, 0, 60)
        graphics.fill(0xffffff)
        graphics.x = -100
        graphics.y = centerY
        graphics.alpha = 0
        stage.addChild(graphics)

        let progress = 0
        tickerCallback = () => {
          if (progress < 1) {
            progress += 0.02
            const ease = 1 - Math.pow(1 - progress, 3)
            graphics.x = -100 + (centerX + 100) * ease
            graphics.alpha = progress
          }
        }

    } else if (template === 'ui-screen') {
        console.log('[MotionCanvas] preview ui-screen')
        const container = new PIXI.Container()
        container.x = centerX
        container.y = app.screen.height + 200
        
        const shadow = new PIXI.Graphics()
        shadow.roundRect(-200, -150, 400, 300, 20)
        shadow.fill({ color: 0x000000, alpha: 0.5 })
        shadow.y = 10 
        container.addChild(shadow)

        const card = new PIXI.Graphics()
        card.roundRect(-200, -150, 400, 300, 20)
        card.fill(0x3b82f6)
        card.roundRect(-180, -130, 360, 40, 10).fill(0xffffff)
        card.roundRect(-180, -70, 100, 100, 10).fill(0xffffff)
        card.roundRect(-60, -70, 240, 20, 5).fill(0xffffff)
        card.roundRect(-60, -40, 180, 20, 5).fill(0xffffff)

        container.addChild(card)
        stage.addChild(container)

        let progress = 0
        tickerCallback = () => {
          if (progress < 1) {
            progress += 0.015
            const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
            container.y = (app.screen.height + 200) - ((app.screen.height + 200) - centerY) * ease
          }
        }

    } else if (template === 'logo-pop') {
        console.log('[MotionCanvas] preview logo-pop')
        const graphics = new PIXI.Graphics()
        graphics.roundRect(-50, -50, 100, 100, 25)
        graphics.fill(0x10b981)
        graphics.x = centerX
        graphics.y = centerY
        graphics.scale.set(0.3)
        stage.addChild(graphics)

        let progress = 0
        tickerCallback = () => {
          if (progress < 1) {
            progress += 0.01
            const c4 = (2 * Math.PI) / 3;
            const ease = progress === 0 ? 0 : progress === 1 ? 1 : Math.pow(2, -10 * progress) * Math.sin((progress * 10 - 0.75) * c4) + 1;
            const currentScale = 0.3 + (1 - 0.3) * ease
            graphics.scale.set(currentScale)
          }
        }
    }

    // Add the ticker if we have one
    if (tickerCallback) {
        app.ticker.add(tickerCallback)
        app.ticker.start()
    }

    // render first frame immediately so users see instant feedback on template switch
    app.render()

    // Cleanup function for this effect
    return () => {
        if (tickerCallback) {
            app.ticker.remove(tickerCallback)
        }
        stage.removeChildren()
    }

  }, [template, templateVersion, isReady, layers]) // Re-run when template changes OR when app becomes ready

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-[#0b0b0b]">
      <div ref={containerRef} className="h-full w-full" />
      {/* DOM overlay for layers so a shape is always visible; mimic template motion with CSS */}
      {layers.length > 0 && (
        <div className="pointer-events-none absolute inset-0">
          {layers.map((layer) => {
            const bounds = containerRef.current?.getBoundingClientRect()
            const screenWidth = bounds?.width || 1
            const screenHeight = bounds?.height || 1
            const posX = layer.x <= 1 ? layer.x * screenWidth : layer.x
            const posY = layer.y <= 1 ? layer.y * screenHeight : layer.y
            const animation =
              template === 'logo-pop'
                ? 'bounce-in 1s cubic-bezier(.68,-0.55,.27,1.55)'
                : template === 'ui-screen'
                ? 'slide-in 1s ease-out'
                : template === 'simple-shape'
                ? 'pop 1s ease-out'
                : undefined
            return (
              <div
                key={layer.id}
                style={{
                  position: 'absolute',
                  left: posX,
                  top: posY,
                  width: layer.width,
                  height: layer.height,
                  transform: 'translate(-50%, -50%)',
                  background: '#fff',
                  borderRadius: '50%',
                  opacity: 0.9,
                  animation,
                }}
              />
            )
          })}
        </div>
      )}

      {/* Fallback DOM previews when no layers exist but a template is chosen */}
      {layers.length === 0 && template && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {template === 'simple-shape' && (
            <div className="h-24 w-24 rounded-full bg-white/80 animate-[pop_1s_ease-out]" />
          )}
          {template === 'ui-screen' && (
            <div className="relative h-56 w-80 rounded-2xl bg-blue-500/70 shadow-2xl shadow-black/50 animate-[slide-in_1s_ease-out]">
              <div className="absolute left-4 right-4 top-4 h-8 rounded-lg bg-white/80" />
              <div className="absolute left-4 top-16 h-24 w-24 rounded-xl bg-white/80" />
              <div className="absolute left-32 right-4 top-20 h-6 rounded-md bg-white/70" />
              <div className="absolute left-32 right-4 top-32 h-6 rounded-md bg-white/70" />
              <div className="absolute left-32 right-4 top-44 h-6 rounded-md bg-white/70" />
            </div>
          )}
          {template === 'logo-pop' && (
            <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-emerald-400/80 text-black font-bold text-xl animate-[bounce-in_1s_cubic-bezier(.68,-0.55,.27,1.55)]">
              Logo
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes pop {
          0% { transform: scale(0.8); opacity: 0.4; }
          40% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes slide-in {
          0% { transform: translateY(80px) scale(0.96); opacity: 0; }
          60% { transform: translateY(-6px) scale(1.02); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes bounce-in {
          0% { transform: scale(0.3); opacity: 0.2; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

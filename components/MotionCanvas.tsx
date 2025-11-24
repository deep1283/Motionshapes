'use client'

import { useEffect, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import 'pixi.js/app' // ensure Application plugins (ticker/resize) are registered
import 'pixi.js/events' // enable pointer events

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
  onUpdateLayerPosition?: (id: string, x: number, y: number) => void
}

export default function MotionCanvas({ template, templateVersion, layers = [], onUpdateLayerPosition }: MotionCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const [isReady, setIsReady] = useState(false)
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const graphicsByIdRef = useRef<Record<string, PIXI.Graphics>>({})
  const domDragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)

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

  // Debug: log raw DOM pointer events on the canvas to ensure we receive them
  useEffect(() => {
    const app = appRef.current
    if (!app) return
    const handler = (e: PointerEvent) => {}
    app.canvas.addEventListener('pointerdown', handler)
    return () => {
      app.canvas.removeEventListener('pointerdown', handler)
    }
  }, [isReady])

  // DOM drag handler as a fallback for Pixi events
  useEffect(() => {
    if (!containerRef.current) return
    const handleMove = (e: PointerEvent) => {
      if (!domDragRef.current || !containerRef.current) return
      const bounds = containerRef.current.getBoundingClientRect()
      const newX = e.clientX - bounds.left - domDragRef.current.offsetX
      const newY = e.clientY - bounds.top - domDragRef.current.offsetY
      const id = domDragRef.current.id
      onUpdateLayerPosition?.(id, newX, newY)
      const g = graphicsByIdRef.current[id]
      if (g) {
        g.x = newX
        g.y = newY
      }
    }
    const handleUp = () => {
      domDragRef.current = null
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [onUpdateLayerPosition])

  // 2. Handle Template Changes (Draw & Animate)
  useEffect(() => {
    if (!isReady || !appRef.current) return

    const app = appRef.current
    const bounds = containerRef.current?.getBoundingClientRect()
    const screenWidth = (bounds?.width && bounds.width > 0 ? bounds.width : containerRef.current?.clientWidth) || app.screen?.width || 800
    const screenHeight = (bounds?.height && bounds.height > 0 ? bounds.height : containerRef.current?.clientHeight) || app.screen?.height || 450
    const stage = app.stage
    stage.interactive = true
    stage.eventMode = 'static'
    stage.hitArea = new PIXI.Rectangle(0, 0, screenWidth, screenHeight)
    stage.cursor = 'default'
    
    // Cleanup previous scene
    stage.removeChildren()
    
    // We need to define the ticker callback variable so we can remove it later
    let tickerCallback: ((ticker: PIXI.Ticker) => void) | null = null
    const centerX = screenWidth / 2
    const centerY = screenHeight / 2
    const tickerCallbacks: Array<(ticker: PIXI.Ticker) => void> = []
    graphicsByIdRef.current = {}

    const handlePointerMove = (e: PIXI.FederatedPointerEvent) => {
      if (!dragRef.current) return
      const { id, offsetX, offsetY } = dragRef.current
      const pos = e.global
      const newX = pos.x - offsetX
      const newY = pos.y - offsetY
      const g = graphicsByIdRef.current[id]
      if (g) {
        g.x = newX
        g.y = newY
      }
      onUpdateLayerPosition?.(id, newX, newY)
    }

    const clearDrag = () => {
      dragRef.current = null
      stage.cursor = 'default'
    }

    stage.on('pointermove', handlePointerMove)
    const handleStagePointerDown = (e: PIXI.FederatedPointerEvent) => {
      if (dragRef.current) return
    }
    stage.on('pointerdown', handleStagePointerDown)
    stage.on('pointerup', clearDrag)
    stage.on('pointerupoutside', clearDrag)

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
        g.interactive = true
        g.eventMode = 'dynamic'
        g.cursor = 'pointer'
        g.hitArea = new PIXI.Circle(0, 0, layer.width / 2)
        g.on('pointerdown', (e) => {
          e.stopPropagation()
          const pos = e.global
          dragRef.current = {
            id: layer.id,
            offsetX: pos.x - g.x,
            offsetY: pos.y - g.y,
          }
          stage.cursor = 'grabbing'
        })
        graphicsByIdRef.current[layer.id] = g
        stage.addChild(g)

        // animate this circle when a template is chosen
        if (template === 'roll') {
          const startX = posX
          const travel = Math.min(screenWidth * 0.4, 320)
          let theta = 0
          const cb = (t?: PIXI.Ticker) => {
            const delta = t?.deltaTime ?? 1
            theta += 0.05 * delta
            g.x = startX + Math.sin(theta) * travel
            g.rotation += 0.12 * delta
          }
          tickerCallbacks.push(cb)
        } else if (template === 'jump') {
          const startY = posY
          const amplitude = Math.min(screenHeight * 0.25, 220)
          let progress = 0
          const cb = (t?: PIXI.Ticker) => {
            const delta = t?.deltaTime ?? 1
            if (progress >= 1) return
            progress = Math.min(1, progress + 0.035 * delta)
            const hop = Math.sin(progress * Math.PI)
            g.y = startY - hop * amplitude
            g.scale.set(1 + hop * 0.05, 1 - hop * 0.05)
          }
          tickerCallbacks.push(cb)
        } else if (template === 'pop') {
          let progress = 0
          const cb = (t?: PIXI.Ticker) => {
            const delta = t?.deltaTime ?? 1
            if (progress >= 1) return
            progress = Math.min(1, progress + 0.03 * delta)

            // Inflate first
            if (progress < 0.6) {
              const inflate = 1 + 0.4 * (progress / 0.6)
              g.scale.set(inflate)
              g.alpha = 1
            } else if (progress < 0.85) {
              // Shake phase
              const shake = Math.sin(progress * 40) * 6
              const wobbleScale = 1.4 + 0.1 * Math.sin(progress * 20)
              g.scale.set(wobbleScale)
              g.x = posX + shake
              g.rotation = Math.sin(progress * 30) * 0.08
              g.alpha = 1
            } else {
              // Burst fade-out
              const burstProgress = (progress - 0.85) / 0.15
              const eased = 1 - Math.pow(1 - burstProgress, 2)
              g.scale.set(1.5 + 0.4 * eased)
              g.alpha = Math.max(0, 1 - eased)
              g.rotation = 0
            }
          }
          tickerCallbacks.push(cb)
        }
      })

      tickerCallbacks.forEach((cb) => app.ticker.add(cb))
      if (tickerCallbacks.length > 0) {
        app.ticker.start()
      }

      // render once to show the shapes even if no animation selected
      app.render()

      return () => {
        // persist final positions so deselecting the template keeps last coords
        if (template === 'roll') {
          layers.forEach((layer) => {
            const g = graphicsByIdRef.current[layer.id]
            if (g) {
              onUpdateLayerPosition?.(layer.id, g.x, g.y)
            }
          })
        }
        tickerCallbacks.forEach((cb) => app.ticker.remove(cb))
        stage.removeChildren()
        stage.off('pointermove', handlePointerMove)
        stage.off('pointerup', clearDrag)
        stage.off('pointerupoutside', clearDrag)
        stage.off('pointerdown', handleStagePointerDown)
      }
    }

    // No layers -> show built-in template preview
    if (template === 'roll') {
        const graphics = new PIXI.Graphics()
        graphics.circle(0, 0, 60)
        graphics.fill(0xffffff)
        graphics.x = centerX
        graphics.y = centerY
        stage.addChild(graphics)

        let progress = 0
        const travel = Math.min(app.screen.width * 0.4, 320)
        tickerCallback = (t?: PIXI.Ticker) => {
          const delta = t?.deltaTime ?? 1
          if (progress >= 1) return
          progress = Math.min(1, progress + 0.01 * delta)
          const ease = 1 - Math.pow(1 - progress, 2)
          graphics.rotation = ease * Math.PI * 4
          graphics.x = centerX + travel * ease
        }
    } else if (template === 'jump') {
        const graphics = new PIXI.Graphics()
        graphics.circle(0, 0, 60)
        graphics.fill(0xffffff)
        graphics.x = centerX
        graphics.y = centerY
        stage.addChild(graphics)

        let progress = 0
        const amplitude = Math.min(app.screen.height * 0.25, 220)
        tickerCallback = (t?: PIXI.Ticker) => {
          const delta = t?.deltaTime ?? 1
          if (progress >= 1) return
          progress = Math.min(1, progress + 0.02 * delta)
          const hop = Math.sin(progress * Math.PI)
          graphics.y = centerY - hop * amplitude
          graphics.scale.set(1 + hop * 0.05, 1 - hop * 0.05)
        }
    } else if (template === 'pop') {
        const graphics = new PIXI.Graphics()
        graphics.circle(0, 0, 60)
        graphics.fill(0xffffff)
        graphics.x = centerX
        graphics.y = centerY
        stage.addChild(graphics)

        let progress = 0
        tickerCallback = (t?: PIXI.Ticker) => {
          const delta = t?.deltaTime ?? 1
          if (progress >= 1) return
          progress = Math.min(1, progress + 0.03 * delta)

          if (progress < 0.6) {
            const inflate = 1 + 0.4 * (progress / 0.6)
            graphics.scale.set(inflate)
            graphics.alpha = 1
          } else if (progress < 0.85) {
            const shake = Math.sin(progress * 40) * 6
            const wobbleScale = 1.4 + 0.1 * Math.sin(progress * 20)
            graphics.scale.set(wobbleScale)
            graphics.x = centerX + shake
            graphics.rotation = Math.sin(progress * 30) * 0.08
            graphics.alpha = 1
          } else {
            const burstProgress = (progress - 0.85) / 0.15
            const eased = 1 - Math.pow(1 - burstProgress, 2)
            graphics.scale.set(1.5 + 0.4 * eased)
            graphics.alpha = Math.max(0, 1 - eased)
            graphics.rotation = 0
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
        stage.off('pointermove', handlePointerMove)
        stage.off('pointerup', clearDrag)
        stage.off('pointerupoutside', clearDrag)
        stage.off('pointerdown', handleStagePointerDown)
    }

  }, [template, templateVersion, isReady, layers, onUpdateLayerPosition]) // Re-run when template changes OR when app becomes ready

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-[#0b0b0b]">
      <div ref={containerRef} className="h-full w-full" />
      {/* DOM overlay for layers so a shape is always visible; mimic template motion with CSS AND enable dragging */}
      {layers.length > 0 && (
        <div className="absolute inset-0">
          {layers.map((layer) => {
            const bounds = containerRef.current?.getBoundingClientRect()
            const screenWidth = bounds?.width || 1
            const screenHeight = bounds?.height || 1
            const posX = layer.x <= 1 ? layer.x * screenWidth : layer.x
            const posY = layer.y <= 1 ? layer.y * screenHeight : layer.y
              const animation =
                template === 'roll'
                  ? 'roll-x-once 2s linear forwards'
                : template === 'jump'
                  ? 'jump-y-once 1.2s ease-out forwards'
                : template === 'pop'
                  ? 'pop-burst 1.2s ease-out forwards'
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
                  touchAction: 'none',
                  cursor: 'grab',
                }}
                onPointerDown={(e) => {
                  const boundsNow = containerRef.current?.getBoundingClientRect()
                  if (!boundsNow) return
                  const offsetX = e.clientX - boundsNow.left - posX
                  const offsetY = e.clientY - boundsNow.top - posY
                  domDragRef.current = { id: layer.id, offsetX, offsetY }
                }}
              />
            )
          })}
        </div>
      )}

      {/* Fallback DOM previews when no layers exist but a template is chosen */}
      {layers.length === 0 && template && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {template === 'roll' && (
            <div className="h-24 w-24 rounded-full bg-white/80 animate-[roll-x-once_2s_linear_forwards]" />
          )}
          {template === 'jump' && (
            <div className="h-24 w-24 rounded-full bg-white/80 animate-[jump-y-once_0.95s_ease-out_forwards]" />
          )}
          {template === 'pop' && (
            <div className="h-24 w-24 rounded-full bg-white/80 animate-[pop-burst_1.2s_ease-out_forwards]" />
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes roll-x-once {
          0% { transform: translate(-50%, -50%) translateX(0) rotate(0deg); }
          100% { transform: translate(-50%, -50%) translateX(140px) rotate(360deg); }
        }
        @keyframes jump-y-once {
          0% { transform: translate(-50%, -50%) translateY(0) scale(1); }
          40% { transform: translate(-50%, -50%) translateY(-120px) scale(1.05, 0.95); }
          70% { transform: translate(-50%, -50%) translateY(-30px) scale(0.98, 1.02); }
          100% { transform: translate(-50%, -50%) translateY(0) scale(1); }
        }
        @keyframes pop-burst {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.35); opacity: 1; }
          70% { transform: translate(-50%, -50%) translateX(-8px) rotate(-2deg) scale(1.4); opacity: 1; }
          80% { transform: translate(-50%, -50%) translateX(8px) rotate(2deg) scale(1.45); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1.9) rotate(0deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

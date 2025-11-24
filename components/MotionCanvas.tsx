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
  onTemplateComplete?: () => void
  isDrawingPath?: boolean
  pathPoints?: Array<{ x: number; y: number }>
  onAddPathPoint?: (x: number, y: number) => void
  onFinishPath?: () => void
  onSelectLayer?: (id: string) => void
  selectedLayerId?: string
  activePathPoints?: Array<{ x: number; y: number }>
  pathVersion?: number
  pathLayerId?: string
}

export default function MotionCanvas({ template, templateVersion, layers = [], onUpdateLayerPosition, onTemplateComplete, isDrawingPath = false, pathPoints = [], onAddPathPoint, onFinishPath, onSelectLayer, selectedLayerId, activePathPoints = [], pathVersion = 0, pathLayerId }: MotionCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const [isReady, setIsReady] = useState(false)
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const graphicsByIdRef = useRef<Record<string, PIXI.Graphics>>({})
  const domDragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const templateCompleteCalled = useRef(false)

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

    templateCompleteCalled.current = false
    const notifyComplete = () => {
      if (templateCompleteCalled.current) return
      templateCompleteCalled.current = true
      onTemplateComplete?.()
    }

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
        // add a small notch so roll rotation is visible
        if (template === 'roll') {
          g.moveTo(0, -layer.width / 2)
          g.lineTo(0, -layer.width / 3)
          g.stroke({ color: 0x000000, width: 6, alpha: 0.8 })
        }
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
          onSelectLayer?.(layer.id)
          dragRef.current = {
            id: layer.id,
            offsetX: pos.x - g.x,
            offsetY: pos.y - g.y,
          }
          stage.cursor = 'grabbing'
        })
        graphicsByIdRef.current[layer.id] = g
        stage.addChild(g)

        const shouldAnimateTemplate = selectedLayerId ? layer.id === selectedLayerId : true

        // animate this circle when a template is chosen
        if (!isDrawingPath && pathLayerId && layer.id === pathLayerId && activePathPoints.length >= 2) {
          const pts = activePathPoints.map((pt) => ({
            x: pt.x * screenWidth,
            y: pt.y * screenHeight,
          }))
          const segments = []
          let totalLen = 0
          for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1]
            const b = pts[i]
            const len = Math.hypot(b.x - a.x, b.y - a.y)
            totalLen += len
            segments.push({ a, b, len })
          }
          const durationMs = 1200
          let elapsed = 0
          const cb = (t?: PIXI.Ticker) => {
            if (totalLen === 0) return
            const deltaMs = t?.deltaMS ?? 16.67
            elapsed = Math.min(durationMs, elapsed + deltaMs)
            const progress = elapsed / durationMs
            const targetDist = progress * totalLen
            let acc = 0
            for (let i = 0; i < segments.length; i++) {
              const { a, b, len } = segments[i]
              if (acc + len >= targetDist) {
                const segT = len === 0 ? 0 : (targetDist - acc) / len
                g.x = a.x + (b.x - a.x) * segT
                g.y = a.y + (b.y - a.y) * segT
                break
              }
              acc += len
            }
            if (progress >= 1) {
              const last = pts[pts.length - 1]
              g.x = last.x
              g.y = last.y
              onUpdateLayerPosition?.(layer.id, g.x, g.y)
              notifyComplete()
            }
          }
          tickerCallbacks.push(cb)
        } else if (shouldAnimateTemplate && template === 'roll') {
          const startX = posX
          const travel = Math.min(screenWidth * 0.21, 200)
          const finalX = startX + travel
          const durationMs = 1200
          let elapsed = 0
          const cb = (t?: PIXI.Ticker) => {
            const deltaMs = t?.deltaMS ?? 16.67
            elapsed = Math.min(durationMs, elapsed + deltaMs)
            const progress = elapsed / durationMs
            const ease = 1 - Math.pow(1 - progress, 2)
            g.x = startX + travel * ease
            g.rotation = ease * Math.PI * 4
            if (progress >= 1) {
              g.x = finalX
              onUpdateLayerPosition?.(layer.id, finalX, g.y)
              notifyComplete()
            }
          }
          tickerCallbacks.push(cb)
        } else if (shouldAnimateTemplate && template === 'jump') {
          const startY = posY
          const amplitude = Math.min(screenHeight * 0.25, 220)
          const durationMs = 1000
          let elapsed = 0
          const cb = (t?: PIXI.Ticker) => {
            const deltaMs = t?.deltaMS ?? 16.67
            elapsed = Math.min(durationMs, elapsed + deltaMs)
            const progress = elapsed / durationMs
            const hop = Math.sin(progress * Math.PI) // smooth up and down
            g.y = startY - hop * amplitude
            g.scale.set(1 + hop * 0.05, 1 - hop * 0.05)
            if (progress >= 1) {
              onUpdateLayerPosition?.(layer.id, g.x, g.y)
              notifyComplete()
            }
          }
          tickerCallbacks.push(cb)
        } else if (shouldAnimateTemplate && template === 'pop') {
          const durationMs = 1000
          let elapsed = 0
          const cb = (t?: PIXI.Ticker) => {
            const deltaMs = t?.deltaMS ?? 16.67
            elapsed = Math.min(durationMs, elapsed + deltaMs)
            const progress = elapsed / durationMs

            if (progress < 0.5) {
              // inflate
              const inflate = 1 + 0.6 * (progress / 0.5)
              g.scale.set(inflate)
              g.alpha = 1
              g.rotation = 0
              g.x = posX
            } else if (progress < 0.8) {
              // shake near max size
              const shakeT = (progress - 0.5) / 0.3
              const shake = Math.sin(shakeT * Math.PI * 6) * 6
              const wobbleScale = 1.6 + 0.12 * Math.sin(shakeT * Math.PI * 4)
              g.scale.set(wobbleScale)
              g.x = posX + shake
              g.rotation = Math.sin(shakeT * Math.PI * 5) * 0.12
              g.alpha = 1
            } else {
              // burst and fade
              const burstT = (progress - 0.8) / 0.2
              const eased = 1 - Math.pow(1 - burstT, 2)
              g.scale.set(1.7 + 0.5 * eased)
              g.alpha = Math.max(0, 1 - eased)
              g.rotation = 0
              g.x = posX
            }
            if (progress >= 1) {
              onUpdateLayerPosition?.(layer.id, g.x, g.y)
              notifyComplete()
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
        // notch for visible rotation
        graphics.moveTo(0, -60)
        graphics.lineTo(0, -40)
        graphics.stroke({ color: 0x000000, width: 6, alpha: 0.8 })
        graphics.x = centerX
        graphics.y = centerY
        stage.addChild(graphics)

        let progress = 0
        const travel = Math.min(app.screen.width * 0.21, 200)
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

        const durationMs = 1000
        let elapsed = 0
        const amplitude = Math.min(app.screen.height * 0.25, 220)
        tickerCallback = (t?: PIXI.Ticker) => {
          const deltaMs = t?.deltaMS ?? 16.67
          elapsed = Math.min(durationMs, elapsed + deltaMs)
          const progress = elapsed / durationMs
          const hop = Math.sin(progress * Math.PI)
          graphics.y = centerY - hop * amplitude
          graphics.scale.set(1 + hop * 0.05, 1 - hop * 0.05)
          if (progress >= 1) notifyComplete()
        }
    } else if (template === 'pop') {
        const graphics = new PIXI.Graphics()
        graphics.circle(0, 0, 60)
        graphics.fill(0xffffff)
        graphics.x = centerX
        graphics.y = centerY
        stage.addChild(graphics)

        const durationMs = 1000
        let elapsed = 0
        tickerCallback = (t?: PIXI.Ticker) => {
          const deltaMs = t?.deltaMS ?? 16.67
          elapsed = Math.min(durationMs, elapsed + deltaMs)
          const progress = elapsed / durationMs

          if (progress < 0.5) {
            const inflate = 1 + 0.6 * (progress / 0.5)
            graphics.scale.set(inflate)
            graphics.alpha = 1
            graphics.rotation = 0
            graphics.x = centerX
          } else if (progress < 0.8) {
            const shakeT = (progress - 0.5) / 0.3
            const shake = Math.sin(shakeT * Math.PI * 6) * 6
            const wobbleScale = 1.6 + 0.12 * Math.sin(shakeT * Math.PI * 4)
            graphics.scale.set(wobbleScale)
            graphics.x = centerX + shake
            graphics.rotation = Math.sin(shakeT * Math.PI * 5) * 0.12
            graphics.alpha = 1
          } else {
            const burstT = (progress - 0.8) / 0.2
            const eased = 1 - Math.pow(1 - burstT, 2)
            graphics.scale.set(1.7 + 0.5 * eased)
            graphics.alpha = Math.max(0, 1 - eased)
            graphics.rotation = 0
            graphics.x = centerX
          }
          if (progress >= 1) notifyComplete()
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

  }, [template, templateVersion, pathVersion, pathLayerId, activePathPoints, isReady, onUpdateLayerPosition]) // Re-run on template/path switches; layer moves are handled directly

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-[#0b0b0b]">
      <div ref={containerRef} className="h-full w-full" />
      {/* Path draw overlay */}
      {isDrawingPath && (
        <div
          className="absolute inset-0 cursor-crosshair"
          style={{ zIndex: 20 }}
          onClick={(e) => {
            if (!containerRef.current) return
            const bounds = containerRef.current.getBoundingClientRect()
            const x = (e.clientX - bounds.left) / bounds.width
            const y = (e.clientY - bounds.top) / bounds.height
            onAddPathPoint?.(x, y)
          }}
          onDoubleClick={(e) => {
            e.preventDefault()
            onFinishPath?.()
          }}
        >
          <svg className="h-full w-full" style={{ pointerEvents: 'none' }}>
            {(() => {
              if (!containerRef.current || pathPoints.length === 0) return null
              const bounds = containerRef.current.getBoundingClientRect()
              const toPx = (pt: { x: number; y: number }) => ({
                x: pt.x * bounds.width,
                y: pt.y * bounds.height,
              })
              const pts = pathPoints.map(toPx)
              const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
              return (
                <>
                  <path d={d} stroke="#22c55e" strokeWidth={2} fill="none" strokeDasharray="6 4" />
                  {pts.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={4} fill="#22c55e" stroke="#0f0f0f" strokeWidth={2} />
                  ))}
                </>
              )
            })()}
          </svg>
        </div>
      )}
      {/* DOM overlay for layers so a shape is always visible; mimic template motion with CSS AND enable dragging */}
      {layers.length > 0 && (
        <div className="absolute inset-0" style={{ pointerEvents: isDrawingPath ? 'none' : undefined }}>
          {layers.map((layer) => {
            const bounds = containerRef.current?.getBoundingClientRect()
            const screenWidth = bounds?.width || 1
            const screenHeight = bounds?.height || 1
            const posX = layer.x <= 1 ? layer.x * screenWidth : layer.x
            const posY = layer.y <= 1 ? layer.y * screenHeight : layer.y
            const travel = Math.min(screenWidth * 0.21, 200)
              let animation: string | undefined
              if (!selectedLayerId || selectedLayerId === layer.id) {
                animation =
                  template === 'roll'
                    ? `roll-x-var 1.2s linear forwards`
                  : template === 'jump'
                    ? 'jump-y-once 1s ease-out forwards'
                  : template === 'pop'
                    ? 'pop-burst 1s ease-out forwards'
                    : undefined
              } else {
                animation = undefined
              }
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
                  outline: selectedLayerId === layer.id ? '2px solid #22c55e' : undefined,
                  outlineOffset: '2px',
                  animation,
                  '--roll-travel': `${travel}px`,
                  touchAction: 'none',
                  cursor: 'grab',
                } as React.CSSProperties}
                onPointerDown={(e) => {
                  const boundsNow = containerRef.current?.getBoundingClientRect()
                  if (!boundsNow) return
                  onSelectLayer?.(layer.id)
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
            <div className="h-24 w-24 rounded-full bg-white/80 animate-[jump-y-once_1s_ease-out_forwards]" />
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
        @keyframes roll-x-var {
          0% { transform: translate(-50%, -50%) translateX(0) rotate(0deg); }
          100% { transform: translate(-50%, -50%) translateX(var(--roll-travel, 140px)) rotate(360deg); }
        }
        @keyframes jump-y-once {
          0% { transform: translate(-50%, -50%) translateY(0) scale(1); }
          45% { transform: translate(-50%, -50%) translateY(-120px) scale(1.05, 0.95); }
          85% { transform: translate(-50%, -50%) translateY(-20px) scale(0.99, 1.01); }
          100% { transform: translate(-50%, -50%) translateY(0) scale(1); }
        }
        @keyframes pop-burst {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.6); opacity: 1; }
          75% { transform: translate(-50%, -50%) translateX(-8px) rotate(-2deg) scale(1.7); opacity: 1; }
          90% { transform: translate(-50%, -50%) translateX(8px) rotate(2deg) scale(1.8); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2.1) rotate(0deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

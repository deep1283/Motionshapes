'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout, { BackgroundSettings } from '@/components/DashboardLayout'
import dynamic from 'next/dynamic'
import { TimelineProvider, useTimeline, useTimelineActions } from '@/lib/timeline-store'
import { TemplateId } from '@/lib/presets'

// Dynamically import MotionCanvas to avoid SSR issues with Pixi.js
const MotionCanvas = dynamic(() => import('@/components/MotionCanvas'), { 
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-neutral-800" />
})

type ShapeKind = 'circle'

interface Layer {
  id: string
  type: 'shape'
  shapeKind: ShapeKind
  x: number
  y: number
  width: number
  height: number
  fillColor: number
}

export default function DashboardPage() {
  return (
    <TimelineProvider>
      <DashboardContent />
    </TimelineProvider>
  )
}

function DashboardContent() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [templateVersion, setTemplateVersion] = useState(0)
  const [layers, setLayers] = useState<Layer[]>([])
  const [isDrawingPath, setIsDrawingPath] = useState(false)
  const [pathPoints, setPathPoints] = useState<Array<{ x: number; y: number }>>([])
  const [activePathPoints, setActivePathPoints] = useState<Array<{ x: number; y: number }>>([])
  const [pathVersion, setPathVersion] = useState(0)
  const [selectedLayerId, setSelectedLayerId] = useState('')
  const [showSelectShapeHint, setShowSelectShapeHint] = useState(false)
  const [background, setBackground] = useState<BackgroundSettings>({
    mode: 'solid',
    solid: '#0f0f0f',
    from: '#0f172a',
    to: '#0b1223',
    opacity: 1,
  })
  const timeline = useTimelineActions()
  const playhead = useTimeline((s) => s.currentTime)
  const templateSpeed = useTimeline((s) => s.templateSpeed)
  const rollDistance = useTimeline((s) => s.rollDistance)
  const jumpHeight = useTimeline((s) => s.jumpHeight)
  const jumpVelocity = useTimeline((s) => s.jumpVelocity)
  const popScale = useTimeline((s) => s.popScale)
  const popSpeed = useTimeline((s) => s.popSpeed)
  const popWobble = useTimeline((s) => s.popWobble)
  const popCollapse = useTimeline((s) => s.popCollapse)
  const tracks = useTimeline((s) => s.tracks)
  const lastTemplateMeta = useRef<Record<string, { template: TemplateId; startAt: number }>>({})

  const getTrackEndTime = (track: (typeof tracks)[number] | undefined) => {
    if (!track) return 0
    const times: number[] = []
    if (track.position?.length) times.push(track.position[track.position.length - 1].time)
    if (track.scale?.length) times.push(track.scale[track.scale.length - 1].time)
    if (track.rotation?.length) times.push(track.rotation[track.rotation.length - 1].time)
    if (track.opacity?.length) times.push(track.opacity[track.opacity.length - 1].time)
    return times.length ? Math.max(...times) : 0
  }

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/')
      } else {
        setIsLoading(false)
      }
    }

    checkUser()
  }, [router])

  useEffect(() => {
    if (!selectedTemplate) {
      timeline.setPlaying(false)
      return
    }
    // ensure we have a target layer; fall back to the first layer if none selected
    const targetLayerId = selectedLayerId || layers[0]?.id
    if (!targetLayerId) return
    const targetLayer = layers.find((l) => l.id === targetLayerId)
    const targetTrack = tracks.find((t) => t.layerId === targetLayerId)
    const hasExistingKeys =
      !!targetTrack &&
      [
        targetTrack.position?.length ?? 0,
        targetTrack.scale?.length ?? 0,
        targetTrack.rotation?.length ?? 0,
        targetTrack.opacity?.length ?? 0,
      ].some((len) => len > 1)

    const previousTemplate = lastTemplateMeta.current[targetLayerId]
    const isSameTemplate = previousTemplate?.template === selectedTemplate

    const trackEnd = getTrackEndTime(targetTrack)
    const startAt = isSameTemplate && typeof previousTemplate?.startAt === 'number' ? previousTemplate.startAt : trackEnd
    const shouldAppend = !isSameTemplate && hasExistingKeys
    const targetDuration = shouldAppend && trackEnd > 0 ? trackEnd : undefined

    timeline.applyPresetToLayer(
      targetLayerId,
      selectedTemplate as TemplateId,
      {
        position: targetLayer ? { x: targetLayer.x, y: targetLayer.y } : undefined,
      },
      { append: shouldAppend, startAt: isSameTemplate ? startAt : shouldAppend ? startAt : 0, targetDuration }
    )
    lastTemplateMeta.current[targetLayerId] = { template: selectedTemplate as TemplateId, startAt }
    timeline.setCurrentTime(startAt)
    timeline.setPlaying(true)
  }, [
    selectedTemplate,
    selectedLayerId,
    layers,
    timeline,
    templateSpeed,
    rollDistance,
    jumpHeight,
    jumpVelocity,
    popScale,
    popSpeed,
    popWobble,
    popCollapse,
  ])

  if (isLoading) {
    return <div className="flex h-screen w-screen items-center justify-center bg-[#0a0a0a] text-white">Loading...</div>
  }

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate((prev) => (prev === templateId ? '' : templateId))
    // bump so MotionCanvas fully resets and replays animation even on same template click
    setTemplateVersion((v) => v + 1)
  }

  const handleTemplateComplete = () => {
    timeline.setPlaying(false)
  }

  const handleAddShape = () => {
    const newLayer: Layer = {
      id: crypto.randomUUID(),
      type: 'shape',
      shapeKind: 'circle',
      x: 0.5,
      y: 0.5,
      width: 120,
      height: 120,
      fillColor: 0xffffff,
    }
    setLayers((prev) => [...prev, newLayer])
    timeline.ensureTrack(newLayer.id, {
      position: { x: newLayer.x, y: newLayer.y },
      scale: 1,
      rotation: 0,
      opacity: 1,
    })
    setTemplateVersion((v) => v + 1)
  }

  const handleUpdateLayerPosition = (id: string, x: number, y: number) => {
    const nx = Math.max(0, Math.min(1, x))
    const ny = Math.max(0, Math.min(1, y))
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === id
          ? { ...layer, x: nx, y: ny }
          : layer
      )
    )
    timeline.ensureTrack(id)
    const t = timeline.getState().currentTime
    timeline.setPositionKeyframe(id, { time: t, value: { x: nx, y: ny } })
  }

  const handleSelectLayer = (id: string) => {
    setSelectedLayerId(id)
    setShowSelectShapeHint(false)
  }

  const handleStartDrawPath = () => {
    if (!selectedLayerId) {
      setShowSelectShapeHint(true)
      return
    }
    setSelectedTemplate('')
    setPathPoints([])
    setIsDrawingPath(true)
  }

  const handleAddPathPoint = (x: number, y: number) => {
    setPathPoints((prev) => [...prev, { x, y }])
  }

  const handleFinishPath = () => {
    setIsDrawingPath(false)
    // lightly simplify consecutive points to avoid over-sampling but keep curvature
    const simplified = pathPoints.filter((pt, idx, arr) => {
      if (idx === 0 || idx === arr.length - 1) return true
      const prev = arr[idx - 1]
      const dist = Math.hypot(pt.x - prev.x, pt.y - prev.y)
      return dist > 0.005
    })
    setActivePathPoints(simplified)
    setPathVersion((v) => v + 1)
    setShowSelectShapeHint(false)
    if (selectedLayerId && simplified.length >= 2) {
      const now = timeline.getState().currentTime
      const duration = 2000
      timeline.addPathClip(selectedLayerId, {
        id: crypto.randomUUID(),
        startTime: now,
        duration,
        points: simplified,
      })
      const desiredDuration = Math.max(timeline.getState().duration, now + duration)
      timeline.setDuration(desiredDuration)
    }
  }

  const handleCancelPath = () => {
    setIsDrawingPath(false)
    setPathPoints([])
    setShowSelectShapeHint(false)
  }

  const handlePathPlaybackComplete = () => {
    // keep path so it can be edited/replayed
  }

  const handleUpdateActivePathPoint = (index: number, x: number, y: number) => {
    setActivePathPoints((prev) =>
      prev.map((pt, i) => (i === index ? { x, y } : pt))
    )
    setPathVersion((v) => v + 1)
  }

  const handleInsertPathPoint = (indexAfter: number, x: number, y: number) => {
    setActivePathPoints((prev) => {
      const next = [...prev.slice(0, indexAfter + 1), { x, y }, ...prev.slice(indexAfter + 1)]
      return next
    })
    setPathVersion((v) => v + 1)
  }

  const handleClearPath = () => {
    setIsDrawingPath(false)
    setPathPoints([])
    setActivePathPoints([])
    setPathVersion((v) => v + 1)
  }

  return (
    <DashboardLayout
      selectedTemplate={selectedTemplate}
      onSelectTemplate={handleTemplateSelect}
      onAddShape={handleAddShape}
      onStartDrawPath={handleStartDrawPath}
      showSelectShapeHint={showSelectShapeHint}
      layers={layers}
      selectedLayerId={selectedLayerId}
      isDrawingPath={isDrawingPath}
      onFinishPath={handleFinishPath}
      onCancelPath={handleCancelPath}
      pathPointCount={pathPoints.length}
      background={background}
      onBackgroundChange={setBackground}
    >
      <MotionCanvas 
        template={selectedTemplate} 
        templateVersion={templateVersion} 
        layers={layers} 
        onUpdateLayerPosition={handleUpdateLayerPosition}
        onTemplateComplete={handleTemplateComplete}
        onSelectLayer={handleSelectLayer}
        selectedLayerId={selectedLayerId}
        isDrawingPath={isDrawingPath}
      pathPoints={pathPoints}
      activePathPoints={activePathPoints}
        pathVersion={pathVersion}
        pathLayerId={selectedLayerId}
        onAddPathPoint={handleAddPathPoint}
        onFinishPath={handleFinishPath}
        onPathPlaybackComplete={handlePathPlaybackComplete}
        onUpdateActivePathPoint={handleUpdateActivePathPoint}
        onClearPath={handleClearPath}
        onInsertPathPoint={handleInsertPathPoint}
        background={background}
      />
    </DashboardLayout>
  )
}

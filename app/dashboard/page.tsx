'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout, { BackgroundSettings } from '@/components/DashboardLayout'
import dynamic from 'next/dynamic'
import { TimelineProvider, useTimeline, useTimelineActions } from '@/lib/timeline-store'
import { sampleTimeline } from '@/lib/timeline'
import { TemplateId, rollDurationForDistance, jumpHeightForDuration } from '@/lib/presets'

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
  const templateClips = useTimeline((s) => s.templateClips)
  const selectedSample = useTimeline((s) => 
    selectedLayerId ? sampleTimeline(s.tracks, s.currentTime)[selectedLayerId] : undefined
  )

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
    // Don't apply template if no layer is selected
    if (!selectedLayerId) {
      timeline.setPlaying(false)
      return
    }
    
    const targetLayerId = selectedLayerId
    const targetLayer = layers.find((l) => l.id === targetLayerId)

    const clipsForLayer = templateClips
      .filter(c => c.layerId === targetLayerId)
      .sort((a, b) => b.start - a.start)
    // Find the most recent clip for the selected template on this layer
    const existingClipsForTemplate = clipsForLayer
      .filter(c => c.template === selectedTemplate)
      .sort((a, b) => b.start - a.start) // Sort by start time, most recent first
    
    const lastClipForTemplate = existingClipsForTemplate[0]
    const isSameTemplate = !!lastClipForTemplate // If this template already has a clip, we're updating it

    // Calculate the end of the last clip to ensure we append correctly
    const lastClipEnd = clipsForLayer.length > 0 
      ? Math.max(...clipsForLayer.map(c => (c.start ?? 0) + (c.duration ?? 0)))
      : 0

    const hasTemplateClipsForLayer = clipsForLayer.length > 0

    const getTrackEndTime = (track: (typeof tracks)[number] | undefined) => {
      if (!track) return 0
      const times: number[] = []
      if (track.position?.length) times.push(track.position[track.position.length - 1].time)
      if (track.scale?.length) times.push(track.scale[track.scale.length - 1].time)
      if (track.rotation?.length) times.push(track.rotation[track.rotation.length - 1].time)
      if (track.opacity?.length) times.push(track.opacity[track.opacity.length - 1].time)
      return times.length ? Math.max(...times) : 0
    }

    const targetTrack = tracks.find((t) => t.layerId === targetLayerId)
    const trackEnd = getTrackEndTime(targetTrack)

    // Start logic: if same template, reuse its start; else append after last template clip or track end; if none, force 0
    let startAt = isSameTemplate && lastClipForTemplate
      ? lastClipForTemplate.start
      : hasTemplateClipsForLayer
        ? Math.max(trackEnd, lastClipEnd)
        : 0
        
    console.log('[START_AT DEBUG]', {
      selectedTemplate,
      isSameTemplate,
      hasTemplateClipsForLayer,
      trackEnd,
      lastClipEnd,
      startAt,
      clipsForLayer: clipsForLayer.map(c => ({ t: c.template, s: c.start, d: c.duration }))
    })

    // If this layer has no other template clips, force a true zero start for the first clip
    if (clipsForLayer.length === 0) {
      startAt = 0
    }

    // Snap to 0 if very close to start, to avoid accidental micro-delays (UI shows ~0.03s)
    if (startAt <= 50) startAt = 0

    const shouldAppend = !isSameTemplate && hasTemplateClipsForLayer

    // Sample the latest state of this layer so templates respect current pose even without clips.
    const baseSampleTime = startAt
    const sampledState = baseSampleTime > 0 ? sampleTimeline(tracks, baseSampleTime)[targetLayerId] : undefined

    console.log('[TEMPLATE APPLY]', {
      template: selectedTemplate,
      startAt,
      shouldAppend,
      baseSampleTime,
      sampledPosition: sampledState?.position,
      layerStart: targetLayer ? { x: targetLayer.x, y: targetLayer.y } : null,
      hasTemplateClipsForLayer,
      lastClipEnd,
      clips: clipsForLayer.map(c => ({ id: c.id, t: c.template, s: c.start, d: c.duration })),
    })

    // For Roll template, clamp the distance to prevent going off-screen
    // This ensures the animation duration matches the visible motion
    let clampedRollDistance: number | undefined = undefined
    if (selectedTemplate === 'roll') {
      // Determine the actual start position for the Roll animation
      let startPosition = 0.5 // Default to middle if we can't determine
      
      // If there are existing clips OR we're appending, we MUST sample the track
      // because targetLayer.x only reflects the initial layer position, not animated position
      if (sampledState?.position) {
        startPosition = sampledState.position.x
      } else if (targetLayer) {
        // Only use targetLayer.x for the very first template (no existing clips)
        startPosition = targetLayer.x
      }
      
      // CRITICAL: Skip if we're just moving clips around (drag operation)
      // Only apply preset if:
      // 1. No clips exist for this template (first time applying)
      // 2. Clips exist but parameters have changed (user adjusted controls)
      
      const clipsExistForSelectedTemplate = existingClipsForTemplate.length > 0
      
      console.log('[DRAG DEBUG] useEffect fired:', {
        selectedTemplate,
        clipsExistForSelectedTemplate,
        existingClipsCount: existingClipsForTemplate.length,
        existingClips: existingClipsForTemplate.map(c => ({
          template: c.template,
          start: c.start,
          duration: c.duration
        }))
      })
      
      if (clipsExistForSelectedTemplate) {
        // Clips already exist for this template
        // Check if parameters match - if they do, this is just a drag/move operation
        const parametersMatch = existingClipsForTemplate.every(c => {
          if (c.template === 'roll') {
            const expectedDuration = rollDurationForDistance(rollDistance, templateSpeed)
            const matches = Math.abs(c.duration - expectedDuration) < 10
            console.log('[DRAG DEBUG] Roll parameter check:', {
              clipDuration: c.duration,
              expectedDuration,
              diff: Math.abs(c.duration - expectedDuration),
              matches
            })
            return matches
          } else if (c.template === 'jump') {
            const calculatedHeight = jumpHeightForDuration(c.duration, jumpVelocity)
            const matches = Math.abs(calculatedHeight - jumpHeight) < 0.05
            console.log('[DRAG DEBUG] Jump parameter check:', {
              clipDuration: c.duration,
              calculatedHeight,
              currentHeight: jumpHeight,
              diff: Math.abs(calculatedHeight - jumpHeight),
              matches
            })
            return matches
          } else if (c.template === 'pop') {
            const expectedDuration = 1000 / Math.max(0.05, popSpeed)
            const matches = Math.abs(c.duration - expectedDuration) < 20
            console.log('[DRAG DEBUG] Pop parameter check:', {
              clipDuration: c.duration,
              expectedDuration,
              diff: Math.abs(c.duration - expectedDuration),
              matches
            })
            return matches
          }
          return false
        })
        
        console.log('[DRAG DEBUG] Parameters match result:', parametersMatch)
        
        if (parametersMatch) {
          // Parameters match, so this is just a drag/position change
          // Skip applying preset to avoid duplicates
          console.log('[DRAG DEBUG] SKIPPING - parameters match, this is a drag operation')
          return
        }
        
        console.log('[DRAG DEBUG] PROCEEDING - parameters changed, updating clip')
        // Parameters don't match, so user changed controls
        // Proceed with applying preset to update the clip
      } else {
        console.log('[DRAG DEBUG] PROCEEDING - no clips exist for this template yet')
      }
      
      const maxDistanceRight = 1.0 - startPosition // Distance to right edge from actual start position
      const currentRollDistance = rollDistance
      
      // Only clamp if the animation would go off-screen to the right
      if (currentRollDistance > maxDistanceRight) {
        clampedRollDistance = Math.max(0.05, maxDistanceRight) // Ensure minimum distance
      }
    }

    timeline.applyPresetToLayer(
      targetLayerId,
      selectedTemplate as TemplateId,
      {
        // Only use static layer position as base if we are starting at 0.
        // Otherwise (appending or updating mid-track), let it sample the track.
        position: sampledState?.position ?? ((startAt === 0 && targetLayer) ? { x: targetLayer.x, y: targetLayer.y } : undefined),
        scale: sampledState?.scale,
        rotation: sampledState?.rotation,
        opacity: sampledState?.opacity,
      },
      { 
        append: shouldAppend, 
        startAt: startAt,
        // Don't set targetDuration - let the preset use its natural duration
        parameters: clampedRollDistance !== undefined ? { rollDistance: clampedRollDistance } : undefined
      }
    )
    // Always align playhead to the start of this clip to avoid tiny offsets
    timeline.setCurrentTime(startAt)
    // Don't auto-play so user can adjust controls first
    // timeline.setPlaying(true)
  }, [
    selectedTemplate,
    selectedLayerId,
    timeline,
    // Include template-specific controls only when that template is selected
    // This allows updating the animation when controls change
    selectedTemplate === 'roll' ? rollDistance : null,
    selectedTemplate === 'roll' ? templateSpeed : null,
    selectedTemplate === 'jump' ? jumpHeight : null,
    selectedTemplate === 'jump' ? jumpVelocity : null,
    selectedTemplate === 'pop' ? popScale : null,
    selectedTemplate === 'pop' ? popWobble : null,
    selectedTemplate === 'pop' ? popSpeed : null,
    selectedTemplate === 'pop' ? popCollapse : null,
  ])

  if (isLoading) {
    return <div className="flex h-screen w-screen items-center justify-center bg-[#0a0a0a] text-white">Loading...</div>
  }

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate((prev) => (prev === templateId ? '' : templateId))
    timeline.setPlaying(false)
    timeline.setCurrentTime(0)
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
    setSelectedTemplate('') // prevent auto-applying the last template to the new shape
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

  const handleScaleChange = (value: number) => {
    if (!selectedLayerId) return
    timeline.ensureTrack(selectedLayerId)
    timeline.setScaleKeyframe(selectedLayerId, { time: playhead, value })
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
      templateSpeed={templateSpeed}
      rollDistance={rollDistance}
      jumpHeight={jumpHeight}
      jumpVelocity={jumpVelocity}
      popScale={popScale}
      popSpeed={popSpeed}
      popCollapse={popCollapse}
      onTemplateSpeedChange={timeline.setTemplateSpeed}
      onRollDistanceChange={timeline.setRollDistance}
      onJumpHeightChange={timeline.setJumpHeight}
      onJumpVelocityChange={timeline.setJumpVelocity}
      onPopScaleChange={timeline.setPopScale}
      onPopSpeedChange={timeline.setPopSpeed}
      onPopCollapseChange={timeline.setPopCollapse}
      selectedLayerScale={selectedSample?.scale}
      onSelectedLayerScaleChange={handleScaleChange}
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

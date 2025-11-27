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
    // Don't apply template if no layer is selected
    if (!selectedLayerId) {
      timeline.setPlaying(false)
      return
    }
    
    const targetLayerId = selectedLayerId
    const targetLayer = layers.find((l) => l.id === targetLayerId)
    const targetTrack = tracks.find((t) => t.layerId === targetLayerId)

    const clipsForLayer = templateClips
      .filter(c => c.layerId === targetLayerId)
      .sort((a, b) => b.start - a.start)
    // Find the most recent clip for the selected template on this layer
    const existingClipsForTemplate = clipsForLayer
      .filter(c => c.template === selectedTemplate)
      .sort((a, b) => b.start - a.start) // Sort by start time, most recent first
    
    const lastClipForTemplate = existingClipsForTemplate[0]
    const isSameTemplate = !!lastClipForTemplate // If this template already has a clip, we're updating it

    const trackEnd = getTrackEndTime(targetTrack)
    const hasTemplateClipsForLayer = clipsForLayer.length > 0
    
    // If the layer has no existing template clips, force start at 0.
    // This handles the case where the user might have moved the shape (creating a keyframe at currentTime)
    // but wants the first animation to start from the beginning.
    // If re-applying the same template, use its original start time
    let startAt = isSameTemplate && lastClipForTemplate
      ? lastClipForTemplate.start
      : hasTemplateClipsForLayer
        ? trackEnd
        : 0

    // If this layer has no other template clips (or only one), force a true zero start for the first clip
    if (clipsForLayer.length <= 1 && startAt < 500) {
      startAt = 0
    }

    // Snap to 0 if very close to start, to avoid accidental micro-delays (UI shows ~0.03s)
    if (startAt <= 50) startAt = 0
    
    // CRITICAL FIX: When re-applying the same template (isSameTemplate=true, append=false),
    // add a tiny epsilon to startAt to prevent trimFrames from deleting the previous 
    // animation's last keyframe. Without this, if Roll ends at 1200ms and Jump starts 
    // at 1200ms, re-applying Jump would delete Roll's keyframe at 1200ms.
    if (isSameTemplate && startAt > 0) {
      startAt += 1 // Add 1ms epsilon
    }

    const shouldAppend = !isSameTemplate && hasTemplateClipsForLayer

    // Sample the latest state of this layer so templates respect current pose even without clips.
    const baseSampleTime = hasTemplateClipsForLayer ? startAt : trackEnd
    const sampledState = baseSampleTime > 0 ? sampleTimeline(tracks, baseSampleTime)[targetLayerId] : undefined

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
      
      // Check if we can skip applying the preset (if the clip is already in sync).
      // This prevents conflict when resizing via TimelinePanel, which updates both duration and rollDistance/jumpHeight.
      if (lastClipForTemplate && typeof lastClipForTemplate.duration === 'number') {
         if (lastClipForTemplate.template === 'roll') {
            const expectedDuration = rollDurationForDistance(rollDistance, templateSpeed)
            // Allow small epsilon (10ms) for floating point differences
            if (Math.abs(lastClipForTemplate.duration - expectedDuration) < 10) {
              return
            }
         } else if (lastClipForTemplate.template === 'jump') {
            // We need to check if the current duration matches the jumpHeight
            // Since jumpHeightForDuration is approximate, we check if the calculated height from duration
            // matches the current jumpHeight state.
            const calculatedHeight = jumpHeightForDuration(lastClipForTemplate.duration, jumpVelocity)
            // Allow small epsilon (0.01) for height differences
            if (Math.abs(calculatedHeight - jumpHeight) < 0.01) {
              return
            }
         } else if (lastClipForTemplate.template === 'pop') {
            // Check if the current duration matches the popSpeed
            // duration = 1000 / speed, so we calculate expected duration
            const expectedDuration = 1000 / Math.max(0.2, popSpeed)
            // Allow small epsilon (10ms) for floating point differences
            if (Math.abs(lastClipForTemplate.duration - expectedDuration) < 10) {
              return
            }
         }
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
    // Only jump to start if we are switching templates or applying for the first time
    if (!isSameTemplate) {
      timeline.setCurrentTime(startAt)
    }
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

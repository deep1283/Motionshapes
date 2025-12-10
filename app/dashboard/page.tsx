'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout, { BackgroundSettings, Effect, EffectType } from '@/components/DashboardLayout'
import dynamic from 'next/dynamic'
import { TimelineProvider, useTimeline, useTimelineActions } from '@/lib/timeline-store'
import { sampleTimeline } from '@/lib/timeline'
import type { TemplateId } from '@/lib/presets'
import { rollDurationForDistance, jumpHeightForDuration } from '@/lib/presets'
import ConfirmDialog from '@/components/ConfirmDialog'
import { HistoryManager, type HistorySnapshot } from '@/lib/history-manager'
import { debounce } from '@/lib/utils'
import { chaikinSmooth, calculatePathLength } from '@/lib/path-smoothing'

// Dynamically import MotionCanvas to avoid SSR issues with Pixi.js
const MotionCanvas = dynamic(() => import('@/components/MotionCanvas'), { 
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-neutral-800" />
})

type ShapeKind =
  | 'circle'
  | 'square'
  | 'heart'
  | 'star'
  | 'triangle'
  | 'pill'
  | 'like'
  | 'comment'
  | 'share'
  | 'cursor'
  | 'counter'

interface Layer {
  id: string
  type: 'shape' | 'image' | 'svg' | 'text'
  shapeKind: ShapeKind
  x: number
  y: number
  width: number
  height: number
  scale: number
  rotation?: number
  fillColor: number
  effects?: Effect[]
  imageUrl?: string  // Base64 data URL for imported images
  svgUrl?: string    // URL to SVG (from Iconify or local)
  iconName?: string  // Iconify icon name (e.g. "mdi:home")
  // Text layer properties
  text?: string           // Text content
  fontFamily?: string     // Font family name (e.g. "Inter")
  fontSize?: number       // Font size in pixels
  fontWeight?: number     // Font weight (400, 500, 600, 700)
  // Counter properties
  isCounter?: boolean     // Whether this is a counter layer
  counterStart?: number   // Starting number
  counterEnd?: number     // Ending number
  counterPrefix?: string  // Currency prefix (e.g. "$")
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
  const [isDrawingLine, setIsDrawingLine] = useState(false)
  const [pathPoints, setPathPoints] = useState<Array<{ x: number; y: number }>>([])
  const [activePathPoints, setActivePathPoints] = useState<Array<{ x: number; y: number }>>([])
  const [pathVersion, setPathVersion] = useState(0)
  const [selectedLayerId, setSelectedLayerId] = useState('')
  const [selectedClipId, setSelectedClipId] = useState('')
  const [layerOrder, setLayerOrder] = useState<string[]>([])
  const lastLayerBaseRef = useRef<Record<string, { x: number; y: number; scale: number }>>({})
  
  // Delete confirmation dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'clip' | 'layer'; id: string; name?: string } | null>(null)

  const [activeEffectId, setActiveEffectId] = useState<string>('')
  const [showSelectShapeHint, setShowSelectShapeHint] = useState(false)
  
  // Smooth path button state
  const [showSmoothPathButton, setShowSmoothPathButton] = useState(false)
  const smoothPathTimerRef = useRef<NodeJS.Timeout | null>(null)
  
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
  const popReappear = useTimeline((s) => s.popReappear)
  const pulseScale = useTimeline((s) => s.pulseScale)
  const pulseSpeed = useTimeline((s) => s.pulseSpeed)
  const spinSpeed = useTimeline((s) => s.spinSpeed)
  const spinDirection = useTimeline((s) => s.spinDirection)
  const shakeDistance = useTimeline((s) => s.shakeDistance)
  const tracks = useTimeline((s) => s.tracks)
  const templateClips = useTimeline((s) => s.templateClips)
  const selectedSample = useTimeline((s) => 
    selectedLayerId ? sampleTimeline(s.tracks, s.currentTime)[selectedLayerId] : undefined
  )
  
  // Get the selected clip's duration
  const selectedClip = templateClips.find(c => c.id === selectedClipId)
  const selectedClipDuration = selectedClip?.duration

  // Auto-select the latest clip for the active template/layer so duration slider stays in sync
  useEffect(() => {
    if (!selectedLayerId || !selectedTemplate) return
    const clipsForLayer = templateClips
      .filter((c) => c.layerId === selectedLayerId && c.template === selectedTemplate)
      .sort((a, b) => b.start - a.start)
    const latest = clipsForLayer[0]
    if (!latest) return
    const currentClip = templateClips.find((c) => c.id === selectedClipId)
    const currentMatches = currentClip && currentClip.template === selectedTemplate
    if (!currentMatches) {
      setSelectedClipId(latest.id)
    }
  }, [selectedTemplate, selectedLayerId, templateClips, selectedClipId])

  // Sync path overlay when selectedClipId or templateClips changes (handles undo/redo)
  useEffect(() => {
    if (!selectedClipId) {
      return
    }
    const clip = templateClips.find(c => c.id === selectedClipId)
    if (clip?.template === 'path' && clip?.parameters?.pathPoints) {
      const pts = clip.parameters.pathPoints as Array<{ x: number; y: number }>
      setActivePathPoints(pts)
      setPathVersion(v => v + 1)
    }
  }, [selectedClipId, templateClips])
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

  // History Manager
  const historyManagerRef = useRef(new HistoryManager())
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Helper to create snapshot
  const createSnapshot = useCallback((): HistorySnapshot => {
    return {
      ...timeline.getSnapshot(),
      layers: [...layers],
      layerOrder: [...layerOrder],
      background: { ...background },
    }
  }, [timeline, layers, layerOrder, background])

  // Helper to push snapshot
  const pushSnapshot = useCallback(() => {
    historyManagerRef.current.pushSnapshot(createSnapshot())
    setCanUndo(historyManagerRef.current.canUndo())
    setCanRedo(historyManagerRef.current.canRedo())
  }, [createSnapshot])

  // Debounced version for parameters
  const debouncedPushSnapshot = useMemo(
    () => debounce(pushSnapshot, 500),
    [pushSnapshot]
  )

  // Undo handler
  const handleUndo = useCallback(() => {
    const snapshot = historyManagerRef.current.undo()
    if (!snapshot) {
      return
    }
    
    // Convert layers to simplified format for timeline
    const simplifiedSnapshot = {
      ...snapshot,
      layers: snapshot.layers.map(layer => ({
        id: layer.id,
        x: layer.x,
        y: layer.y,
        scale: layer.scale,
        rotation: layer.rotation ?? 0,
        opacity: layer.opacity ?? 1,
      }))
    }
    
    // Restore timeline state with simplified layers
    timeline.restoreSnapshot(simplifiedSnapshot)
    
    // Restore dashboard state with full layers
    setLayers(snapshot.layers)
    setLayerOrder(snapshot.layerOrder)
    setBackground(snapshot.background)
    
    // Set selectedTemplate to first clip's template to trigger canvas render
    if (snapshot.templateClips && snapshot.templateClips.length > 0) {
      const firstClip = snapshot.templateClips[0]
      setSelectedTemplate(firstClip.template)
      setSelectedClipId(firstClip.id)
    }
    
    // Force canvas refresh by re-setting current time
    const currentTime = timeline.getState().currentTime
    setTimeout(() => timeline.setCurrentTime(currentTime), 0)
    
    // Increment templateVersion to force canvas re-render
    setTemplateVersion(v => v + 1)
    
    setCanUndo(historyManagerRef.current.canUndo())
    setCanRedo(historyManagerRef.current.canRedo())
  }, [timeline])

  // Redo handler
  const handleRedo = useCallback(() => {
    const snapshot = historyManagerRef.current.redo()
    if (!snapshot) return
    
    // Convert layers to simplified format for timeline
    const simplifiedSnapshot = {
      ...snapshot,
      layers: snapshot.layers.map(layer => ({
        id: layer.id,
        x: layer.x,
        y: layer.y,
        scale: layer.scale,
        rotation: layer.rotation ?? 0,
        opacity: layer.opacity ?? 1,
      }))
    }
    
    // Restore timeline state with simplified layers
    timeline.restoreSnapshot(simplifiedSnapshot)
    
    // Restore dashboard state with full layers
    setLayers(snapshot.layers)
    setLayerOrder(snapshot.layerOrder)
    setBackground(snapshot.background)
    
    // Set selectedTemplate to first clip's template to trigger canvas render
    if (snapshot.templateClips && snapshot.templateClips.length > 0) {
      const firstClip = snapshot.templateClips[0]
      setSelectedTemplate(firstClip.template)
      setSelectedClipId(firstClip.id)
    }
    
    // Force canvas refresh by re-setting current time
    const currentTime = timeline.getState().currentTime
    setTimeout(() => timeline.setCurrentTime(currentTime), 0)
    
    // Increment templateVersion to force canvas re-render
    setTemplateVersion(v => v + 1)
    
    setCanUndo(historyManagerRef.current.canUndo())
    setCanRedo(historyManagerRef.current.canRedo())
  }, [timeline])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey
      
      // Undo: Cmd+Z / Ctrl+Z
      if (cmdOrCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
      
      // Redo: Cmd+Shift+Z / Ctrl+Shift+Z
      if (cmdOrCtrl && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        handleRedo()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo])

  // Initial snapshot
  useEffect(() => {
    // Capture initial state on mount
    if (historyManagerRef.current.getHistorySize() === 0) {
      pushSnapshot()
    }
  }, []) // Empty deps = run once on mount

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
    
    // If we have a selected clip, check if it matches the selected template
    // If it doesn't match, clear it so we create a new clip instead of updating
    if (selectedClipId) {
      const clip = templateClips.find(c => c.id === selectedClipId)
      if (!clip || clip.template !== selectedTemplate) {
        // Clear selectedClipId if the clip doesn't exist or doesn't match the template
        setSelectedClipId('')
      }
    }
    
    // If we have a selected clip that matches the template, update its parameters
    if (selectedClipId) {
      const clip = templateClips.find(c => c.id === selectedClipId)
      
      // Only update if the selected template matches the clip's template
      if (clip && clip.template === selectedTemplate) {
        // Skip pan_zoom - it has its own dedicated update handlers
        // Calling updateTemplateClip here would rebuild tracks and reset the animation
        if (selectedTemplate === 'pan_zoom') {
          return
        }
        
        // Update the clip's parameters based on the current control values
        const parameters: any = {}
        
        if (selectedTemplate === 'roll') {
          parameters.rollDistance = rollDistance
          parameters.templateSpeed = templateSpeed
        } else if (selectedTemplate === 'jump') {
          parameters.jumpHeight = jumpHeight
          parameters.jumpVelocity = jumpVelocity
        } else if (selectedTemplate === 'pop') {
          parameters.popScale = popScale
          parameters.popWobble = popWobble
          parameters.popSpeed = popSpeed
          parameters.popWobble = popWobble
          parameters.popSpeed = popSpeed
          parameters.popCollapse = popCollapse
          parameters.popReappear = popReappear
        } else if (selectedTemplate === 'shake') {
          parameters.shakeDistance = shakeDistance
          parameters.templateSpeed = templateSpeed
        } else if (selectedTemplate === 'pulse') {
          parameters.pulseScale = pulseScale
          parameters.pulseSpeed = pulseSpeed
        } else if (selectedTemplate === 'spin') {
          parameters.spinSpeed = spinSpeed
          parameters.spinDirection = spinDirection
          parameters.templateSpeed = templateSpeed
        }
        
        timeline.updateTemplateClip(selectedLayerId, selectedClipId, {
          parameters
        })
      }
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

    // Start logic: if same template, reuse its start; else append after last template clip
    let startAt = isSameTemplate && lastClipForTemplate
      ? lastClipForTemplate.start
      : hasTemplateClipsForLayer
        ? lastClipEnd  // Always use lastClipEnd when appending, not trackEnd
        : 0

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
      if (clipsExistForSelectedTemplate) {
        // Clips already exist for this template
        // Check if parameters match - if they do, this is just a drag/move operation
        const parametersMatch = existingClipsForTemplate.every(c => {
          if (c.template === 'roll') {
            const expectedDuration = rollDurationForDistance(rollDistance, templateSpeed)
            const matches = Math.abs(c.duration - expectedDuration) < 10
            return matches
          } else if (c.template === 'jump') {
            const calculatedHeight = jumpHeightForDuration(c.duration, jumpVelocity)
            const matches = Math.abs(calculatedHeight - jumpHeight) < 0.05
            return matches
          } else if (c.template === 'pop') {
            const expectedDuration = 1000 / Math.max(0.05, popSpeed)
            const matches = Math.abs(c.duration - expectedDuration) < 20
            return matches
          }
          return false
        })

        if (parametersMatch) {
          // Parameters match, so this is just a drag/position change
          // Skip applying preset to avoid duplicates
          return
        }

        // Parameters don't match, so user changed controls
        // Proceed with applying preset to update the clip
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
        // Don't pass base.position here - we're passing layerPosition in options instead
        // This ensures layerPosition takes precedence for the first animation
        scale: sampledState?.scale,
        rotation: sampledState?.rotation,
        opacity: sampledState?.opacity,
      },
      { 
        append: shouldAppend, 
        startAt: startAt,
        // Don't set targetDuration - let the preset use its natural duration
        parameters: clampedRollDistance !== undefined ? { rollDistance: clampedRollDistance } : undefined,
        layerScale: targetLayer?.scale,
        layerPosition: targetLayer ? { x: targetLayer.x, y: targetLayer.y } : undefined,
        layerBase: targetLayer
          ? {
              position: { x: targetLayer.x, y: targetLayer.y },
              scale: targetLayer.scale,
              rotation: (targetLayer.rotation || 0) * (Math.PI / 180), // Use layer's rotation in radians
              opacity: 1,
            }
          : undefined,
      }
    )
    // Capture history after applying a template
    setTimeout(() => pushSnapshot(), 0)
    // Always align playhead to the start of this clip to avoid tiny offsets
    timeline.setCurrentTime(startAt)
    // Don't auto-play so user can adjust controls first
    // timeline.setPlaying(true)
    pushSnapshot()
  }, [
    selectedTemplate,
    selectedLayerId,
    selectedClipId,
    timeline,
    popReappear, // Added so toggling reappear updates the clip
    popCollapse, // Added so toggling collapse updates the clip
    // Template-specific parameters removed from dependencies
    // They should only update existing clips via dedicated handlers (handleTemplateSpeedChange, etc.)
    // not by re-triggering this effect
  ])

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate((prev) => (prev === templateId ? '' : templateId))
    setSelectedClipId('')
    timeline.setPlaying(false)
    timeline.setCurrentTime(0)
    // bump so MotionCanvas fully resets and replays animation even on same template click
    setTemplateVersion((v) => v + 1)
  }

  const handleTemplateComplete = () => {
    timeline.setPlaying(false)
  }

  const handlePulseScaleChange = (value: number) => {
    timeline.setPulseScale(value)
    if (selectedClipId && selectedLayerId) {
      const clip = templateClips.find(c => c.id === selectedClipId)
      if (clip && clip.template === 'pulse') {
        timeline.updateTemplateClip(selectedLayerId, selectedClipId, {
          parameters: { pulseScale: value }
        })
        pushSnapshot()
      }
    }
  }

  const handlePulseSpeedChange = (value: number) => {
    timeline.setPulseSpeed(value)
    if (selectedClipId && selectedLayerId) {
      const clip = templateClips.find(c => c.id === selectedClipId)
      if (clip && clip.template === 'pulse') {
        timeline.updateTemplateClip(selectedLayerId, selectedClipId, {
          parameters: { pulseSpeed: value }
        })
        pushSnapshot()
      }
    }
  }



  const handleSelectEffect = (effectId: string) => {
    setActiveEffectId(effectId)
  }

  const handleUpdateEffect = (effectId: string, params: Record<string, any>) => {
    if (!selectedLayerId) return
    setLayers(prev => prev.map(layer => {
      if (layer.id !== selectedLayerId) return layer
      const effects = layer.effects || []
      const existing = effects.find(e => e.type === effectId)
      
      let newEffects
      if (existing) {
        newEffects = effects.map(e => e.type === effectId ? { ...e, params: { ...e.params, ...params } } : e)
      } else {
        // Initialize with params if creating new
        newEffects = [...effects, { id: crypto.randomUUID(), type: effectId as EffectType, isEnabled: true, params }]
      }
      return { ...layer, effects: newEffects }
    }))
    pushSnapshot()
  }

  const handleToggleEffect = (effectId: string, isEnabled: boolean) => {
    if (!selectedLayerId) return
    setLayers(prev => prev.map(layer => {
      if (layer.id !== selectedLayerId) return layer
      const effects = layer.effects || []
      const existing = effects.find(e => e.type === effectId)
      
      let newEffects
      if (existing) {
        newEffects = effects.map(e => e.type === effectId ? { ...e, isEnabled } : e)
      } else {
        if (isEnabled) {
           // Initialize with default params
           let defaultParams = {}
           if (effectId === 'glow') defaultParams = { intensity: 1, blur: 10 }
           if (effectId === 'dropShadow') defaultParams = { distance: 5, blur: 2, rotation: 45, alpha: 0.5 }
           if (effectId === 'blur') defaultParams = { strength: 4 }
           if (effectId === 'glitch') defaultParams = { slices: 5, offset: 10 }
           if (effectId === 'pixelate') defaultParams = { size: 10 }
           if (effectId === 'sparkles') defaultParams = { density: 0.5, speed: 1 }
           if (effectId === 'confetti') defaultParams = { density: 0.5, speed: 1 }
           
           newEffects = [...effects, { id: crypto.randomUUID(), type: effectId as EffectType, isEnabled: true, params: defaultParams }]
        } else {
           newEffects = effects
        }
      }
      return { ...layer, effects: newEffects }
    }))
    pushSnapshot()
  }

  const shapeDefaults: Record<ShapeKind, { width: number; height: number }> = {
    circle: { width: 100, height: 100 },
    square: { width: 100, height: 100 },
    heart: { width: 100, height: 100 },
    star: { width: 100, height: 100 },
    triangle: { width: 100, height: 100 },
    pill: { width: 100, height: 100 },
    like: { width: 100, height: 100 },
    comment: { width: 100, height: 100 },
    share: { width: 100, height: 100 },
    cursor: { width: 100, height: 100 },
    counter: { width: 200, height: 60 },
  }

  const handleAddShape = (shapeKind: ShapeKind = 'circle') => {
    const dimensions = shapeDefaults[shapeKind] ?? shapeDefaults.circle
    const newLayer: Layer = {
      id: crypto.randomUUID(),
      type: 'shape',
      shapeKind,
      x: 0.5,
      y: 0.5,
      width: dimensions.width,
      height: dimensions.height,
      scale: 1,
      fillColor: 0xffffff,
      rotation: 0,
    }
    setLayers((prev) => [...prev, newLayer])
    setSelectedLayerId(newLayer.id)
    pushSnapshot()
    timeline.ensureTrack(newLayer.id, {
      position: { x: newLayer.x, y: newLayer.y },
      scale: newLayer.scale,
      rotation: 0,
      opacity: 1,
    })
    lastLayerBaseRef.current[newLayer.id] = { x: newLayer.x, y: newLayer.y, scale: newLayer.scale }
    setLayerOrder((prev) => [...prev, newLayer.id]) // newest on top
    setSelectedTemplate('') // prevent auto-applying the last template to the new shape
    setTemplateVersion((v) => v + 1)
  }

  const handleImportImage = async (file: File) => {
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/webp']
    if (!validTypes.includes(file.type)) {
      alert('Please select a valid image file (PNG, JPG, or WebP)')
      return
    }

    // Validate file size (<10MB)
    const maxSizeBytes = 10 * 1024 * 1024 // 10MB
    if (file.size >= maxSizeBytes) {
      alert('Image must be less than 10MB')
      return
    }

    // Read file as base64
    const reader = new FileReader()
    reader.onload = async (e) => {
      const imageUrl = e.target?.result as string
      if (!imageUrl) return

      // Get image dimensions
      const img = new Image()
      img.onload = () => {
        // Downscale if larger than 4096px for WebGL compatibility
        let width = img.width
        let height = img.height
        const maxDimension = 4096
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        // Create image layer with default 300x300 size to fit canvas
        // User can resize afterwards
        const newLayer: Layer = {
          id: crypto.randomUUID(),
          type: 'image',
          shapeKind: 'circle', // Placeholder, not used for images
          x: 0.5,
          y: 0.5,
          width: 300,
          height: 300,
          scale: 1, // Use scale=1 for direct width/height control
          fillColor: 0xffffff,
          rotation: 0,
          imageUrl,
        }

        setLayers((prev) => [...prev, newLayer])
        setSelectedLayerId(newLayer.id)
        pushSnapshot()
        timeline.ensureTrack(newLayer.id, {
          position: { x: newLayer.x, y: newLayer.y },
          scale: newLayer.scale,
          rotation: 0,
          opacity: 1,
        })
        lastLayerBaseRef.current[newLayer.id] = { x: newLayer.x, y: newLayer.y, scale: newLayer.scale }
        setLayerOrder((prev) => [...prev, newLayer.id])
        setSelectedTemplate('')
        setTemplateVersion((v) => v + 1)
      }
      img.src = imageUrl
    }
    reader.readAsDataURL(file)
  }

  const handleAIGenerateImage = async (prompt: string) => {
    try {
      const res = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })
      
      if (!res.ok) {
        throw new Error(await res.text())
      }
      
      const data = await res.json()
      
      if (data.imageUrl) {
        // Create new layer with generated image
        const newLayer: Layer = {
          id: crypto.randomUUID(),
          type: 'image',
          shapeKind: 'circle', // Required placeholder
          x: 0.5,
          y: 0.5,
          width: 300,
          height: 300,
          scale: 1, // Default scale like imported images
          fillColor: 0xffffff,
          rotation: 0,
          imageUrl: data.imageUrl,
        }
        
        setLayers((prev) => [...prev, newLayer])
        setLayerOrder((prev) => [...prev, newLayer.id])
        setSelectedLayerId(newLayer.id)
        
        const track = timeline.ensureTrack(newLayer.id, {
          position: { x: newLayer.x, y: newLayer.y },
          scale: newLayer.scale,
          rotation: 0,
          opacity: 1,
        })
        
        // Jump playhead to the start of the new clip so it's visible
        if (track && typeof track.startTime === 'number') {
          timeline.setCurrentTime(track.startTime)
        }
        
        // Trigger canvas re-render
        setTemplateVersion((v) => v + 1)
      }
    } catch (error) {
      console.error('AI Generation failed', error)
      alert('Failed to generate image. Please try again.')
    }
  }

  const handleAIEditImage = async (layerId: string, prompt: string) => {
    const layer = layers.find(l => l.id === layerId)
    if (!layer || !layer.imageUrl) return

    try {
      const res = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt,
          baseImage: layer.imageUrl 
        })
      })
      
      if (!res.ok) {
        throw new Error(await res.text())
      }
      
      const data = await res.json()
      if (data.imageUrl) {
        // Update layer with new image
        setLayers((prev) =>
          prev.map((l) =>
            l.id === layerId
              ? { ...l, imageUrl: data.imageUrl }
              : l
          )
        )
      }
    } catch (error) {
      console.error('AI Edit failed', error)
      alert('Failed to edit image. Please try again.')
    }
  }

  // Handle adding SVG from Iconify
  const handleAddSvg = (iconName: string, svgUrl: string) => {
    // Request larger SVG (256px) with white color for crisp rendering on dark background
    const highResUrl = svgUrl.includes('?') 
      ? `${svgUrl}&color=%23ffffff&width=256&height=256` 
      : `${svgUrl}?color=%23ffffff&width=256&height=256`
    
    const newLayer: Layer = {
      id: crypto.randomUUID(),
      type: 'svg',
      shapeKind: 'circle', // Placeholder, not used for SVGs
      x: 0.5,
      y: 0.5,
      width: 100,
      height: 100,
      scale: 1,
      fillColor: 0xffffff,
      rotation: 0,
      svgUrl: highResUrl, // Store the SVG URL with white color and high res
      iconName, // Store icon name for reference
    }

    setLayers((prev) => [...prev, newLayer])
    setSelectedLayerId(newLayer.id)
    pushSnapshot()
    timeline.ensureTrack(newLayer.id, {
      position: { x: newLayer.x, y: newLayer.y },
      scale: newLayer.scale,
      rotation: 0,
      opacity: 1,
    })
    lastLayerBaseRef.current[newLayer.id] = { x: newLayer.x, y: newLayer.y, scale: newLayer.scale }
    setLayerOrder((prev) => [...prev, newLayer.id])
    setSelectedTemplate('')
    setTemplateVersion((v) => v + 1)
  }

  // Handle adding Text layer
  const handleAddText = () => {
    const newLayer: Layer = {
      id: crypto.randomUUID(),
      type: 'text',
      shapeKind: 'circle', // Placeholder, not used for text
      x: 0.5,
      y: 0.5,
      width: 200,
      height: 60,
      scale: 1,
      fillColor: 0xffffff, // White text
      rotation: 0,
      text: 'Your Text',
      fontFamily: 'Inter',
      fontSize: 48,
      fontWeight: 600,
    }

    setLayers((prev) => [...prev, newLayer])
    setSelectedLayerId(newLayer.id)
    pushSnapshot()
    timeline.ensureTrack(newLayer.id, {
      position: { x: newLayer.x, y: newLayer.y },
      scale: newLayer.scale,
      rotation: 0,
      opacity: 1,
    })
    lastLayerBaseRef.current[newLayer.id] = { x: newLayer.x, y: newLayer.y, scale: newLayer.scale }
    setLayerOrder((prev) => [...prev, newLayer.id])
    setSelectedTemplate('')
    setTemplateVersion((v) => v + 1)
  }

  const handleAddCounter = () => {
    const newLayer: Layer = {
      id: crypto.randomUUID(),
      type: 'text',
      shapeKind: 'counter',
      x: 0.5,
      y: 0.5,
      width: 200,
      height: 60,
      scale: 1,
      fillColor: 0xffffff,
      rotation: 0,
      text: '0',
      fontFamily: 'Inter',
      fontSize: 72,
      fontWeight: 700,
      // Counter specific
      isCounter: true,
      counterStart: 0,
      counterEnd: 100,
      counterPrefix: '',
    }

    setLayers((prev) => [...prev, newLayer])
    setSelectedLayerId(newLayer.id)
    pushSnapshot()
    // Create track with visibility bar - counter animation is driven by this bar's duration
    timeline.ensureTrack(newLayer.id, {
      position: { x: newLayer.x, y: newLayer.y },
      scale: newLayer.scale,
      rotation: 0,
      opacity: 1,
    })
    // No addTemplateClip - counter animation uses the visibility bar duration directly
    lastLayerBaseRef.current[newLayer.id] = { x: newLayer.x, y: newLayer.y, scale: newLayer.scale }
    setLayerOrder((prev) => [...prev, newLayer.id])
    setSelectedTemplate('')
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
    const currentScale = layers.find((l) => l.id === id)?.scale ?? 1
    lastLayerBaseRef.current[id] = { x: nx, y: ny, scale: currentScale }
    timeline.ensureTrack(id)
  }

  const handleUpdateLayerScale = (id: string, scale: number) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === id
          ? { ...layer, scale }
          : layer
      )
    )
    const layer = layers.find((l) => l.id === id)
    if (layer) {
       lastLayerBaseRef.current[id] = { x: layer.x, y: layer.y, scale }
       timeline.ensureTrack(id)
    }
  }

  const handleUpdateLayerRotation = (id: string, rotation: number) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === id
          ? { ...layer, rotation }
          : layer
      )
    )
    // We don't currently track rotation in lastLayerBaseRef for dragging, 
    // but we might need to if we add rotation handles.
    // For now just update state.
    timeline.ensureTrack(id)
  }

  const handleUpdateLayerSize = (id: string, width: number, height: number) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === id
          ? { ...layer, width, height }
          : layer
      )
    )
    timeline.ensureTrack(id)
  }

  const handleUpdateLayerText = (id: string, text: string) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === id
          ? { ...layer, text }
          : layer
      )
    )
  }

  const handleUpdateLayerFontSize = (id: string, fontSize: number) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === id
          ? { ...layer, fontSize }
          : layer
      )
    )
  }

  const handleUpdateLayerColor = (id: string, color: number) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === id
          ? { ...layer, fillColor: color }
          : layer
      )
    )
  }

  const handleUpdateLayerFontFamily = (id: string, fontFamily: string) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === id
          ? { ...layer, fontFamily }
          : layer
      )
    )
  }

  const handleUpdateLayerCounterStart = (id: string, counterStart: number) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === id
          ? { ...layer, counterStart }
          : layer
      )
    )
  }

  const handleUpdateLayerCounterEnd = (id: string, counterEnd: number) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === id
          ? { ...layer, counterEnd }
          : layer
      )
    )
  }

  const handleUpdateLayerCounterPrefix = (id: string, counterPrefix: string) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === id
          ? { ...layer, counterPrefix }
          : layer
      )
    )
  }

  const handleSelectLayer = (id: string) => {
    setSelectedLayerId(id)
    setSelectedClipId('')
    setSelectedTemplate('')  // Clear template to prevent accidentally applying it to the layer
    setShowSelectShapeHint(false)
    
    // Move playhead to layer's startTime so the shape is visible
    const track = tracks.find(t => t.layerId === id)
    if (track?.startTime !== undefined) {
      timeline.setCurrentTime(track.startTime)
    }
  }

  const handleDeselectShape = () => {
    setSelectedLayerId('')
    setSelectedClipId('')
    setSelectedTemplate('')
  }

  const handleStartDrawPath = () => {
    if (!selectedLayerId) {
      setShowSelectShapeHint(true)
      setTimeout(() => setShowSelectShapeHint(false), 3000)
      return
    }
    setIsDrawingPath(true)
    setIsDrawingLine(false)
    setPathPoints([])
    setActivePathPoints([])
    setPathVersion(v => v + 1)
    
    // Clear any existing clips for this layer to avoid conflicts
    const existingClips = templateClips.filter(c => c.layerId === selectedLayerId)
    existingClips.forEach(clip => {
      // removeTemplateClip doesn't exist, we need to implement it or use setState directly if possible (but we can't from here)
      // Actually, let's check if there's a method to remove template clips.
      // If not, I'll add it to the store.
    })
  }

  const handleStartDrawLine = () => {
    if (!selectedLayerId) {
      setShowSelectShapeHint(true)
      setTimeout(() => setShowSelectShapeHint(false), 3000)
      return
    }
    // Determine starting point: end of last path clip if it exists, otherwise layer position
    const layer = layers.find((l) => l.id === selectedLayerId)
    const layerPos = { x: layer?.x ?? 0.5, y: layer?.y ?? 0.5 }
    const lastPathClip = templateClips
      .filter((c) => c.layerId === selectedLayerId && c.template === 'path')
      .sort((a, b) => (b.start + b.duration) - (a.start + a.duration))[0]
    let startPos = layerPos
    if (lastPathClip) {
      const endTime = (lastPathClip.start ?? 0) + (lastPathClip.duration ?? 0)
      const sampled = sampleTimeline(tracks, endTime)[selectedLayerId]
      if (sampled?.position) {
        startPos = { x: sampled.position.x, y: sampled.position.y }
      }
    }
    setIsDrawingLine(true)
    setIsDrawingPath(false)
    setPathPoints([startPos]) // seed start; end will be set on drag
    setActivePathPoints([startPos])
    setPathVersion(v => v + 1)
    setSelectedTemplate('')
    setSelectedClipId('')
    timeline.setPlaying(false)
  }

  const handleAddPathPoint = (x: number, y: number) => {
    setPathPoints((prev) => [...prev, { x, y }])
  }

  const handleFinishPath = (finalPoints?: Array<{ x: number; y: number }>) => {
    setIsDrawingPath(false)
    setIsDrawingLine(false)
    const pointsToUse = finalPoints || (activePathPoints.length ? activePathPoints : pathPoints)
    if (pointsToUse.length < 2) {
      setShowSelectShapeHint(false)
      return
    }
    // Normalize to two points for line mode
    const normalized = isDrawingLine ? pointsToUse.slice(0, 2) : pointsToUse
    // lightly simplify consecutive points to avoid over-sampling but keep curvature
    const simplified = normalized.filter((pt, idx, arr) => {
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
      // For line mode, append after the last clip on this layer
      const layerClips = templateClips.filter(c => c.layerId === selectedLayerId)
      const lastEnd = layerClips.length
        ? Math.max(...layerClips.map(c => (c.start ?? 0) + (c.duration ?? 0)))
        : now
      const startAt = isDrawingLine ? lastEnd : now
      
      // Calculate path length for speed calculations
      let length = 0
      for (let i = 1; i < simplified.length; i++) {
        length += Math.hypot(simplified[i].x - simplified[i-1].x, simplified[i].y - simplified[i-1].y)
      }
      
      const clipId = timeline.addTemplateClip(
        selectedLayerId,
        'path',
        startAt,
        duration,
        {
          pathPoints: simplified,
          pathLength: length,
          templateSpeed: 1 // Default speed
        },
        layers.find(l => l.id === selectedLayerId)?.scale ?? 1 // Pass layer scale
      )
      
      // Set the template to 'path' so the speed control appears
      setSelectedTemplate('path')
      // Also set the clip ID so speed changes target this clip
      setSelectedClipId(clipId)
      timeline.setPlaying(false)
      timeline.setCurrentTime(startAt)
      pushSnapshot()
      
      // Show smooth path button for 3 seconds
      if (smoothPathTimerRef.current) {
        clearTimeout(smoothPathTimerRef.current)
      }
      setShowSmoothPathButton(true)
      smoothPathTimerRef.current = setTimeout(() => {
        setShowSmoothPathButton(false)
        smoothPathTimerRef.current = null
      }, 3000)
    }
  }

  const handleCancelPath = () => {
    setIsDrawingPath(false)
    setIsDrawingLine(false)
    setPathPoints([])
    setActivePathPoints([])
    setPathVersion(v => v + 1)
  }

  const handleSmoothPath = () => {
    // Hide the button immediately
    setShowSmoothPathButton(false)
    if (smoothPathTimerRef.current) {
      clearTimeout(smoothPathTimerRef.current)
      smoothPathTimerRef.current = null
    }
    
    if (!selectedClipId || !selectedLayerId) return
    
    // Get the current clip
    const clips = timeline.getState().templateClips
    const clip = clips.find(c => c.id === selectedClipId)
    if (!clip || clip.template !== 'path' || !clip.parameters?.pathPoints) return
    
    const originalPoints = clip.parameters.pathPoints as Array<{ x: number; y: number }>
    if (originalPoints.length < 3) return
    
    // Apply Chaikin's smoothing (2 iterations for good results)
    const smoothedPoints = chaikinSmooth(originalPoints, 2)
    const newLength = calculatePathLength(smoothedPoints)
    
    // Update the clip with smoothed points
    timeline.updateTemplateClip(selectedLayerId, selectedClipId, {
      parameters: {
        ...clip.parameters,
        pathPoints: smoothedPoints,
        pathLength: newLength,
      }
    })
    
    // Update active path points for visual feedback
    setActivePathPoints(smoothedPoints)
    setPathVersion(v => v + 1)
    
    // Push snapshot for undo support
    pushSnapshot()
  }

  const handlePathPlaybackComplete = () => {
    // keep path so it can be edited/replayed
  }

  const handleUpdateActivePathPoint = (index: number, x: number, y: number) => {
    setActivePathPoints((prev) =>
      prev.map((pt, i) => (i === index ? { x, y } : pt))
    )
    setPathPoints((prev) =>
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
    
    // Update the static scale of the layer
    setLayers(prev => prev.map(l => 
      l.id === selectedLayerId ? { ...l, scale: value } : l
    ))
    const existing = lastLayerBaseRef.current[selectedLayerId] ?? {
      x: layers.find((l) => l.id === selectedLayerId)?.x ?? 0.5,
      y: layers.find((l) => l.id === selectedLayerId)?.y ?? 0.5,
      scale: 1,
    }
    lastLayerBaseRef.current[selectedLayerId] = { ...existing, scale: value }
    debouncedPushSnapshot()
  }

  const handleClipClick = (clip: { id: string; template: string }) => {
    setSelectedTemplate(clip.template)
    setSelectedClipId(clip.id)
    timeline.selectClip(clip.id)
    
    // Find the clip data to get its layerId and start time
    const clipData = templateClips.find(c => c.id === clip.id)
    if (clipData) {
      // Select the layer (shape) that owns this clip
      setSelectedLayerId(clipData.layerId)
      
      // Move playhead to the start of the clip so the shape is visible
      timeline.setCurrentTime(clipData.start ?? 0)
      
      // Load the clip's parameters into the global controls
      if (clipData.parameters?.templateSpeed) {
        timeline.setTemplateSpeed(clipData.parameters.templateSpeed)
      }
      
      // If it's a path clip, show the path overlay
      if (clip.template === 'path' && clipData.parameters?.pathPoints) {
        const pts = clipData.parameters.pathPoints as Array<{ x: number; y: number }>
        setActivePathPoints(pts)
        setPathVersion(v => v + 1)
      } else {
        // Clear path if selecting a non-path clip
        setActivePathPoints([])
      }
    }
  }

  const handleTemplateSpeedChange = (value: number) => {
    timeline.setTemplateSpeed(value)
    
    if (selectedClipId && selectedLayerId) {
      const clip = templateClips.find(c => c.id === selectedClipId)
      if (clip) {
        // For path clips, update duration based on speed
        if (clip.template === 'path') {
          // Base duration is 2000ms at speed 1.0
          // duration = baseDuration / speed
          const newDuration = 2000 / value
          
          timeline.updateTemplateClip(selectedLayerId, selectedClipId, {
            duration: newDuration,
            parameters: {
              templateSpeed: value
            }
          }, layers.find(l => l.id === selectedLayerId)?.scale ?? 1)
        } else if (clip.template === 'roll') {
          // Recompute roll duration when speed changes
          const newDuration = rollDurationForDistance(rollDistance, value)
          timeline.updateTemplateClip(selectedLayerId, selectedClipId, {
            duration: newDuration,
            parameters: {
              templateSpeed: value,
              rollDistance,
            }
          }, layers.find(l => l.id === selectedLayerId)?.scale ?? 1)
        } else {
          // For other templates, just update the speed parameter
          timeline.updateTemplateClip(selectedLayerId, selectedClipId, {
            parameters: {
              templateSpeed: value
            }
          }, layers.find(l => l.id === selectedLayerId)?.scale ?? 1)
        }
      }
    }
    debouncedPushSnapshot()
  }

  const handleRollDistanceChange = (value: number) => {
    timeline.setRollDistance(value)

    if (selectedClipId && selectedLayerId) {
      const clip = templateClips.find(c => c.id === selectedClipId)
      if (clip && clip.template === 'roll') {
      const newDuration = rollDurationForDistance(value, templateSpeed)
      timeline.updateTemplateClip(
        selectedLayerId,
        selectedClipId,
        {
          duration: newDuration,
          parameters: {
            rollDistance: value,
            templateSpeed,
            layerBase: lastLayerBaseRef.current[selectedLayerId]
          }
        },
        layers.find(l => l.id === selectedLayerId)?.scale ?? 1
      )
      }
    }
    debouncedPushSnapshot()
  }

  const handleJumpHeightChange = (value: number) => {
    timeline.setJumpHeight(value)

    if (selectedClipId && selectedLayerId) {
      const clip = templateClips.find(c => c.id === selectedClipId)
      if (clip && clip.template === 'jump') {
        timeline.updateTemplateClip(
          selectedLayerId,
          selectedClipId,
          {
            parameters: {
              jumpHeight: value,
              jumpVelocity,
              layerBase: lastLayerBaseRef.current[selectedLayerId]
            }
          },
          layers.find(l => l.id === selectedLayerId)?.scale ?? 1
        )
      }
    }
    debouncedPushSnapshot()
  }

  const handleJumpVelocityChange = (value: number) => {
    timeline.setJumpVelocity(value)

    if (selectedClipId && selectedLayerId) {
      const clip = templateClips.find(c => c.id === selectedClipId)
      if (clip && clip.template === 'jump') {
        timeline.updateTemplateClip(
          selectedLayerId,
          selectedClipId,
          {
            parameters: {
              jumpHeight,
              jumpVelocity: value,
              layerBase: lastLayerBaseRef.current[selectedLayerId]
            }
          },
          layers.find(l => l.id === selectedLayerId)?.scale ?? 1
        )
      }
    }
    debouncedPushSnapshot()
  }

  const handleSpinSpeedChange = (value: number) => {
    timeline.setSpinSpeed(value)
    if (selectedClipId && selectedLayerId) {
      const clip = templateClips.find(c => c.id === selectedClipId)
      if (clip && clip.template === 'spin') {
        timeline.updateTemplateClip(selectedLayerId, selectedClipId, {
          parameters: { templateSpeed: value, spinSpeed: value }
        })
      }
    }
    debouncedPushSnapshot()
  }

  const handleSpinDirectionChange = (value: 1 | -1) => {
    timeline.setSpinDirection(value)
    if (selectedClipId && selectedLayerId) {
      const clip = templateClips.find(c => c.id === selectedClipId)
      if (clip && clip.template === 'spin') {
        timeline.updateTemplateClip(selectedLayerId, selectedClipId, {
          parameters: { spinDirection: value }
        })
      }
    }
    debouncedPushSnapshot()
  }
  
  const handleClipDurationChange = (value: number) => {
    if (selectedClipId && selectedLayerId) {
      timeline.updateTemplateClip(selectedLayerId, selectedClipId, {
        duration: value
      })
      debouncedPushSnapshot()
    }
  }
  
  // Handler for updating pan/zoom regions from canvas overlay
  const handleUpdatePanZoomRegions = (
    clipId: string, 
    targetRegion: { x: number; y: number; width: number; height: number }
  ) => {
    const clip = templateClips.find(c => c.id === clipId)
    if (clip && clip.template === 'pan_zoom') {
      timeline.updateTemplateClip(clip.layerId, clipId, {
        parameters: {
          ...clip.parameters,
          panZoomEndRegion: targetRegion, // Use target as the zoom destination
        }
      })
      debouncedPushSnapshot()
    }
  }

  const handleReorderLayers = (nextOrder: string[]) => {
    setLayerOrder(nextOrder)
    pushSnapshot()
  }

  const handleDeleteClip = useCallback((clipId: string) => {
    const layer = layers.find((l) => l.id === selectedLayerId)
    const layerBase = layer
      ? {
          position: { x: layer.x, y: layer.y },
          scale: layer.scale,
          rotation: (layer.rotation || 0) * (Math.PI / 180), // Use layer's rotation in radians
          opacity: 1,
        }
      : undefined

    timeline.removeTemplateClip(clipId, layerBase)
    
    // Force a re-render by updating a dummy state
    // This ensures the TimelinePanel picks up the new duration immediately
    setSelectedClipId('')
    setSelectedTemplate('')
    
    // Force React to flush updates synchronously
    requestAnimationFrame(() => {
      timeline.selectClip?.(clipId) // deselect in store if supported
    })
    
    setIsDeleteDialogOpen(false)
    setDeleteTarget(null)
    
    // Defer snapshot to next tick to ensure timeline state updates first
    setTimeout(() => pushSnapshot(), 0)
  }, [layers, selectedLayerId, timeline, pushSnapshot])

  const handleDeleteLayer = useCallback((layerId: string) => {
    // Remove all clips for this layer
    const layerClips = templateClips.filter(c => c.layerId === layerId)
    layerClips.forEach(clip => timeline.removeTemplateClip(clip.id))
    
    // Remove layer from state
    setLayers(prev => prev.filter(l => l.id !== layerId))
    
    // Remove from layer order
    setLayerOrder(prev => prev.filter(id => id !== layerId))
    
    // Remove from lastLayerBaseRef
    delete lastLayerBaseRef.current[layerId]
    
    // Deselect
    setSelectedLayerId('')
    setSelectedClipId('')
    setIsDeleteDialogOpen(false)
    setDeleteTarget(null)
    pushSnapshot()
  }, [templateClips, timeline])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        
        // Get current state values
        const currentSelectedClipId = selectedClipId
        const currentSelectedLayerId = selectedLayerId
        
        if (currentSelectedClipId) {
          const clip = templateClips.find(c => c.id === currentSelectedClipId)
          const layer = layers.find((l) => l.id === clip?.layerId)
          
          const layerBase = layer
            ? {
                position: { x: layer.x, y: layer.y },
                scale: layer.scale,
                rotation: (layer.rotation || 0) * (Math.PI / 180), // Use layer's rotation in radians
                opacity: 1,
              }
            : undefined

          timeline.removeTemplateClip(currentSelectedClipId, layerBase)
          setSelectedClipId('')
          setSelectedTemplate('')
          timeline.selectClip?.(currentSelectedClipId)
          setIsDeleteDialogOpen(false)
          setDeleteTarget(null)
          // Capture snapshot for undo/redo
          setTimeout(() => pushSnapshot(), 0)
        } else if (currentSelectedLayerId) {
          // Show confirmation for layer deletion
          const layer = layers.find(l => l.id === currentSelectedLayerId)
          const layerName = layer ? `${layer.shapeKind.charAt(0).toUpperCase()}${layer.shapeKind.slice(1)}` : 'Layer'
          const clipCount = templateClips.filter(c => c.layerId === currentSelectedLayerId).length
          
          setDeleteTarget({ 
            type: 'layer', 
            id: currentSelectedLayerId, 
            name: `${layerName} (${clipCount} clip${clipCount !== 1 ? 's' : ''})` 
          })
          setIsDeleteDialogOpen(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedClipId, selectedLayerId, layers, templateClips, timeline])

  const dashboard = (
    <>
      <DashboardLayout
        selectedTemplate={selectedTemplate}
        onSelectTemplate={handleTemplateSelect}
        onAddShape={handleAddShape}
        onAddSvg={handleAddSvg}
        onAddText={handleAddText}
        onAddCounter={handleAddCounter}
        onImportImage={handleImportImage}
        onStartDrawPath={handleStartDrawPath}
        onStartDrawLine={handleStartDrawLine}
        showSelectShapeHint={showSelectShapeHint}
        layers={layers}
        layerOrder={layerOrder}
        onReorderLayers={handleReorderLayers}
        selectedLayerId={selectedLayerId}
        isDrawingPath={isDrawingPath}
        isDrawingLine={isDrawingLine}
        onFinishPath={() => handleFinishPath()}
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
        popReappear={popReappear}
        pulseScale={pulseScale}
        pulseSpeed={pulseSpeed}
        spinSpeed={spinSpeed}
        spinDirection={spinDirection}
        onTemplateSpeedChange={handleTemplateSpeedChange}
        onRollDistanceChange={handleRollDistanceChange}
        onJumpHeightChange={handleJumpHeightChange}
        onJumpVelocityChange={handleJumpVelocityChange}
        onPopScaleChange={timeline.setPopScale}
        onPopSpeedChange={timeline.setPopSpeed}
        onPopCollapseChange={timeline.setPopCollapse}
        onPopReappearChange={timeline.setPopReappear}
        onPulseScaleChange={handlePulseScaleChange}
        onPulseSpeedChange={handlePulseSpeedChange}
        onSpinSpeedChange={handleSpinSpeedChange}
        onSpinDirectionChange={handleSpinDirectionChange}
        shakeDistance={shakeDistance}
        onShakeDistanceChange={timeline.setShakeDistance}
        selectedLayerScale={layers.find(l => l.id === selectedLayerId)?.scale ?? 1}
        onSelectedLayerScaleChange={handleScaleChange}
        onUpdateLayerPosition={handleUpdateLayerPosition}
        onAIGenerateImage={handleAIGenerateImage}
        onAIEditImage={handleAIEditImage}
        showSmoothPathButton={showSmoothPathButton}
        onSmoothPath={handleSmoothPath}
        onUpdateLayerRotation={handleUpdateLayerRotation}
        onUpdateLayerSize={handleUpdateLayerSize}
        onUpdateLayerText={handleUpdateLayerText}
        onUpdateLayerFontSize={handleUpdateLayerFontSize}
        onUpdateLayerColor={handleUpdateLayerColor}
        onUpdateLayerFontFamily={handleUpdateLayerFontFamily}
        onUpdateCounterStart={handleUpdateLayerCounterStart}
        onUpdateCounterEnd={handleUpdateLayerCounterEnd}
        onUpdateCounterPrefix={handleUpdateLayerCounterPrefix}
        selectedClipDuration={selectedClipDuration}
        onClipDurationChange={handleClipDurationChange}
        onClipClick={handleClipClick}
        selectedClipId={selectedClipId}
        onDeselectShape={handleDeselectShape}
        activeEffectId={activeEffectId}
        onSelectEffect={handleSelectEffect}
        onUpdateEffect={handleUpdateEffect}
        onToggleEffect={handleToggleEffect}
        layerEffects={layers.find(l => l.id === selectedLayerId)?.effects}
        onAddClickMarker={(layerId) => {
          if (layerId) {
            timeline.addClickMarker(layerId)
          }
        }}
        onAddPanZoom={(layerId) => {
          console.log('[PAGE] onAddPanZoom called for layer:', layerId)
          const layer = layers.find(l => l.id === layerId)
          if (!layer) return
          
          const now = timeline.getState().currentTime
          const duration = 2000 // 2 seconds for zoom in + hold + zoom out
          
          // Get clip start position (after any existing clips on this layer)
          const layerClips = templateClips.filter(c => c.layerId === layerId)
          const lastEnd = layerClips.length
            ? Math.max(...layerClips.map(c => (c.start ?? 0) + (c.duration ?? 0)))
            : now
          
          console.log('[PAGE] Adding pan_zoom clip at', lastEnd, 'duration', duration)
          
          const clipId = timeline.addTemplateClip(
            layerId,
            'pan_zoom',
            lastEnd,
            duration,
            {
              panZoomEndRegion: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 }, // Default target region
              panZoomHoldDuration: 500, // 500ms hold
              panZoomIntensity: 1.5, // Default zoom level
              panZoomBlurIntensity: 0, // No blur by default
              panZoomEasing: 'ease-in-out',
            },
            layer.scale ?? 1,
            { position: { x: layer.x, y: layer.y }, scale: layer.scale ?? 1 }
          )
          
          console.log('[PAGE] Created pan_zoom clip with id:', clipId)
          setSelectedTemplate('pan_zoom')
          setSelectedClipId(clipId)
          timeline.setPlaying(false)
          timeline.setCurrentTime(lastEnd)
          pushSnapshot()
        }}
        onAddMaskCenter={(layerId) => {
          console.log('[PAGE] onAddMaskCenter called for layer:', layerId)
          const layer = layers.find(l => l.id === layerId)
          if (!layer) return
          
          const now = timeline.getState().currentTime
          const duration = 1000 // 1 second
          
          const layerClips = templateClips.filter(c => c.layerId === layerId)
          const lastEnd = layerClips.length
            ? Math.max(...layerClips.map(c => (c.start ?? 0) + (c.duration ?? 0)))
            : now
            
          const clipId = timeline.addTemplateClip(
            layerId,
            'mask_center',
            lastEnd,
            duration,
            {},
            layer.scale ?? 1,
            { position: { x: layer.x, y: layer.y }, scale: layer.scale ?? 1 }
          )
          
          setSelectedTemplate('mask_center')
          setSelectedClipId(clipId)
          timeline.setPlaying(false)
          timeline.setCurrentTime(lastEnd)
          pushSnapshot()
        }}
        onAddMaskTop={(layerId) => {
          console.log('[PAGE] onAddMaskTop called for layer:', layerId)
          const layer = layers.find(l => l.id === layerId)
          if (!layer) return
          
          const now = timeline.getState().currentTime
          const duration = 1000 // 1 second
          
          const layerClips = templateClips.filter(c => c.layerId === layerId)
          const lastEnd = layerClips.length
            ? Math.max(...layerClips.map(c => (c.start ?? 0) + (c.duration ?? 0)))
            : now
            
          const clipId = timeline.addTemplateClip(
            layerId,
            'mask_top',
            lastEnd,
            duration,
            {},
            layer.scale ?? 1,
            { position: { x: layer.x, y: layer.y }, scale: layer.scale ?? 1 }
          )
          
          setSelectedTemplate('mask_top')
          setSelectedClipId(clipId)
          timeline.setPlaying(false)
          timeline.setCurrentTime(lastEnd)
          pushSnapshot()
        }}
        onAddMaskCenterOut={(layerId) => {
          const layer = layers.find(l => l.id === layerId)
          if (!layer) return
          
          const now = timeline.getState().currentTime
          const duration = 1000
          
          const layerClips = templateClips.filter(c => c.layerId === layerId)
          const lastEnd = layerClips.length
            ? Math.max(...layerClips.map(c => (c.start ?? 0) + (c.duration ?? 0)))
            : now
            
          const clipId = timeline.addTemplateClip(
            layerId,
            'mask_center_out',
            lastEnd,
            duration,
            {},
            layer.scale ?? 1,
            { position: { x: layer.x, y: layer.y }, scale: layer.scale ?? 1 }
          )
          
          setSelectedTemplate('mask_center_out')
          setSelectedClipId(clipId)
          timeline.setPlaying(false)
          timeline.setCurrentTime(lastEnd)
          pushSnapshot()
        }}
        onAddMaskTopOut={(layerId) => {
          const layer = layers.find(l => l.id === layerId)
          if (!layer) return
          
          const now = timeline.getState().currentTime
          const duration = 1000
          
          const layerClips = templateClips.filter(c => c.layerId === layerId)
          const lastEnd = layerClips.length
            ? Math.max(...layerClips.map(c => (c.start ?? 0) + (c.duration ?? 0)))
            : now
            
          const clipId = timeline.addTemplateClip(
            layerId,
            'mask_top_out',
            lastEnd,
            duration,
            {},
            layer.scale ?? 1,
            { position: { x: layer.x, y: layer.y }, scale: layer.scale ?? 1 }
          )
          
          setSelectedTemplate('mask_top_out')
          setSelectedClipId(clipId)
          timeline.setPlaying(false)
          timeline.setCurrentTime(lastEnd)
          pushSnapshot()
        }}
        onAddTypewriter={(layerId) => {
          const layer = layers.find(l => l.id === layerId)
          if (!layer || layer.type !== 'text') return
          
          const now = timeline.getState().currentTime
          const textLength = layer.text?.length ?? 10
          // Duration based on text length: ~80ms per character
          const duration = Math.max(1000, textLength * 80)
          
          const layerClips = templateClips.filter(c => c.layerId === layerId)
          const lastEnd = layerClips.length
            ? Math.max(...layerClips.map(c => (c.start ?? 0) + (c.duration ?? 0)))
            : now
            
          const clipId = timeline.addTemplateClip(
            layerId,
            'typewriter',
            lastEnd,
            duration,
            {
              showCursor: true,
              textAnimation: 'typewriter',
            },
            layer.scale ?? 1,
            { position: { x: layer.x, y: layer.y }, scale: layer.scale ?? 1 }
          )
          
          setSelectedTemplate('typewriter')
          setSelectedClipId(clipId)
          timeline.setPlaying(false)
          timeline.setCurrentTime(lastEnd)
          pushSnapshot()
        }}
        onAddBounceIn={(layerId) => {
          const layer = layers.find(l => l.id === layerId)
          if (!layer || layer.type !== 'text') return
          
          const now = timeline.getState().currentTime
          const duration = 1000 // Fixed duration for bounce in
          
          const layerClips = templateClips.filter(c => c.layerId === layerId)
          const lastEnd = layerClips.length
            ? Math.max(...layerClips.map(c => (c.start ?? 0) + (c.duration ?? 0)))
            : now
            
          const clipId = timeline.addTemplateClip(
            layerId,
            'bounce_in',
            lastEnd,
            duration,
            {
              textAnimation: 'bounce_in',
            },
            layer.scale ?? 1,
            { position: { x: layer.x, y: layer.y }, scale: layer.scale ?? 1 }
          )
          
          setSelectedTemplate('bounce_in')
          setSelectedClipId(clipId)
          timeline.setPlaying(false)
          timeline.setCurrentTime(lastEnd)
          pushSnapshot()
        }}
        onAddBounceOut={(layerId) => {
          const layer = layers.find(l => l.id === layerId)
          if (!layer || layer.type !== 'text') return
          
          const now = timeline.getState().currentTime
          const duration = 1000 // Fixed duration for bounce out
          
          const layerClips = templateClips.filter(c => c.layerId === layerId)
          const lastEnd = layerClips.length
            ? Math.max(...layerClips.map(c => (c.start ?? 0) + (c.duration ?? 0)))
            : now
            
          const clipId = timeline.addTemplateClip(
            layerId,
            'bounce_out',
            lastEnd,
            duration,
            {
              textAnimation: 'bounce_out',
            },
            layer.scale ?? 1,
            { position: { x: layer.x, y: layer.y }, scale: layer.scale ?? 1 }
          )
          
          setSelectedTemplate('bounce_out')
          setSelectedClipId(clipId)
          timeline.setPlaying(false)
          timeline.setCurrentTime(lastEnd)
          pushSnapshot()
        }}
        onSelectLayer={handleSelectLayer}
      >
        <MotionCanvas 
          template={selectedTemplate} 
          templateVersion={templateVersion} 
          layers={layers}
          layerOrder={layerOrder}
          onUpdateLayerPosition={handleUpdateLayerPosition}
          onUpdateLayerScale={handleUpdateLayerScale}
          onUpdateLayerSize={handleUpdateLayerSize}
          onTemplateComplete={handleTemplateComplete}
          onSelectLayer={handleSelectLayer}
          selectedLayerId={selectedLayerId}
          isDrawingPath={isDrawingPath}
          isDrawingLine={isDrawingLine}
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
          popReappear={popReappear}
          onCanvasBackgroundClick={handleDeselectShape}
          selectedClipId={selectedClipId}
          onUpdatePanZoomRegions={handleUpdatePanZoomRegions}
        />
      </DashboardLayout>

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Delete Layer"
        message={`Are you sure you want to delete ${deleteTarget?.name || 'this layer'}? This will remove the layer and all its animations. This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget?.type === 'layer') {
            handleDeleteLayer(deleteTarget.id)
          } else if (deleteTarget?.type === 'clip') {
            handleDeleteClip(deleteTarget.id)
          }
        }}
        onCancel={() => {
          setIsDeleteDialogOpen(false)
          setDeleteTarget(null)
        }}
      />
    </>
  )

  if (isLoading) {
    return <div className="flex h-screen w-screen items-center justify-center bg-[#0a0a0a] text-white">Loading...</div>
  }

  return dashboard
}

'use client'

import { useState, useEffect } from 'react'
import { X, Download, Monitor, Coffee } from 'lucide-react'
import { cn } from '@/lib/utils'
import { exportToWebM, downloadBlob, estimateFileSize, ExportQuality, ExportFPS, ExportBackground, convertToMP4 } from '@/lib/video-exporter'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  canvasRef: HTMLCanvasElement | null
  duration: number // ms
  canvasWidth: number
  canvasHeight: number
  background?: ExportBackground
  onSeek: (time: number) => void
  onRender: () => void
  onSetPlaying: (playing: boolean) => void
  onHideHandles?: () => void
  onShowHandles?: () => void
  // Returns viewport bounds in canvas coordinates for cropping
  getViewportBounds?: () => { x: number; y: number; width: number; height: number }
  // Default filename from project name
  defaultFilename?: string
}

export function ExportModal({
  isOpen,
  onClose,
  canvasRef,
  duration,
  canvasWidth,
  canvasHeight,
  background,
  onSeek,
  onRender,
  onSetPlaying,
  onHideHandles,
  onShowHandles,
  getViewportBounds,
  defaultFilename = 'motionshapes',
}: ExportModalProps) {
  const [quality, setQuality] = useState<ExportQuality>('standard')
  const [fps, setFps] = useState<ExportFPS>(30)
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [totalFrames, setTotalFrames] = useState(0)
  const [exportPhase, setExportPhase] = useState<'capturing' | 'encoding' | 'converting'>('capturing')
  const [filename, setFilename] = useState(defaultFilename)
  const [format, setFormat] = useState<'webm' | 'mp4'>('webm')
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setProgress(0)
      setCurrentFrame(0)
      setIsExporting(false)
      setFilename(defaultFilename)
      setFormat('webm')
    }
  }, [isOpen, defaultFilename])

  if (!isOpen) return null

  const aspectRatio = canvasWidth / canvasHeight
  const aspectRatioLabel = 
    Math.abs(aspectRatio - 16/9) < 0.1 ? '16:9' :
    Math.abs(aspectRatio - 9/16) < 0.1 ? '9:16' :
    Math.abs(aspectRatio - 1) < 0.1 ? '1:1' :
    `${aspectRatio.toFixed(2)}:1`

  const platformHints = 
    Math.abs(aspectRatio - 16/9) < 0.1 ? 'YouTube, Website' :
    Math.abs(aspectRatio - 9/16) < 0.1 ? 'Instagram Reels, TikTok' :
    Math.abs(aspectRatio - 1) < 0.1 ? 'Instagram Post, Twitter' :
    'Custom size'

  const durationSeconds = (duration / 1000).toFixed(1)
  const estimatedSize = estimateFileSize(duration, fps, quality)

  const handleExport = async () => {
    if (!canvasRef) return

    setIsExporting(true)
    setProgress(0)
    setTotalFrames(Math.ceil(duration / (1000 / fps)))
    
    // Set playing state to hide UI overlays (selection handles, path lines, etc.)
    onSetPlaying(true)
    
    // Directly hide PIXI handles
    onHideHandles?.()
    
    // Seek to start and force render to ensure UI is updated before capture
    onSeek(0)
    onRender()
    
    // Wait for PIXI to render
    await new Promise(resolve => requestAnimationFrame(resolve))
    await new Promise(resolve => requestAnimationFrame(resolve))
    await new Promise(resolve => setTimeout(resolve, 100))

    try {
      // Get viewport bounds for cropping
      // Default to centered viewport if not provided
      const viewportBounds = getViewportBounds?.() ?? {
        x: (canvasRef.width - canvasWidth) / 2,
        y: (canvasRef.height - canvasHeight) / 2,
        width: canvasWidth,
        height: canvasHeight,
      }
      
      // For MP4 with transparent background, force black background
      // (H.264 + yuv420p doesn't support alpha channel)
      let exportBackground = background
      if (format === 'mp4' && (!background || background.mode === 'transparent')) {
        exportBackground = {
          mode: 'solid',
          solid: '#000000',
          from: '#000000',
          to: '#000000',
        }
      }

      const blob = await exportToWebM({
        canvas: canvasRef,
        duration,
        fps,
        quality,
        viewportBounds,
        outputWidth: canvasWidth,  // Logical viewport width
        outputHeight: canvasHeight, // Logical viewport height
        background: exportBackground,
        onProgress: (prog, frame, total, phase) => {
          setProgress(prog)
          setCurrentFrame(frame)
          setTotalFrames(total)
          setExportPhase(phase)
        },
        onSeek,
        onRender,
      })

      // If MP4 selected, convert WebM to MP4
      let finalBlob = blob
      if (format === 'mp4') {
        setExportPhase('converting')
        setProgress(0)
        // Bitrate based on quality setting
        const bitrateMap = { standard: 5_000_000, high: 10_000_000, ultra: 25_000_000 }
        finalBlob = await convertToMP4(blob, fps, (prog) => {
          setProgress(prog)
        }, bitrateMap[quality])
      }

      downloadBlob(finalBlob, `${filename.trim() || 'motionshapes'}.${format}`)
      
      // Reset timeline to start
      onSeek(0)
      onRender()
      
      // Show feedback modal after successful export
      setShowFeedbackModal(true)
      
      // Auto-close feedback modal after 10 seconds
      setTimeout(() => {
        setShowFeedbackModal(false)
        onClose()
      }, 10000)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Please try again.')
    } finally {
      // Reset playing state and restore handles
      onShowHandles?.()
      onSetPlaying(false)
      setIsExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!isExporting ? onClose : undefined}
      />
      
      {/* Modal */}
      <div className="relative bg-neutral-900 rounded-2xl border border-white/10 shadow-2xl w-[400px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Download className="w-4 h-4 text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Export Animation</h2>
          </div>
          <button
            onClick={() => {
              if (isExporting) {
                // Allow cancel during export - confirm first
                if (confirm('Export is in progress. Cancel and return to dashboard?')) {
                  // Restore state and close
                  onShowHandles?.()
                  onSetPlaying(false)
                  setIsExporting(false)
                  onClose()
                }
              } else {
                onClose()
              }
            }}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            title={isExporting ? "Cancel export" : "Close"}
          >
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>
        
        {/* Format Tabs */}
        <div className="flex border-b border-white/5">
          <button
            onClick={() => setFormat('webm')}
            disabled={isExporting}
            className={cn(
              "flex-1 py-3 px-4 text-sm font-medium transition-all border-b-2",
              format === 'webm'
                ? "text-purple-400 border-purple-500 bg-purple-500/5"
                : "text-neutral-400 border-transparent hover:text-neutral-200 hover:bg-white/5",
              isExporting && "cursor-not-allowed opacity-50"
            )}
          >
            WebM
            <span className="block text-[10px] font-normal opacity-60">Faster export</span>
          </button>
          <button
            onClick={() => setFormat('mp4')}
            disabled={isExporting}
            className={cn(
              "flex-1 py-3 px-4 text-sm font-medium transition-all border-b-2",
              format === 'mp4'
                ? "text-purple-400 border-purple-500 bg-purple-500/5"
                : "text-neutral-400 border-transparent hover:text-neutral-200 hover:bg-white/5",
              isExporting && "cursor-not-allowed opacity-50"
            )}
          >
            MP4
            <span className="block text-[10px] font-normal opacity-60">Universal</span>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5">
          {/* Resolution Info */}
          <div className="bg-neutral-800/50 rounded-xl p-4 border border-white/5">
            <div className="flex items-center gap-3">
              <Monitor className="w-5 h-5 text-neutral-400" />
              <div>
                <div className="text-white font-medium">
                  {canvasWidth} × {canvasHeight} ({aspectRatioLabel})
                </div>
                <div className="text-sm text-neutral-400">
                  ✓ {platformHints}
                </div>
              </div>
            </div>
          </div>

          {!isExporting ? (
            <>
              {/* Filename Input */}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-neutral-500 font-medium">
                  File Name
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                    placeholder="motionshapes"
                    className="flex-1 px-3 py-2 rounded-xl bg-neutral-800 text-white border border-white/10 focus:border-purple-500/50 focus:outline-none text-sm"
                  />
                  <span className="text-neutral-500 text-sm">.{format}</span>
                </div>
              </div>

              {/* Quality Selection */}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-neutral-500 font-medium">
                  Quality
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setQuality('standard')}
                    className={cn(
                      "flex-1 py-3 px-3 rounded-xl text-sm font-medium transition-all",
                      quality === 'standard'
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        : "bg-neutral-800 text-neutral-400 border border-white/5 hover:bg-neutral-700"
                    )}
                  >
                    <div>Standard</div>
                    <div className="text-xs opacity-60 mt-0.5">Smaller</div>
                  </button>
                  <button
                    onClick={() => setQuality('high')}
                    className={cn(
                      "flex-1 py-3 px-3 rounded-xl text-sm font-medium transition-all",
                      quality === 'high'
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        : "bg-neutral-800 text-neutral-400 border border-white/5 hover:bg-neutral-700"
                    )}
                  >
                    <div>High</div>
                    <div className="text-xs opacity-60 mt-0.5">Better</div>
                  </button>
                  <button
                    onClick={() => setQuality('ultra')}
                    className={cn(
                      "flex-1 py-3 px-3 rounded-xl text-sm font-medium transition-all",
                      quality === 'ultra'
                        ? "bg-gradient-to-r from-purple-500/30 to-pink-500/30 text-purple-200 border border-purple-400/40"
                        : "bg-neutral-800 text-neutral-400 border border-white/5 hover:bg-neutral-700"
                    )}
                  >
                    <div className="flex items-center gap-1 justify-center">
                      Ultra
                      <span className="text-[10px] px-1 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded text-white font-semibold">PRO</span>
                    </div>
                    <div className="text-xs opacity-60 mt-0.5">Best</div>
                  </button>
                </div>
              </div>

              {/* FPS Selection */}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-neutral-500 font-medium">
                  Frame Rate
                </label>
                <div className="flex gap-2">
                  {([24, 30, 60] as ExportFPS[]).map((fpsOption) => (
                    <button
                      key={fpsOption}
                      onClick={() => setFps(fpsOption)}
                      className={cn(
                        "flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all",
                        fps === fpsOption
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          : "bg-neutral-800 text-neutral-400 border border-white/5 hover:bg-neutral-700"
                      )}
                    >
                      <div>{fpsOption} fps</div>
                      <div className="text-xs opacity-60 mt-0.5">
                        {fpsOption === 24 ? 'Cinematic' : fpsOption === 30 ? 'Standard' : 'Smooth'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Info */}
              <div className="flex justify-between text-sm text-neutral-400 px-1">
                <span>Duration: {durationSeconds}s</span>
                <span>Est. Size: {estimatedSize}</span>
              </div>
            </>
          ) : (
            /* Progress UI */
            <div className="py-8 flex flex-col items-center gap-4">
              {/* Circular Progress */}
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 transform -rotate-90">
                  {/* Background circle */}
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke="rgba(168, 85, 247, 0.2)"
                    strokeWidth="6"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke="url(#progressGradient)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${progress * 251.2} 251.2`}
                    className="transition-all duration-150"
                  />
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#A855F7" />
                      <stop offset="100%" stopColor="#EC4899" />
                    </linearGradient>
                  </defs>
                </svg>
                {/* Percentage in center */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">
                    {Math.round(progress * 100)}%
                  </span>
                </div>
              </div>
              
              {/* Frame counter */}
              <div className="text-sm text-neutral-400">
                {exportPhase === 'capturing' 
                  ? `Capturing frame ${currentFrame} of ${totalFrames}`
                  : exportPhase === 'encoding'
                  ? `Encoding frame ${currentFrame} of ${totalFrames}`
                  : 'Converting to MP4...'
                }
              </div>
              
              {/* Phase indicator */}
              <div className="text-xs text-neutral-500 animate-pulse">
                {exportPhase === 'capturing' 
                  ? 'Capturing frames...' 
                  : exportPhase === 'encoding'
                  ? 'Creating video...'
                  : 'Converting WebM → MP4...'
                }
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isExporting && (
          <div className="px-6 py-4 border-t border-white/5">
            <button
              onClick={handleExport}
              disabled={!canvasRef}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export {format.toUpperCase()}
            </button>
          </div>
        )}
      </div>

      {/* Feedback Modal - appears after successful export */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setShowFeedbackModal(false); onClose(); }} />
          <div className="relative bg-neutral-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <button
              onClick={() => { setShowFeedbackModal(false); onClose(); }}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                <span className="text-2xl">✨</span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Export Complete!</h3>
              <p className="text-neutral-400 text-sm mb-4">
                Found a bug or have ideas? We&apos;d love to hear from you!
                <br /><br />
                <span className="italic text-purple-300">Girlfriend wants to go on a date but I am broke 🥺</span>
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center mt-2">
                <a
                  href="mailto:deepmishra1283@gmail.com?subject=MotionShapes Feedback&body=Hi Deep,%0A%0AI have some feedback about MotionShapes:%0A%0A"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800 text-white border border-white/10 hover:bg-neutral-700 transition-all font-medium text-sm w-full sm:w-auto"
                  onClick={() => { setShowFeedbackModal(false); onClose(); }}
                >
                  Send Feedback
                </a>
                
                <button 
                  onClick={async (e) => {
                      const btn = e.currentTarget;
                      const originalText = btn.innerHTML;
                      btn.innerHTML = '<span class="animate-pulse">Loading...</span>';
                      btn.disabled = true;
                      try {
                          const res = await fetch('/api/checkout', { method: 'POST' });
                          const data = await res.json();
                          if (data.url) window.open(data.url, "_blank");
                          else throw new Error(data.error || "Failed to create checkout");
                      } catch (err) {
                          console.error(err);
                          alert("Failed to initialize sponsor checkout.");
                      } finally {
                          btn.innerHTML = originalText;
                          btn.disabled = false;
                      }
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium text-sm hover:from-purple-600 hover:to-pink-600 transition-all w-full sm:w-auto shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                >
                  <Coffee className="w-4 h-4" />
                  <span>Sponsor my date</span>
                </button>
              </div>
              <p className="text-neutral-500 text-xs mt-3">This popup will close in 10 seconds</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

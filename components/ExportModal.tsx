'use client'

import { useState, useEffect } from 'react'
import { X, Download, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'
import { exportToWebM, downloadBlob, estimateFileSize, ExportQuality, ExportFPS } from '@/lib/video-exporter'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  canvasRef: HTMLCanvasElement | null
  duration: number // ms
  canvasWidth: number
  canvasHeight: number
  onSeek: (time: number) => void
  onRender: () => void
}

export function ExportModal({
  isOpen,
  onClose,
  canvasRef,
  duration,
  canvasWidth,
  canvasHeight,
  onSeek,
  onRender,
}: ExportModalProps) {
  const [quality, setQuality] = useState<ExportQuality>('standard')
  const [fps, setFps] = useState<ExportFPS>(30)
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [totalFrames, setTotalFrames] = useState(0)
  const [exportPhase, setExportPhase] = useState<'capturing' | 'encoding'>('capturing')

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setProgress(0)
      setCurrentFrame(0)
      setIsExporting(false)
    }
  }, [isOpen])

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

    try {
      const blob = await exportToWebM({
        canvas: canvasRef,
        duration,
        fps,
        quality,
        onProgress: (prog, frame, total, phase) => {
          setProgress(prog)
          setCurrentFrame(frame)
          setTotalFrames(total)
          setExportPhase(phase)
        },
        onSeek,
        onRender,
      })

      downloadBlob(blob, 'motionshapes.webm')
      
      // Reset timeline to start
      onSeek(0)
      onRender()
      
      onClose()
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
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
          {!isExporting && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-neutral-400" />
            </button>
          )}
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
              {/* Quality Selection */}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-neutral-500 font-medium">
                  Quality
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setQuality('standard')}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all",
                      quality === 'standard'
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        : "bg-neutral-800 text-neutral-400 border border-white/5 hover:bg-neutral-700"
                    )}
                  >
                    <div>Standard</div>
                    <div className="text-xs opacity-60 mt-0.5">Smaller file</div>
                  </button>
                  <button
                    onClick={() => setQuality('high')}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all",
                      quality === 'high'
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        : "bg-neutral-800 text-neutral-400 border border-white/5 hover:bg-neutral-700"
                    )}
                  >
                    <div>High</div>
                    <div className="text-xs opacity-60 mt-0.5">Best quality</div>
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
                  : `Encoding frame ${currentFrame} of ${totalFrames}`
                }
              </div>
              
              {/* Phase indicator */}
              <div className="text-xs text-neutral-500 animate-pulse">
                {exportPhase === 'capturing' 
                  ? 'Capturing frames...' 
                  : 'Creating video...'
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
              Export WebM
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

/**
 * Video Exporter Utility
 * Exports canvas animations to WebM/MP4 formats using MediaRecorder
 */

export type ExportQuality = 'standard' | 'high'
export type ExportFPS = 24 | 30 | 60

interface ExportOptions {
  canvas: HTMLCanvasElement
  duration: number // ms
  fps: ExportFPS
  quality: ExportQuality
  onProgress?: (progress: number, currentFrame: number, totalFrames: number) => void
  onSeek: (time: number) => void // Function to seek the timeline
  onRender: () => void // Function to force render
}

// Hidden bitrate values - users only see "Standard" and "High"
const QUALITY_BITRATE: Record<ExportQuality, number> = {
  standard: 5_000_000, // 5 Mbps
  high: 10_000_000,    // 10 Mbps
}

/**
 * Export canvas animation to WebM format
 */
export async function exportToWebM(options: ExportOptions): Promise<Blob> {
  const { canvas, duration, fps, quality, onProgress, onSeek, onRender } = options
  
  const frameInterval = 1000 / fps
  const totalFrames = Math.ceil(duration / frameInterval)
  const bitrate = QUALITY_BITRATE[quality]
  
  // Create MediaRecorder
  const stream = canvas.captureStream(fps)
  
  // Check for WebM support
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm'
  
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: bitrate,
  })
  
  const chunks: Blob[] = []
  
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data)
    }
  }
  
  // Start recording
  recorder.start()
  
  // Seek through timeline frame by frame
  for (let frame = 0; frame < totalFrames; frame++) {
    const time = frame * frameInterval
    
    // Seek timeline to this time
    onSeek(time)
    
    // Force render
    onRender()
    
    // Wait for frame to be captured
    await new Promise(resolve => requestAnimationFrame(resolve))
    
    // Small delay to ensure frame is recorded
    await new Promise(resolve => setTimeout(resolve, 16))
    
    // Report progress
    if (onProgress) {
      const progress = (frame + 1) / totalFrames
      onProgress(progress, frame + 1, totalFrames)
    }
  }
  
  // Stop recording
  return new Promise((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType })
      resolve(blob)
    }
    recorder.stop()
  })
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Estimate file size based on settings
 */
export function estimateFileSize(
  duration: number,
  fps: ExportFPS,
  quality: ExportQuality
): string {
  const bitrate = QUALITY_BITRATE[quality]
  const seconds = duration / 1000
  const bytes = (bitrate * seconds) / 8
  
  if (bytes < 1024 * 1024) {
    return `~${Math.round(bytes / 1024)} KB`
  }
  return `~${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

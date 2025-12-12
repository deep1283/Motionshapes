'use client'

/**
 * Video Exporter Utility
 * Exports canvas animations to WebM/MP4 formats using Frame Buffer approach
 * 
 * Two-phase export for smooth output:
 * Phase 1: Capture all frames as ImageData (decoupled from real-time)
 * Phase 2: Encode frames to video at constant rate
 */

export type ExportQuality = 'standard' | 'high'
export type ExportFPS = 24 | 30 | 60

interface ExportOptions {
  canvas: HTMLCanvasElement
  duration: number // ms
  fps: ExportFPS
  quality: ExportQuality
  onProgress?: (progress: number, currentFrame: number, totalFrames: number, phase: 'capturing' | 'encoding') => void
  onSeek: (time: number) => void // Function to seek the timeline
  onRender: () => void // Function to force render
}

// Hidden bitrate values - users only see "Standard" and "High"
const QUALITY_BITRATE: Record<ExportQuality, number> = {
  standard: 5_000_000, // 5 Mbps
  high: 10_000_000,    // 10 Mbps
}

/**
 * Capture a single frame from canvas as ImageData
 * Works with both 2D and WebGL canvases by drawing to a temporary 2D canvas
 */
function captureFrame(canvas: HTMLCanvasElement): ImageData {
  // Create a temporary 2D canvas to capture the frame
  // This works for both WebGL and 2D source canvases
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = canvas.width
  tempCanvas.height = canvas.height
  const ctx = tempCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Could not create 2D context for frame capture')
  
  // Draw the source canvas (WebGL or 2D) to our 2D canvas
  ctx.drawImage(canvas, 0, 0)
  
  // Now we can get the ImageData from the 2D canvas
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/**
 * Wait for next animation frame + small delay for render completion
 */
async function waitForRender(): Promise<void> {
  await new Promise(resolve => requestAnimationFrame(resolve))
  await new Promise(resolve => requestAnimationFrame(resolve))
}

/**
 * Export canvas animation to WebM format using Frame Buffer approach
 * 
 * This approach captures all frames first, then encodes them at a constant rate.
 * This ensures smooth output regardless of system performance during capture.
 */
export async function exportToWebM(options: ExportOptions): Promise<Blob> {
  const { canvas, duration, fps, quality, onProgress, onSeek, onRender } = options
  
  const frameInterval = 1000 / fps
  const totalFrames = Math.ceil(duration / frameInterval)
  const bitrate = QUALITY_BITRATE[quality]
  
  // ============================================
  // PHASE 1: Capture all frames
  // ============================================
  const frames: ImageData[] = []
  
  for (let frame = 0; frame < totalFrames; frame++) {
    const time = frame * frameInterval
    
    // Seek timeline to this time
    onSeek(time)
    
    // Force render and wait for it to complete
    onRender()
    await waitForRender()
    
    // Capture frame
    frames.push(captureFrame(canvas))
    
    // Report progress (Phase 1: 0% - 50%)
    if (onProgress) {
      const progress = ((frame + 1) / totalFrames) * 0.5
      onProgress(progress, frame + 1, totalFrames, 'capturing')
    }
  }
  
  // ============================================
  // PHASE 2: Encode frames to video
  // ============================================
  
  // Create offscreen canvas for encoding
  const encodeCanvas = document.createElement('canvas')
  encodeCanvas.width = canvas.width
  encodeCanvas.height = canvas.height
  const encodeCtx = encodeCanvas.getContext('2d')
  if (!encodeCtx) throw new Error('Could not create encode context')
  
  // Create MediaRecorder
  const stream = encodeCanvas.captureStream(fps)
  
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
  
  // Draw each frame at constant interval
  const frameTime = 1000 / fps
  
  for (let frame = 0; frame < frames.length; frame++) {
    // Draw frame to encode canvas
    encodeCtx.putImageData(frames[frame], 0, 0)
    
    // Wait for frame duration (constant timing)
    await new Promise(resolve => setTimeout(resolve, frameTime))
    
    // Report progress (Phase 2: 50% - 100%)
    if (onProgress) {
      const progress = 0.5 + ((frame + 1) / frames.length) * 0.5
      onProgress(progress, frame + 1, totalFrames, 'encoding')
    }
  }
  
  // Clean up frame buffer
  frames.length = 0
  
  // Stop recording and return blob
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

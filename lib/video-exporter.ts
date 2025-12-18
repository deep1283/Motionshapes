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

// Background settings for export
export interface ExportBackground {
  mode: 'transparent' | 'solid' | 'gradient' | 'image'
  solid: string
  from: string
  to: string
  gradientType?: 'linear' | 'radial'
  gradientPosition?: number  // 0-1's for radial position
  image?: string
  imageMode?: 'cover' | 'contain' | 'stretch'
}

interface ExportOptions {
  canvas: HTMLCanvasElement
  duration: number // ms
  fps: ExportFPS
  quality: ExportQuality
  background?: ExportBackground
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
 * Draws background first (if specified), then PIXI content on top.
 * Works with both 2D and WebGL canvases by drawing to a temporary 2D canvas.
 */
function captureFrame(canvas: HTMLCanvasElement, background?: ExportBackground): ImageData {
  // Create a temporary 2D canvas to capture the frame
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = canvas.width
  tempCanvas.height = canvas.height
  const ctx = tempCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Could not create 2D context for frame capture')
  
  // Draw background FIRST (if not transparent)
  if (background && background.mode !== 'transparent') {
    if (background.mode === 'solid') {
      ctx.fillStyle = background.solid
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    } else if (background.mode === 'gradient') {
      let gradient: CanvasGradient
      if (background.gradientType === 'radial') {
        // Radial gradient from center
        const centerX = canvas.width / 2
        const centerY = canvas.height / 2
        const radius = Math.max(canvas.width, canvas.height) / 2
        gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
      } else {
        // Linear gradient top to bottom
        gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
      }
      gradient.addColorStop(0, background.from)
      gradient.addColorStop(1, background.to)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    // Note: Image backgrounds are rendered via CSS in the dashboard,
    // so they will be captured as part of the canvas layer during export
  }
  
  // Draw PIXI canvas on top
  ctx.drawImage(canvas, 0, 0)
  
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/**
 * Wait for next animation frame + extra delay to ensure full render quality
 */
async function waitForRender(isFirstFrame: boolean = false): Promise<void> {
  // Wait for 2 animation frames to ensure render is complete
  await new Promise(resolve => requestAnimationFrame(resolve))
  await new Promise(resolve => requestAnimationFrame(resolve))
  
  // For first frame, add extra delay to ensure textures/images are fully loaded
  if (isFirstFrame) {
    await new Promise(resolve => setTimeout(resolve, 100))
    await new Promise(resolve => requestAnimationFrame(resolve))
  }
}

/**
 * Export canvas animation to WebM format using Frame Buffer approach
 * 
 * This approach captures all frames first, then encodes them at a constant rate.
 * This ensures smooth output regardless of system performance during capture.
 */
export async function exportToWebM(options: ExportOptions): Promise<Blob> {
  const { canvas, duration, fps, quality, background, onProgress, onSeek, onRender } = options
  
  const frameInterval = 1000 / fps
  const totalFrames = Math.ceil(duration / frameInterval)
  const bitrate = QUALITY_BITRATE[quality]
  
  // ============================================
  // PHASE 1: Capture all frames
  // ============================================
  const frames: ImageData[] = []
  
  for (let frame = 0; frame < totalFrames; frame++) {
    const time = frame * frameInterval
    const isFirstFrame = frame === 0
    
    // Seek timeline to this time
    onSeek(time)
    
    // Force render and wait for it to complete
    // First frame gets extra delay for quality
    onRender()
    await waitForRender(isFirstFrame)
    
    // Capture frame with background
    frames.push(captureFrame(canvas, background))
    
    // Report progress (Phase 1: 0% - 50%)
    if (onProgress) {
      const progress = ((frame + 1) / totalFrames) * 0.5
      onProgress(progress, frame + 1, totalFrames, 'capturing')
    }
  }
  
  // ============================================
  // PHASE 2: Encode frames to video
  // ============================================
  
  // Create offscreen canvas for encoding at canvas size
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

/**
 * Convert WebM blob to MP4 using FFmpeg.wasm
 * FFmpeg is lazy-loaded on first use (~25MB download, cached after)
 * 
 * Note: Requires Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy
 * headers to be set in next.config.ts for SharedArrayBuffer support.
 */
export async function convertToMP4(
  webmBlob: Blob,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  // Dynamically import FFmpeg to avoid loading it until needed
  const { FFmpeg } = await import('@ffmpeg/ffmpeg')
  const { fetchFile } = await import('@ffmpeg/util')
  
  const ffmpeg = new FFmpeg()
  
  // Set up progress handler for real-time updates
  ffmpeg.on('progress', ({ progress }) => {
    // Map FFmpeg progress (0-1) to our progress range (0.3 - 0.9)
    const mappedProgress = 0.3 + (progress * 0.6)
    onProgress?.(mappedProgress)
  })
  
  // Set up log handler for debugging
  ffmpeg.on('log', ({ message }) => {
    console.log('[FFmpeg]', message)
  })
  
  try {
    // Load FFmpeg WASM (downloads ~25MB on first load, cached after)
    if (!ffmpeg.loaded) {
      onProgress?.(0.1) // 10% - loading FFmpeg
      await ffmpeg.load()
    }
    
    onProgress?.(0.2) // 20% - FFmpeg loaded
    
    // Write WebM to FFmpeg virtual filesystem
    const inputData = await fetchFile(webmBlob)
    await ffmpeg.writeFile('input.webm', inputData)
    
    onProgress?.(0.3) // 30% - Input written
    
    // Convert WebM to MP4 using H.264 codec
    // -c:v libx264 = use H.264 video codec  
    // -preset ultrafast = fastest encoding (less compression but much faster)
    // -crf 23 = quality level (18-28, lower = better)
    // -pix_fmt yuv420p = ensure compatibility with all players
    await ffmpeg.exec([
      '-i', 'input.webm',
      '-c:v', 'libx264',
      '-preset', 'ultrafast', // Changed from 'fast' for speed
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', // Optimize for web streaming
      'output.mp4'
    ])
    
    onProgress?.(0.9) // 90% - Conversion complete
    
    // Read the output MP4
    const outputData = await ffmpeg.readFile('output.mp4')
    
    // Clean up
    await ffmpeg.deleteFile('input.webm')
    await ffmpeg.deleteFile('output.mp4')
    
    onProgress?.(1) // 100% - Done
    
    // Return as Blob (convert Uint8Array to proper ArrayBuffer)
    const buffer = outputData instanceof Uint8Array 
      ? outputData.buffer.slice(outputData.byteOffset, outputData.byteOffset + outputData.byteLength) as ArrayBuffer
      : outputData as BlobPart
    return new Blob([buffer], { type: 'video/mp4' })
  } catch (error) {
    console.error('[FFmpeg] Conversion failed:', error)
    throw new Error('MP4 conversion failed. Try exporting as WebM instead.')
  }
}


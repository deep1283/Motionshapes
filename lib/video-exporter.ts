'use client'

/**
 * Video Exporter Utility
 * Exports canvas animations to WebM/MP4 formats using Frame Buffer approach
 * 
 * Two-phase export for smooth output:
 * Phase 1: Capture all frames as ImageData (decoupled from real-time)
 * Phase 2: Encode frames to video at constant rate
 */

export type ExportQuality = 'standard' | 'high' | 'ultra'
export type ExportFPS = 24 | 30 | 60  // 120fps removed - browser limitations

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

interface ViewportBounds {
  x: number // Viewport left edge in canvas coordinates
  y: number // Viewport top edge in canvas coordinates
  width: number // Viewport width
  height: number // Viewport height
}

interface ExportOptions {
  canvas: HTMLCanvasElement
  duration: number // ms
  fps: ExportFPS
  quality: ExportQuality
  viewportBounds: ViewportBounds // Region to capture from canvas (physical pixels)
  outputWidth: number // Output video width (logical pixels)
  outputHeight: number // Output video height (logical pixels)
  background?: ExportBackground
  onProgress?: (progress: number, currentFrame: number, totalFrames: number, phase: 'capturing' | 'encoding') => void
  onSeek: (time: number) => void // Function to seek the timeline
  onRender: () => void // Function to force render
}

// Hidden bitrate values for each quality tier
const QUALITY_BITRATE: Record<ExportQuality, number> = {
  standard: 5_000_000,  // 5 Mbps
  high: 10_000_000,     // 10 Mbps
  ultra: 25_000_000,    // 25 Mbps - best quality
}

/**
 * Capture a single frame from canvas as ImageData
 * Crops to the viewport region so export matches what's visible in the viewport.
 * 
 * viewportBounds: Source region in PHYSICAL pixels (on the canvas)
 * outputWidth/Height: Output dimensions in LOGICAL pixels (for the video)
 * 
 * Works with both 2D and WebGL canvases by drawing to a temporary 2D canvas.
 */
function captureFrame(
  canvas: HTMLCanvasElement, 
  viewportBounds: ViewportBounds,
  outputWidth: number,
  outputHeight: number
): ImageData {
  const { x, y, width, height } = viewportBounds
  
  // Create a temporary 2D canvas sized to OUTPUT dimensions (logical pixels)
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = outputWidth
  tempCanvas.height = outputHeight
  const ctx = tempCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Could not create 2D context for frame capture')
  
  // Draw the viewport region from physical canvas to logical output
  // This scales from physical pixels to logical pixels
  ctx.drawImage(
    canvas,
    x, y, width, height,           // Source: physical pixel region from canvas
    0, 0, outputWidth, outputHeight // Destination: logical output size
  )
  
  return ctx.getImageData(0, 0, outputWidth, outputHeight)
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
  const { canvas, duration, fps, quality, viewportBounds, outputWidth, outputHeight, onProgress, onSeek, onRender } = options
  
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
    
    // Capture frame (crop from physical canvas, output at logical size)
    frames.push(captureFrame(canvas, viewportBounds, outputWidth, outputHeight))
    
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
  encodeCanvas.width = outputWidth
  encodeCanvas.height = outputHeight
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
  fps: ExportFPS = 30,
  onProgress?: (progress: number) => void,
  bitrate: number = 10_000_000  // Default 10 Mbps
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
    
    // Convert bitrate to kbps for FFmpeg
    const bitrateKbps = `${Math.round(bitrate / 1000)}k`
    const maxrateKbps = `${Math.round(bitrate * 1.5 / 1000)}k`  // Allow 1.5x peak
    const bufsizeKbps = `${Math.round(bitrate * 2 / 1000)}k`    // 2s buffer
    
    // Convert WebM to MP4 using H.264 codec
    // -c:v libx264 = use H.264 video codec  
    // -preset medium = balanced speed/compression
    // -b:v = target bitrate, -maxrate/-bufsize = enforce consistent bitrate
    // -pix_fmt yuv420p = ensure compatibility with all players
    await ffmpeg.exec([
      '-r', fps.toString(),       // Input frame rate
      '-i', 'input.webm',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',  // Round to even dimensions
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-b:v', bitrateKbps,
      '-maxrate', maxrateKbps,    // Max bitrate for peaks
      '-bufsize', bufsizeKbps,    // Rate control buffer
      '-pix_fmt', 'yuv420p',
      '-r', fps.toString(),       // Output frame rate
      '-movflags', '+faststart',
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

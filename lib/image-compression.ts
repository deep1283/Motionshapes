/**
 * Client-Side Image Compression
 * 
 * Intercepts large image uploads and downscales them to a maximum dimension
 * using a browser Canvas before converting them to efficient WebP base64 strings.
 */

export interface CompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number // 0 to 1
  mimeType?: string
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 0.8,
  mimeType: 'image/webp' // Falls back to jpeg internally on some legacy browsers
}

export async function compressImage(file: File, options?: CompressionOptions): Promise<string> {
  const config = { ...DEFAULT_OPTIONS, ...options }
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      
      img.onload = () => {
        // Calculate new dimensions keeping aspect ratio
        let width = img.width
        let height = img.height
        
        if (width > config.maxWidth!) {
          height = Math.round((height * config.maxWidth!) / width)
          width = config.maxWidth!
        }
        
        if (height > config.maxHeight!) {
          width = Math.round((width * config.maxHeight!) / height)
          height = config.maxHeight!
        }
        
        // Draw to offscreen canvas
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
           // Fallback to original if 2d context fails
           resolve(img.src)
           return
        }
        
        // Fill white background in case of transparent JPEGs routing
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)
        
        ctx.drawImage(img, 0, 0, width, height)
        
        // Preserve PNG transparency if the source is a PNG, otherwise use WebP
        const finalMimeType = file.type === 'image/png' ? 'image/png' : config.mimeType!
        const finalQuality = file.type === 'image/png' ? undefined : config.quality
        
        const compressedDataUrl = canvas.toDataURL(finalMimeType, finalQuality)
        resolve(compressedDataUrl)
      }
      
      img.onerror = (error) => reject(error)
    }
    
    reader.onerror = (error) => reject(error)
  })
}

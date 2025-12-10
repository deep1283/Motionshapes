import type { Vec2 } from './timeline'

// Background settings type (from dashboard)
export interface BackgroundSettings {
  mode: 'solid' | 'gradient'
  solid: string
  from: string
  to: string
  opacity: number
}

export type ShapeKind =
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

// Layer type (from dashboard)
export interface Layer {
  id: string
  type: 'shape' | 'image' | 'svg' | 'text'
  shapeKind: ShapeKind
  x: number
  y: number
  width: number
  height: number
  scale: number
  rotation?: number
  opacity?: number
  fillColor: number
  effects?: any[] // Simplified for now to avoid import issues
  imageUrl?: string  // Base64 data URL for imported images
  svgUrl?: string    // URL to SVG (from Iconify or local)
  iconName?: string  // Iconify icon name (e.g. "mdi:home")
  // Text layer properties
  text?: string           // Text content
  fontFamily?: string     // Font family name (e.g. "Inter")
  fontSize?: number       // Font size in pixels
  fontWeight?: number     // Font weight (400, 500, 600, 700)
}

// Template clip type (from timeline store)
export type TemplateId =
  | 'roll'
  | 'jump'
  | 'pop'
  | 'shake'
  | 'pulse'
  | 'spin'
  | 'counter'
  | 'fade_in'
  | 'fade_out'
  | 'slide_in'
  | 'slide_out'
  | 'grow_in'
  | 'grow_out'
  | 'shrink_in'
  | 'shrink_out'
  | 'spin_in'
  | 'spin_out'
  | 'twist_in'
  | 'twist_out'
  | 'move_scale_in'
  | 'move_scale_out'
  | 'path'
  | 'pan_zoom'
  | 'mask_center'
  | 'mask_top'
  | 'mask_center_out'
  | 'mask_top_out'
  | 'typewriter' | 'bounce_in' | 'bounce_out' | 'scramble' // Text animations
  | 'transition_fade' | 'transition_slide' | 'transition_zoom' | 'transition_blur' // Unified transitions

export interface TemplateClip {
  id: string
  layerId: string
  template: TemplateId
  start: number
  duration: number
  parameters?: {
    templateSpeed?: number
    rollDistance?: number
    jumpHeight?: number
    jumpVelocity?: number
    popScale?: number
    popWobble?: boolean
    popSpeed?: number
    popCollapse?: boolean
    popReappear?: boolean
    shakeDistance?: number
    pulseScale?: number
    pulseSpeed?: number
    spinSpeed?: number
    spinDirection?: 1 | -1
    pathPoints?: Vec2[]
    pathLength?: number
    layerBase?: {
      position?: Vec2
      scale?: number
      rotation?: number
      opacity?: number
    }
    // Pan & Zoom parameters
    panZoomStartRegion?: { x: number; y: number; width: number; height: number }
    panZoomEndRegion?: { x: number; y: number; width: number; height: number }
    panZoomHoldDuration?: number
    panZoomIntensity?: number // Zoom level (1.2 - 3.0)
    panZoomEasing?: 'linear' | 'ease-in-out' | 'smooth'
    panZoomBlurIntensity?: number // Blur intensity (0 = no blur, 10 = max blur)
    // Mask Center parameters
    maskAngle?: number // Angle in degrees (0 = horizontal, 90 = vertical)
    // Text animation parameters
    textAnimation?: 'typewriter' | 'bounce_in' | 'bounce_out' | 'scramble'
    showCursor?: boolean
  }
}

// Complete snapshot of application state for undo/redo
export interface HistorySnapshot {
  // Timeline state
  templateClips: TemplateClip[]
  
  // Animation parameters (global defaults)
  templateSpeed: number
  rollDistance: number
  jumpHeight: number
  jumpVelocity: number
  popScale: number
  popWobble: boolean
  popSpeed: number
  popCollapse: boolean
  popReappear: boolean
  shakeDistance: number
  pulseScale: number
  pulseSpeed: number
  spinSpeed: number
  spinDirection: 1 | -1
  
  // Dashboard state
  layers: Layer[]
  layerOrder: string[]
  background: BackgroundSettings
}

/**
 * Manages undo/redo history using snapshot-based approach.
 * Stores up to 50 snapshots in memory.
 */
export class HistoryManager {
  private history: HistorySnapshot[] = []
  private currentIndex: number = -1
  private readonly maxHistory: number = 50

  /**
   * Push a new snapshot to history.
   * Clears redo stack and trims oldest snapshots if limit exceeded.
   */
  pushSnapshot(snapshot: HistorySnapshot): void {
    // Clear redo stack (everything after current index)
    this.history = this.history.slice(0, this.currentIndex + 1)
    
    // Add new snapshot
    this.history.push(snapshot)
    
    // Trim if exceeds limit (remove oldest)
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    } else {
      this.currentIndex++
    }
  }

  /**
   * Undo to previous snapshot.
   * Returns the snapshot to restore, or null if can't undo.
   */
  undo(): HistorySnapshot | null {
    if (!this.canUndo()) return null
    this.currentIndex--
    return this.history[this.currentIndex]
  }

  /**
   * Redo to next snapshot.
   * Returns the snapshot to restore, or null if can't redo.
   */
  redo(): HistorySnapshot | null {
    if (!this.canRedo()) return null
    this.currentIndex++
    return this.history[this.currentIndex]
  }

  /**
   * Check if undo is available.
   */
  canUndo(): boolean {
    return this.currentIndex > 0
  }

  /**
   * Check if redo is available.
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1
  }

  /**
   * Clear all history.
   */
  clear(): void {
    this.history = []
    this.currentIndex = -1
  }

  /**
   * Get current snapshot without changing index.
   */
  getCurrentSnapshot(): HistorySnapshot | null {
    return this.history[this.currentIndex] ?? null
  }

  /**
   * Get history size for debugging.
   */
  getHistorySize(): number {
    return this.history.length
  }

  /**
   * Get current index for debugging.
   */
  getCurrentIndex(): number {
    return this.currentIndex
  }
}

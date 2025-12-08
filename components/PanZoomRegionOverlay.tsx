/**
 * PanZoomRegionOverlay - Shows target region for zoom animation
 * 
 * Single blue rectangle indicating where to zoom to.
 * User drags/resizes this rectangle to set the zoom target.
 */

import React, { useState, useRef } from 'react'

export interface PanZoomRegion {
  x: number  // normalized 0-1 (left edge)
  y: number  // normalized 0-1 (top edge)
  width: number  // normalized 0-1
  height: number // normalized 0-1
}

interface PanZoomRegionOverlayProps {
  canvasBounds: { width: number; height: number; left: number; top: number }
  offsetX: number
  offsetY: number
  targetRegion: PanZoomRegion
  onUpdateTargetRegion: (region: PanZoomRegion) => void
  onClickBackdrop?: () => void
}

export function PanZoomRegionOverlay({
  canvasBounds,
  offsetX,
  offsetY,
  targetRegion,
  onUpdateTargetRegion,
  onClickBackdrop,
}: PanZoomRegionOverlayProps) {
  const { width, height } = canvasBounds
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  
  const dragStartRef = useRef<{
    mouseX: number
    mouseY: number
    regionX: number
    regionY: number
    regionW: number
    regionH: number
  } | null>(null)
  
  if (!width || !height) return null
  
  // Convert normalized coords to screen pixels
  const toScreen = (region: PanZoomRegion) => ({
    x: region.x * width + offsetX,
    y: region.y * height + offsetY,
    width: region.width * width,
    height: region.height * height,
  })
  
  const screen = toScreen(targetRegion)
  
  // Handle mouse move for dragging/resizing
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return
    
    const { mouseX, mouseY, regionX, regionY, regionW, regionH } = dragStartRef.current
    const deltaX = (e.clientX - mouseX) / width
    const deltaY = (e.clientY - mouseY) / height
    
    if (isDragging) {
      // Move the rectangle
      const newX = Math.max(0, Math.min(1 - targetRegion.width, regionX + deltaX))
      const newY = Math.max(0, Math.min(1 - targetRegion.height, regionY + deltaY))
      onUpdateTargetRegion({ ...targetRegion, x: newX, y: newY })
    } else if (isResizing && resizeHandle) {
      // Resize the rectangle
      let newX = regionX
      let newY = regionY
      let newW = regionW
      let newH = regionH
      
      if (resizeHandle.includes('e')) {
        newW = Math.max(0.1, Math.min(1 - regionX, regionW + deltaX))
      }
      if (resizeHandle.includes('w')) {
        const potentialW = Math.max(0.1, regionW - deltaX)
        const potentialX = regionX + (regionW - potentialW)
        if (potentialX >= 0) {
          newX = potentialX
          newW = potentialW
        }
      }
      if (resizeHandle.includes('s')) {
        newH = Math.max(0.1, Math.min(1 - regionY, regionH + deltaY))
      }
      if (resizeHandle.includes('n')) {
        const potentialH = Math.max(0.1, regionH - deltaY)
        const potentialY = regionY + (regionH - potentialH)
        if (potentialY >= 0) {
          newY = potentialY
          newH = potentialH
        }
      }
      
      onUpdateTargetRegion({ x: newX, y: newY, width: newW, height: newH })
    }
  }
  
  const handlePointerUp = () => {
    setIsDragging(false)
    setIsResizing(false)
    setResizeHandle(null)
    dragStartRef.current = null
  }
  
  // Start dragging the rectangle body
  const startDrag = (e: React.PointerEvent) => {
    e.stopPropagation()
    setIsDragging(true)
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      regionX: targetRegion.x,
      regionY: targetRegion.y,
      regionW: targetRegion.width,
      regionH: targetRegion.height,
    }
  }
  
  // Start resizing from a handle
  const startResize = (e: React.PointerEvent, handle: string) => {
    e.stopPropagation()
    setIsResizing(true)
    setResizeHandle(handle)
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      regionX: targetRegion.x,
      regionY: targetRegion.y,
      regionW: targetRegion.width,
      regionH: targetRegion.height,
    }
  }
  
  const handleSize = 10
  const handles = [
    { id: 'nw', x: screen.x, y: screen.y, cursor: 'nwse-resize' },
    { id: 'n', x: screen.x + screen.width / 2, y: screen.y, cursor: 'ns-resize' },
    { id: 'ne', x: screen.x + screen.width, y: screen.y, cursor: 'nesw-resize' },
    { id: 'e', x: screen.x + screen.width, y: screen.y + screen.height / 2, cursor: 'ew-resize' },
    { id: 'se', x: screen.x + screen.width, y: screen.y + screen.height, cursor: 'nwse-resize' },
    { id: 's', x: screen.x + screen.width / 2, y: screen.y + screen.height, cursor: 'ns-resize' },
    { id: 'sw', x: screen.x, y: screen.y + screen.height, cursor: 'nesw-resize' },
    { id: 'w', x: screen.x, y: screen.y + screen.height / 2, cursor: 'ew-resize' },
  ]
  
  return (
    <div
      className="absolute inset-0"
      style={{ zIndex: 25, pointerEvents: 'auto' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerDown={(e) => {
        // If clicking directly on the overlay container (backdrop), trigger callback
        if (e.target === e.currentTarget) {
          onClickBackdrop?.()
        }
      }}
    >
      <svg className="h-full w-full" style={{ pointerEvents: 'none' }}>
        <g style={{ pointerEvents: 'auto' }}>
          {/* Target region rectangle */}
          <rect
            x={screen.x}
            y={screen.y}
            width={screen.width}
            height={screen.height}
            fill="rgba(59, 130, 246, 0.15)"
            stroke="#3b82f6"
            strokeWidth={3}
            style={{ cursor: 'move' }}
            onPointerDown={startDrag}
          />
          
          {/* Label */}
          <text
            x={screen.x + 8}
            y={screen.y + 22}
            fill="#3b82f6"
            fontSize={14}
            fontWeight="bold"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            ZOOM TARGET
          </text>
          
          {/* Resize handles */}
          {handles.map(handle => (
            <rect
              key={handle.id}
              x={handle.x - handleSize / 2}
              y={handle.y - handleSize / 2}
              width={handleSize}
              height={handleSize}
              fill="white"
              stroke="#3b82f6"
              strokeWidth={2}
              style={{ cursor: handle.cursor }}
              onPointerDown={(e) => startResize(e, handle.id)}
            />
          ))}
        </g>
      </svg>
      
      {/* Instructions */}
      <div 
        className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 px-4 py-2 rounded-lg text-white text-sm"
        style={{ pointerEvents: 'none' }}
      >
        Drag to position • Resize to set zoom level • Smaller = more zoom
      </div>
    </div>
  )
}

export default PanZoomRegionOverlay

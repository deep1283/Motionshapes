'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, ExternalLink } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Motion } from '@/lib/library-api'

interface MotionCardProps {
  motion: Motion
}

export function MotionCard({ motion: motionData }: MotionCardProps) {
  const [isHovering, setIsHovering] = useState(false)
  const [isVideoLoaded, setIsVideoLoaded] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Auto-play video when component mounts
  useEffect(() => {
    if (videoRef.current && motionData.preview_url) {
      videoRef.current.play().catch(() => {
        // Autoplay might be blocked, silent fail
      })
    }
  }, [motionData.preview_url])

  const handleMouseEnter = () => {
    setIsHovering(true)
  }

  const handleMouseLeave = () => {
    setIsHovering(false)
  }

  return (
    <Link 
      href={`/dashboard?motion=${motionData.id}`} 
      target="_blank"
      className="group relative block aspect-video w-full overflow-hidden rounded-xl bg-neutral-900 border border-white/10 hover:border-white/20 transition-all hover:shadow-2xl hover:shadow-purple-500/10"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Thumbnail - show only while video is loading */}
      <div className={cn(
        "absolute inset-0 transition-opacity duration-300",
        isVideoLoaded ? "opacity-0" : "opacity-100"
      )}>
        {motionData.thumbnail_url ? (
          <Image
            src={motionData.thumbnail_url}
            alt={motionData.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
             <span className="text-neutral-600 font-mono text-xs">No Preview</span>
          </div>
        )}
      </div>

      {/* Video Preview - auto-plays on load */}
      {motionData.preview_url && (
        <video
          ref={videoRef}
          src={motionData.preview_url}
          muted
          loop
          playsInline
          autoPlay
          onLoadedData={() => setIsVideoLoaded(true)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-300 bg-neutral-900",
            isVideoLoaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}

      {/* Info Overlay (Bottom) */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-20">
        <div className="flex items-center justify-between">
          <div>
             <h3 className="font-medium text-white text-sm">{motionData.name}</h3>
             <p className="text-[10px] text-neutral-300 uppercase tracking-wider mt-0.5">
               {motionData.category.replace('_', ' ')}
             </p>
          </div>
          <div className="flex items-center gap-2 text-white/70 text-xs">
            <span className="bg-white/10 px-2 py-0.5 rounded text-[10px]">Open</span>
            <ExternalLink className="h-3 w-3" />
          </div>
        </div>
      </div>
    </Link>
  )
}

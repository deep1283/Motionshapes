'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Motion } from '@/lib/library-api'
import { createClient } from '@/lib/supabase'
import { LoginModal } from '@/components/LoginModal'

interface MotionCardProps {
  motion: Motion
}

export function MotionCard({ motion: motionData }: MotionCardProps) {
  const [isHovering, setIsHovering] = useState(false)
  const [isVideoLoaded, setIsVideoLoaded] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const router = useRouter()

  // Auto-play video when component mounts
  useEffect(() => {
    if (videoRef.current && motionData.preview_url) {
      videoRef.current.play().catch(() => {
        // Autoplay might be blocked, silent fail
      })
    }
  }, [motionData.preview_url])

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    setIsCheckingAuth(true)
    
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // User is logged in - navigate directly
        window.open(`/dashboard?motion=${motionData.id}`, '_blank')
      } else {
        // User not logged in - show login modal
        setShowLoginModal(true)
      }
    } catch {
      // On error, show login modal as fallback
      setShowLoginModal(true)
    } finally {
      setIsCheckingAuth(false)
    }
  }

  return (
    <>
      <div 
        onClick={handleClick}
        className={cn(
          "group block cursor-pointer",
          isCheckingAuth && "opacity-70 pointer-events-none"
        )}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Preview Container */}
        <div className="relative flex aspect-video w-full overflow-hidden rounded-xl bg-neutral-900 border border-white/10 group-hover:border-white/20 transition-all">
          {/* Inner layer - absolute, fills container, centers content */}
          <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
            {/* Thumbnail - show only while video is loading */}
            <div className={cn(
              "absolute inset-0 flex items-center justify-center transition-all duration-300",
              isVideoLoaded ? "opacity-0 pointer-events-none" : "opacity-100",
              isHovering ? "scale-105" : "scale-100"
            )}>
              {motionData.thumbnail_url ? (
                <Image
                  src={motionData.thumbnail_url}
                  alt={motionData.name}
                  fill
                  className="object-contain"
                />
              ) : (
                <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                   <span className="text-neutral-600 font-mono text-xs">No Preview</span>
                </div>
              )}
            </div>

            {/* Video Preview - auto-plays on load, centered */}
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
                  "max-h-full max-w-full object-contain transition-all duration-300",
                  isVideoLoaded ? "opacity-100" : "opacity-0",
                  isHovering ? "scale-105" : "scale-100"
                )}
              />
            )}
          </div>
        </div>

        {/* Description - Always visible below preview */}
        <div className="mt-3">
          <h3 className="font-medium text-white text-sm group-hover:text-purple-400 transition-colors">{motionData.name}</h3>
        </div>
      </div>

      {/* Login Modal */}
      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)}
        redirectTo={`/dashboard?motion=${motionData.id}`}
      />
    </>
  )
}


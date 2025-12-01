import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface EffectPreviewProps {
  id: string
  name: string
  isActive: boolean
  isEnabled: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
}

export const EffectPreview: React.FC<EffectPreviewProps> = ({
  id,
  name,
  isActive,
  isEnabled,
  onClick,
  icon: Icon,
}) => {
  const renderAnimation = () => {
    const baseClass = "h-6 w-6 rounded-full bg-gradient-to-br from-neutral-300 to-neutral-500"
    
    switch (id) {
      case 'glow':
        return (
          <motion.div
            className={baseClass}
            animate={{
              boxShadow: [
                '0 0 0px rgba(255, 255, 255, 0)',
                '0 0 20px rgba(255, 255, 255, 0.8)',
                '0 0 0px rgba(255, 255, 255, 0)',
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )
      case 'dropShadow':
        return (
          <motion.div
            className={baseClass}
            animate={{
              boxShadow: [
                '4px 4px 8px rgba(0, 0, 0, 0.3)',
                '8px 8px 16px rgba(0, 0, 0, 0.5)',
                '4px 4px 8px rgba(0, 0, 0, 0.3)',
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )
      case 'blur':
        return (
          <motion.div
            className={baseClass}
            animate={{
              filter: ['blur(0px)', 'blur(4px)', 'blur(0px)'],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )
      case 'glitch':
        return (
          <motion.div
            className={baseClass}
            animate={{
              x: [0, -2, 2, -1, 1, 0],
              filter: [
                'hue-rotate(0deg)',
                'hue-rotate(90deg)',
                'hue-rotate(180deg)',
                'hue-rotate(270deg)',
                'hue-rotate(0deg)',
              ],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              ease: "linear",
              repeatDelay: 1.5,
            }}
          />
        )
      case 'pixelate':
        return (
          <motion.div
            className="h-6 w-6 rounded-full overflow-hidden"
            animate={{
              filter: [
                'contrast(1)',
                'contrast(1.5) brightness(1.2)',
                'contrast(1)',
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <div className="w-full h-full bg-gradient-to-br from-neutral-300 to-neutral-500" 
                 style={{ 
                   imageRendering: 'pixelated',
                   transform: 'scale(0.5)',
                   transformOrigin: 'center'
                 }} 
            />
          </motion.div>
        )
      case 'sparkles':
        return (
          <div className="relative h-6 w-6">
            <div className={cn(baseClass, "absolute inset-0")} />
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute h-1 w-1 rounded-full bg-yellow-300"
                style={{
                  top: '50%',
                  left: '50%',
                }}
                animate={{
                  x: [0, Math.cos(i * 2.1) * 15, 0],
                  y: [0, Math.sin(i * 2.1) * 15, 0],
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.3,
                  ease: "easeOut",
                }}
              />
            ))}
          </div>
        )
      case 'confetti':
        return (
          <div className="relative h-6 w-6">
            <div className={cn(baseClass, "absolute inset-0")} />
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="absolute h-1.5 w-1 rounded-sm"
                style={{
                  top: '50%',
                  left: '50%',
                  backgroundColor: ['#ff0000', '#00ff00', '#0000ff', '#ffff00'][i],
                }}
                animate={{
                  x: [0, (i % 2 === 0 ? 1 : -1) * 12],
                  y: [0, -15 + i * 3, 20],
                  rotate: [0, 360],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeOut",
                }}
              />
            ))}
          </div>
        )
      default:
        return <Icon className="h-6 w-6 text-neutral-400" />
    }
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border p-4 transition-all hover:bg-white/5 relative group",
        isActive
          ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
          : isEnabled
            ? "border-emerald-500/50 bg-emerald-500/5 text-emerald-300"
            : "border-white/5 bg-white/5 text-neutral-400"
      )}
    >
      <div className="flex items-center justify-center h-8 w-8">
        {renderAnimation()}
      </div>
      <span className="text-xs font-medium">{name}</span>
      {isEnabled && (
        <div className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />
      )}
    </button>
  )
}

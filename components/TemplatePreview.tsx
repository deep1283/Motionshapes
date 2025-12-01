import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface TemplatePreviewProps {
  id: string
  name: string
  isSelected: boolean
  onClick: () => void
}

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  id,
  name,
  isSelected,
  onClick,
}) => {
  const renderAnimation = () => {
    switch (id) {
      case 'roll':
        return (
          <motion.div
            className="h-8 w-8 rounded-full bg-neutral-400"
            animate={{
              x: [-20, 20, -20],
              rotate: [0, 360, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )
      case 'jump':
        return (
          <motion.div
            className="h-8 w-8 rounded-full bg-neutral-400"
            animate={{
              y: [10, -10, 10],
              scaleY: [0.9, 1.1, 0.9],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )
      case 'pop':
        return (
          <motion.div
            className="h-8 w-8 rounded-full bg-neutral-400"
            animate={{
              scale: [0.5, 1.2, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeOut",
              times: [0, 0.5, 1]
            }}
          />
        )
      case 'shake':
        return (
          <motion.div
            className="h-8 w-8 rounded-full bg-neutral-400"
            animate={{
              x: [0, -5, 5, -5, 5, 0],
            }}
            transition={{
              duration: 0.5,
              repeat: Infinity,
              ease: "linear",
              repeatDelay: 1,
            }}
          />
        )
      default:
        return <div className="h-8 w-8 rounded-full bg-neutral-400" />
    }
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center justify-center gap-3 rounded-xl border p-4 transition-all duration-200",
        isSelected
          ? "bg-white/10 border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.05)]"
          : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
      )}
    >
      <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded-lg bg-black/20">
        {renderAnimation()}
      </div>
      <span className={cn(
        "text-xs font-medium transition-colors",
        isSelected ? "text-white" : "text-neutral-400 group-hover:text-neutral-200"
      )}>
        {name}
      </span>
    </button>
  )
}

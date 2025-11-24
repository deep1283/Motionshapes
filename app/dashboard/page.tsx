'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import DashboardLayout from '@/components/DashboardLayout'
import dynamic from 'next/dynamic'

// Dynamically import MotionCanvas to avoid SSR issues with Pixi.js
const MotionCanvas = dynamic(() => import('@/components/MotionCanvas'), { 
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-neutral-800" />
})

type ShapeKind = 'circle'

interface Layer {
  id: string
  type: 'shape'
  shapeKind: ShapeKind
  x: number
  y: number
  width: number
  height: number
  fillColor: number
}

export default function DashboardPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [templateVersion, setTemplateVersion] = useState(0)
  const [layers, setLayers] = useState<Layer[]>([])

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/')
      } else {
        setIsLoading(false)
      }
    }

    checkUser()
  }, [router])

  if (isLoading) {
    return <div className="flex h-screen w-screen items-center justify-center bg-[#0a0a0a] text-white">Loading...</div>
  }

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId)
    // bump so MotionCanvas fully resets and replays animation even on same template click
    setTemplateVersion((v) => v + 1)
  }

  const handleAddShape = () => {
    console.log('[Dashboard] add circle')
    const newLayer: Layer = {
      id: crypto.randomUUID(),
      type: 'shape',
      shapeKind: 'circle',
      x: 0.5,
      y: 0.5,
      width: 120,
      height: 120,
      fillColor: 0xffffff,
    }
    setLayers((prev) => [...prev, newLayer])
    setTemplateVersion((v) => v + 1)
  }

  return (
    <DashboardLayout selectedTemplate={selectedTemplate} onSelectTemplate={handleTemplateSelect} onAddShape={handleAddShape}>
      <MotionCanvas template={selectedTemplate} templateVersion={templateVersion} layers={layers} />
    </DashboardLayout>
  )
}

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

export default function DashboardPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState('simple-shape')
  const [templateVersion, setTemplateVersion] = useState(0)

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

  return (
    <DashboardLayout selectedTemplate={selectedTemplate} onSelectTemplate={handleTemplateSelect}>
      <MotionCanvas template={selectedTemplate} templateVersion={templateVersion} />
    </DashboardLayout>
  )
}

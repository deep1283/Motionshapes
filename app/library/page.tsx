'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getMotions, Motion } from '@/lib/library-api'
import { MotionCard } from '@/components/MotionCard'
import { LoginModal } from '@/components/LoginModal'

export default function LibraryPage() {
  const router = useRouter()
  const [motions, setMotions] = useState<Motion[]>([])
  const [loading, setLoading] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setIsLoggedIn(!!session)
    }
    checkAuth()
  }, [])

  useEffect(() => {
    const fetchMotions = async () => {
      setLoading(true)
      try {
        const data = await getMotions('all')
        setMotions(data)
      } catch (error) {
        console.error('Failed to fetch motions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMotions()
  }, [])

  const handleOpenEditor = () => {
    if (isLoggedIn) {
      router.push('/dashboard')
    } else {
      setShowLoginModal(true)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-purple-500/30 font-sans">
        {/* Login Modal */}
        <LoginModal 
          isOpen={showLoginModal} 
          onClose={() => setShowLoginModal(false)} 
          redirectTo="/dashboard"
        />

        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/50 backdrop-blur-xl">
             <div className="flex h-16 items-center justify-between px-6 max-w-[1600px] mx-auto">
                 <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <img src="/resources/wordmark.png" alt="MotionShapes" className="h-6 w-auto" />
                    <div className="h-6 w-px bg-white/20" />
                    <span className="text-neutral-500 font-medium">Library</span>
                 </Link>
                 
                 <div className="flex items-center gap-4">
                     <button 
                       onClick={handleOpenEditor}
                       className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 transition-colors"
                     >
                        Open Editor
                     </button>
                 </div>
             </div>
        </header>
        
        <div className="mx-auto max-w-[1600px] px-6 py-8">
            <div className="flex flex-col gap-8">
                {/* Grid */}
                <div className="min-h-[500px]">
                     <div className="mb-8">
                         <h1 className="text-2xl font-bold text-white mb-2">
                            All Motions
                         </h1>
                         <p className="text-neutral-400 text-sm">
                            {loading ? 'Loading library...' : `${motions.length} ready-to-use motions`}
                         </p>
                     </div>

                     {loading ? (
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                             {[1,2,3,4,5,6,7,8].map(i => (
                                 <div key={i} className="aspect-video rounded-xl bg-neutral-900 border border-white/5 animate-pulse" />
                             ))}
                         </div>
                     ) : motions.length > 0 ? (
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                             {motions.map(motion => (
                                 <MotionCard key={motion.id} motion={motion} />
                             ))}
                         </div>
                     ) : (
                         <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-white/10 rounded-2xl bg-neutral-900/20">
                             <div className="h-12 w-12 rounded-full bg-neutral-800 flex items-center justify-center mb-4">
                                 <Search className="h-6 w-6 text-neutral-500" />
                             </div>
                             <h3 className="text-lg font-medium text-white mb-1">No motions found</h3>
                             <p className="text-neutral-400 text-sm max-w-sm">
                                 We couldn't find any motions yet. Check back soon!
                             </p>
                         </div>
                     )}
                </div>
            </div>
        </div>
    </div>
  )
}


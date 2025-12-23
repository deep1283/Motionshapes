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
    <div className="min-h-screen bg-black text-white selection:bg-purple-500/30 font-sans relative overflow-x-hidden">
        {/* Ambient Background Glow */}
        <div className="fixed top-0 left-0 right-0 h-[500px] bg-purple-900/10 blur-[120px] pointer-events-none select-none" />
        <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-blue-900/5 blur-[120px] pointer-events-none select-none" />

        {/* Login Modal */}
        <LoginModal 
          isOpen={showLoginModal} 
          onClose={() => setShowLoginModal(false)} 
          redirectTo="/dashboard"
        />

        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-black/50 backdrop-blur-xl supports-[backdrop-filter]:bg-black/20">
             <div className="flex h-16 items-center justify-between px-6 max-w-[1600px] mx-auto">
                 <Link href="/" className="flex items-center gap-4 group">
                    <img src="/resources/wordmark.png" alt="MotionShapes" className="h-6 w-auto opacity-90 group-hover:opacity-100 transition-opacity" />
                    <div className="h-4 w-px bg-white/10" />
                    <span className="text-neutral-500 font-medium text-sm tracking-wide">Library</span>
                 </Link>
                 
                 <div className="flex items-center gap-4">
                     <button 
                       onClick={handleOpenEditor}
                       className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-neutral-200 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-white/5"
                     >
                        Open Editor
                     </button>
                 </div>
             </div>
        </header>
        
        <div className="mx-auto max-w-[1600px] px-6 py-12 relative z-10">
            <div className="flex flex-col gap-10">
                {/* Heading Section */}
                <div className="flex items-end justify-between border-b border-white/[0.06] pb-6">
                     <div>
                         <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 mb-2 tracking-tight">
                            Explore Motion
                         </h1>
                         <p className="text-neutral-400 text-sm">
                            {loading ? 'Curating library...' : `${motions.length} hand-crafted animations ready for your projects`}
                         </p>
                     </div>
                </div>

                {/* Grid */}
                <div className="min-h-[500px]">
                     {loading ? (
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                             {[1,2,3,4,5,6,7,8].map(i => (
                                 <div key={i} className="space-y-3">
                                    <div className="aspect-video rounded-xl bg-neutral-900/50 border border-white/5 animate-pulse" />
                                    <div className="h-4 w-2/3 bg-neutral-900/50 rounded animate-pulse" />
                                 </div>
                             ))}
                         </div>
                     ) : motions.length > 0 ? (
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-10">
                             {motions.map(motion => (
                                 <MotionCard key={motion.id} motion={motion} />
                             ))}
                         </div>
                     ) : (
                         <div className="flex flex-col items-center justify-center py-32 text-center border border-dashed border-white/10 rounded-2xl bg-neutral-900/20 backdrop-blur-sm">
                             <div className="h-14 w-14 rounded-full bg-white/5 flex items-center justify-center mb-4 ring-1 ring-white/10">
                                 <Search className="h-6 w-6 text-neutral-500" />
                             </div>
                             <h3 className="text-lg font-medium text-white mb-2">No motions found</h3>
                             <p className="text-neutral-400 text-sm max-w-sm">
                                 We couldn't find any motions yet. Check back soon for fresh content!
                             </p>
                         </div>
                     )}
                </div>
            </div>
        </div>
    </div>
  )
}


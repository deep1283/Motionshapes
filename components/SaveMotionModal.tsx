'use client'

import { useState } from 'react'
import { X, Upload, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SaveMotionData {
  name: string
  category: string
}

interface SaveMotionModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: SaveMotionData) => Promise<void>
  isSaving: boolean
}

export function SaveMotionModal({ isOpen, onClose, onSave, isSaving }: SaveMotionModalProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('social_media')

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ name, category })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-neutral-900 border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
          <h2 className="text-lg font-semibold text-white">Save to Motion Library</h2>
          <button 
            onClick={onClose} 
            className="rounded-full p-2 hover:bg-white/10 transition-colors text-neutral-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Motion Name</label>
            <input 
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-lg bg-black border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
              placeholder="e.g. Bounce In Text"
              required
              disabled={isSaving}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Category</label>
            <div className="relative">
                <select 
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full rounded-lg bg-black border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50 appearance-none disabled:opacity-50"
                disabled={isSaving}
                >
                <option value="social_media" className="bg-neutral-900">Social Media</option>
                <option value="logos" className="bg-neutral-900">Logos</option>
                <option value="text" className="bg-neutral-900">Text Effects</option>
                <option value="product" className="bg-neutral-900">Product</option>
                <option value="ui" className="bg-neutral-900">UI Elements</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
            </div>
          </div>
          
          <div className="pt-2">
            <button 
                type="submit"
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-purple-900/20 hover:shadow-purple-900/40"
            >
                {isSaving ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating Preview...
                    </>
                ) : (
                    <>
                        <Upload className="h-4 w-4" />
                        Save to Library
                    </>
                )}
            </button>
            {isSaving && (
                <p className="text-xs text-center text-neutral-500 mt-3 animate-pulse">
                    Please wait while we record a preview video...
                </p>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

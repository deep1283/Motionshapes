'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, Search, Loader2 } from 'lucide-react'
import { searchIcons, getSvgUrl, getPopularIcons, type IconifySearchResult } from '@/lib/iconify'

interface ExploreShapesModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectIcon: (iconName: string, svgUrl: string) => void
}

export function ExploreShapesModal({ isOpen, onClose, onSelectIcon }: ExploreShapesModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<IconifySearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load popular icons on mount
  useEffect(() => {
    if (isOpen && !results) {
      loadPopularIcons()
    }
  }, [isOpen])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  // Close on click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const loadPopularIcons = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getPopularIcons()
      setResults(data)
    } catch (err) {
      setError('Failed to load icons')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      loadPopularIcons()
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await searchIcons(searchQuery, { limit: 60 })
      setResults(data)
    } catch (err) {
      setError('Search failed')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search
  const handleQueryChange = (value: string) => {
    setQuery(value)
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(value)
    }, 300)
  }

  const handleIconClick = (iconName: string) => {
    const svgUrl = getSvgUrl(iconName)
    onSelectIcon(iconName, svgUrl)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="relative w-[700px] max-w-[90vw] max-h-[80vh] rounded-2xl border border-purple-500/30 bg-neutral-900/95 backdrop-blur-xl shadow-2xl shadow-purple-500/10 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(23, 23, 23, 0.98) 0%, rgba(38, 38, 38, 0.95) 100%)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div>
            <h2 className="text-lg font-semibold text-white">Explore Shapes</h2>
            <p className="text-xs text-neutral-500 mt-0.5">200,000+ icons from Iconify</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-4 border-b border-neutral-800/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search icons... (e.g. arrow, home, social)"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-neutral-800/80 border border-neutral-700/50 text-white text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
              autoFocus
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-400 animate-spin" />
            )}
          </div>
        </div>

        {/* Icon Grid */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 160px)' }}>
          {error ? (
            <div className="text-center py-12 text-neutral-500">
              <p>{error}</p>
              <button
                onClick={loadPopularIcons}
                className="mt-2 text-purple-400 hover:text-purple-300 text-sm"
              >
                Try again
              </button>
            </div>
          ) : loading && !results ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
            </div>
          ) : results && results.icons.length > 0 ? (
            <div className="grid grid-cols-8 gap-2">
              {results.icons.map((iconName) => (
                <button
                  key={iconName}
                  onClick={() => handleIconClick(iconName)}
                  className="group relative aspect-square rounded-xl bg-neutral-800/50 hover:bg-purple-500/20 border border-transparent hover:border-purple-500/40 transition-all duration-200 flex items-center justify-center overflow-hidden"
                  title={iconName}
                >
                  {/* Icon Preview */}
                  <img
                    src={getSvgUrl(iconName, 'ffffff')}
                    alt={iconName}
                    className="w-7 h-7 object-contain opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all duration-200"
                    loading="lazy"
                  />
                  
                  {/* Hover Glow */}
                  <div className="absolute inset-0 rounded-xl bg-purple-500/0 group-hover:bg-purple-500/5 transition-colors" />
                  
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-[10px] text-neutral-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {iconName.split(':')[1]}
                  </div>
                </button>
              ))}
            </div>
          ) : results && results.icons.length === 0 ? (
            <div className="text-center py-12 text-neutral-500">
              <p>No icons found for "{query}"</p>
              <p className="text-sm mt-1">Try different keywords</p>
            </div>
          ) : null}
        </div>

        {/* Footer with result count */}
        {results && results.total > 0 && (
          <div className="px-6 py-3 border-t border-neutral-800/50 text-xs text-neutral-500">
            Showing {results.icons.length} of {results.total} icons
          </div>
        )}
      </div>
    </div>
  )
}

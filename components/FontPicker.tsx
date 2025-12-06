'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { fetchGoogleFonts, loadFont, POPULAR_FONTS, GoogleFont } from '@/lib/google-fonts'
import { Search, ChevronDown, X } from 'lucide-react'

interface FontPickerProps {
  value: string
  onChange: (fontFamily: string) => void
}

export default function FontPicker({ value, onChange }: FontPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [fonts, setFonts] = useState<GoogleFont[]>([])
  const [loading, setLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch fonts on mount
  useEffect(() => {
    const loadFonts = async () => {
      setLoading(true)
      const fetchedFonts = await fetchGoogleFonts()
      setFonts(fetchedFonts)
      setLoading(false)
    }
    loadFonts()
  }, [])

  // Load current font
  useEffect(() => {
    if (value) {
      loadFont(value)
    }
  }, [value])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Filter fonts by search and category
  const filteredFonts = useMemo(() => {
    let result = fonts

    // Filter by category
    if (activeCategory !== 'all') {
      result = result.filter(f => f.category === activeCategory)
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(f => f.family.toLowerCase().includes(query))
    }

    // Sort: popular fonts first, then alphabetically
    return result.slice(0, 100).sort((a, b) => {
      const aPopular = POPULAR_FONTS.includes(a.family)
      const bPopular = POPULAR_FONTS.includes(b.family)
      if (aPopular && !bPopular) return -1
      if (!aPopular && bPopular) return 1
      return a.family.localeCompare(b.family)
    })
  }, [fonts, searchQuery, activeCategory])

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'sans-serif', label: 'Sans Serif' },
    { id: 'serif', label: 'Serif' },
    { id: 'display', label: 'Display' },
    { id: 'handwriting', label: 'Handwriting' },
    { id: 'monospace', label: 'Mono' },
  ]

  const handleSelect = async (fontFamily: string) => {
    setIsOpen(false)
    setSearchQuery('')
    // Wait for font to fully load before updating
    await loadFont(fontFamily)
    onChange(fontFamily)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Selected Font Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between rounded bg-neutral-800 px-3 py-2.5 text-sm text-white hover:bg-neutral-700 transition-colors"
      >
        <span style={{ fontFamily: value }}>{value}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-[999] rounded-xl border border-white/10 bg-[#0a0a0a] shadow-2xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search fonts..."
                className="w-full pl-8 pr-8 py-2 bg-neutral-800 rounded text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Categories */}
          <div className="flex gap-1 p-2 border-b border-white/5 overflow-x-auto">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2 py-1 text-[10px] rounded whitespace-nowrap transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Font List */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-neutral-500 text-sm">Loading fonts...</div>
            ) : filteredFonts.length === 0 ? (
              <div className="p-4 text-center text-neutral-500 text-sm">No fonts found</div>
            ) : (
              filteredFonts.map((font) => (
                <button
                  key={font.family}
                  onClick={() => handleSelect(font.family)}
                  onMouseEnter={() => loadFont(font.family)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-neutral-800 transition-colors ${
                    value === font.family ? 'bg-purple-600/20 text-purple-300' : 'text-white'
                  }`}
                >
                  <span 
                    className="text-sm truncate" 
                    style={{ fontFamily: font.family }}
                  >
                    {font.family}
                  </span>
                  {POPULAR_FONTS.includes(font.family) && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-600/30 text-purple-300">
                      Popular
                    </span>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-white/5 text-center">
            <span className="text-[10px] text-neutral-500">
              {fonts.length} fonts available
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Toast {
  id: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}

interface ToastContextType {
  showToast: (message: string, type?: Toast['type']) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={cn(
              "min-w-[300px] max-w-[400px] rounded-lg shadow-lg p-4 flex items-start gap-3 animate-in slide-in-from-right",
              {
                'bg-neutral-800 border border-white/10 text-white': toast.type === 'info',
                'bg-green-900/90 border border-green-500/30 text-green-100': toast.type === 'success',
                'bg-yellow-900/90 border border-yellow-500/30 text-yellow-100': toast.type === 'warning',
                'bg-red-900/90 border border-red-500/30 text-red-100': toast.type === 'error',
              }
            )}
          >
            <span className="text-xl">
              {toast.type === 'info' && 'ℹ️'}
              {toast.type === 'success' && '✅'}
              {toast.type === 'warning' && '⚠️'}
              {toast.type === 'error' && '❌'}
            </span>
            <p className="flex-1 text-sm">{toast.message}</p>
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-white/60 hover:text-white transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

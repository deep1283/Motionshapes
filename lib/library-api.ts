import { createClient } from '@/lib/supabase'

export interface Motion {
  id: string
  name: string
  description?: string
  category: string
  tags: string[]
  thumbnail_url: string
  preview_url: string
  data: any
  status: 'pending' | 'approved' | 'rejected' | 'featured'
  submitted_by?: string
  created_at: string
  use_count: number
  is_featured: boolean
}

export async function getMotions(category?: string) {
  const supabase = createClient()
  let query = supabase
    .from('motions')
    .select('*')
    .in('status', ['approved', 'featured'])
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })

  if (category && category !== 'all') {
    query = query.eq('category', category)
  }

  const { data, error } = await query
  if (error) throw error
  return data as Motion[]
}

export async function getMotionById(id: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('motions')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return data as Motion
}

export async function saveMotion(motion: Partial<Motion>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('motions')
    .insert([motion])
    .select()
    .single()

  if (error) throw error
  return data as Motion
}

export async function uploadToCloudflare(file: Blob, filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = async () => {
      try {
        const dataUrl = reader.result as string
        const res = await fetch('/api/r2/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: dataUrl,
            fileName: filename
          })
        })
        
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Upload failed')
        resolve(data.url)
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

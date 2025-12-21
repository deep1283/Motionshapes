/**
 * Supabase Project Persistence
 * 
 * Helper functions for saving and loading user animation projects.
 * Projects are stored in the `projects` table in Supabase.
 */

import { createClient } from '@/lib/supabase'

export interface ProjectData {
  id?: string
  user_id?: string
  name?: string
  layers: unknown[]
  layer_order: string[]
  timeline_snapshot: unknown
  canvas_width?: number
  canvas_height?: number
  aspect_ratio?: string
  background_color?: string
  background_settings?: unknown // Full background object (type, solid, gradient, image)
  created_at?: string
  updated_at?: string
}

/**
 * Load the user's active project (most recently updated)
 */
export async function loadActiveProject(userId: string): Promise<ProjectData | null> {
  console.log('[LOAD-DEBUG] Loading project for user:', userId)
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()
  
  console.log('[LOAD-DEBUG] Supabase response:', { data, error })
  
  if (error) {
    // No project found is not an error for us
    if (error.code === 'PGRST116') {
      console.log('[LOAD-DEBUG] No active project found (PGRST116)')
      return null
    }
    console.error('[LOAD-DEBUG] Error loading project:', error)
    return null
  }
  
  console.log('[LOAD-DEBUG] Loaded project:', {
    id: data?.id,
    name: data?.name,
    layersCount: data?.layers?.length,
    hasBackgroundSettings: !!data?.background_settings,
    canvasWidth: data?.canvas_width,
    canvasHeight: data?.canvas_height,
  })
  
  return data as ProjectData
}

/**
 * Save (upsert) a project to Supabase
 */
export async function saveProject(
  projectId: string | null,
  userId: string,
  projectData: Partial<ProjectData>
): Promise<{ id: string } | null> {
  const supabase = createClient()
  
  const payload = {
    ...projectData,
    user_id: userId,
    is_active: true,
  }
  
  if (projectId) {
    // Update existing project
    const { error } = await supabase
      .from('projects')
      .update(payload)
      .eq('id', projectId)
      .eq('user_id', userId)
    
    if (error) {
      console.error('Error saving project:', error)
      return null
    }
    
    return { id: projectId }
  } else {
    // Create new project
    const { data, error } = await supabase
      .from('projects')
      .insert(payload)
      .select('id')
      .single()
    
    if (error) {
      console.error('Error creating project:', error)
      return null
    }
    
    return data as { id: string }
  }
}

/**
 * Create a new blank project for a user
 */
export async function createNewProject(userId: string): Promise<{ id: string } | null> {
  return saveProject(null, userId, {
    name: 'Untitled Project',
    layers: [],
    layer_order: [],
    timeline_snapshot: {},
  })
}

/**
 * List all projects for a user (for future project management UI)
 */
export async function listProjects(userId: string): Promise<ProjectData[]> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  
  if (error) {
    console.error('Error listing projects:', error)
    return []
  }
  
  return data as ProjectData[]
}

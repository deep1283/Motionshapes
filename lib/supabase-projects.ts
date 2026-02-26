/**
 * Local Project Persistence (IndexedDB)
 * 
 * Helper functions for saving and loading user animation projects locally.
 * Projects are stored using IndexedDB via `idb-keyval` to bypass 5MB limits.
 */

import { get, set } from 'idb-keyval'

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
  is_active?: boolean
}

const STORE_KEY = 'motionshapes_local_projects'

async function getLocalProjects(): Promise<Record<string, ProjectData>> {
  if (typeof window === 'undefined') return {}
  try {
    const data = await get(STORE_KEY)
    return data || {}
  } catch (e) {
    console.error('Error getting local projects:', e)
    return {}
  }
}

async function saveLocalProjects(projects: Record<string, ProjectData>): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    await set(STORE_KEY, projects)
  } catch (e: any) {
    console.error('Failed to save to IndexedDB:', e)
    if (e && e.name === 'QuotaExceededError') {
      window.dispatchEvent(new CustomEvent('motionshapes:quota_exceeded'))
    }
  }
}

/**
 * Load the user's active project (most recently updated)
 */
export async function loadActiveProject(userId: string): Promise<ProjectData | null> {
  const projects = await getLocalProjects()
  
  // Find the most recently updated active project for this user
  let activeProject: ProjectData | null = null
  for (const id in projects) {
    const p = projects[id]
    if (p.user_id === userId && p.is_active) {
      if (!activeProject || new Date(p.updated_at || 0) > new Date(activeProject.updated_at || 0)) {
        activeProject = p
      }
    }
  }
  
  // If no active project found, check if there's any legacy local storage fallback we can migrate
  if (!activeProject && typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('motionshapes_anonymous_project')
      if (saved) {
        try {
          const legacyProject = JSON.parse(saved) as ProjectData
          // Migrate it to IDB
          await saveProject(legacyProject.id || `local_${Math.random().toString(36).substring(7)}`, userId, legacyProject)
          window.localStorage.removeItem('motionshapes_anonymous_project')
          return legacyProject
        } catch (e) {
          console.error('Error parsing legacy local project', e)
        }
      }
  }
  
  return activeProject
}

/**
 * Save (upsert) a project to IndexedDB
 */
export async function saveProject(
  projectId: string | null,
  userId: string,
  projectData: Partial<ProjectData>
): Promise<{ id: string } | null> {
  const projects = await getLocalProjects()
  
  const id = projectId || 'local_' + Math.random().toString(36).substring(7)
  const now = new Date().toISOString()
  
  const existingProject = projects[id] || {}
  
  const payload: ProjectData = {
    ...existingProject,
    ...projectData,
    id,
    user_id: userId,
    is_active: true,
    updated_at: now,
    created_at: existingProject.created_at || now
  }
  
  projects[id] = payload
  
  await saveLocalProjects(projects)
  return { id }
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
  const projects = await getLocalProjects()
  return Object.values(projects)
    .filter(p => p.user_id === userId)
    .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())
}

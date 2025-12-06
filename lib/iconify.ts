/**
 * Iconify API Service
 * 
 * Provides functions to search and fetch SVG icons from the Iconify API.
 * API Docs: https://iconify.design/docs/api/
 */

const ICONIFY_API_BASE = 'https://api.iconify.design'

export interface IconifySearchResult {
  icons: string[]  // e.g., ["mdi:home", "mdi-light:home"]
  total: number
  limit: number
  start: number
  collections: Record<string, {
    name: string
    total: number
    author?: { name: string; url?: string }
    license?: { title: string; spdx?: string; url?: string }
    samples?: string[]
    height?: number | number[]
    category?: string
    palette?: boolean
  }>
}

/**
 * Search for icons matching a query
 */
export async function searchIcons(
  query: string,
  options: { limit?: number; start?: number; prefix?: string } = {}
): Promise<IconifySearchResult> {
  const { limit = 48, start = 0, prefix } = options
  
  const params = new URLSearchParams({
    query,
    limit: String(limit),
    start: String(start),
  })
  
  if (prefix) {
    params.set('prefix', prefix)
  }
  
  const response = await fetch(`${ICONIFY_API_BASE}/search?${params}`)
  
  if (!response.ok) {
    throw new Error(`Iconify search failed: ${response.status}`)
  }
  
  return response.json()
}

/**
 * Get the direct URL to an SVG icon
 * @param iconName Full icon name like "mdi:home" or "mdi-light:home"
 * @param color Optional color (CSS color value without #)
 */
export function getSvgUrl(iconName: string, color?: string): string {
  const [prefix, name] = iconName.split(':')
  let url = `${ICONIFY_API_BASE}/${prefix}/${name}.svg`
  
  if (color) {
    url += `?color=%23${color.replace('#', '')}`
  }
  
  return url
}

/**
 * Fetch the raw SVG content for an icon
 */
export async function fetchSvgContent(iconName: string, color?: string): Promise<string> {
  const url = getSvgUrl(iconName, color)
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch SVG: ${response.status}`)
  }
  
  return response.text()
}

/**
 * Get popular/featured icons for initial display
 */
export async function getPopularIcons(): Promise<IconifySearchResult> {
  // Search for love icons to show initially
  return searchIcons('love', { limit: 48 })
}

/**
 * Parse icon name into prefix and name parts
 */
export function parseIconName(fullName: string): { prefix: string; name: string } {
  const [prefix, name] = fullName.split(':')
  return { prefix, name }
}

// Google Fonts API utility

export interface GoogleFont {
  family: string
  category: string
  variants: string[]
  files: Record<string, string>
}

interface GoogleFontsResponse {
  items: GoogleFont[]
}

let cachedFonts: GoogleFont[] | null = null

export async function fetchGoogleFonts(): Promise<GoogleFont[]> {
  if (cachedFonts) return cachedFonts

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_FONTS_API_KEY
  if (!apiKey) {
    console.warn('Google Fonts API key not found')
    return getDefaultFonts()
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&sort=popularity`
    )
    
    if (!response.ok) {
      throw new Error('Failed to fetch fonts')
    }

    const data: GoogleFontsResponse = await response.json()
    cachedFonts = data.items
    return cachedFonts
  } catch (error) {
    console.error('Error fetching Google Fonts:', error)
    return getDefaultFonts()
  }
}

// Fallback fonts if API fails
function getDefaultFonts(): GoogleFont[] {
  return [
    { family: 'Inter', category: 'sans-serif', variants: ['400', '500', '600', '700'], files: {} },
    { family: 'Roboto', category: 'sans-serif', variants: ['400', '500', '700'], files: {} },
    { family: 'Poppins', category: 'sans-serif', variants: ['400', '500', '600', '700'], files: {} },
    { family: 'Montserrat', category: 'sans-serif', variants: ['400', '500', '600', '700'], files: {} },
    { family: 'Open Sans', category: 'sans-serif', variants: ['400', '500', '600', '700'], files: {} },
    { family: 'Lato', category: 'sans-serif', variants: ['400', '700'], files: {} },
    { family: 'Space Grotesk', category: 'sans-serif', variants: ['400', '500', '600', '700'], files: {} },
    { family: 'DM Sans', category: 'sans-serif', variants: ['400', '500', '700'], files: {} },
  ]
}

// Load a font dynamically via CSS and wait for it to be ready
export async function loadFont(fontFamily: string): Promise<boolean> {
  const linkId = `google-font-${fontFamily.replace(/\s+/g, '-').toLowerCase()}`
  
  // Check if already loaded in DOM
  const existingLink = document.getElementById(linkId)
  
  if (!existingLink) {
    // Add the CSS link
    const link = document.createElement('link')
    link.id = linkId
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;500;600;700&display=swap`
    document.head.appendChild(link)
  }
  
  // Wait for the font to actually load using the Font Loading API
  try {
    await document.fonts.load(`600 48px "${fontFamily}"`)
    return true
  } catch {
    console.warn(`Failed to load font: ${fontFamily}`)
    return false
  }
}

// Popular fonts to show at the top
export const POPULAR_FONTS = [
  'Inter',
  'Roboto',
  'Poppins',
  'Montserrat',
  'Open Sans',
  'Lato',
  'Oswald',
  'Raleway',
  'Playfair Display',
  'Merriweather',
  'Space Grotesk',
  'DM Sans',
  'Plus Jakarta Sans',
  'Outfit',
  'Nunito',
  'Work Sans',
]

import { MetadataRoute } from 'next'
 
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://motionshapes.com'
  
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/api/'], // Don't index private dashboard or API
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}

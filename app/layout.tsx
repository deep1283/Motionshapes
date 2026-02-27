import type { Metadata } from 'next'
import { Inter, Roboto } from 'next/font/google'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { ToastProvider } from '@/components/Toast'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

const roboto = Roboto({
  variable: '--font-roboto',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
})

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://motionshapes.com'

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'MotionShapes',
    template: '%s | MotionShapes',
  },
  description:
    'MotionShapes is an open-source browser-based motion design tool for creating professional animations and exporting videos fast.',
  applicationName: 'MotionShapes',
  authors: [{ name: 'MotionShapes Team' }],
  creator: 'MotionShapes',
  publisher: 'MotionShapes',
  category: 'design',
  referrer: 'origin-when-cross-origin',
  keywords: [
    'open-source motion design',
    'motion graphics editor',
    'browser video editor',
    'animation software',
    'motion design web app',
    'online animation maker',
    'logo animation maker',
    'product animation software',
    '2D animation editor',
    'kinetic typography tool',
    'social media video maker',
    'web-based motion graphics',
    'startup product demo video tool',
    'open source creative coding project',
    'contribute to open source motion editor',
  ],
  alternates: {
    languages: {
      'en-US': '/',
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/resources/logo.png', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/resources/logo.png',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    type: 'website',
    url: '/',
    title: 'MotionShapes | Open-Source Motion Design Tool',
    description:
      'Create high-quality animations in your browser with MotionShapes, an open-source editor for product videos and motion graphics.',
    siteName: 'MotionShapes',
    locale: 'en_US',
    images: [
      {
        url: '/canvas.png',
        width: 2552,
        height: 1300,
        alt: 'MotionShapes editor preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MotionShapes | Open-Source Motion Design Tool',
    description:
      'Create high-quality animations in your browser with MotionShapes, an open-source editor for product videos and motion graphics.',
    images: ['/canvas.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${roboto.variable} antialiased`}
        suppressHydrationWarning
      >
        <ToastProvider>{children}</ToastProvider>
        {/* Preload emoji glyphs to reduce canvas emoji flash on first render */}
        <span className="emoji-preload" aria-hidden="true">
          🎄🎁😀
        </span>
        <SpeedInsights />
      </body>
    </html>
  )
}

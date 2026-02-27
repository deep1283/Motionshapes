import type { Metadata } from 'next'
import HomePageClient from '@/components/HomePageClient'

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://motionshapes.com'
const repositoryUrl = 'https://github.com/deep1283/Motionshapes'
const title = 'Open-Source Motion Design Tool'
const fullTitle = `MotionShapes | ${title}`
const description =
  'Create high-quality product animations, logo reveals, and motion graphics directly in your browser. MotionShapes is a fast, open-source web animation editor.'

export const metadata: Metadata = {
  title: {
    absolute: fullTitle,
  },
  description,
  keywords: [
    'motion design tool',
    'open source animation editor',
    'browser animation software',
    'logo animation',
    '2D motion graphics',
    'product video creator',
    'web-based video editor',
    'online motion graphics editor',
    'logo reveal maker',
    'startup demo video creator',
    'social media animation maker',
    'kinetic typography creator',
    'framer motion alternative workflow',
    'contribute to open source animation editor',
    'open source nextjs creative tool',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'MotionShapes',
    title: fullTitle,
    description,
    images: [
      {
        url: '/canvas.png',
        width: 2552,
        height: 1300,
        alt: 'MotionShapes editor canvas preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: fullTitle,
    description,
    images: ['/canvas.png'],
  },
}

export default function HomePage() {
  const softwareAppSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'MotionShapes',
    url: baseUrl,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    isAccessibleForFree: true,
    license: 'https://www.gnu.org/licenses/agpl-3.0.en.html',
    codeRepository: repositoryUrl,
    description,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  }

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MotionShapes',
    url: baseUrl,
    logo: `${baseUrl}/resources/logo.png`,
    sameAs: [repositoryUrl],
  }

  const sourceCodeSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: 'MotionShapes',
    codeRepository: repositoryUrl,
    license: 'https://www.gnu.org/licenses/agpl-3.0.en.html',
    programmingLanguage: ['TypeScript', 'JavaScript'],
    runtimePlatform: 'Web Browser',
    url: repositoryUrl,
  }

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'MotionShapes',
    url: baseUrl,
    description:
      'Open-source browser-based motion graphics editor for logo animations, product demos, and social content.',
  }

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Is MotionShapes open source?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. MotionShapes is open source under the AGPL-3.0 license.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I create logo and product animations in the browser?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. MotionShapes is designed for browser-based logo reveals, product animations, and motion graphics workflows.',
        },
      },
      {
        '@type': 'Question',
        name: 'Who is MotionShapes built for?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'It is built for founders, marketers, designers, content creators, and developers who need fast motion assets.',
        },
      },
    ],
  }

  return (
    <>
      <HomePageClient />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(sourceCodeSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  )
}

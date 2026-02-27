import type { Metadata } from 'next'
import Link from 'next/link'

const title = 'Features'
const description =
  'Explore MotionShapes features: browser-native animation editing, timeline control, effects, templates, and local-first exports.'

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'motion design features',
    'animation editor features',
    'online logo animation tool',
    'product animation software',
    'web motion graphics editor',
    'timeline animation editor',
    'visual keyframe editor',
    'social media animation creator',
  ],
  alternates: {
    canonical: '/features',
  },
  openGraph: {
    title: `MotionShapes | ${title}`,
    description,
    url: '/features',
    type: 'website',
    images: [
      {
        url: '/canvas.png',
        width: 2552,
        height: 1300,
        alt: 'MotionShapes features and editor preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `MotionShapes | ${title}`,
    description,
    images: ['/canvas.png'],
  },
}

export default function FeaturesPage() {
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'MotionShapes Features',
    description,
    url: 'https://motionshapes.com/features',
  }

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What can I create with MotionShapes?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'You can create logo animations, product demos, social media motion assets, and 2D motion graphics in the browser.',
        },
      },
      {
        '@type': 'Question',
        name: 'Does MotionShapes support timeline-based animation?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. MotionShapes includes timeline controls and keyframe-style editing to design precise motion behavior.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is MotionShapes suitable for startup marketing videos?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. It is useful for founders and teams creating product explainer visuals and launch content quickly.',
        },
      },
    ],
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <section className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-sm uppercase tracking-wide text-violet-300">Features</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          Browser-first motion design, built for speed
        </h1>
        <p className="mt-6 max-w-3xl text-lg text-neutral-300">
          MotionShapes helps creators and teams build product animations, logo reveals,
          and social clips without installing heavy desktop software.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-medium">Visual canvas + timeline</h2>
            <p className="mt-2 text-sm text-neutral-300">
              Compose scenes with layers, keyframe effects, and timeline controls to
              shape motion precisely.
            </p>
          </article>
          <article className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-medium">Template-driven motion</h2>
            <p className="mt-2 text-sm text-neutral-300">
              Use prebuilt animation templates for jump, roll, pulse, spin, path, and
              other common motion behaviors.
            </p>
          </article>
          <article className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-medium">Effects and styling</h2>
            <p className="mt-2 text-sm text-neutral-300">
              Add visual treatments and adjust typography, color, and composition with
              instant feedback.
            </p>
          </article>
          <article className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-medium">Local-first export workflow</h2>
            <p className="mt-2 text-sm text-neutral-300">
              Build and preview in the browser, then export ready-to-share motion
              outputs without a complex setup.
            </p>
          </article>
        </div>

        <section className="mt-12 rounded-xl border border-violet-400/30 bg-violet-500/10 p-6">
          <h2 className="text-xl font-semibold">Who it is for</h2>
          <p className="mt-2 text-neutral-200">
            Founders, indie makers, designers, marketers, and developers who want to
            produce polished motion assets quickly.
          </p>
        </section>

        <section className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Common use cases</h2>
          <ul className="mt-3 space-y-2 text-neutral-300">
            <li>Landing page product animation clips</li>
            <li>Logo reveal and brand motion packs</li>
            <li>Social media promo reels and ad creatives</li>
            <li>App onboarding visuals and launch teasers</li>
          </ul>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-200"
          >
            Start creating
          </Link>
          <Link
            href="/use-cases"
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            See use cases
          </Link>
          <Link
            href="/contribute"
            className="rounded-full border border-violet-400/40 bg-violet-500/10 px-5 py-2.5 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20"
          >
            Contribute as engineer
          </Link>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </main>
  )
}

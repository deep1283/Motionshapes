import type { Metadata } from 'next'
import Link from 'next/link'

const title = 'About'
const description =
  'Learn about MotionShapes, the open-source browser motion design project focused on fast creation, local-first workflows, and community contribution.'

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'about motionshapes',
    'open source animation project',
    'web motion graphics platform',
    'browser-based animation editor',
    'logo animation software',
    'product demo video creator',
  ],
  alternates: {
    canonical: '/about',
  },
  openGraph: {
    title: `MotionShapes | ${title}`,
    description,
    url: '/about',
    type: 'website',
    images: [
      {
        url: '/canvas.png',
        width: 2552,
        height: 1300,
        alt: 'MotionShapes about page preview',
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

export default function AboutPage() {
  const aboutSchema = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'About MotionShapes',
    description,
    url: 'https://motionshapes.com/about',
  }

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MotionShapes',
    url: 'https://motionshapes.com',
    sameAs: ['https://github.com/deep1283/Motionshapes'],
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <section className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-sm uppercase tracking-wide text-violet-300">About</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          MotionShapes is an open-source motion design editor for the web
        </h1>

        <p className="mt-6 text-lg text-neutral-300">
          The goal is simple: make high-quality motion graphics creation accessible
          directly in the browser with a workflow that feels fast and practical.
        </p>

        <div className="mt-10 space-y-8">
          <section className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Mission</h2>
            <p className="mt-2 text-neutral-300">
              Lower the barrier to professional motion design by combining a visual
              editor, timeline controls, and export capabilities in a modern web app.
            </p>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Open-source commitment</h2>
            <p className="mt-2 text-neutral-300">
              MotionShapes is fully open source under AGPL-3.0. Contributions, issues,
              and discussions are welcome through the public repository.
            </p>
            <p className="mt-3 text-sm text-neutral-400">
              Repository: https://github.com/deep1283/Motionshapes
            </p>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Who uses MotionShapes</h2>
            <p className="mt-2 text-neutral-300">
              Indie hackers, product teams, startup founders, content creators, and
              frontend developers who need polished motion assets quickly.
            </p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/features"
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Explore features
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-200"
          >
            Open editor
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
    </main>
  )
}

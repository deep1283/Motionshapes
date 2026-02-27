import type { Metadata } from 'next'
import Link from 'next/link'

const title = 'Use Cases'
const description =
  'Discover MotionShapes use cases for founders, marketers, creators, and developers: logo animation, product demos, launch videos, and social media motion assets.'

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'motion graphics use cases',
    'logo animation use case',
    'product demo video software',
    'startup launch video tool',
    'social media animation creator',
    'browser motion design workflow',
  ],
  alternates: {
    canonical: '/use-cases',
  },
  openGraph: {
    title: `MotionShapes | ${title}`,
    description,
    url: '/use-cases',
    type: 'website',
    images: [
      {
        url: '/canvas.png',
        width: 2552,
        height: 1300,
        alt: 'MotionShapes use cases',
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

export default function UseCasesPage() {
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'MotionShapes Use Cases',
    description,
    url: 'https://motionshapes.com/use-cases',
  }

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'MotionShapes Use Cases',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Product launch animations' },
      { '@type': 'ListItem', position: 2, name: 'Logo reveals and brand motion' },
      { '@type': 'ListItem', position: 3, name: 'Social media promo clips' },
      { '@type': 'ListItem', position: 4, name: 'Landing page hero animations' },
    ],
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <section className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-sm uppercase tracking-wide text-violet-300">Use Cases</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          Where teams use MotionShapes
        </h1>
        <p className="mt-6 max-w-3xl text-lg text-neutral-300">
          MotionShapes helps you create polished motion assets quickly, directly in the
          browser, without heavyweight desktop setup.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Startup product demos</h2>
            <p className="mt-2 text-neutral-300">
              Build short demo videos and animated walkthroughs for launches, waitlists,
              and sales pages.
            </p>
          </article>

          <article className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Logo reveals</h2>
            <p className="mt-2 text-neutral-300">
              Create clean brand intros and logo animations for websites, presentations,
              and social channels.
            </p>
          </article>

          <article className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Social content and ads</h2>
            <p className="mt-2 text-neutral-300">
              Produce quick promo clips and announcement visuals for short-form content
              and paid campaigns.
            </p>
          </article>

          <article className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Landing page hero motion</h2>
            <p className="mt-2 text-neutral-300">
              Design high-impact motion assets that communicate product value in the
              first screen.
            </p>
          </article>
        </div>

        <section className="mt-10 rounded-xl border border-violet-400/30 bg-violet-500/10 p-6">
          <h2 className="text-xl font-semibold">Teams that benefit most</h2>
          <p className="mt-2 text-neutral-200">
            Founders, indie hackers, marketers, UI designers, and frontend engineers who
            need fast, high-quality animation outputs.
          </p>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-200"
          >
            Start creating
          </Link>
          <Link
            href="/contribute"
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
    </main>
  )
}

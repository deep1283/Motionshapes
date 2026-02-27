import type { Metadata } from 'next'
import Link from 'next/link'

const title = 'Contribute'
const description =
  'Contribute to MotionShapes: explore issues, submit pull requests, and help improve the open-source browser motion design editor.'

const repositoryUrl = 'https://github.com/deep1283/Motionshapes'
const issuesUrl = `${repositoryUrl}/issues`
const pullsUrl = `${repositoryUrl}/pulls`
const discussionsUrl = `${repositoryUrl}/discussions`
const contributingUrl = `${repositoryUrl}/blob/main/CONTRIBUTING.md`
const bugReportUrl = `${repositoryUrl}/issues/new?template=bug_report.yml`
const featureRequestUrl = `${repositoryUrl}/issues/new?template=feature_request.yml`
const featureIdeaUrl = `${repositoryUrl}/issues/new?template=feature_idea.yml`
const starterTaskUrl = `${repositoryUrl}/issues/new?template=good_first_issue.yml`
const goodFirstIssuesUrl = `${repositoryUrl}/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22good%20first%20issue%22`
const helpWantedIssuesUrl = `${repositoryUrl}/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22help%20wanted%22`

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'contribute to open source animation project',
    'motionshapes github',
    'motion graphics open source contribution',
    'good first issue animation tool',
    'nextjs open source contribution',
    'pixi js open source project',
  ],
  alternates: {
    canonical: '/contribute',
  },
  openGraph: {
    title: `MotionShapes | ${title}`,
    description,
    url: '/contribute',
    type: 'website',
    images: [
      {
        url: '/canvas.png',
        width: 2552,
        height: 1300,
        alt: 'Contribute to MotionShapes',
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

export default function ContributePage() {
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Contribute to MotionShapes',
    description,
    url: 'https://motionshapes.com/contribute',
  }

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How can engineers contribute to MotionShapes?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Engineers can start with issues, discuss implementation direction, and submit pull requests that follow the repository contributing guide.',
        },
      },
      {
        '@type': 'Question',
        name: 'What stack does MotionShapes use?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The project is built with Next.js, TypeScript, Tailwind CSS, Framer Motion, and Pixi.js with browser-first workflows.',
        },
      },
      {
        '@type': 'Question',
        name: 'Where can I find contribution guidelines?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Contribution guidelines are available in the repository CONTRIBUTING.md file.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I suggest ideas like a Figma plugin?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. You can open a feature idea issue for product ideas such as a Figma plugin, template packs, or workflow upgrades.',
        },
      },
      {
        '@type': 'Question',
        name: 'Where should I discuss ideas before implementation?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Use GitHub Discussions for open-ended product conversations, then open issues for scoped work.',
        },
      },
    ],
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <section className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-sm uppercase tracking-wide text-violet-300">Contribute</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          Help build MotionShapes
        </h1>
        <p className="mt-6 text-lg text-neutral-300">
          MotionShapes is fully open source. If you are an engineer who cares about
          creative tooling, performance, and polished UX, your contributions can have
          direct impact.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Ways to contribute</h2>
            <ul className="mt-3 space-y-2 text-neutral-300">
              <li>Fix bugs and regression issues</li>
              <li>Ship editor workflow improvements</li>
              <li>Optimize canvas performance</li>
              <li>Improve export reliability and UX</li>
              <li>Add docs and developer onboarding guides</li>
            </ul>
          </article>

          <article className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Core technical areas</h2>
            <ul className="mt-3 space-y-2 text-neutral-300">
              <li>Next.js App Router + TypeScript</li>
              <li>Pixi.js rendering and animation logic</li>
              <li>Timeline data model and state management</li>
              <li>Export pipeline and media processing</li>
              <li>Developer experience and performance tooling</li>
            </ul>
          </article>
        </div>

        <section className="mt-10 rounded-xl border border-violet-400/30 bg-violet-500/10 p-6">
          <h2 className="text-xl font-semibold">Contribution flow</h2>
          <ol className="mt-3 space-y-2 text-neutral-200">
            <li>1. Read the contribution guide and run the project locally.</li>
            <li>2. Pick an issue or propose one with clear scope.</li>
            <li>3. Open a focused pull request with verification details.</li>
          </ol>
        </section>

        <section className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Have product ideas?</h2>
          <p className="mt-2 text-neutral-300">
            We want idea submissions too. Propose what MotionShapes should add next,
            including integration ideas like a Figma plugin, new presets, or export
            improvements.
          </p>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <a
            href={bugReportUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Report bug
          </a>
          <a
            href={featureRequestUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Request feature
          </a>
          <a
            href={featureIdeaUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-violet-400/40 bg-violet-500/10 px-5 py-2.5 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20"
          >
            Submit idea
          </a>
          <a
            href={starterTaskUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Propose starter task
          </a>
          <a
            href={issuesUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-200"
          >
            View issues
          </a>
          <a
            href={pullsUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            View pull requests
          </a>
          <a
            href={discussionsUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Join discussions
          </a>
          <a
            href={goodFirstIssuesUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Good first issues
          </a>
          <a
            href={helpWantedIssuesUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Help wanted
          </a>
          <a
            href={contributingUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-violet-400/40 bg-violet-500/10 px-5 py-2.5 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20"
          >
            Read CONTRIBUTING.md
          </a>
          <Link
            href="/use-cases"
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Explore use cases
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

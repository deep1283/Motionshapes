# Repository Guidelines

## Project Structure & Module Organization
- App router lives in `app/` (`layout.tsx`, `page.tsx`, dashboard views, global styles).
- Reusable UI sits in `components/` (`components/ui` for primitives such as `button.tsx`, `spotlight.tsx`; layout and motion helpers alongside).
- Shared logic and stores live in `lib/` (Supabase client in `supabase.ts`, timeline state in `timeline-store.tsx`, presets and utilities nearby).
- Static assets belong in `public/` (e.g., `public/resources/home-bg.mp4`); configuration is at the repo root (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`).

## Build, Test, and Development Commands
- `npm run dev` — start the Next.js dev server on port 3000.
- `npm run build` — production build; ensure this passes before shipping.
- `npm run start` — serve the production build locally.
- `npm run lint` — run ESLint (Next.js + TypeScript core web vitals); fix or justify any warnings.

## Coding Style & Naming Conventions
- TypeScript + React with functional components; prefer client components only when needed (`'use client'`).
- Indentation is 2 spaces, single quotes, and trailing commas per project style; rely on ESLint/Next defaults.
- Components: PascalCase filenames (`DashboardLayout.tsx`), hooks `useSomething`, utilities camelCase. Keep JSX readable with extracted helpers.
- Styling: Tailwind classes inline; group semantic chunks (layout, spacing, color, state) and avoid unused class noise.

## Testing Guidelines
- No automated tests are present yet; add targeted unit/visual tests when introducing complex logic or animations.
- Co-locate tests near source files when added, following `<name>.test.ts` or `.test.tsx`. Mirror component names and scenarios.
- Before merging, at minimum run `npm run lint`; for new tests, ensure they run in CI or locally before review.

## Commit & Pull Request Guidelines
- Recent commits use short, descriptive sentences (e.g., “fixed lint issue”); match that tone or adopt lightweight imperative phrasing.
- Keep commits focused; include context for UX changes or data flow adjustments.
- PRs should include: goal/summary, screenshots or screen recordings for UI changes, steps to reproduce/verify, and linked issue/ticket when available.
- Call out breaking changes or config/env updates explicitly in the PR body.

## Security & Configuration Tips
- Keep secrets out of the repo; use environment variables for Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Do not commit `.env` files.
- When adding new public assets, place them under `public/` so Next.js can serve them without custom routes.
- Favor server components by default for data loading; only opt into client components for hooks, event handling, or animations that need the browser.

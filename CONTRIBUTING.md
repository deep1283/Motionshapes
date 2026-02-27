# Contributing to MotionShapes

First off, thank you for considering contributing to **MotionShapes**! It's people like you that make the open-source community such an amazing place to learn, inspire, and create.

## Quick Links

- Bug report form: `https://github.com/deep1283/Motionshapes/issues/new?template=bug_report.yml`
- Feature request form: `https://github.com/deep1283/Motionshapes/issues/new?template=feature_request.yml`
- Feature idea form (for ideas like Figma plugin): `https://github.com/deep1283/Motionshapes/issues/new?template=feature_idea.yml`
- Starter task proposal form: `https://github.com/deep1283/Motionshapes/issues/new?template=good_first_issue.yml`
- Good first issues: `https://github.com/deep1283/Motionshapes/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22good%20first%20issue%22`
- Help wanted issues: `https://github.com/deep1283/Motionshapes/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22help%20wanted%22`
- Discussions (ideas + community): `https://github.com/deep1283/Motionshapes/discussions`

## How Can I Contribute?

### 1. Reporting Bugs
If you find a bug in the application, please open an issue in the GitHub repository. Include:
- A clear and descriptive title.
- Steps to reproduce the issue.
- Your OS, browser, and environment.
- Any relevant console errors or screenshots.

### 2. Suggesting Enhancements
Have an idea for a new 2D shape preset, a Figma plugin, an animation curve, or a UI workflow optimization?
- Open a feature request issue.
- Explain **why** this enhancement would be useful to most users.
- If possible, include wireframes, code examples, or references to similar tools.

For early-stage ideas, use the dedicated **feature idea** form so maintainers can triage quickly.
If the idea needs broader community discussion first, open a GitHub Discussion.

### 3. Pull Requests
We actively welcome Pull Requests (PRs).

1. **Fork the repo** and create your branch from `main`.
2. **Run `npm install`** and make sure you can spin up the dev server (`npm run dev`).
3. **Make your changes**. If you're changing the WebGL canvas, test it on both Chrome and Safari to ensure cross-browser compatibility.
4. If you've added code that should be tested, **add tests**.
5. Ensure your code lints properly (`npm run lint`).
6. Update the documentation (like `README.md` or TSDoc comments) if you're changing public APIs or installation steps.
7. Issue a PR with a clear description of what you improved.

## Labels and Triage

- `good first issue`: Starter-friendly work with tight scope.
- `help wanted`: We actively want external contributors on these.
- `idea`: Early product ideas awaiting validation.
- `needs-triage`: Pending maintainers' initial review.

If you do not see a clear task, propose one using the starter task form.

## Local Development Rules

- **Pixi.js:** Any modifications to the WebGL context must ensure the canvas cleans up its memory properly on React unmount to prevent memory leaks in the Next.js router.
- **FFmpeg WASM:** Video export encoding is computationally expensive. When adding new export features, ensure UI interactions are debounced or disabled during the WASM encoding phase.
- **Tailwind:** Please stick to the configured Tailwind themes and variables in `tailwind.config.ts`. Do not use arbitrary values unless absolutely necessary.

## Code of Conduct

By participating in this project, you agree to treat everyone with respect. Harassment, discrimination, or abusive behavior will not be tolerated.

Thank you for helping us keep MotionShapes blazing fast and open for everyone!

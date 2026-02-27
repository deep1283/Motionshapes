# Contributing to MotionShapes

First off, thank you for considering contributing to **MotionShapes**! It's people like you that make the open-source community such an amazing place to learn, inspire, and create.

## How Can I Contribute?

### 1. Reporting Bugs
If you find a bug in the application, please open an issue in the GitHub repository. Include:
- A clear and descriptive title.
- Steps to reproduce the issue.
- Your OS, browser, and environment.
- Any relevant console errors or screenshots.

### 2. Suggesting Enhancements
Have an idea for a new 2D shape preset,a figma plugin an animation curve, or a UI workflow optimization?
- Open a feature request issue.
- Explain **why** this enhancement would be useful to most users.
- If possible, include wireframes, code examples, or references to similar tools.

### 3. Pull Requests
We actively welcome Pull Requests (PRs).

1. **Fork the repo** and create your branch from `main`.
2. **Run `npm install`** and make sure you can spin up the dev server (`npm run dev`).
3. **Make your changes**. If you're changing the WebGL canvas, test it on both Chrome and Safari to ensure cross-browser compatibility.
4. If you've added code that should be tested, **add tests**.
5. Ensure your code lints properly (`npm run lint`).
6. Update the documentation (like `README.md` or TSDoc comments) if you're changing public APIs or installation steps.
7. Issue a PR with a clear description of what you improved.

## Local Development Rules

- **Pixi.js:** Any modifications to the WebGL context must ensure the canvas cleans up its memory properly on React unmount to prevent memory leaks in the Next.js router.
- **FFmpeg WASM:** Video export encoding is computationally expensive. When adding new export features, ensure UI interactions are debounced or disabled during the WASM encoding phase.
- **Tailwind:** Please stick to the configured Tailwind themes and variables in `tailwind.config.ts`. Do not use arbitrary values unless absolutely necessary.

## Code of Conduct

By participating in this project, you agree to treat everyone with respect. Harassment, discrimination, or abusive behavior will not be tolerated.

Thank you for helping us keep MotionShapes blazing fast and open for everyone!

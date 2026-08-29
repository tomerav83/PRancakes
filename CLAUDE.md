# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PRancakes: an open-source tool for creating, managing, and synchronizing stacked pull requests on GitHub. Apache-2.0.

## Status

The only shipped code is the marketing site in `web/`: Next.js 16 (App Router) + TypeScript + plain CSS, statically exported (`output: 'export'`). The site lands in `web/out/`.

```
cd web && npm run build   # export to web/out
cd web && npm run lint    # ESLint; the repo root has no lint config
cd web && npm start       # serve the built export (NOT `next start` — it refuses an export build)
```

The build needs network access: `next/font/google` fetches and self-hosts the font files at build time.

- **The CLI stack is still undecided.** `web/` is the homepage and nothing more — it is not a decision about the PRancakes tool itself. Ask before scaffolding the CLI in any language.
- **Ask before adding dependencies to `web/` too.** It runs on `next`/`react`/`react-dom` and nothing else on purpose; no CSS framework, no icon or animation packages.
- `.idea/` is an IntelliJ default Java/JDK-22 module stub, **not** a stack decision. Do not treat it as evidence the project is Java.
- `.idea/`, `.claude/`, `_bmad/`, and `_bmad-output/` are gitignored — local tooling, not project files.

## Brand

Tokens live in `:root` in `web/app/globals.css`; the mascot is `web/public/mascot.svg`, original artwork.

The visual language is hand-inked cartoon: flat fills, heavy round-capped ink outlines, hard offset shadows (`--drop`). No gradients and no blurred shadows anywhere — keep that rule for any new brand asset.

## GitHub access

Shell out to the `gh` CLI (installed, v2.45) rather than adding a REST/GraphQL client library. This reuses the user's existing `gh` auth — no token handling in this codebase.

## Git etiquette

Branch names: `type/short-description` (e.g. `feat/stack-rebase`, `fix/orphaned-pr`, `chore/`, `docs/`, `refactor/`).

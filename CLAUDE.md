# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PRancakes: an open-source tool for creating, managing, and synchronizing stacked pull requests on GitHub. Apache-2.0.

## Status

Two things ship today. The marketing site in `web/`: Next.js 16 (App Router) + TypeScript + plain CSS, statically exported (`output: 'export'`), landing in `web/out/`. And the CLI in `cli/`: a dependency-free Go module whose one command prints the repository's open pull requests grouped into stacks.

```
make                      # build the page if stale, then serve it (make REPO=~/x PORT=9000)
make test                 # go test + vitest
make lint                 # go vet + gofmt + eslint

cd web && npm run build   # export to web/out
cd web && npm run lint    # ESLint; the repo root has no lint config
cd web && npm test        # vitest + jsdom over app/**/*.test.tsx
cd web && npm start       # serve the built export (NOT `next start` — it refuses an export build)

cd cli && go run .        # print this repo's open pull requests, grouped into stacks
cd cli && go run . --json # the same data as JSON
cd cli && go run . serve  # local server: gh on demand + the built page, 127.0.0.1:8080
cd cli && go test ./...   # unit tests; no network, no gh needed
cd cli && go vet ./...
```

The build needs network access: `next/font/google` fetches and self-hosts the font files at build time.

- **The CLI is Go**, in `cli/` — module `github.com/tomerav83/PRancakes/cli`, Go 1.22+. It has zero dependencies and reads GitHub only by shelling out to `gh`. **Ask before adding any Go module**; the stdlib has covered it so far.
- The CLI is **read-only** today: it describes a stack, it never rebases, pushes, or edits a pull request. Ask before adding a command that writes.
- `serve` binds **loopback only** and has no auth of its own — it answers with a private repository's state. Ask before changing the bind address. It serves `web/out`, so the page needs `npm run build` first; the export puts the route at `out/stack.html`, not `out/stack/index.html`.
- **Ask before adding dependencies to `web/` too.** It ships on `next`/`react`/`react-dom` and nothing else on purpose; no CSS framework, no icon or animation packages. The only dev dependencies are ESLint/TypeScript and the test runner (`vitest`, `jsdom`, `@testing-library/react`, `@vitejs/plugin-react`), added deliberately to cover the `/stack` page's states.
- `.idea/` is an IntelliJ default Java/JDK-22 module stub, **not** a stack decision. Do not treat it as evidence the project is Java.
- `.idea/`, `.claude/`, `_bmad/`, and `_bmad-output/` are gitignored — local tooling, not project files.

## Brand

Tokens live in `:root` in `web/app/globals.css`; the mascot is `web/public/mascot.svg`, original artwork.

The visual language is hand-inked cartoon: flat fills, heavy round-capped ink outlines, hard offset shadows (`--drop`). No gradients and no blurred shadows anywhere — keep that rule for any new brand asset.

## GitHub access

Shell out to the `gh` CLI (installed, v2.45) rather than adding a REST/GraphQL client library. This reuses the user's existing `gh` auth — no token handling in this codebase.

## Git etiquette

Branch names: `type/short-description` (e.g. `feat/stack-rebase`, `fix/orphaned-pr`, `chore/`, `docs/`, `refactor/`).

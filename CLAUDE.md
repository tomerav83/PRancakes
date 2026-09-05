# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PRancakes: an open-source tool for creating, managing, and synchronizing stacked pull requests on GitHub. Apache-2.0.

## Status

`web/` is a React + TypeScript + Vite frontend (decided; do not re-scaffold or add a second stack without asking). There is no backend yet — the data it renders is hardcoded, since a browser page cannot shell out to `gh` (see GitHub access below) and no fetch path has been designed.

- Layout: `web/src/components/` holds one directory per component (`PrStateBadge`, `PrMetadataPanel`, `StackTree`). `StackTree` renders the stack graph via `@xyflow/react` + `@dagrejs/dagre`.
- Commands (run from `web/`): `npm run dev`, `npm run build` (`tsc -b && vite build`), `npm run lint` (oxlint), `npm run preview`.
- Tests: `node --test` against the pure logic in `stack.ts` / `metadata.ts`. No framework is installed; Node's built-in runner is sufficient for now.
- `.idea/` is an IntelliJ default Java/JDK-22 module stub, **not** a stack decision. Do not treat it as evidence the project is Java.
- `.idea/`, `.claude/`, `_bmad/`, and `_bmad-output/` are gitignored — local tooling, not project files.

## GitHub access

Shell out to the `gh` CLI (installed, v2.45) rather than adding a REST/GraphQL client library. This reuses the user's existing `gh` auth — no token handling in this codebase.

## Git etiquette

Branch names: `type/short-description` (e.g. `feat/stack-rebase`, `fix/orphaned-pr`, `chore/`, `docs/`, `refactor/`).

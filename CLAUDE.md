# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PRancakes: an open-source tool for creating, managing, and synchronizing stacked pull requests on GitHub. Apache-2.0.

## Status: greenfield

The repo contains only `README.md` and `LICENSE`. There is no source code, build file, test framework, or lint config yet.

- **The stack is undecided.** Do not scaffold in a language without asking first.
- `.idea/` is an IntelliJ default Java/JDK-22 module stub, **not** a stack decision. Do not treat it as evidence the project is Java.
- `.idea/`, `.claude/`, `_bmad/`, and `_bmad-output/` are gitignored — local tooling, not project files.

## GitHub access

Shell out to the `gh` CLI (installed, v2.45) rather than adding a REST/GraphQL client library. This reuses the user's existing `gh` auth — no token handling in this codebase.

## Git etiquette

Branch names: `type/short-description` (e.g. `feat/stack-rebase`, `fix/orphaned-pr`, `chore/`, `docs/`, `refactor/`).

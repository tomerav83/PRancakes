# PRancakes web

A React + TypeScript + Vite frontend for PRancakes. Currently a static demo:
the PR state badges and stack graph render from hardcoded data in `src/App.tsx`,
not a live fetch — a browser page can't shell out to `gh` the way the rest of
this project does, and no server-side fetch path has been designed yet.

## Commands

```
npm run dev      # start the dev server
npm run build    # typecheck (tsc -b) then production build
npm run lint     # oxlint
npm run preview  # preview a production build
npm test         # node --test against src/**/*.test.ts
```

## Layout

- `src/components/PrStateBadge` — the PR lifecycle/review/check state badge
- `src/components/PrMetadataPanel` — the panel a badge opens to show PR detail
- `src/components/StackTree` — the stack graph, via `@xyflow/react` + `@dagrejs/dagre`

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import type { PrMetadata } from './src/components/PrMetadataPanel/metadata.ts'

const execFileAsync = promisify(execFile)

// Exactly the fields stack.ts/metadata.ts consume.
const PR_FIELDS =
  'number,headRefName,baseRefName,state,isDraft,mergeStateStatus,changedFiles,additions,deletions,author,updatedAt,mergedBy,mergeCommit,isCrossRepository'

type PrRow = PrMetadata & { number: number; isCrossRepository: boolean }

// GitHub's own `mergeStateStatus` only reports BEHIND when the base branch has
// a protection rule requiring up-to-date branches — a stacked PR based on a
// plain feature branch never gets that signal even when genuinely behind. This
// answers it directly from local git instead: exact, and free of any extra
// network round trip since it reads already-fetched `origin/*` refs.
export async function attachBehindBy(prs: PrRow[]): Promise<(PrRow & { behindBy?: number })[]> {
  return Promise.all(
    prs.map(async (pr) => {
      // A fork PR's headRefName lives in the fork, not under this repo's
      // `origin` remote — resolving it there could coincidentally hit an
      // unrelated same-named branch in the base repo, giving a wrong (not
      // just missing) count. Skip rather than risk that.
      if (pr.isCrossRepository) return pr
      try {
        const { stdout } = await execFileAsync(
          'git',
          ['rev-list', '--count', `origin/${pr.headRefName}..origin/${pr.baseRefName}`],
          { cwd: process.cwd(), timeout: 5000 },
        )
        const behindBy = Number(stdout.trim())
        // ref doesn't exist locally (deleted branch) can still surface as
        // unparseable output rather than a thrown error — treat the same way.
        return Number.isFinite(behindBy) ? { ...pr, behindBy } : pr
      } catch {
        // ref doesn't exist locally (deleted branch) — leave undefined,
        // caller falls back to GitHub's mergeStateStatus.
        return pr
      }
    }),
  )
}

// One `gh pr list` call per request, run against the repo the dev server started
// in — no PAT, no new dependency, no per-PR follow-up calls.
function ghPrsPlugin(): Plugin {
  return {
    name: 'gh-prs-api',
    configureServer(server) {
      server.middlewares.use('/api/prs', (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end()
          return
        }
        execFileAsync('gh', ['pr', 'list', '--state', 'all', '--json', PR_FIELDS], { cwd: process.cwd(), timeout: 15000 })
          .then(async ({ stdout }) => {
            const prs = await attachBehindBy(JSON.parse(stdout) as PrRow[])
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(prs))
          })
          .catch((err: unknown) => {
            const message =
              (err as { stderr?: string })?.stderr?.trim() || (err instanceof Error ? err.message : 'gh pr list failed')
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: message }))
          })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), ghPrsPlugin()],
})

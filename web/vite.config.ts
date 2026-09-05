import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const execFileAsync = promisify(execFile)

// Exactly the fields stack.ts/metadata.ts consume.
const PR_FIELDS =
  'number,headRefName,baseRefName,state,isDraft,mergeStateStatus,changedFiles,additions,deletions,author,updatedAt,mergedBy,mergeCommit'

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
          .then(({ stdout }) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(stdout)
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

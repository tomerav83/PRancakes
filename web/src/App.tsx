import { useEffect, useMemo, useState } from 'react'
import type { PrMetadata } from './components/PrMetadataPanel/metadata'
import { StackTree } from './components/StackTree/StackTree'
import { withSyntheticRoots } from './components/StackTree/stack'

// Shape of one row of `gh pr list --json <PR_FIELDS>` (see vite.config.ts) —
// PrMetadata already mirrors that field-for-field, plus the PR number.
type RawPr = PrMetadata & { number: number }

function App() {
  const [prs, setPrs] = useState<RawPr[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/prs')
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body?.error ?? `request failed: ${res.status}`)
        setPrs(body as RawPr[])
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  const stackPrs = useMemo(() => (prs ? withSyntheticRoots(prs) : []), [prs])

  return (
    <div className="h-screen w-screen">
      {error ? (
        <p className="text-sm p-6" style={{ color: 'var(--changes)' }}>
          Couldn&rsquo;t load PRs: {error}
        </p>
      ) : prs === null ? (
        <p className="text-sm p-6" style={{ color: 'var(--ink-muted)' }}>
          Loading&hellip;
        </p>
      ) : prs.length === 0 ? (
        <p className="text-sm p-6" style={{ color: 'var(--ink-muted)' }}>
          No pull requests.
        </p>
      ) : (
        <StackTree prs={stackPrs} height="100vh" />
      )}
    </div>
  )
}

export default App

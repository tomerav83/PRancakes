import { useEffect, useMemo, useState } from 'react'
import { PrStateBadge, type PrState } from './components/PrStateBadge'
import type { PrMetadata } from './components/PrMetadataPanel/metadata'
import { StackTree } from './components/StackTree/StackTree'
import { toStackPrState, withSyntheticRoots } from './components/StackTree/stack'

const LIFECYCLE: PrState[] = ['draft', 'open', 'merged', 'closed']
const REVIEW: PrState[] = ['review_required', 'changes_requested', 'approved', 'checks_running']

// Shape of one row of `gh pr list --json <PR_FIELDS>` (see vite.config.ts) —
// PrMetadata already mirrors that field-for-field, plus the PR number.
type RawPr = PrMetadata & { number: number }

// Best-effort sample metadata per lifecycle state, for the badge grid below —
// there's no guarantee the current repo has an open PR in every state.
function metadataFor(prs: RawPr[], state: PrState): PrMetadata | undefined {
  return prs.find((pr) => toStackPrState(pr) === state)
}

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
    <div className="max-w-3xl mx-auto px-6 py-14">
      <div className="mb-10">
        <span className="block font-mono text-xs font-semibold tracking-wider uppercase mb-2" style={{ color: 'var(--running)' }}>
          PRancakes
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight mb-2">PR state badges</h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
          Pull request state (GraphQL <code>PullRequestState</code> + <code>isDraft</code>) and review/check status
          (<code>reviewDecision</code>, check <code>status</code>).
        </p>
      </div>

      <div className="mb-10">
        <h2 className="text-xs font-bold tracking-wide mb-4 pb-2.5 border-b" style={{ borderColor: 'var(--panel-border)' }}>
          Stack &mdash; this repository
        </h2>
        {error ? (
          <p className="text-sm" style={{ color: 'var(--changes)' }}>
            Couldn&rsquo;t load PRs: {error}
          </p>
        ) : prs === null ? (
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            Loading&hellip;
          </p>
        ) : prs.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            No open pull requests.
          </p>
        ) : (
          <StackTree prs={stackPrs} height={300} />
        )}
      </div>

      <div className="mb-8">
        <h2 className="text-xs font-bold tracking-wide mb-4 pb-2.5 border-b" style={{ borderColor: 'var(--panel-border)' }}>
          Pull request state
        </h2>
        <div className="flex flex-wrap gap-3.5">
          {LIFECYCLE.map((state) => (
            <PrStateBadge key={state} state={state} metadata={prs ? metadataFor(prs, state) : undefined} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xs font-bold tracking-wide mb-4 pb-2.5 border-b" style={{ borderColor: 'var(--panel-border)' }}>
          Review &amp; checks
        </h2>
        <div className="flex flex-wrap gap-3.5">
          {REVIEW.map((state) => (
            <PrStateBadge key={state} state={state} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default App

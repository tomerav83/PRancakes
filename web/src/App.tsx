import { PrStateBadge, type PrState } from './components/PrStateBadge'
import type { PrMetadata } from './components/PrMetadataPanel/metadata'
import { StackTree } from './components/StackTree/StackTree'
import type { StackPr } from './components/StackTree/stack'

const LIFECYCLE: PrState[] = ['draft', 'open', 'merged', 'closed']
const REVIEW: PrState[] = ['review_required', 'changes_requested', 'approved', 'checks_running']

// Captured from `gh pr view 1 --json headRefName,baseRefName,state,isDraft,
// changedFiles,additions,deletions,author,updatedAt,mergedBy,mergeCommit`
// against this repo, reshaped to PrMetadata by hand — there's no fetch yet.
// Other states have no metadata prop: this repo has no open/draft/review PR
// to source them from, so those badges stay static until that's wired up.
const METADATA: Partial<Record<PrState, PrMetadata>> = {
  merged: {
    headRefName: 'chore/project-setup',
    baseRefName: 'master',
    state: 'MERGED',
    isDraft: false,
    changedFiles: 2,
    additions: 34,
    deletions: 0,
    author: { login: 'tomerav83' },
    updatedAt: '2026-09-03T06:30:04Z',
    mergedBy: { login: 'tomerav83' },
    mergeCommit: { oid: '60c254ae3c24d8f7a9bb577f4f1e08d3039f3081' },
  },
}

// Hand-authored, shaped like `gh pr list --json number,headRefName,
// baseRefName,state` — not a live snapshot, so it won't track this repo's
// actual PRs as they change. The { number: null } row is a synthetic root
// this code adds so the graph has a floor; `gh` itself never returns one.
const THIS_REPO: StackPr[] = [
  { number: null, headRefName: 'master', baseRefName: null, state: 'merged' },
  { number: 1, headRefName: 'chore/project-setup', baseRefName: 'master', state: 'merged' },
]

// Invented, not from this repo — a real stack is the only way to see the fan-out
// and the level spacing, and this repo has never had a branching one.
const EXAMPLE: StackPr[] = [
  { number: null, headRefName: 'master', baseRefName: null, state: 'merged' },
  { number: 12, headRefName: 'feat/graph-nodes', baseRefName: 'master', state: 'merged' },
  { number: 13, headRefName: 'feat/edge-render', baseRefName: 'feat/graph-nodes', state: 'open' },
  { number: 17, headRefName: 'feat/keyboard-nav', baseRefName: 'feat/graph-nodes', state: 'open' },
  { number: 14, headRefName: 'feat/stack-toolbar', baseRefName: 'feat/edge-render', state: 'draft' },
  { number: 15, headRefName: 'feat/edge-tests', baseRefName: 'feat/edge-render', state: 'open' },
  { number: 16, headRefName: 'feat/toolbar-icons', baseRefName: 'feat/stack-toolbar', state: 'draft' },
]

function App() {
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
        <StackTree prs={THIS_REPO} height={300} />
      </div>

      <div className="mb-10">
        <h2 className="text-xs font-bold tracking-wide mb-4 pb-2.5 border-b" style={{ borderColor: 'var(--panel-border)' }}>
          Stack &mdash; example shape (not this repository)
        </h2>
        <StackTree prs={EXAMPLE} height={480} />
      </div>

      <div className="mb-8">
        <h2 className="text-xs font-bold tracking-wide mb-4 pb-2.5 border-b" style={{ borderColor: 'var(--panel-border)' }}>
          Pull request state
        </h2>
        <div className="flex flex-wrap gap-3.5">
          {LIFECYCLE.map((state) => (
            <PrStateBadge key={state} state={state} metadata={METADATA[state]} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xs font-bold tracking-wide mb-4 pb-2.5 border-b" style={{ borderColor: 'var(--panel-border)' }}>
          Review &amp; checks
        </h2>
        <div className="flex flex-wrap gap-3.5">
          {REVIEW.map((state) => (
            <PrStateBadge key={state} state={state} metadata={METADATA[state]} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default App

// Field names mirror `gh pr view --json ...` output, verified against this
// repo's own PR #1. `author`/`mergedBy` are objects ({login, ...}), not
// strings, and the merge commit comes back as `mergeCommit: { oid }`.
export interface PrMetadata {
  headRefName: string
  baseRefName: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  isDraft: boolean
  mergeStateStatus?: 'BEHIND' | 'BLOCKED' | 'CLEAN' | 'DIRTY' | 'UNSTABLE' | 'UNKNOWN'
  // Commits the base ref has that the head ref doesn't, computed locally from
  // git (see vite.config.ts) — undefined when the refs aren't resolvable
  // locally (fork PR, deleted branch).
  behindBy?: number
  changedFiles: number
  additions: number
  deletions: number
  author: { login: string }
  updatedAt: string
  mergedBy?: { login: string }
  mergeCommit?: { oid: string }
}

export type StatusKind = 'success' | 'warning' | 'blocked' | 'neutral'

// One-word status per mergeStateStatus, the real GitHub GraphQL enum.
// A Record over the union means TS errors if GitHub adds a value we don't handle.
const MERGE_STATUS_LABEL: Record<NonNullable<PrMetadata['mergeStateStatus']>, { kind: StatusKind; label: string }> = {
  CLEAN: { kind: 'success', label: 'Synced' },
  BEHIND: { kind: 'warning', label: 'Out of sync' },
  BLOCKED: { kind: 'blocked', label: 'Blocked' },
  DIRTY: { kind: 'blocked', label: 'Blocked' },
  UNSTABLE: { kind: 'warning', label: 'Checks pending' },
  UNKNOWN: { kind: 'neutral', label: 'Open' },
}

// isDraft / state aren't part of the mergeStateStatus enum, so they stay as
// guard clauses ahead of the table rather than being folded into it.
export function deriveStatus(m: PrMetadata): { kind: StatusKind; label: string } {
  if (m.isDraft) return { kind: 'neutral', label: 'Draft' }
  if (m.state === 'MERGED') return { kind: 'neutral', label: 'Merged' }
  if (m.state === 'CLOSED') return { kind: 'neutral', label: 'Closed' }
  // Falls back to UNKNOWN's entry for a mergeStateStatus GitHub adds later
  // that isn't in the table yet, rather than an undefined lookup.
  const fromGitHub = MERGE_STATUS_LABEL[m.mergeStateStatus ?? 'UNKNOWN'] ?? MERGE_STATUS_LABEL.UNKNOWN
  // Locally-computed ancestry overrides a plain BEHIND/CLEAN/UNKNOWN read, since
  // GitHub only reports BEHIND when the base branch has a protection rule for
  // it — but a real merge conflict (BLOCKED/DIRTY) is worse news and must win.
  if (fromGitHub.kind !== 'blocked' && m.behindBy !== undefined && m.behindBy > 0) {
    return { kind: 'warning', label: 'Out of sync' }
  }
  return fromGitHub
}

const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000], ['month', 2592000], ['week', 604800],
  ['day', 86400], ['hour', 3600], ['minute', 60],
]

export function formatRelative(iso: string): string {
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return '—'
  const seconds = (Date.now() - ms) / 1000
  const abs = Math.abs(seconds)
  for (const [unit, secondsInUnit] of UNITS) {
    if (abs >= secondsInUnit) return RELATIVE.format(-Math.round(seconds / secondsInUnit), unit)
  }
  return RELATIVE.format(-Math.round(seconds), 'second')
}

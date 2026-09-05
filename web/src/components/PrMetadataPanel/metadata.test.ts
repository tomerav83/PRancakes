import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deriveStatus, formatRelative, type PrMetadata } from './metadata.ts'

const BASE: PrMetadata = {
  headRefName: 'feat/a',
  baseRefName: 'master',
  state: 'OPEN',
  isDraft: false,
  changedFiles: 1,
  additions: 1,
  deletions: 0,
  author: { login: 'someone' },
  updatedAt: new Date().toISOString(),
}

test('deriveStatus checks draft before merged', () => {
  assert.equal(deriveStatus({ ...BASE, isDraft: true, state: 'MERGED' }).label, 'Draft')
})

test('deriveStatus checks merged before closed', () => {
  assert.equal(deriveStatus({ ...BASE, state: 'MERGED' }).label, 'Merged')
  assert.equal(deriveStatus({ ...BASE, state: 'CLOSED' }).label, 'Closed')
})

test('deriveStatus reads every mergeStateStatus table entry', () => {
  assert.equal(deriveStatus({ ...BASE, mergeStateStatus: 'CLEAN' }).label, 'Synced')
  assert.equal(deriveStatus({ ...BASE, mergeStateStatus: 'BEHIND' }).label, 'Out of sync')
  assert.equal(deriveStatus({ ...BASE, mergeStateStatus: 'UNSTABLE' }).label, 'Checks pending')
})

test('deriveStatus falls back to UNKNOWN for an unrecognized mergeStateStatus', () => {
  const bogus = 'SOMETHING_NEW' as PrMetadata['mergeStateStatus']
  assert.equal(deriveStatus({ ...BASE, mergeStateStatus: bogus }).label, 'Open')
})

test('deriveStatus prioritizes a real behindBy over a CLEAN mergeStateStatus', () => {
  assert.equal(deriveStatus({ ...BASE, mergeStateStatus: 'CLEAN', behindBy: 2 }).label, 'Out of sync')
})

test('deriveStatus falls through to mergeStateStatus when behindBy is zero or unset', () => {
  assert.equal(deriveStatus({ ...BASE, mergeStateStatus: 'CLEAN', behindBy: 0 }).label, 'Synced')
  assert.equal(deriveStatus({ ...BASE, mergeStateStatus: 'CLEAN' }).label, 'Synced')
})

test('formatRelative renders a past timestamp', () => {
  const seventyFiveSecondsAgo = new Date(Date.now() - 75_000).toISOString()
  assert.equal(formatRelative(seventyFiveSecondsAgo), '1 minute ago')
})

test('formatRelative renders a future timestamp without raw seconds', () => {
  const inTwoHours = new Date(Date.now() + 7_200_000).toISOString()
  assert.equal(formatRelative(inTwoHours), 'in 2 hours')
})

test('formatRelative returns a placeholder instead of throwing on bad input', () => {
  assert.equal(formatRelative(''), '—')
  assert.equal(formatRelative('not-a-date'), '—')
  assert.equal(formatRelative(undefined as unknown as string), '—')
})

// Shaped exactly like one row of `gh pr list --json <PR_FIELDS>` (see
// vite.config.ts) — the real data source this endpoint returns.
test('deriveStatus reads a gh pr list --json sample payload', () => {
  const ghPr: PrMetadata = {
    headRefName: 'feat/edge-render',
    baseRefName: 'feat/graph-nodes',
    state: 'OPEN',
    isDraft: false,
    mergeStateStatus: 'CLEAN',
    changedFiles: 3,
    additions: 40,
    deletions: 2,
    author: { login: 'tomerav83' },
    updatedAt: new Date().toISOString(),
  }
  assert.equal(deriveStatus(ghPr).label, 'Synced')
})

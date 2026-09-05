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

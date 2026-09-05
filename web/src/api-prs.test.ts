import assert from 'node:assert/strict'
import { test } from 'node:test'
import { attachBehindBy } from '../vite.config.ts'

// Runs against this checkout's real `origin/*` refs — `master` compared with
// itself is always 0, and a nonexistent ref always fails to resolve, so both
// assertions hold regardless of the repo's actual branch history.
const BASE_PR = {
  number: 1,
  headRefName: 'master',
  baseRefName: 'master',
  state: 'OPEN' as const,
  isDraft: false,
  changedFiles: 0,
  additions: 0,
  deletions: 0,
  author: { login: 'someone' },
  updatedAt: new Date().toISOString(),
  isCrossRepository: false,
}

test('attachBehindBy reports 0 when head and base are the same ref', async () => {
  const [result] = await attachBehindBy([BASE_PR])
  assert.equal(result.behindBy, 0)
})

test('attachBehindBy leaves behindBy undefined when the ref cannot be resolved locally', async () => {
  const [result] = await attachBehindBy([{ ...BASE_PR, baseRefName: 'definitely-does-not-exist-xyz' }])
  assert.equal(result.behindBy, undefined)
})

test('attachBehindBy skips fork PRs entirely, even if a same-named branch exists locally', async () => {
  const [result] = await attachBehindBy([{ ...BASE_PR, isCrossRepository: true }])
  assert.equal(result.behindBy, undefined)
})

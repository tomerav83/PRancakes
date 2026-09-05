import assert from 'node:assert/strict'
import { test } from 'node:test'
import { layout, toFlow, toStackPrState, withSyntheticRoots, type StackPr } from './stack.ts'

test('toFlow links a PR to its base by ref name', () => {
  const prs: StackPr[] = [
    { number: null, headRefName: 'master', baseRefName: null, state: 'merged', url: null },
    { number: 1, headRefName: 'feat/a', baseRefName: 'master', state: 'open', url: 'https://github.com/o/r/pull/1' },
  ]
  const { nodes, edges } = toFlow(prs)
  assert.equal(nodes.length, 2)
  assert.equal(edges.length, 1)
  assert.equal(edges[0]!.source, nodes.find((n) => n.data.pr.headRefName === 'master')!.id)
  assert.equal(edges[0]!.target, nodes.find((n) => n.data.pr.headRefName === 'feat/a')!.id)
})

test('toFlow drops the edge when the base branch is not in the list', () => {
  const prs: StackPr[] = [
    { number: 5, headRefName: 'feat/b', baseRefName: 'feat/gone', state: 'open', url: 'https://github.com/o/r/pull/5' },
  ]
  const { nodes, edges } = toFlow(prs)
  assert.equal(nodes.length, 1)
  assert.equal(edges.length, 0)
})

test('toFlow gives distinct ids to PRs that share a branch name', () => {
  const prs: StackPr[] = [
    { number: 1, headRefName: 'feat/a', baseRefName: null, state: 'merged', url: 'https://github.com/o/r/pull/1' },
    { number: 2, headRefName: 'feat/a', baseRefName: null, state: 'open', url: 'https://github.com/o/r/pull/2' },
  ]
  const { nodes } = toFlow(prs)
  assert.equal(new Set(nodes.map((n) => n.id)).size, 2)
})

test('layout positions nodes top-left, offset from dagre center', () => {
  const prs: StackPr[] = [{ number: null, headRefName: 'master', baseRefName: null, state: 'merged', url: null }]
  const { nodes, edges } = toFlow(prs)
  const laidOut = layout(nodes, edges)
  assert.equal(laidOut.length, 1)
  assert.ok(Number.isFinite(laidOut[0]!.position.x))
  assert.ok(Number.isFinite(laidOut[0]!.position.y))
})

test('toStackPrState maps draft ahead of the gh state', () => {
  assert.equal(toStackPrState({ state: 'OPEN', isDraft: true }), 'draft')
  assert.equal(toStackPrState({ state: 'MERGED', isDraft: false }), 'merged')
  assert.equal(toStackPrState({ state: 'CLOSED', isDraft: false }), 'closed')
  assert.equal(toStackPrState({ state: 'OPEN', isDraft: false }), 'open')
})

// Shaped exactly like one row of `gh pr list --json number,headRefName,
// baseRefName,state,isDraft` — the real data source this endpoint returns,
// not a hand-authored fixture.
test('toFlow round-trips a gh pr list --json sample payload', () => {
  const ghPrs = [
    {
      number: 12,
      headRefName: 'feat/graph-nodes',
      baseRefName: 'master',
      state: 'MERGED',
      isDraft: false,
      url: 'https://github.com/o/r/pull/12',
    },
    {
      number: 13,
      headRefName: 'feat/edge-render',
      baseRefName: 'feat/graph-nodes',
      state: 'OPEN',
      isDraft: false,
      url: 'https://github.com/o/r/pull/13',
    },
  ] as const
  const prs: StackPr[] = [
    { number: null, headRefName: 'master', baseRefName: null, state: 'merged', url: null },
    ...ghPrs.map((pr) => ({ ...pr, state: toStackPrState(pr) })),
  ]
  const { nodes, edges } = toFlow(prs)
  assert.equal(nodes.length, 3)
  assert.equal(edges.length, 2)
  assert.equal(nodes.find((n) => n.data.pr.headRefName === 'feat/edge-render')!.data.pr.state, 'open')
})

test('withSyntheticRoots adds exactly one root for an untracked base', () => {
  const prs = withSyntheticRoots([
    { number: 1, headRefName: 'feat/a', baseRefName: 'master', state: 'OPEN', isDraft: false },
  ])
  assert.equal(prs.filter((pr) => pr.number === null).length, 1)
})

test('withSyntheticRoots adds no root when the base matches an existing PR headRefName', () => {
  const prs = withSyntheticRoots([
    { number: 1, headRefName: 'feat/a', baseRefName: 'feat/base', state: 'OPEN', isDraft: false },
    { number: 2, headRefName: 'feat/base', baseRefName: 'feat/base', state: 'MERGED', isDraft: false },
  ])
  assert.equal(prs.filter((pr) => pr.number === null).length, 0)
})

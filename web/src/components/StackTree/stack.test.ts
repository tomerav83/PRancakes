import assert from 'node:assert/strict'
import { test } from 'node:test'
import { layout, toFlow, toStackPrState, type StackPr } from './stack.ts'

test('toFlow links a PR to its base by ref name', () => {
  const prs: StackPr[] = [
    { number: null, headRefName: 'master', baseRefName: null, state: 'merged' },
    { number: 1, headRefName: 'feat/a', baseRefName: 'master', state: 'open' },
  ]
  const { nodes, edges } = toFlow(prs)
  assert.equal(nodes.length, 2)
  assert.equal(edges.length, 1)
  assert.equal(edges[0]!.source, nodes.find((n) => n.data.pr.headRefName === 'master')!.id)
  assert.equal(edges[0]!.target, nodes.find((n) => n.data.pr.headRefName === 'feat/a')!.id)
})

test('toFlow drops the edge when the base branch is not in the list', () => {
  const prs: StackPr[] = [{ number: 5, headRefName: 'feat/b', baseRefName: 'feat/gone', state: 'open' }]
  const { nodes, edges } = toFlow(prs)
  assert.equal(nodes.length, 1)
  assert.equal(edges.length, 0)
})

test('toFlow gives distinct ids to PRs that share a branch name', () => {
  const prs: StackPr[] = [
    { number: 1, headRefName: 'feat/a', baseRefName: null, state: 'merged' },
    { number: 2, headRefName: 'feat/a', baseRefName: null, state: 'open' },
  ]
  const { nodes } = toFlow(prs)
  assert.equal(new Set(nodes.map((n) => n.id)).size, 2)
})

test('layout positions nodes top-left, offset from dagre center', () => {
  const prs: StackPr[] = [{ number: null, headRefName: 'master', baseRefName: null, state: 'merged' }]
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

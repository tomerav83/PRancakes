import dagre from '@dagrejs/dagre'
import { Position, type Edge, type Node } from '@xyflow/react'
import type { PrMetadata } from '../PrMetadataPanel/metadata.ts'

// The graph only ever shows lifecycle state: `gh pr list --json state,isDraft`
// returns state as 'OPEN'|'CLOSED'|'MERGED' plus isDraft — review/check state
// (approved, checks_running, ...) needs a per-PR call this endpoint doesn't
// make. toStackPrState below is the mapping from that real shape to this one.
export type StackPrState = 'draft' | 'open' | 'merged' | 'closed'

export interface StackPr {
  number: number | null // null for the base branch itself, which has no PR
  headRefName: string
  baseRefName: string | null // null on the base branch
  state: StackPrState
  metadata?: PrMetadata // absent for the base branch itself, which has no PR
}

export function toStackPrState(pr: { state: 'OPEN' | 'CLOSED' | 'MERGED'; isDraft: boolean }): StackPrState {
  if (pr.isDraft) return 'draft'
  if (pr.state === 'MERGED') return 'merged'
  if (pr.state === 'CLOSED') return 'closed'
  return 'open'
}

// A PR's baseRefName is the headRefName of the PR below it. When that parent
// branch isn't itself an open PR (already merged, branch gone), the graph
// needs a floor to land on — this synthesizes one per such ref, same as the
// old hand-authored { number: null } root.
type RawPr = PrMetadata & { number: number }

export function withSyntheticRoots(prs: RawPr[]): StackPr[] {
  // Merged PRs are done and no longer need attention — drop them from the
  // rendered list. A child whose parent was just dropped floors on a
  // synthetic root, same as any other missing parent.
  const openPrs = prs.filter((pr) => toStackPrState(pr) !== 'merged')
  const stackPrs: StackPr[] = openPrs.map((pr) => ({
    number: pr.number,
    headRefName: pr.headRefName,
    baseRefName: pr.baseRefName,
    state: toStackPrState(pr),
    metadata: pr,
  }))
  const heads = new Set(stackPrs.map((pr) => pr.headRefName))
  const roots = new Set(openPrs.map((pr) => pr.baseRefName).filter((ref) => !heads.has(ref)))
  for (const ref of roots) {
    stackPrs.push({ number: null, headRefName: ref, baseRefName: null, state: 'merged' })
  }
  return stackPrs
}

export type PrNodeData = { pr: StackPr }
export type PrFlowNode = Node<PrNodeData, 'pr'>

// dagre is told these dimensions and PrNode renders at them, so the two can't drift.
export const NODE_W = 260
export const NODE_H = 62
export const ROW_GAP = 62 // dagre `ranksep` — also the pulse stagger's row pitch
const GUTTER = 34 // dagre `nodesep`

// Node ids key on PR number, not branch name — a branch name can repeat
// across a reused branch or a reopened PR, and a number can't. The base
// branch has no PR number, so it falls back to its own ref name.
function nodeId(pr: StackPr): string {
  return pr.number != null ? `pr-${pr.number}` : `ref-${pr.headRefName}`
}

/**
 * A stack is PRs linked by ref name: a PR's baseRefName is the headRefName of the
 * PR below it. A PR whose base isn't in the list (parent merged and its branch
 * deleted) simply gets no edge, and dagre lays it out as its own root — we don't
 * know its parent, so we don't draw one.
 */
export function toFlow(prs: StackPr[]): { nodes: PrFlowNode[]; edges: Edge[] } {
  const idByRef = new Map(prs.map((pr) => [pr.headRefName, nodeId(pr)]))

  const nodes: PrFlowNode[] = prs.map((pr) => ({
    id: nodeId(pr),
    type: 'pr',
    position: { x: 0, y: 0 }, // dagre fills these in
    data: { pr },
  }))

  const edges: Edge[] = prs
    .filter((pr) => pr.baseRefName !== null && idByRef.has(pr.baseRefName))
    .map((pr) => {
      const source = idByRef.get(pr.baseRefName!)! // parent, lower in the stack
      const target = nodeId(pr) // child, stacked on top of it
      return { id: `${source}->${target}`, source, target, type: 'glow' }
    })

  return { nodes, edges }
}

/** dagre pass. `rankdir: 'BT'` is what puts the base branch on the floor. */
export function layout(nodes: PrFlowNode[], edges: Edge[]): PrFlowNode[] {
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: 'BT', nodesep: GUTTER, ranksep: ROW_GAP })

  for (const node of nodes) graph.setNode(node.id, { width: NODE_W, height: NODE_H })
  for (const edge of edges) graph.setEdge(edge.source, edge.target)

  dagre.layout(graph)

  return nodes.map((node) => {
    const pos = graph.node(node.id)
    if (!pos) return node // shouldn't happen — every node id above was set on the graph
    return {
      ...node,
      // dagre anchors at the node's centre, React Flow at its top-left
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
      sourcePosition: Position.Top, // edges leave upward, toward the child
      targetPosition: Position.Bottom,
    }
  })
}

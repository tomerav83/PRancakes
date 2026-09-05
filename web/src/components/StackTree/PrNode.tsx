import { Handle, Position, type NodeProps } from '@xyflow/react'
import { STATES } from '../PrStateBadge'
import { NODE_H, NODE_W, type PrFlowNode } from './stack'

export function PrNode({ data, selected }: NodeProps<PrFlowNode>) {
  const { pr } = data
  const { label, color } = STATES[pr.state] ?? STATES.open
  const isBase = pr.number === null

  return (
    <div
      className={`stack-node${isBase ? ' stack-node-base' : ''}`}
      style={{ width: NODE_W, height: NODE_H, ['--c' as string]: `var(--${color})` }}
      data-selected={selected}
    >
      <Handle type="target" position={Position.Bottom} className="stack-handle" />
      <span className="stack-node-dot" />
      <span className="stack-node-main">
        <span className="stack-node-ref" title={pr.headRefName}>
          {pr.headRefName}
        </span>
        <span className="stack-node-meta">{isBase ? 'base branch' : `#${pr.number}`}</span>
      </span>
      <span className="stack-node-pill">{label}</span>
      <Handle type="source" position={Position.Top} className="stack-handle" />
    </div>
  )
}

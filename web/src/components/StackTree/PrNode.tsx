import { Handle, Position, type NodeProps } from '@xyflow/react'
import { STATES } from '../PrStateBadge'
import { NODE_H, NODE_W, type PrFlowNode } from './stack'

export function PrNode({ data, selected }: NodeProps<PrFlowNode>) {
  const { pr } = data
  const { label, color } = STATES[pr.state] ?? STATES.open
  const isBase = pr.number === null
  const Tag = pr.url ? 'a' : 'div'

  return (
    <Tag
      className={`stack-node${isBase ? ' stack-node-base' : ''}${pr.url ? ' stack-node-clickable' : ''}`}
      style={{ width: NODE_W, height: NODE_H, ['--c' as string]: `var(--${color})` }}
      data-selected={selected}
      {...(pr.url ? { href: pr.url, target: '_blank', rel: 'noopener noreferrer', title: `Open #${pr.number} on GitHub` } : {})}
    >
      <Handle type="target" position={Position.Bottom} className="stack-handle" />
      <span className="stack-node-dot" />
      <span className="stack-node-main">
        <span className="stack-node-ref" title={pr.headRefName}>
          {pr.headRefName}
        </span>
        <span className="stack-node-meta">{isBase ? 'base branch' : `#${pr.number}`}</span>
      </span>
      {!isBase && <span className="stack-node-pill">{label}</span>}
      <Handle type="source" position={Position.Top} className="stack-handle" />
    </Tag>
  )
}

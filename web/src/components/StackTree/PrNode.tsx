import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ChangesRequestedIcon } from '../PrStateBadge/icons'
import { STATES } from '../PrStateBadge'
import { isOutOfSync } from '../PrMetadataPanel/metadata'
import { NODE_H, NODE_W, type PrFlowNode } from './stack'

export function PrNode({ data, selected }: NodeProps<PrFlowNode>) {
  const { pr } = data
  const { label, color } = STATES[pr.state] ?? STATES.open
  const isBase = pr.number === null
  const outOfSync = pr.metadata != null && isOutOfSync(pr.metadata)

  return (
    <div
      className={`stack-node${isBase ? ' stack-node-base' : ' stack-node-clickable'}`}
      style={{ width: NODE_W, height: NODE_H, ['--c' as string]: `var(--${color})` }}
      data-selected={selected}
    >
      <Handle type="target" position={Position.Bottom} className="stack-handle" />
      <span className="stack-node-ref expandable" data-full={pr.headRefName}>
        {pr.headRefName}
      </span>
      <span className="stack-node-row">
        <span className="stack-node-dot" />
        <span className="stack-node-meta">{isBase ? 'base branch' : `#${pr.number}`}</span>
        {outOfSync && (
          <svg
            className="stack-node-sync-warning"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            role="img"
          >
            <title>Out of sync with base branch</title>
            <ChangesRequestedIcon />
          </svg>
        )}
        {!isBase && <span className="stack-node-pill">{label}</span>}
      </span>
      <Handle type="source" position={Position.Top} className="stack-handle" />
    </div>
  )
}

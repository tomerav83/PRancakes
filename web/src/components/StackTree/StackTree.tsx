import { useId, useMemo } from 'react'
import { Background, BackgroundVariant, Controls, ReactFlow } from '@xyflow/react'
import { GlowEdge } from './GlowEdge'
import { PrNode } from './PrNode'
import { layout, toFlow, type StackPr } from './stack'
import './StackTree.css'

const nodeTypes = { pr: PrNode }
const edgeTypes = { glow: GlowEdge }

export function StackTree({ prs, height }: { prs: StackPr[]; height: number }) {
  const filterId = useId()
  const { nodes, edges } = useMemo(() => {
    const flow = toFlow(prs)
    return { nodes: layout(flow.nodes, flow.edges), edges: flow.edges }
  }, [prs])

  return (
    <div className="stack-tree" style={{ height, ['--stack-bloom' as string]: `url(#${filterId})` }}>
      {/* Each instance needs its own filter id — two StackTrees on one page would
          otherwise both define id="stack-bloom" and collide as duplicate DOM ids. */}
      <svg width="0" height="0" aria-hidden="true" className="absolute">
        <defs>
          <filter id={filterId} x="-60%" y="-30%" width="220%" height="160%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="3" result="near" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="11" result="far" />
            <feMerge>
              <feMergeNode in="far" />
              <feMergeNode in="far" />
              <feMergeNode in="near" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--panel-border)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}

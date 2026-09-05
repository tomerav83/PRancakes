import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node as FlowNode,
} from '@xyflow/react'
import { PrMetadataPanel } from '../PrMetadataPanel/PrMetadataPanel'
import { GlowEdge } from './GlowEdge'
import { PrNode } from './PrNode'
import { layout, toFlow, NODE_H, NODE_W, type PrNodeData, type StackPr } from './stack'
import './StackTree.css'

const nodeTypes = { pr: PrNode }
const edgeTypes = { glow: GlowEdge }

// See Design Notes in the spec: pan-in dolly, panel fade, mirrored exit, refit.
const PAN_ZOOM = 1.6
const PAN_DURATION = 550
const PANEL_EXIT_DURATION = 180

function StackTreeCanvas({
  prs,
  height,
  filterId,
}: {
  prs: StackPr[]
  height: number | string
  filterId: string
}) {
  const { setCenter, fitView } = useReactFlow()
  const [focused, setFocused] = useState<StackPr | null>(null)
  const [closing, setClosing] = useState(false)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { nodes, edges } = useMemo(() => {
    const flow = toFlow(prs)
    return { nodes: layout(flow.nodes, flow.edges), edges: flow.edges }
  }, [prs])

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) clearTimeout(closeTimeoutRef.current)
    }
  }, [])

  const handleNodeClick = useCallback(
    (_: unknown, node: FlowNode<PrNodeData>) => {
      const pr = node.data.pr
      if (pr.number === null) return // base/root node — no PR to focus
      if (focused?.number === pr.number) return // already focused — no-op, no redundant pan

      // A new pan supersedes any pending close-fade unmount — otherwise the
      // stale timeout from the previous close would wipe this focus later.
      if (closeTimeoutRef.current !== null) {
        clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }

      const x = node.position.x + NODE_W / 2
      const y = node.position.y + NODE_H / 2
      void setCenter(x, y, { zoom: PAN_ZOOM, duration: PAN_DURATION }).then((didPan) => {
        if (!didPan) return // interrupted by a newer transition — let that one win
        setClosing(false)
        setFocused(pr)
      })
    },
    [focused, setCenter],
  )

  const handleClose = useCallback(() => {
    if (closeTimeoutRef.current !== null) clearTimeout(closeTimeoutRef.current)
    setClosing(true)
    // Fixed timeout matching the CSS exit duration — simplest way to unmount
    // after the fade-out plays, no transitionend tracking needed.
    closeTimeoutRef.current = setTimeout(() => {
      closeTimeoutRef.current = null
      setFocused(null)
      setClosing(false)
      void fitView({ padding: 0.2, duration: PAN_DURATION })
    }, PANEL_EXIT_DURATION)
  }, [fitView])

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
        onNodeClick={handleNodeClick}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--panel-border)" />
        <Controls showInteractive={false} />
      </ReactFlow>

      {focused?.metadata && (
        <div className="stack-meta-overlay">
          <PrMetadataPanel metadata={focused.metadata} onClose={handleClose} closing={closing} />
        </div>
      )}
    </div>
  )
}

export function StackTree({ prs, height }: { prs: StackPr[]; height: number | string }) {
  const filterId = useId()
  return (
    <ReactFlowProvider>
      <StackTreeCanvas prs={prs} height={height} filterId={filterId} />
    </ReactFlowProvider>
  )
}

import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'
import { NODE_H, ROW_GAP } from './stack'

/**
 * The resting edge plus the sweep: a lit section of the curve itself runs
 * parent -> child. pathLength={100} normalises every curve, and the dash cycle
 * (20 on, 130 off) is longer than the path, so exactly one run crosses at a
 * time with a beat of rest — no wrapping segment chasing its own tail.
 */
export function GlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  // Negative delay so every edge is already mid-sweep on first paint, offset by
  // the row it starts on so the tree ripples upward instead of blinking at once.
  const delay = `${(-0.5 * Math.abs(sourceY / (NODE_H + ROW_GAP))).toFixed(2)}s`
  const pulse = { pathLength: 100, style: { animationDelay: delay } }

  return (
    <>
      <BaseEdge id={id} path={path} className="stack-edge" />
      <path {...pulse} className="stack-pulse-halo" d={path} style={{ ...pulse.style, filter: 'var(--stack-bloom)' }} />
      <path {...pulse} className="stack-pulse-core" d={path} />
    </>
  )
}

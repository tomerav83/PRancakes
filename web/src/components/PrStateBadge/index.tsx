import { useId, useState } from 'react'
import {
  ApprovedIcon,
  ChangesRequestedIcon,
  ChecksRunningIcon,
  ClosedIcon,
  DraftIcon,
  MergedIcon,
  OpenIcon,
  ReviewRequiredIcon,
} from './icons'
import { PrMetadataPanel } from '../PrMetadataPanel/PrMetadataPanel'
import type { PrMetadata } from '../PrMetadataPanel/metadata'
import './PrStateBadge.css'

/**
 * PR state badges, mapped to GitHub's actual API values rather than invented labels:
 *  - lifecycle: GraphQL PullRequestState (OPEN/CLOSED/MERGED) + the isDraft flag
 *  - review: PullRequestReviewDecision (REVIEW_REQUIRED/CHANGES_REQUESTED/APPROVED)
 *  - checks: a check run's `status` (queued/in_progress/completed)
 */
export type PrState =
  | 'draft'
  | 'open'
  | 'merged'
  | 'closed'
  | 'review_required'
  | 'changes_requested'
  | 'approved'
  | 'checks_running'

// Exported so anything else drawing a PR in this state (the stack canvas, say)
// takes its label and color token from here rather than keeping a second map.
export const STATES: Record<PrState, { label: string; color: string; Icon: React.ComponentType }> = {
  draft: { label: 'Draft', color: 'draft', Icon: DraftIcon },
  open: { label: 'Open', color: 'open', Icon: OpenIcon },
  merged: { label: 'Merged', color: 'merged', Icon: MergedIcon },
  closed: { label: 'Closed', color: 'closed', Icon: ClosedIcon },
  review_required: { label: 'Review required', color: 'review-required', Icon: ReviewRequiredIcon },
  changes_requested: { label: 'Changes requested', color: 'changes', Icon: ChangesRequestedIcon },
  approved: { label: 'Approved', color: 'approved', Icon: ApprovedIcon },
  checks_running: { label: 'Checks running', color: 'running', Icon: ChecksRunningIcon },
}

export function PrStateBadge({ state, metadata }: { state: PrState; metadata?: PrMetadata }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const { label, color, Icon } = STATES[state]
  const badgeClassName = 'pr-badge inline-flex items-center gap-2 h-[42px] px-4 rounded-[13px] text-sm font-bold tracking-tight whitespace-nowrap'
  const badgeStyle = { ['--c' as string]: `var(--${color})` }
  const icon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="shrink-0">
      <Icon />
    </svg>
  )

  if (!metadata) {
    return (
      <span className={badgeClassName} style={badgeStyle}>
        {icon}
        {label}
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        className={badgeClassName}
        style={badgeStyle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        {icon}
        {label}
        <svg className="pr-badge-caret" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M1 1l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div id={panelId} className="pr-badge-panel-slot">
          <PrMetadataPanel metadata={metadata} onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  )
}

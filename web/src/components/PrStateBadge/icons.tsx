// Icons for PrStateBadge. Each inherits stroke="currentColor" strokeWidth="1.6"
// fill="none" from the <svg> wrapper that renders it.

export function DraftIcon() {
  return <circle cx="8" cy="8" r="5.2" strokeDasharray="2.4 2.6" />
}

export function OpenIcon() {
  return (
    <>
      <circle cx="5" cy="4.2" r="1.7" />
      <path d="M5 5.9v4.5a2 2 0 0 0 2 2h1" strokeLinecap="round" />
      <circle cx="11" cy="11.8" r="1.7" />
    </>
  )
}

export function MergedIcon() {
  return (
    <>
      <circle cx="5" cy="4.2" r="1.7" />
      <path d="M5 5.9V11" strokeLinecap="round" />
      <path d="M5 8.2c0 2.2 1.8 3.6 4 3.6" strokeLinecap="round" />
      <circle cx="11" cy="11.8" r="1.7" />
    </>
  )
}

export function ClosedIcon() {
  return (
    <>
      <circle cx="8" cy="8" r="5.2" />
      <path d="M6.1 6.1l3.8 3.8M9.9 6.1l-3.8 3.8" strokeLinecap="round" />
    </>
  )
}

export function ReviewRequiredIcon() {
  return (
    <>
      <circle cx="8" cy="8" r="5.2" />
      <path d="M8 5.2V8l2 1.4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  )
}

export function ChangesRequestedIcon() {
  return (
    <>
      <path d="M8 2.6 14 12.8H2Z" strokeLinejoin="round" />
      <path d="M8 6.6v3" strokeLinecap="round" />
      <circle cx="8" cy="10.9" r="0.9" fill="currentColor" stroke="none" />
    </>
  )
}

export function ApprovedIcon() {
  return (
    <>
      <circle cx="8" cy="8" r="5.2" />
      <path d="M5.4 8.2 7.2 10l3.4-3.8" strokeLinecap="round" strokeLinejoin="round" />
    </>
  )
}

export function ChecksRunningIcon() {
  return (
    <g className="pr-badge-spin">
      <circle cx="8" cy="8" r="5.2" strokeOpacity="0.25" />
      <path d="M13.2 8a5.2 5.2 0 0 0-5.2-5.2" strokeLinecap="round" />
    </g>
  )
}

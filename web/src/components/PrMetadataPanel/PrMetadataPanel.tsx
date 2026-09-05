import { deriveStatus, formatRelative, type PrMetadata } from './metadata'
import './PrMetadataPanel.css'

const STATUS_COLOR: Record<string, string> = {
  success: 'var(--open)',
  warning: 'var(--changes)',
  blocked: 'var(--changes)',
  neutral: 'var(--ink-muted)',
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pr-meta-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export function PrMetadataPanel({
  metadata,
  onClose,
  closing,
}: {
  metadata: PrMetadata
  onClose: () => void
  closing?: boolean
}) {
  const status = deriveStatus(metadata)
  const statusColor = STATUS_COLOR[status.kind]

  return (
    <div className={`pr-meta-panel${closing ? ' pr-meta-panel--closing' : ''}`}>
      <button type="button" className="pr-meta-close" onClick={onClose} aria-label="Close panel">
        &times;
      </button>
      <div className="pr-meta-branch">
        <span className="pr-meta-head" title={metadata.headRefName}>{metadata.headRefName}</span>
        <span className="pr-meta-arrow">&rarr;</span>
        <span className="pr-meta-base" title={metadata.baseRefName}>{metadata.baseRefName}</span>
      </div>

      <dl className="pr-meta-fields">
        <FieldRow label="Status">
          <span className="pr-meta-status-dot" style={{ background: statusColor }} />
          <span style={{ color: statusColor }}>{status.label}</span>
        </FieldRow>
        <FieldRow label="Diff">
          {metadata.changedFiles} files&nbsp;&nbsp;
          <span className="pr-meta-add">+{metadata.additions}</span>&nbsp;&nbsp;
          <span className="pr-meta-del">&minus;{metadata.deletions}</span>
        </FieldRow>
        <FieldRow label="Author">{metadata.author.login}</FieldRow>
        <FieldRow label="Updated">{formatRelative(metadata.updatedAt)}</FieldRow>
      </dl>

      {(metadata.mergedBy || metadata.mergeCommit) && (
        <dl className="pr-meta-fields pr-meta-extra">
          {metadata.mergedBy && <FieldRow label="Merged by">{metadata.mergedBy.login}</FieldRow>}
          {metadata.mergeCommit && <FieldRow label="Commit">{metadata.mergeCommit.oid.slice(0, 7)}</FieldRow>}
        </dl>
      )}
    </div>
  )
}

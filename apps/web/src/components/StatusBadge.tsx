import { clsx } from 'clsx';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT:     { label: 'Draft',     className: 'badge--draft' },
  SUBMITTED: { label: 'Submitted', className: 'badge--submitted' },
  APPROVED:  { label: 'Approved',  className: 'badge--approved' },
  REJECTED:  { label: 'Rejected',  className: 'badge--rejected' },
};

interface StatusBadgeProps {
  status: string;
  large?: boolean;
}

export function StatusBadge({ status, large }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'badge--unknown' };
  return (
    <span className={clsx('badge', config.className, large && 'badge--large')}>
      {config.label}
    </span>
  );
}

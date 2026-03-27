import { and, eq } from 'drizzle-orm';
import type { DB } from '../db';
import { expenseReports } from '../db/schema';
import type { ReportStatus } from '@expense-report/shared';

// ─── Valid Transition Map ─────────────────────────────────────────────────────
// Encoding the full state machine as a lookup table.
// Role restrictions are also enforced here — not in controllers.

const ALLOWED_TRANSITIONS: Record<string, { next: string[]; role: 'user' | 'admin' | 'any' }> = {
  DRAFT:     { next: ['SUBMITTED'], role: 'user' },
  SUBMITTED: { next: ['APPROVED', 'REJECTED'], role: 'admin' },
  APPROVED:  { next: [], role: 'any' },  // terminal
  REJECTED:  { next: ['DRAFT'], role: 'user' }, // user re-opens to edit
};

export class StateTransitionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INVALID_TRANSITION'
      | 'FORBIDDEN'
      | 'CONCURRENT_MODIFICATION'
      | 'NOT_FOUND' = 'INVALID_TRANSITION'
  ) {
    super(message);
    this.name = 'StateTransitionError';
  }
}

/**
 * Atomically transition an expense report to a new status.
 *
 * Uses a single UPDATE ... WHERE status = currentStatus RETURNING to prevent
 * TOCTOU race conditions (Directive B). If the WHERE clause matches zero rows,
 * either the record doesn't exist, the status has already changed, or the
 * caller supplied a stale snapshot — all treated as a conflict.
 */
export async function transitionReport(
  db: DB,
  reportId: string,
  currentStatus: string,
  targetStatus: string,
  actorRole: 'user' | 'admin'
): Promise<void> {
  const rule = ALLOWED_TRANSITIONS[currentStatus];

  if (!rule) {
    throw new StateTransitionError(
      `Unknown source status: ${currentStatus}`,
      'INVALID_TRANSITION'
    );
  }

  if (!rule.next.includes(targetStatus)) {
    throw new StateTransitionError(
      `Cannot transition from ${currentStatus} to ${targetStatus}`,
      'INVALID_TRANSITION'
    );
  }

  if (rule.role !== 'any' && rule.role !== actorRole) {
    throw new StateTransitionError(
      `Role '${actorRole}' cannot perform this transition (requires '${rule.role}')`,
      'FORBIDDEN'
    );
  }

  // Atomic update — the WHERE on both id AND current status prevents TOCTOU
  const updated = await db
    .update(expenseReports)
    .set({
      status: targetStatus as ReportStatus,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(expenseReports.id, reportId),
        eq(expenseReports.status, currentStatus as ReportStatus)
      )
    )
    .returning({ id: expenseReports.id });

  if (updated.length === 0) {
    throw new StateTransitionError(
      'State transition failed: report not found or status has already changed (concurrent modification)',
      'CONCURRENT_MODIFICATION'
    );
  }
}

/**
 * Check if a report status allows item mutations.
 * Items can only be modified when the parent report is DRAFT.
 */
export function assertReportIsEditable(status: string): void {
  if (status !== 'DRAFT') {
    throw new StateTransitionError(
      `Expense items cannot be modified when report status is '${status}'. Report must be in DRAFT state.`,
      'INVALID_TRANSITION'
    );
  }
}

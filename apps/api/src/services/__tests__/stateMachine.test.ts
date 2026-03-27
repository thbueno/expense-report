import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StateTransitionError, transitionReport, assertReportIsEditable } from '../stateMachine';

// ─── Mock Drizzle DB ──────────────────────────────────────────────────────────
// We test the state machine logic without a real database by mocking the
// Drizzle query builder. Only the chained .returning() matters.

function makeMockDb(returningRows: { id: string }[]) {
  const returning = vi.fn().mockResolvedValue(returningRows);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  return { update, set, where, returning } as unknown as Parameters<typeof transitionReport>[0];
}

describe('State Machine — transitionReport', () => {
  const reportId = 'test-report-id';

  describe('Valid transitions', () => {
    it('DRAFT → SUBMITTED by user', async () => {
      const db = makeMockDb([{ id: reportId }]);
      await expect(
        transitionReport(db, reportId, 'DRAFT', 'SUBMITTED', 'user')
      ).resolves.toBeUndefined();
    });

    it('SUBMITTED → APPROVED by admin', async () => {
      const db = makeMockDb([{ id: reportId }]);
      await expect(
        transitionReport(db, reportId, 'SUBMITTED', 'APPROVED', 'admin')
      ).resolves.toBeUndefined();
    });

    it('SUBMITTED → REJECTED by admin', async () => {
      const db = makeMockDb([{ id: reportId }]);
      await expect(
        transitionReport(db, reportId, 'SUBMITTED', 'REJECTED', 'admin')
      ).resolves.toBeUndefined();
    });

    it('REJECTED → DRAFT by user (re-open for editing)', async () => {
      const db = makeMockDb([{ id: reportId }]);
      await expect(
        transitionReport(db, reportId, 'REJECTED', 'DRAFT', 'user')
      ).resolves.toBeUndefined();
    });
  });

  describe('Invalid transitions', () => {
    it('DRAFT → APPROVED is not allowed', async () => {
      const db = makeMockDb([{ id: reportId }]);
      await expect(
        transitionReport(db, reportId, 'DRAFT', 'APPROVED', 'admin')
      ).rejects.toThrow(StateTransitionError);
    });

    it('APPROVED → anything is not allowed (terminal state)', async () => {
      const db = makeMockDb([{ id: reportId }]);
      await expect(
        transitionReport(db, reportId, 'APPROVED', 'DRAFT', 'admin')
      ).rejects.toThrow(StateTransitionError);

      await expect(
        transitionReport(db, reportId, 'APPROVED', 'SUBMITTED', 'admin')
      ).rejects.toThrow(StateTransitionError);
    });

    it('DRAFT → REJECTED is not allowed', async () => {
      const db = makeMockDb([{ id: reportId }]);
      await expect(
        transitionReport(db, reportId, 'DRAFT', 'REJECTED', 'admin')
      ).rejects.toThrow(StateTransitionError);
    });

    it('REJECTED → SUBMITTED directly is not allowed', async () => {
      const db = makeMockDb([{ id: reportId }]);
      await expect(
        transitionReport(db, reportId, 'REJECTED', 'SUBMITTED', 'user')
      ).rejects.toThrow(StateTransitionError);
    });
  });

  describe('Role enforcement', () => {
    it('user cannot APPROVE a report (admin only)', async () => {
      const db = makeMockDb([{ id: reportId }]);
      await expect(
        transitionReport(db, reportId, 'SUBMITTED', 'APPROVED', 'user')
      ).rejects.toThrow(StateTransitionError);

      const error = await transitionReport(db, reportId, 'SUBMITTED', 'APPROVED', 'user').catch(
        (e) => e
      );
      expect(error.code).toBe('FORBIDDEN');
    });

    it('user cannot REJECT a report (admin only)', async () => {
      const db = makeMockDb([{ id: reportId }]);
      await expect(
        transitionReport(db, reportId, 'SUBMITTED', 'REJECTED', 'user')
      ).rejects.toThrow(StateTransitionError);
    });

    it('admin cannot SUBMIT a report (user only)', async () => {
      const db = makeMockDb([{ id: reportId }]);
      await expect(
        transitionReport(db, reportId, 'DRAFT', 'SUBMITTED', 'admin')
      ).rejects.toThrow(StateTransitionError);

      const error = await transitionReport(db, reportId, 'DRAFT', 'SUBMITTED', 'admin').catch(
        (e) => e
      );
      expect(error.code).toBe('FORBIDDEN');
    });
  });

  describe('Concurrent modification (TOCTOU guard)', () => {
    it('throws CONCURRENT_MODIFICATION when DB returns 0 rows (status changed between read and write)', async () => {
      // Simulate another request having already changed the status
      const db = makeMockDb([]); // empty returning = update matched 0 rows
      const err = await transitionReport(db, reportId, 'DRAFT', 'SUBMITTED', 'user').catch(
        (e) => e
      );
      expect(err).toBeInstanceOf(StateTransitionError);
      expect(err.code).toBe('CONCURRENT_MODIFICATION');
    });
  });
});

describe('assertReportIsEditable', () => {
  it('allows DRAFT', () => {
    expect(() => assertReportIsEditable('DRAFT')).not.toThrow();
  });

  it('throws for SUBMITTED', () => {
    expect(() => assertReportIsEditable('SUBMITTED')).toThrow(StateTransitionError);
  });

  it('throws for APPROVED', () => {
    expect(() => assertReportIsEditable('APPROVED')).toThrow(StateTransitionError);
  });

  it('throws for REJECTED', () => {
    expect(() => assertReportIsEditable('REJECTED')).toThrow(StateTransitionError);
  });
});

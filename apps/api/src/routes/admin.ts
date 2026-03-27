import { Hono } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { expenseReports, expenseItems } from '../db/schema';
import { jwtMiddleware, requireRole } from '../middleware/auth';
import { transitionReport, StateTransitionError } from '../services/stateMachine';
import { AdminActionBody, ReportFilterQuery } from '@expense-report/shared';
import { zValidator } from '@hono/zod-validator';
import type { JWTPayload } from '../lib/jwt';

type Variables = { user: JWTPayload };

export const adminRouter = new Hono<{ Variables: Variables }>();
adminRouter.use('*', jwtMiddleware, requireRole('admin'));

// GET /admin/reports — all reports across all users, filterable by status
adminRouter.get('/reports', zValidator('query', ReportFilterQuery), async (c) => {
  const { status } = c.req.valid('query');

  const conditions = status ? [eq(expenseReports.status, status)] : [];

  const rows = await db
    .select({
      id: expenseReports.id,
      userId: expenseReports.userId,
      title: expenseReports.title,
      description: expenseReports.description,
      status: expenseReports.status,
      createdAt: expenseReports.createdAt,
      updatedAt: expenseReports.updatedAt,
      totalAmount: sql<string>`COALESCE(SUM(${expenseItems.amount}), 0)::text`,
    })
    .from(expenseReports)
    .leftJoin(expenseItems, eq(expenseItems.reportId, expenseReports.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(expenseReports.id)
    .orderBy(expenseReports.updatedAt);

  return c.json({ success: true, data: rows });
});

// POST /admin/reports/:id/action — approve or reject a SUBMITTED report
adminRouter.post(
  '/reports/:id/action',
  zValidator('json', AdminActionBody),
  async (c) => {
    const { action } = c.req.valid('json');
    const reportId = c.req.param('id');
    const user = c.get('user');

    const [report] = await db
      .select()
      .from(expenseReports)
      .where(eq(expenseReports.id, reportId))
      .limit(1);

    if (!report) return c.json({ success: false, error: 'Report not found' }, 404);

    try {
      await transitionReport(db, reportId, report.status, action, user.role);
    } catch (err) {
      if (err instanceof StateTransitionError) {
        const httpStatus = err.code === 'FORBIDDEN' ? 403 : 422;
        return c.json({ success: false, error: err.message, code: err.code }, httpStatus);
      }
      throw err;
    }

    const [updated] = await db
      .select()
      .from(expenseReports)
      .where(eq(expenseReports.id, reportId))
      .limit(1);

    return c.json({ success: true, data: updated });
  }
);

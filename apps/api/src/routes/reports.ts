import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { expenseReports, expenseItems } from '../db/schema';
import { jwtMiddleware } from '../middleware/auth';
import {
  transitionReport,
  StateTransitionError,
} from '../services/stateMachine';
import {
  CreateReportBody,
  UpdateReportBody,
  ReportFilterQuery,
  ReportStatus,
} from '@expense-report/shared';
import type { JWTPayload } from '../lib/jwt';

type Variables = { user: JWTPayload };

export const reportsRouter = new Hono<{ Variables: Variables }>();
reportsRouter.use('*', jwtMiddleware);

// Helper: fetch a report by id with computed total_amount via SQL SUM (Directive C)
async function getReportWithTotal(reportId: string, userId?: string) {
  const query = db
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
    .where(
      userId
        ? and(eq(expenseReports.id, reportId), eq(expenseReports.userId, userId))
        : eq(expenseReports.id, reportId)
    )
    .groupBy(expenseReports.id);

  const [report] = await query;
  return report ?? null;
}

// GET /reports — list own reports, filterable by status
reportsRouter.get('/', zValidator('query', ReportFilterQuery), async (c) => {
  const { status } = c.req.valid('query');
  const user = c.get('user');

  const conditions = [eq(expenseReports.userId, user.sub)];
  if (status) conditions.push(eq(expenseReports.status, status));

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
    .where(and(...conditions))
    .groupBy(expenseReports.id)
    .orderBy(expenseReports.createdAt);

  return c.json({ success: true, data: rows });
});

// POST /reports — create a new report
reportsRouter.post('/', zValidator('json', CreateReportBody), async (c) => {
  const body = c.req.valid('json');
  const user = c.get('user');

  const [report] = await db
    .insert(expenseReports)
    .values({ userId: user.sub, title: body.title, description: body.description })
    .returning();

  return c.json({ success: true, data: { ...report, totalAmount: '0' } }, 201);
});

// GET /reports/:id — get own report with items
reportsRouter.get('/:id', async (c) => {
  const user = c.get('user');
  const report = await getReportWithTotal(c.req.param('id'), user.sub);
  if (!report) return c.json({ success: false, error: 'Report not found' }, 404);

  const items = await db
    .select()
    .from(expenseItems)
    .where(eq(expenseItems.reportId, report.id))
    .orderBy(expenseItems.createdAt);

  return c.json({ success: true, data: { ...report, items } });
});

// PATCH /reports/:id — update title/description (only in DRAFT)
reportsRouter.patch('/:id', zValidator('json', UpdateReportBody), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const reportId = c.req.param('id');

  const report = await getReportWithTotal(reportId, user.sub);
  if (!report) return c.json({ success: false, error: 'Report not found' }, 404);
  if (report.status !== 'DRAFT') {
    return c.json({ success: false, error: 'Only DRAFT reports can be edited' }, 422);
  }

  const [updated] = await db
    .update(expenseReports)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(expenseReports.id, reportId), eq(expenseReports.userId, user.sub)))
    .returning();

  return c.json({ success: true, data: { ...updated, totalAmount: report.totalAmount } });
});

// DELETE /reports/:id — only in DRAFT
reportsRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const reportId = c.req.param('id');

  const report = await getReportWithTotal(reportId, user.sub);
  if (!report) return c.json({ success: false, error: 'Report not found' }, 404);
  if (report.status !== 'DRAFT') {
    return c.json({ success: false, error: 'Only DRAFT reports can be deleted' }, 422);
  }

  await db
    .delete(expenseReports)
    .where(and(eq(expenseReports.id, reportId), eq(expenseReports.userId, user.sub)));

  return c.json({ success: true, data: null }, 200);
});

// POST /reports/:id/submit — DRAFT → SUBMITTED (atomic)
reportsRouter.post('/:id/submit', async (c) => {
  const user = c.get('user');
  const reportId = c.req.param('id');

  const report = await getReportWithTotal(reportId, user.sub);
  if (!report) return c.json({ success: false, error: 'Report not found' }, 404);

  try {
    await transitionReport(db, reportId, report.status, 'SUBMITTED', user.role);
  } catch (err) {
    if (err instanceof StateTransitionError) {
      const status = err.code === 'FORBIDDEN' ? 403 : 422;
      return c.json({ success: false, error: err.message, code: err.code }, status);
    }
    throw err;
  }

  const updated = await getReportWithTotal(reportId, user.sub);
  return c.json({ success: true, data: updated });
});

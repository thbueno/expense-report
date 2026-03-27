import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { expenseReports, expenseItems } from '../db/schema';
import { jwtMiddleware } from '../middleware/auth';
import { assertReportIsEditable } from '../services/stateMachine';
import { StateTransitionError } from '../services/stateMachine';
import { CreateItemBody, UpdateItemBody } from '@expense-report/shared';
import type { JWTPayload } from '../lib/jwt';

type Variables = { user: JWTPayload };

export const itemsRouter = new Hono<{ Variables: Variables }>();
itemsRouter.use('*', jwtMiddleware);

// Helper: get report and verify ownership
async function getOwnReport(reportId: string, userId: string) {
  const [report] = await db
    .select()
    .from(expenseReports)
    .where(and(eq(expenseReports.id, reportId), eq(expenseReports.userId, userId)))
    .limit(1);
  return report ?? null;
}

// GET /reports/:id/items
itemsRouter.get('/:id/items', async (c) => {
  const user = c.get('user');
  const report = await getOwnReport(c.req.param('id'), user.sub);
  if (!report) return c.json({ success: false, error: 'Report not found' }, 404);

  const items = await db
    .select()
    .from(expenseItems)
    .where(eq(expenseItems.reportId, report.id))
    .orderBy(expenseItems.createdAt);

  return c.json({ success: true, data: items });
});

// POST /reports/:id/items
itemsRouter.post('/:id/items', zValidator('json', CreateItemBody), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const report = await getOwnReport(c.req.param('id'), user.sub);

  if (!report) return c.json({ success: false, error: 'Report not found' }, 404);

  try {
    assertReportIsEditable(report.status);
  } catch (err) {
    if (err instanceof StateTransitionError) {
      return c.json({ success: false, error: err.message }, 422);
    }
    throw err;
  }

  const [item] = await db
    .insert(expenseItems)
    .values({
      reportId: report.id,
      amount: body.amount,
      currency: body.currency,
      category: body.category,
      merchantName: body.merchantName,
      transactionDate: body.transactionDate,
      receiptUrl: body.receiptUrl ?? null,
      aiStatus: body.aiStatus ?? null,
    })
    .returning();

  return c.json({ success: true, data: item }, 201);
});

// PATCH /reports/:id/items/:itemId
itemsRouter.patch('/:id/items/:itemId', zValidator('json', UpdateItemBody), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const { id: reportId, itemId } = c.req.param();

  const report = await getOwnReport(reportId, user.sub);
  if (!report) return c.json({ success: false, error: 'Report not found' }, 404);

  try {
    assertReportIsEditable(report.status);
  } catch (err) {
    if (err instanceof StateTransitionError) {
      return c.json({ success: false, error: err.message }, 422);
    }
    throw err;
  }

  const [updated] = await db
    .update(expenseItems)
    .set(body)
    .where(and(eq(expenseItems.id, itemId), eq(expenseItems.reportId, reportId)))
    .returning();

  if (!updated) return c.json({ success: false, error: 'Item not found' }, 404);

  return c.json({ success: true, data: updated });
});

// DELETE /reports/:id/items/:itemId
itemsRouter.delete('/:id/items/:itemId', async (c) => {
  const user = c.get('user');
  const { id: reportId, itemId } = c.req.param();

  const report = await getOwnReport(reportId, user.sub);
  if (!report) return c.json({ success: false, error: 'Report not found' }, 404);

  try {
    assertReportIsEditable(report.status);
  } catch (err) {
    if (err instanceof StateTransitionError) {
      return c.json({ success: false, error: err.message }, 422);
    }
    throw err;
  }

  await db
    .delete(expenseItems)
    .where(and(eq(expenseItems.id, itemId), eq(expenseItems.reportId, reportId)));

  return c.json({ success: true, data: null });
});

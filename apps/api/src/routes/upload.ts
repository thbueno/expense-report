import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { db } from '../db';
import { expenseReports, expenseItems } from '../db/schema';
import { jwtMiddleware } from '../middleware/auth';
import { assertReportIsEditable, StateTransitionError } from '../services/stateMachine';
import { extractReceiptData } from '../services/geminiService';
import type { JWTPayload } from '../lib/jwt';

type Variables = { user: JWTPayload };

export const uploadRouter = new Hono<{ Variables: Variables }>();
uploadRouter.use('*', jwtMiddleware);

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

/**
 * POST /reports/:id/items/:itemId/receipt
 *
 * Follows Directive D exactly:
 * 1. Verify ownership + editability
 * 2. Mark item aiStatus = PENDING in DB
 * 3. Save file to disk
 * 4. Call Gemini
 * 5. Update DB with extracted fields + aiStatus = COMPLETED/FAILED
 */
uploadRouter.post('/:id/items/:itemId/receipt', async (c) => {
  const user = c.get('user');
  const { id: reportId, itemId } = c.req.param();

  // Verify report ownership
  const [report] = await db
    .select()
    .from(expenseReports)
    .where(and(eq(expenseReports.id, reportId), eq(expenseReports.userId, user.sub)))
    .limit(1);

  if (!report) return c.json({ success: false, error: 'Report not found' }, 404);

  try {
    assertReportIsEditable(report.status);
  } catch (err) {
    if (err instanceof StateTransitionError) {
      return c.json({ success: false, error: err.message }, 422);
    }
    throw err;
  }

  // Verify item belongs to this report
  const [item] = await db
    .select()
    .from(expenseItems)
    .where(and(eq(expenseItems.id, itemId), eq(expenseItems.reportId, reportId)))
    .limit(1);

  if (!item) return c.json({ success: false, error: 'Item not found' }, 404);

  // Parse multipart form
  const formData = await c.req.formData();
  const file = formData.get('receipt') as File | null;

  if (!file) {
    return c.json({ success: false, error: 'No file provided — use field name "receipt"' }, 400);
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return c.json(
      { success: false, error: `Unsupported file type: ${file.type}. Use JPEG, PNG, WebP, GIF, or PDF.` },
      415
    );
  }

  // ── Step 1: Mark PENDING in DB (Directive D) ─────────────────────────────
  await db
    .update(expenseItems)
    .set({ aiStatus: 'PENDING' })
    .where(eq(expenseItems.id, itemId));

  // ── Step 2: Save file to disk ─────────────────────────────────────────────
  const uploadsDir = process.env.UPLOADS_DIR || './uploads';
  const userDir = join(uploadsDir, user.sub);
  await mkdir(userDir, { recursive: true });

  const ext = extname(file.name) || '.bin';
  const filename = `${randomUUID()}${ext}`;
  const filePath = join(userDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const receiptUrl = `/uploads/${user.sub}/${filename}`;

  // ── Step 3: Call Gemini ───────────────────────────────────────────────────
  const extracted = await extractReceiptData(buffer, file.type);

  // ── Step 4: Update DB with results ───────────────────────────────────────
  const updatePayload: Record<string, unknown> = {
    receiptUrl,
    aiStatus: extracted ? 'COMPLETED' : 'FAILED',
  };

  if (extracted) {
    updatePayload.merchantName = extracted.merchantName;
    updatePayload.amount = String(extracted.amount);
    updatePayload.currency = extracted.currency;
    updatePayload.transactionDate = extracted.transactionDate;
  }

  const [updated] = await db
    .update(expenseItems)
    .set(updatePayload)
    .where(eq(expenseItems.id, itemId))
    .returning();

  return c.json({
    success: true,
    data: {
      item: updated,
      extracted: extracted ?? null,
      message: extracted
        ? 'AI extraction completed. Review the pre-filled values before saving.'
        : 'File saved. AI extraction failed — please fill in the fields manually.',
    },
  });
});

/**
 * POST /reports/:id/extract-receipt
 * 1. Verify ownership + editability
 * 2. Save file to disk
 * 3. Call Gemini
 * 4. Return extracted data & receiptUrl
 */
uploadRouter.post('/:id/extract-receipt', async (c) => {
  const user = c.get('user');
  const reportId = c.req.param('id');

  // Verify report ownership
  const [report] = await db
    .select()
    .from(expenseReports)
    .where(and(eq(expenseReports.id, reportId), eq(expenseReports.userId, user.sub)))
    .limit(1);

  if (!report) return c.json({ success: false, error: 'Report not found' }, 404);

  try {
    assertReportIsEditable(report.status);
  } catch (err) {
    if (err instanceof StateTransitionError) {
      return c.json({ success: false, error: err.message }, 422);
    }
    throw err;
  }

  // Parse multipart form
  let formData: FormData;
  try {
     formData = await c.req.formData();
  } catch {
     return c.json({ success: false, error: 'Invalid form data' }, 400);
  }
  const file = formData.get('receipt') as File | null;

  if (!file) {
    return c.json({ success: false, error: 'No file provided — use field name "receipt"' }, 400);
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return c.json(
      { success: false, error: `Unsupported file type: ${file.type}. Use JPEG, PNG, WebP, GIF, or PDF.` },
      415
    );
  }

  // Save file to disk
  const uploadsDir = process.env.UPLOADS_DIR || './uploads';
  const userDir = join(uploadsDir, user.sub);
  await mkdir(userDir, { recursive: true });

  const ext = extname(file.name) || '.bin';
  const filename = `${randomUUID()}${ext}`;
  const filePath = join(userDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const receiptUrl = `/uploads/${user.sub}/${filename}`;

  // Call Gemini
  const extracted = await extractReceiptData(buffer, file.type);

  return c.json({
    success: true,
    data: {
      receiptUrl,
      extracted: extracted ?? null,
      message: extracted
        ? 'AI extraction completed. Review the pre-filled values before saving.'
        : 'File saved. AI extraction failed — please fill in the fields manually.',
    },
  });
});

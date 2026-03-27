import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import { serveStatic } from '@hono/node-server/serve-static';

import { authRouter } from './routes/auth';
import { reportsRouter } from './routes/reports';
import { itemsRouter } from './routes/items';
import { uploadRouter } from './routes/upload';
import { adminRouter } from './routes/admin';

const app = new Hono();

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);

// ─── Static file serving for uploaded receipts ────────────────────────────────
app.use(
  '/uploads/*',
  serveStatic({ root: process.env.UPLOADS_DIR ? './' : './' })
);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.route('/auth', authRouter);
app.route('/reports', reportsRouter);
app.route('/reports', itemsRouter);   // nested: /reports/:id/items/*
app.route('/reports', uploadRouter);  // nested: /reports/:id/items/:itemId/receipt
app.route('/admin', adminRouter);

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ success: false, error: err.message }, err.status);
  }
  console.error('Unhandled error:', err);
  return c.json({ success: false, error: 'Internal server error' }, 500);
});

// ─── Server ───────────────────────────────────────────────────────────────────
const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port }, () => {
  console.log(`🚀 API server running at http://localhost:${port}`);
});

export default app;

# CLAUDE.md — Project Context for Claude Code

## Project
Expense Report Management System — take-home assessment.

## Stack
- **Monorepo:** pnpm workspaces (`apps/api`, `apps/web`, `packages/shared`)
- **Backend:** Hono + Drizzle ORM + PostgreSQL + jose (JWT)
- **AI:** Google Gemini 1.5 Flash (`@google/generative-ai`)
- **Frontend:** React + Vite + TanStack Query + React Hook Form

## Critical Directives

### A. Type Safety
Never duplicate types. All shapes live in `packages/shared/src/schemas.ts`.
Both `zValidator` (Hono) and `zodResolver` (React Hook Form) consume the same schema.

### B. State Machine (TOCTOU-safe)
Always use atomic UPDATE with WHERE clause:
```typescript
const updated = await db.update(expenseReports)
  .set({ status: target })
  .where(and(eq(expenseReports.id, id), eq(expenseReports.status, current)))
  .returning();
if (updated.length === 0) throw conflict error
```

### C. total_amount
NEVER store. Always `COALESCE(SUM(items.amount), 0)::text` in the query.

### D. Upload Order (orphan-safe)
1. DB insert with `aiStatus='PENDING'`
2. Write file to disk
3. Call Gemini
4. DB update with extracted fields + `aiStatus='COMPLETED'`

## State Machine
```
DRAFT → [user] → SUBMITTED → [admin] → APPROVED (terminal)
               ↓ [admin] → REJECTED → [user] → DRAFT (re-edit)
```

## Running
```bash
docker compose up -d   # PostgreSQL
pnpm install
pnpm migrate
pnpm dev               # API :3000, Web :5173
pnpm --filter api test # unit + integration tests
```

# DECISIONS.md — Expense Report Management System

## Stack Choices

### TypeScript Monorepo (pnpm workspaces)

**Why:** Sharing Zod schemas between the API validators and the frontend React Hook Form is the single highest-leverage architectural decision in this codebase. It eliminates an entire class of bugs where the API accepts a shape the frontend doesn't know about (or vice versa). pnpm workspaces with a `packages/shared` package makes this trivially easy.

### Hono + Node.js

**Why:** Hono has native TypeScript support, an elegant `zValidator` middleware that integrates directly with Zod, and runs on the standard Node.js HTTP server for simplicity. The alternative (Express) requires more ceremony to achieve the same type safety. Hono's `c.req.valid('json')` gives fully-typed, validated request bodies without any casting.

### PostgreSQL + Drizzle ORM

**Why:** Drizzle's `where(and(...)).returning()` pattern is the cleanest way to implement the required atomic state transition (Directive B). Other ORMs would require raw SQL or transactions for the same guarantee. Drizzle is also TypeScript-native with schema inference.

### React + Vite + TanStack Query

**Why:** TanStack Query is the gold standard for server state management in React. Its `invalidateQueries` pattern means the UI stays consistent after mutations without manual cache management. Vite's dev server starts in milliseconds.

---

## Key Trade-offs & Design Decisions

### Decision 1: REJECTED → DRAFT (not REJECTED → SUBMITTED directly)

When a report is rejected, the user is returned to `DRAFT` state, not directly to `SUBMITTED`.

**Reasoning:** The purpose of rejection is to give the user a chance to correct their items. Jumping directly to `SUBMITTED` would defeat this — the user could only add new items, not edit or delete incorrect ones. `DRAFT` restores full edit rights, which is the semantically correct behavior. The user then re-submits explicitly, giving them a chance to review before the report re-enters the admin queue.

### Decision 2: Synchronous AI extraction (no polling)

Receipt extraction happens inline during the upload request. The response includes the extracted fields immediately.

**Reasoning:** For this scope, async extraction would add significant complexity (background worker, polling endpoint or WebSockets, status tracking UI). The synchronous approach is simpler, easier to reason about, and meets the requirement. Gemini 1.5 Flash is fast enough (~1-3 seconds) that the UX impact is minimal. The `aiStatus='PENDING'` → `COMPLETED/FAILED` DB update still uses the Directive D order in case the flow needs to become async later — it's a drop-in change.

### Decision 3: total_amount as SQL aggregation, never stored

`total_amount` is computed via `COALESCE(SUM(expense_items.amount), 0)` in every query that needs it. It is never stored as a column on `expense_reports`.

**Reasoning:** Storing a derived value creates the possibility of drift. If an item is updated or deleted, the stored total must be kept in sync through triggers or application logic — both of which have failure modes. Deriving it from the source of truth (the items table) is always correct and the performance cost at this scale is negligible.

### Decision 4: TOCTOU-safe atomic state transitions

State transitions use a single `UPDATE ... WHERE (id = ? AND status = currentStatus) RETURNING` instead of a read-then-update pattern.

**Reasoning:** Under concurrent load, a read-then-update creates a race: two requests can both read the same status, both pass the validation check, and both execute the update — with one of them succeeding on an already-transitioned record. The `WHERE status = currentStatus` clause turns the database into the arbiter. If zero rows are returned, the transition either didn't apply (status had changed) or the record doesn't exist. This is handled as a `CONCURRENT_MODIFICATION` error to the caller.

### Decision 5: File storage on local filesystem

Receipts are stored in a local `uploads/` directory volume-mounted via Docker.

**Reasoning:** Cloud storage (S3, GCS) adds authentication complexity, SDK dependencies, and network latency — none of which are necessary for a local development assessment. The upload route design is intentionally agnostic: replacing `writeFile` with an S3 PutObject call is a one-function change.

---

## What I Skipped (and Why)

| Feature | Reason |
|---|---|
| Background job queue (Redis/BullMQ) | Adds significant infrastructure complexity. Sync extraction meets the spec. |
| Confidence score in UI | Optional enhancement. Not enough signal from a single extraction to display meaningfully. |
| Audit trail / status history table | Optional enhancement. Clean `updatedAt` timestamp on the report covers basic needs. |
| Pagination | Not mentioned in requirements. Easy to add with Drizzle's `limit/offset`. |
| Email notifications | Out of scope. No email infra in the brief. |
| Rate limiting | Would add for production; out of scope here. |

---

## If You Had One More Day

**I would build the audit trail.** Here's why:

The status state machine is the core value of this system — every meaningful action is a transition. Right now, when an admin looks at an `APPROVED` report, they have no visibility into when it was submitted, how long it sat in the queue, or whether it was ever rejected before being re-submitted and approved.

A `report_status_history` table (columns: `id, report_id, from_status, to_status, actor_id, created_at, note`) adds almost no backend complexity — it's a single `INSERT` inside the `transitionReport` service call. But the value it creates is disproportionate:

- **Admins** can see the full lifecycle of a report and understand context before approving/rejecting
- **Finance teams** get an immutable audit log for compliance
- **Users** can see when their report was reviewed and by whom

After the audit trail, the next priority would be **proper error boundaries and loading skeletons in the UI**. The current frontend shows a plain text "Loading..." state which is functional but poor UX. Given that TanStack Query gives you `isLoading`, `isFetching`, and error states out of the box, adding skeleton screens is a 30-minute polish pass that significantly improves perceived performance.

The final thing I'd add is **pagination on the admin reports list**. As the number of reports grows, loading everything in one query becomes a scalability problem. Drizzle's `limit`/`offset` + a `count` subquery would take about an hour to implement correctly with the server-side filtering already in place.

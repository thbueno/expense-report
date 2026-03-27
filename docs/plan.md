# docs/plan.md — Build Plan & Task Breakdown

## Phase 1: Scaffold (30 min)
- [x] Init pnpm workspaces
- [x] Create docker-compose.yml (PostgreSQL + init-db.sql for test DB)
- [x] Create .env.example with all required vars

## Phase 2: Shared Contracts (20 min)
- [x] `packages/shared/src/schemas.ts` — all Zod schemas
  - Entity schemas: User, ExpenseItem, ExpenseReport
  - Request bodies: SignupBody, LoginBody, CreateReportBody, CreateItemBody, UpdateItemBody, AdminActionBody
  - AI schema: ExtractedReceiptSchema

## Phase 3: DB Schema + Connection (20 min)
- [x] Drizzle schema: users, expense_reports, expense_items
- [x] pgEnum for user_role, report_status, category, ai_status
- [x] total_amount NOT stored — derived by SUM query (Directive C)
- [x] drizzle.config.ts → drizzle-kit migrations

## Phase 4: Auth (30 min)
- [x] jose JWT sign/verify
- [x] jwtMiddleware + requireRole('admin')
- [x] POST /auth/signup, POST /auth/login

## Phase 5: State Machine (45 min) ← Critical path
- [x] ALLOWED_TRANSITIONS map with role enforcement
- [x] transitionReport() — atomic WHERE+RETURNING (Directive B)
- [x] assertReportIsEditable() for item CRUD protection
- [x] Unit tests: all valid/invalid, role violations, TOCTOU

## Phase 6: Reports API (40 min)
- [x] GET/POST/PATCH/DELETE /reports
- [x] POST /reports/:id/submit → transitionReport
- [x] All list queries use SUM aggregation

## Phase 7: Items API (30 min)
- [x] GET/POST/PATCH/DELETE /reports/:id/items
- [x] assertReportIsEditable guard on every write

## Phase 8: Upload + AI (45 min)
- [x] Multipart file parse
- [x] Directive D order: PENDING → disk write → Gemini → COMPLETED/FAILED
- [x] Gemini responseSchema mapped from Zod ExtractedReceiptSchema

## Phase 9: Admin API (20 min)
- [x] requireRole('admin') on all routes
- [x] GET /admin/reports with status filter + SUM
- [x] POST /admin/reports/:id/action → transitionReport

## Phase 10: Integration Test (30 min)
- [x] Full happy path: signup → create → add item → submit → admin approve
- [x] Negative cases: item edit locked, double submit, role enforcement

## Phase 11: Frontend (90 min)
- [x] API client with JWT token management
- [x] Auth context with localStorage persistence
- [x] LoginPage, SignupPage (RHF + Zod from shared)
- [x] ReportsListPage with status filter
- [x] ReportDetailPage with item form + AI upload state widget
- [x] AdminReportsPage with approve/reject
- [x] ProtectedRoute with role guard

## Phase 12: Docs (30 min)
- [x] README.md — setup in <5 min, test commands, architecture, AI usage note
- [x] DECISIONS.md — all key trade-offs, one-more-day section
- [x] CLAUDE.md — AI system prompt evidence
- [x] docs/plan.md — this file

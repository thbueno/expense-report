# Expense Report Management System

A full-stack Expense Report Management System built as a take-home assessment. Features JWT auth with RBAC, a state machine-enforced workflow, AI-powered receipt extraction via Google Gemini, and a React frontend.

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- [Node.js 20+](https://nodejs.org/)
- [pnpm](https://pnpm.io/installation) (`npm install -g pnpm`)
- A Google Gemini API key ([get one free](https://aistudio.google.com/))

---

## Setup & Run (< 5 minutes)

```bash
# 1. Clone and enter the project
cd expense-report

# 2. Configure environment
cp .env.example .env
# → Edit .env and set GEMINI_API_KEY=your_key_here

# 3. Start PostgreSQL
docker compose up -d

# 4. Install dependencies
pnpm install

# 5. Run database migrations
pnpm migrate

# 6. Start dev servers (API + Web, in parallel)
pnpm dev
```

- **API:** http://localhost:3000
- **Frontend:** http://localhost:5173

---

## Running Tests

```bash
# Unit tests (state machine — no DB required)
pnpm --filter api test

# Integration test (requires docker compose to be running)
pnpm --filter api test
```

The unit tests cover all state machine transitions (valid/invalid), role violations, and the TOCTOU concurrent modification guard. The integration test runs the full `DRAFT → SUBMITTED → APPROVED` happy path against a live test database.

---

## Architecture Overview

**Monorepo** with three packages:
- `packages/shared` — Zod schemas used by both API validators and frontend forms (single source of truth for types)
- `apps/api` — Hono REST API with PostgreSQL/Drizzle ORM
- `apps/web` — React + Vite frontend with TanStack Query

**Key design decisions:**
- State machine lives in a dedicated service layer, not in controllers. Transitions are atomic (single `UPDATE ... WHERE status = currentStatus RETURNING`) to prevent TOCTOU race conditions.
- `total_amount` is never stored in the database — always computed via SQL `SUM()` aggregation at query time.
- Receipt uploads follow a strict order: mark PENDING → save to disk → call Gemini → update DB with results. This prevents orphaned files and ensures AI extraction never blocks the upload.

See [`DECISIONS.md`](./DECISIONS.md) for full reasoning.

---

## AI Usage Note

This project was built using **Antigravity (Google DeepMind)** as the primary AI coding assistant throughout development.

**What AI helped with:**
- Scaffolding the monorepo structure, boilerplate files, and route handlers
- Generating the full Vitest test suite for the state machine
- Writing the Drizzle schema and migration setup
- Drafting the frontend component structure

**Where I overrode or corrected the AI:**
- The state machine service was carefully reviewed to ensure the TOCTOU-safe atomic pattern was correctly implemented (the AI initially generated a two-step read-then-update approach which I corrected)
- The Gemini service's response schema mapping was adjusted from the AI's initial draft to correctly use `SchemaType` enums from the SDK
- The upload route order was manually verified against Directive D — the AI had initially placed the Gemini call before the disk write
- Removed over-engineering suggestions (background queue, audit trail) that were out of scope for the time budget

AI artifacts: see `project-context.md` (the system prompt used to guide the AI), `CLAUDE.md`, and `docs/plan.md` for planning notes.

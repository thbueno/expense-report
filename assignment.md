# Senior Fullstack Developer — Take-Home Assessment

> **Effort:** ~1 working day (~6–8 hours of focused work)
> 
> 
> **Deadline:** 3 calendar days from receipt of this document
> 
> **Delivery:** A single Git repository link (GitHub / GitLab / Bitbucket)
> 
> **Questions?** Reach out to the recruiter who sent you this document
> 

---

## 01 · Context & Goal

We want to see how you approach a product engineering problem end-to-end: schema design, business logic, API craft, testing, and the thinking behind your choices.

**We are not evaluating the quantity of features — we are evaluating the quality of your decisions about what to build and how.**

You will build a full-stack Expense Report Management System — a REST API with a working frontend UI. The scope is intentionally limited to fit a single working day. Use AI tools liberally to move fast; apply your senior judgment to make sure the output is actually good.

---

## 02 · Domain Model

Implement the following core entities and their relationships:

| Entity | Key Fields | Notes |
| --- | --- | --- |
| `User` | id, email, password_hash, role | Roles: `user` | `admin` |
| `Expense Report` | id, user_id (FK), title, description, status, total_amount (computed) | See state machine below |
| `Expense Item` | id, report_id (FK), amount, currency, category, merchant_name, transaction_date, receipt_url | Cascade delete with Report |

### 2.1 Status State Machine

The `status` field must follow this lifecycle. Validate transitions at the **service layer** — not in controllers.

```markdown
  User actions                              Admin actions
  ─────────────────────────────────────────────────────────

  DRAFT  ──[Submit]──►  SUBMITTED  ──[Approve]──►  APPROVED
    ▲                       │                         (final)
    │                       │ [Reject]
    └───────────────────────┘
                        REJECTED  (user may re-edit & re-submit)
```

- **`DRAFT`** — user can add / edit / delete items.
- **`SUBMITTED`** — report is locked; no item edits allowed.
- **`APPROVED`** — terminal state set by admin.
- **`REJECTED`** — set by admin. User regains edit rights and can re-submit.

> Your choice for `REJECTED → re-submit` (back to `DRAFT` or directly to `SUBMITTED`) is yours to make — document it in `DECISIONS.md`.
> 

---

## 03 · Functional Requirements

### 3.1 Authentication & Authorization

- JWT-based signup / login.
- RBAC: `user` and `admin` roles with appropriate access controls.
- Protect all endpoints accordingly.

### 3.2 Expense Reports (User)

- CRUD on own reports — delete only allowed in `DRAFT` state.
- Submit a report (`DRAFT` → `SUBMITTED`).
- List own reports, filterable by status.

### 3.3 Expense Items & Receipt Upload

- CRUD on items — only allowed when the parent report is in `DRAFT`.
- `total_amount` on the report must reflect the sum of its items (computed).
- **File upload:** users can attach a receipt document (PDF or image) to any expense item.
- **AI extraction:** upon upload, call an LLM to automatically extract and pre-fill: merchant name, amount, currency, and transaction date. The user can review and override any extracted value before saving.

> Extraction does not need to be real-time. A simple polling approach or immediate response is both acceptable — document your choice in `DECISIONS.md`.
> 

### 3.4 Admin Endpoints

- List all reports across all users, filterable by status.
- Approve or reject a `SUBMITTED` report.

### 3.5 Frontend UI

A working frontend is required. Styling is secondary — usability and clean component structure matter more. At minimum it must cover:

- Login / signup screens.
- Expense report list with status indicator.
- Report detail view: expense items, current status, submit button.
- Add / edit expense item form — with receipt upload and a clear UI state for when AI extraction is in progress vs. completed.
- Admin view: list all reports, approve / reject actions.

---

## 04 · Technical Requirements

### 4.1 Stack

Choose any stack you are comfortable with. Our common stacks lean toward React/Vue on frontend, PHP / Node.js / Go / .NET / Java on backend, and PostgreSQL or MongoDB for storage. Pick what lets you move fast and produce quality work.

For file storage, a local filesystem mount or MinIO mock is perfectly fine — no cloud storage required.

### 4.2 Testing

- Unit tests for the state machine / business logic layer — at minimum.
- At least one integration test covering a key happy path (e.g., `DRAFT → SUBMITTED → APPROVED`).

> Full TDD and E2E coverage are not required for this exercise.
> 

### 4.3 Local Development

- A `docker-compose.yml` to spin up all dependencies (database, file storage mock, etc.).
- Setup instructions in `README.md` — a reviewer should be up and running in under 5 minutes.

### 4.4 AI-Assisted Development (Required)

**You are required to use AI coding tools** (Cursor, Claude, Copilot, or equivalent) throughout this exercise. This is not optional — it reflects how we work at Gradion.

Your repository must include evidence of AI tool usage committed to Git. This can include any combination of:

- `.claude/` — Claude project settings, commands, or memory files
- `CLAUDE.md` — project context file used by Claude Code
- `.cursor/` — Cursor rules or project configuration
- `docs/architecture.md` — AI-generated or AI-assisted architecture notes
- `docs/plan.md` — planning notes, task breakdowns, or sprint outlines
- Prompt files, agent configs, or any other AI workflow artifacts

> We are not looking for a perfect AI workflow. We want to see that you actually used the tools and made deliberate decisions along the way — including where you overrode or corrected the AI output.
> 

---

## 05 · Deliverables

Your repository must include:

| File / Artifact | What we expect |
| --- | --- |
| `README.md` | How to run locally, how to run tests, brief architecture overview. |
| `DECISIONS.md` | Stack choices and why, key trade-offs, what you'd add next with more time. Include a short section: *"If you had one more day, what would you build next and why?"* (~300–600 words) |
| AI Usage note | 1–2 paragraphs in `README.md` or a separate file: which AI tools you used, how they helped, where you overrode or corrected the output. |
| AI artifacts | Evidence of AI tool usage committed to the repo — see section 4.4 for examples. |
| Clean Git history | Meaningful commit messages. No single giant commit. |
| `docker-compose.yml` | All dependencies runnable locally with a single command. |

---

## 06 · Evaluation Criteria

| Dimension | What we look for |
| --- | --- |
| **Architectural Judgment** | Clean separation of concerns. Business logic out of controllers. Sensible schema. No over-engineering for this scope. |
| **Code Quality** | Readable, maintainable code. Consistent conventions. Error handling that doesn't swallow exceptions silently. |
| **Testing Mindset** | Tests cover logic that matters: state machine, auth rules. Tests are readable and purposeful. |
| **AI Proficiency** | Evidence of actual AI tool usage in the repo. Judgment shown in where you trusted the output and where you didn't. |
| **Communication** | `DECISIONS.md` reads like a senior engineer explaining trade-offs to a peer — not a feature list. The *"one more day"* answer reveals how you think about priority and value delivery. |

---

## 07 · Optional Enhancements

These are not expected and will not negatively affect your evaluation if absent. They are here if you finish early and want to show more depth:

- Background job queue for async receipt processing (Redis/BullMQ, PgBoss, or similar).
- Confidence score display in the UI for AI-extracted fields — let the user know how certain the model is.
- Per-report audit trail: a history of status transitions visible in the admin view.

---

## 08 · Suggested Approach

This is a suggestion, not a constraint. Work in the order that makes sense for you.

1. Define schema and project structure. Set up `docker-compose`. Let AI help scaffold the initial structure.
2. Implement auth: signup / login / JWT / RBAC.
3. Build the Expense Report domain: model, state machine, service layer, and unit tests.
4. Add Expense Item CRUD with locking logic tied to report status.
5. Add receipt file upload and AI extraction endpoint.
6. Expose admin endpoints (list, approve, reject).
7. Build the frontend UI — use AI tools to move fast here.
8. Write `DECISIONS.md` and AI usage note. Commit AI artifacts. Polish `README`.
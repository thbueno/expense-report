
### The AI IDE Implementation Guide (`project-context.md`)

Create a file named `project-context.md` (or `.cursorrules` / `.windsurfrules` depending on your specific AI IDE) in the root of your new project and paste the following content. This document acts as the "System Prompt" for your IDE, forcing it to adhere to our strict architectural decisions.

```markdown
# Expense Report Management System - Core Architecture

## 1. Project Overview
We are building an Expense Report Management System for a take-home assessment. It requires a REST API and a React frontend. The primary evaluation criteria are architectural judgment, strict state machine enforcement, and type safety.

## 2. Tech Stack (Strict Constraints)
- **Architecture:** TypeScript Monorepo (pnpm workspaces).
- **Backend:** Node.js + Hono (`apps/api`).
- **Database:** PostgreSQL + Drizzle ORM.
- **Frontend:** React + Vite + TanStack Query + shadcn/ui + Tailwind CSS (`apps/web`).
- **Shared Contracts:** Zod schemas in a shared package (`packages/shared`).
- **AI Integration:** Google Gemini API (`@google/generative-ai` using `gemini-1.5-flash`).

## 3. Directory Structure
```text
/
├── packages/
│   └── shared/          # Zod schemas (ExpenseItem, ExpenseReport, API types)
├── apps/
│   ├── api/             # Hono backend
│   │   ├── src/
│   │   │   ├── db/      # Drizzle schema and connection
│   │   │   ├── routes/  # Hono endpoints
│   │   │   └── services/# Business logic & state machine (CRITICAL)
│   └── web/             # Vite frontend
│       ├── src/
│       │   ├── components/ui/ # shadcn/ui components
│       │   ├── hooks/         # TanStack Query mutations/queries
│       │   └── pages/
```

## 4. Critical Engineering Directives (Do Not Ignore)

### Directive A: End-to-End Type Safety
Do not duplicate types. The backend Hono routes MUST use `zValidator` with schemas imported from `packages/shared`. The frontend React Hook Forms MUST use the exact same Zod schemas for validation. 

### Directive B: State Machine Concurrency (TOCTOU Fix)
When transitioning an expense report from `DRAFT` to `SUBMITTED`, do NOT query the status and then update it in two separate steps. You must use an atomic database operation using optimistic concurrency control. 
*Implementation Requirement:* Use Drizzle's `where` and `returning()` clauses.
```typescript
// Example of the REQUIRED pattern for state transitions:
const updated = await db.update(reports)
  .set({ status: 'SUBMITTED' })
  .where(and(eq(reports.id, targetId), eq(reports.status, 'DRAFT')))
  .returning();

if (updated.length === 0) throw new Error("Transition failed or state mismatch");
```

### Directive C: The total_amount Guarantee
Do not sum the `total_amount` in application memory. The total amount must be strictly derived from the database. Use a subquery or a SQL `SUM()` aggregation in the Drizzle query when fetching the report.

### Directive D: Transactional File Uploads
To prevent orphan files, the upload route must execute in this exact order:
1. Insert a `PENDING` record in the `expense_items` table.
2. Save the file to the local disk volume (use Node's `fs` or a basic multipart parser).
3. Call the Gemini API.
4. Update the DB record with extracted data and mark `COMPLETED`.

### Directive E: Gemini 1.5 Flash Integration
Use the `@google/generative-ai` SDK. You must use the `gemini-1.5-flash` model. 
*Implementation Requirement:* Pass the Zod schema to Gemini to enforce the JSON structure.
```typescript
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: {
    responseMimeType: "application/json",
    // Instruct the IDE to map the Zod schema to the Gemini schema format here
  }
});
```

## 5. Development Workflow
1. Initialize pnpm workspaces.
2. Scaffold the Drizzle schema first.
3. Build the shared Zod contracts.
4. Implement the State Machine service layer.
5. Expose Hono endpoints.
6. Build the Vite UI consuming the endpoints.
```

---

import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  numeric,
  date,
} from 'drizzle-orm/pg-core';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);
export const reportStatusEnum = pgEnum('report_status', [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
]);
export const categoryEnum = pgEnum('category', [
  'travel',
  'meals',
  'accommodation',
  'office',
  'other',
]);
export const aiStatusEnum = pgEnum('ai_status', ['PENDING', 'COMPLETED', 'FAILED']);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const expenseReports = pgTable('expense_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: reportStatusEnum('status').notNull().default('DRAFT'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const expenseItems = pgTable('expense_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportId: uuid('report_id')
    .notNull()
    .references(() => expenseReports.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('USD'),
  category: categoryEnum('category').notNull(),
  merchantName: text('merchant_name').notNull(),
  transactionDate: date('transaction_date').notNull(),
  receiptUrl: text('receipt_url'),
  aiStatus: aiStatusEnum('ai_status'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Type exports ─────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ExpenseReport = typeof expenseReports.$inferSelect;
export type NewExpenseReport = typeof expenseReports.$inferInsert;
export type ExpenseItem = typeof expenseItems.$inferSelect;
export type NewExpenseItem = typeof expenseItems.$inferInsert;

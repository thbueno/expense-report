import { z } from 'zod';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const ReportStatus = z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED']);
export type ReportStatus = z.infer<typeof ReportStatus>;

export const UserRole = z.enum(['user', 'admin']);
export type UserRole = z.infer<typeof UserRole>;

export const Category = z.enum([
  'travel',
  'meals',
  'accommodation',
  'office',
  'other',
]);
export type Category = z.infer<typeof Category>;

export const AiStatus = z.enum(['PENDING', 'COMPLETED', 'FAILED']);
export type AiStatus = z.infer<typeof AiStatus>;

// ─── Core Entity Schemas ──────────────────────────────────────────────────────

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: UserRole,
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

export const ExpenseItemSchema = z.object({
  id: z.string().uuid(),
  reportId: z.string().uuid(),
  amount: z.string(), // numeric as string (precision safe)
  currency: z.string().length(3),
  category: Category,
  merchantName: z.string().min(1).max(255),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  receiptUrl: z.string().nullable(),
  aiStatus: AiStatus.nullable(),
  createdAt: z.string().datetime(),
});
export type ExpenseItem = z.infer<typeof ExpenseItemSchema>;

export const ExpenseReportSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).nullable(),
  status: ReportStatus,
  totalAmount: z.string(), // computed SUM from DB
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  items: z.array(ExpenseItemSchema).optional(),
});
export type ExpenseReport = z.infer<typeof ExpenseReportSchema>;

// ─── AI Extraction Schema ─────────────────────────────────────────────────────

export const ExtractedReceiptSchema = z.object({
  merchantName: z.string(),
  amount: z.number(),
  currency: z.string().length(3),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type ExtractedReceipt = z.infer<typeof ExtractedReceiptSchema>;

// ─── Request Body Schemas (shared between API validators & frontend forms) ────

export const SignupBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  role: UserRole.optional().default('user'),
});
export type SignupBody = z.infer<typeof SignupBody>;

export const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginBody = z.infer<typeof LoginBody>;

export const CreateReportBody = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
});
export type CreateReportBody = z.infer<typeof CreateReportBody>;

export const UpdateReportBody = CreateReportBody.partial();
export type UpdateReportBody = z.infer<typeof UpdateReportBody>;

export const CreateItemBody = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a positive decimal'),
  currency: z.string().length(3).default('USD'),
  category: Category,
  merchantName: z.string().min(1).max(255),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  receiptUrl: z.string().nullable().optional(),
  aiStatus: AiStatus.nullable().optional(),
});
export type CreateItemBody = z.infer<typeof CreateItemBody>;

export const UpdateItemBody = CreateItemBody.partial();
export type UpdateItemBody = z.infer<typeof UpdateItemBody>;

export const AdminActionBody = z.object({
  action: z.enum(['APPROVED', 'REJECTED']),
});
export type AdminActionBody = z.infer<typeof AdminActionBody>;

export const ReportFilterQuery = z.object({
  status: ReportStatus.optional(),
});
export type ReportFilterQuery = z.infer<typeof ReportFilterQuery>;

// ─── API Response Wrappers ────────────────────────────────────────────────────

export const ApiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ─── Auth Response ────────────────────────────────────────────────────────────

export const AuthResponseSchema = z.object({
  token: z.string(),
  user: UserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

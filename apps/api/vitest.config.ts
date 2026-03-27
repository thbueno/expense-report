import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/expense_report_test',
      JWT_SECRET: 'test-secret-do-not-use-in-production',
      UPLOADS_DIR: '/tmp/expense-report-test-uploads',
    },
  },
});

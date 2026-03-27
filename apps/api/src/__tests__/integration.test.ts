import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../index';

// Integration test: DRAFT → SUBMITTED → APPROVED happy path
// Requires TEST_DATABASE_URL to be set and the DB to be migrated.
// Run: TEST_DATABASE_URL=... pnpm --filter api test

const BASE = 'http://localhost';

async function req(
  method: string,
  path: string,
  body?: unknown,
  token?: string
): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await app.request(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  return { status: res.status, data };
}

describe('Integration: Expense Report Happy Path', () => {
  let userToken: string;
  let adminToken: string;
  let reportId: string;
  let itemId: string;

  const userEmail = `user_${Date.now()}@test.com`;
  const adminEmail = `admin_${Date.now()}@test.com`;
  const password = 'TestPass123!';

  it('user can sign up', async () => {
    const { status, data } = await req('POST', '/auth/signup', {
      email: userEmail,
      password,
      role: 'user',
    });
    expect(status).toBe(201);
    const d = data as { success: boolean; data: { token: string } };
    expect(d.success).toBe(true);
    userToken = d.data.token;
  });

  it('admin can sign up', async () => {
    const { status, data } = await req('POST', '/auth/signup', {
      email: adminEmail,
      password,
      role: 'admin',
    });
    expect(status).toBe(201);
    const d = data as { success: boolean; data: { token: string } };
    adminToken = d.data.token;
  });

  it('user can create a DRAFT report', async () => {
    const { status, data } = await req(
      'POST',
      '/reports',
      { title: 'Q1 Travel Expenses', description: 'Business trip costs' },
      userToken
    );
    expect(status).toBe(201);
    const d = data as { success: boolean; data: { id: string; status: string } };
    expect(d.data.status).toBe('DRAFT');
    reportId = d.data.id;
  });

  it('user can add an expense item to a DRAFT report', async () => {
    const { status, data } = await req(
      'POST',
      `/reports/${reportId}/items`,
      {
        amount: '125.50',
        currency: 'USD',
        category: 'travel',
        merchantName: 'Delta Airlines',
        transactionDate: '2026-03-01',
      },
      userToken
    );
    expect(status).toBe(201);
    const d = data as { success: boolean; data: { id: string } };
    itemId = d.data.id;
  });

  it('user can submit the report (DRAFT → SUBMITTED)', async () => {
    const { status, data } = await req('POST', `/reports/${reportId}/submit`, undefined, userToken);
    expect(status).toBe(200);
    const d = data as { success: boolean; data: { status: string } };
    expect(d.data.status).toBe('SUBMITTED');
  });

  it('user cannot add items to a SUBMITTED report', async () => {
    const { status, data } = await req(
      'POST',
      `/reports/${reportId}/items`,
      {
        amount: '50.00',
        currency: 'USD',
        category: 'meals',
        merchantName: 'Airport Cafe',
        transactionDate: '2026-03-01',
      },
      userToken
    );
    expect(status).toBe(422);
  });

  it('user cannot submit the same report twice', async () => {
    const { status } = await req('POST', `/reports/${reportId}/submit`, undefined, userToken);
    // SUBMITTED → SUBMITTED is not a valid transition
    expect(status).toBe(422);
  });

  it('admin can see SUBMITTED report in admin view', async () => {
    const { status, data } = await req(
      'GET',
      '/admin/reports?status=SUBMITTED',
      undefined,
      adminToken
    );
    expect(status).toBe(200);
    const d = data as { success: boolean; data: { id: string }[] };
    expect(d.data.some((r) => r.id === reportId)).toBe(true);
  });

  it('admin can approve the report (SUBMITTED → APPROVED)', async () => {
    const { status, data } = await req(
      'POST',
      `/admin/reports/${reportId}/action`,
      { action: 'APPROVED' },
      adminToken
    );
    expect(status).toBe(200);
    const d = data as { success: boolean; data: { status: string } };
    expect(d.data.status).toBe('APPROVED');
  });

  it('user cannot edit items on an APPROVED report', async () => {
    const { status } = await req(
      'PATCH',
      `/reports/${reportId}/items/${itemId}`,
      { merchantName: 'Changed' },
      userToken
    );
    expect(status).toBe(422);
  });

  it('non-admin user cannot access admin endpoint', async () => {
    const { status } = await req('GET', '/admin/reports', undefined, userToken);
    expect(status).toBe(403);
  });
});

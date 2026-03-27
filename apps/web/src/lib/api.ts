const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

export function setToken(token: string): void {
  localStorage.setItem('token', token);
}

export function clearToken(): void {
  localStorage.removeItem('token');
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};

  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  }

  return (data as { data: T }).data;
}

export const api = {
  // Auth
  signup: (body: { email: string; password: string; role?: string }) =>
    request<{ token: string; user: { id: string; email: string; role: string } }>(
      'POST',
      '/auth/signup',
      body
    ),
  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: { id: string; email: string; role: string } }>(
      'POST',
      '/auth/login',
      body
    ),

  // Reports
  getReports: (status?: string) =>
    request<unknown[]>('GET', status ? `/reports?status=${status}` : '/reports'),
  getReport: (id: string) =>
    request<unknown>('GET', `/reports/${id}`),
  createReport: (body: { title: string; description?: string }) =>
    request<unknown>('POST', '/reports', body),
  updateReport: (id: string, body: { title?: string; description?: string }) =>
    request<unknown>('PATCH', `/reports/${id}`, body),
  deleteReport: (id: string) =>
    request<null>('DELETE', `/reports/${id}`),
  submitReport: (id: string) =>
    request<unknown>('POST', `/reports/${id}/submit`),

  // Items
  getItems: (reportId: string) =>
    request<unknown[]>('GET', `/reports/${reportId}/items`),
  createItem: (reportId: string, body: unknown) =>
    request<unknown>('POST', `/reports/${reportId}/items`, body),
  updateItem: (reportId: string, itemId: string, body: unknown) =>
    request<unknown>('PATCH', `/reports/${reportId}/items/${itemId}`, body),
  deleteItem: (reportId: string, itemId: string) =>
    request<null>('DELETE', `/reports/${reportId}/items/${itemId}`),
  uploadReceipt: (reportId: string, itemId: string, file: File) => {
    const form = new FormData();
    form.append('receipt', file);
    return request<unknown>('POST', `/reports/${reportId}/items/${itemId}/receipt`, form);
  },
  extractReceipt: (reportId: string, file: File) => {
    const form = new FormData();
    form.append('receipt', file);
    return request<unknown>('POST', `/reports/${reportId}/extract-receipt`, form);
  },

  // Admin
  adminGetReports: (status?: string) =>
    request<unknown[]>('GET', status ? `/admin/reports?status=${status}` : '/admin/reports'),
  adminAction: (reportId: string, action: 'APPROVED' | 'REJECTED') =>
    request<unknown>('POST', `/admin/reports/${reportId}/action`, { action }),
};

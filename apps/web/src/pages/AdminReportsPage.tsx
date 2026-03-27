import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';

interface Report {
  id: string;
  userId: string;
  title: string;
  status: string;
  totalAmount: string;
  updatedAt: string;
}

export function AdminReportsPage() {
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('SUBMITTED');
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  const { data: reports = [], isLoading, error } = useQuery<Report[]>({
    queryKey: ['admin-reports', statusFilter],
    queryFn: () => api.adminGetReports(statusFilter || undefined) as Promise<Report[]>,
  });

  const actionMutation = useMutation({
    mutationFn: ({ reportId, action }: { reportId: string; action: 'APPROVED' | 'REJECTED' }) =>
      api.adminAction(reportId, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-reports'] }),
    onError: (e, { reportId }) =>
      setActionErrors((prev) => ({ ...prev, [reportId]: (e as Error).message })),
  });

  return (
    <div className="page">
      <header className="page-header">
        <h1>Admin — All Reports</h1>
        <div className="header-actions">
          <Link to="/reports" className="btn btn-secondary">My Reports</Link>
          <button onClick={logout} className="btn btn-ghost">Sign Out</button>
        </div>
      </header>

      <div className="toolbar">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-select"
          id="admin-status-filter"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {isLoading && <p className="loading">Loading...</p>}
      {error && <p className="error-banner">{(error as Error).message}</p>}

      {reports.length === 0 && !isLoading && (
        <div className="empty-state">
          <p>No reports found with this status.</p>
        </div>
      )}

      <div className="report-list">
        {reports.map((report) => (
          <div key={report.id} className="report-card report-card--admin">
            <div className="report-card-header">
              <div>
                <h3>{report.title}</h3>
                <small className="report-id">ID: {report.id}</small>
                <small className="user-id">User: {report.userId}</small>
              </div>
              <StatusBadge status={report.status} />
            </div>
            <div className="report-card-meta">
              <span className="total-amount">${Number(report.totalAmount).toFixed(2)}</span>
              <span className="updated-date">
                Updated: {new Date(report.updatedAt).toLocaleDateString()}
              </span>
            </div>

            {actionErrors[report.id] && (
              <div className="error-banner">{actionErrors[report.id]}</div>
            )}

            {report.status === 'SUBMITTED' && (
              <div className="admin-actions">
                <button
                  className="btn btn-success"
                  onClick={() => actionMutation.mutate({ reportId: report.id, action: 'APPROVED' })}
                  disabled={actionMutation.isPending}
                  id={`approve-${report.id}`}
                >
                  ✓ Approve
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => actionMutation.mutate({ reportId: report.id, action: 'REJECTED' })}
                  disabled={actionMutation.isPending}
                  id={`reject-${report.id}`}
                >
                  ✗ Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

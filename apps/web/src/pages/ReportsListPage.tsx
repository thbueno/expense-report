import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';

interface Report {
  id: string;
  title: string;
  description: string | null;
  status: string;
  totalAmount: string;
  createdAt: string;
}

export function ReportsListPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const { data: reports = [], isLoading, error } = useQuery<Report[]>({
    queryKey: ['reports', statusFilter],
    queryFn: () => api.getReports(statusFilter || undefined) as Promise<Report[]>,
  });

  const createMutation = useMutation({
    mutationFn: (title: string) => api.createReport({ title }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      navigate(`/reports/${(created as Report).id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteReport(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reports'] }),
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await createMutation.mutateAsync(newTitle.trim());
    setNewTitle('');
    setCreating(false);
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>My Expense Reports</h1>
        <div className="header-actions">
          <span className="user-info">{user?.email} ({user?.role})</span>
          {user?.role === 'admin' && (
            <Link to="/admin/reports" className="btn btn-secondary">Admin View</Link>
          )}
          <button onClick={logout} className="btn btn-ghost">Sign Out</button>
        </div>
      </header>

      <div className="toolbar">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-select"
          id="status-filter"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + New Report
        </button>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="create-form">
          <input
            autoFocus
            type="text"
            placeholder="Report title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
            Create
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>
            Cancel
          </button>
        </form>
      )}

      {isLoading && <p className="loading">Loading...</p>}
      {error && <p className="error-banner">{(error as Error).message}</p>}

      {reports.length === 0 && !isLoading && (
        <div className="empty-state">
          <p>No expense reports yet.</p>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            Create your first report
          </button>
        </div>
      )}

      <div className="report-list">
        {reports.map((report) => (
          <div key={report.id} className="report-card">
            <Link to={`/reports/${report.id}`} className="report-card-link">
              <div className="report-card-header">
                <h3>{report.title}</h3>
                <StatusBadge status={report.status} />
              </div>
              <div className="report-card-meta">
                <span className="total-amount">${Number(report.totalAmount).toFixed(2)}</span>
                <span className="created-date">
                  {new Date(report.createdAt).toLocaleDateString()}
                </span>
              </div>
            </Link>
            {report.status === 'DRAFT' && (
              <button
                className="btn btn-danger btn-sm"
                onClick={() => {
                  if (confirm('Delete this report?')) deleteMutation.mutate(report.id);
                }}
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

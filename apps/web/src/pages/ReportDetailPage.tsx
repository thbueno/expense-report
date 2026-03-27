import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useRef } from 'react';
import { api } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { CreateItemBody } from '@expense-report/shared';

interface ExpenseItem {
  id: string;
  reportId: string;
  amount: string;
  currency: string;
  category: string;
  merchantName: string;
  transactionDate: string;
  receiptUrl: string | null;
  aiStatus: string | null;
}

interface Report {
  id: string;
  title: string;
  description: string | null;
  status: string;
  totalAmount: string;
  items: ExpenseItem[];
  createdAt: string;
}

const CATEGORIES = ['travel', 'meals', 'accommodation', 'office', 'other'] as const;

function ItemForm({
  reportId,
  reportStatus,
  onSaved,
  onCancel,
  defaultValues,
  itemId,
}: {
  reportId: string;
  reportStatus: string;
  onSaved: () => void;
  onCancel: () => void;
  defaultValues?: Partial<CreateItemBody>;
  itemId?: string;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'done' | 'failed'>('idle');
  const fileRef = useRef<HTMLInputElement>(null);


  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateItemBody>({
    resolver: zodResolver(CreateItemBody),
    defaultValues: {
      currency: 'USD',
      ...defaultValues,
    },
  });

  const onSubmit = async (data: CreateItemBody) => {
    setError('');
    try {
      if (itemId) {
        await api.updateItem(reportId, itemId, data);
      } else {
        await api.createItem(reportId, data);
      }
      queryClient.invalidateQueries({ queryKey: ['report', reportId] });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadState('uploading');
    try {
      const result = await api.extractReceipt(reportId, file) as {
        receiptUrl: string;
        extracted: { merchantName: string; amount: number; currency: string; transactionDate: string } | null;
      };

      setValue('receiptUrl', result.receiptUrl);
      if (result.extracted) {
        setValue('merchantName', result.extracted.merchantName);
        setValue('amount', String(result.extracted.amount));
        setValue('currency', result.extracted.currency);
        setValue('transactionDate', result.extracted.transactionDate);
        setValue('aiStatus', 'COMPLETED');
        setUploadState('done');
      } else {
        setValue('aiStatus', 'FAILED');
        setUploadState('failed');
      }
    } catch {
      setUploadState('failed');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="item-form">
      <input type="hidden" {...register('receiptUrl')} />
      <input type="hidden" {...register('aiStatus')} />
      <div className="form-row">
        <div className="form-group">
          <label>Merchant Name</label>
          <input {...register('merchantName')} placeholder="e.g. Delta Airlines" />
          {errors.merchantName && <span className="error">{errors.merchantName.message}</span>}
        </div>
        <div className="form-group">
          <label>Amount</label>
          <input {...register('amount')} placeholder="0.00" />
          {errors.amount && <span className="error">{errors.amount.message}</span>}
        </div>
        <div className="form-group">
          <label>Currency</label>
          <input {...register('currency')} placeholder="USD" maxLength={3} />
          {errors.currency && <span className="error">{errors.currency.message}</span>}
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Category</label>
          <select {...register('category')}>
            <option value="">Select...</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
          {errors.category && <span className="error">{errors.category.message}</span>}
        </div>
        <div className="form-group">
          <label>Transaction Date</label>
          <input type="date" {...register('transactionDate')} />
          {errors.transactionDate && <span className="error">{errors.transactionDate.message}</span>}
        </div>
      </div>

      {reportStatus === 'DRAFT' && (
        <div className="receipt-upload">
          <label>Receipt (PDF or image)</label>
          <input type="file" ref={fileRef} accept="image/*,.pdf" onChange={handleFileUpload} />
          {uploadState === 'uploading' && (
            <div className="ai-status ai-status--pending">
              🤖 AI extracting receipt data…
            </div>
          )}
          {uploadState === 'done' && (
            <div className="ai-status ai-status--done">
              ✅ AI extraction complete — fields pre-filled. Review before saving.
            </div>
          )}
          {uploadState === 'failed' && (
            <div className="ai-status ai-status--failed">
              ⚠️ AI extraction failed — please fill in fields manually.
            </div>
          )}
          <small>Upload a receipt to auto-fill the form fields using AI.</small>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : itemId ? 'Update Item' : 'Add Item'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const { data: report, isLoading } = useQuery<Report>({
    queryKey: ['report', id],
    queryFn: () => api.getReport(id!) as Promise<Report>,
    enabled: !!id,
  });

  const submitMutation = useMutation({
    mutationFn: () => api.submitReport(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['report', id] }),
    onError: (e) => setActionError((e as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => api.deleteItem(id!, itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['report', id] }),
  });

  if (isLoading || !report) {
    return <div className="page"><p className="loading">Loading...</p></div>;
  }

  const isDraft = report.status === 'DRAFT';

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to="/reports" className="back-link">← My Reports</Link>
          <h1>{report.title}</h1>
          {report.description && <p className="description">{report.description}</p>}
        </div>
        <div className="header-right">
          <StatusBadge status={report.status} large />
          <div className="total-amount-large">${Number(report.totalAmount).toFixed(2)}</div>
        </div>
      </header>

      {actionError && <div className="error-banner">{actionError}</div>}

      {isDraft && (
        <div className="actions-bar">
          <button
            className="btn btn-success"
            onClick={() => {
              setActionError('');
              if (report.items?.length === 0) {
                setActionError('Add at least one expense item before submitting.');
                return;
              }
              submitMutation.mutate();
            }}
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit Report'}
          </button>
          {!showAddItem && (
            <button className="btn btn-primary" onClick={() => setShowAddItem(true)}>
              + Add Item
            </button>
          )}
        </div>
      )}

      {report.status === 'REJECTED' && (
        <div className="status-notice status-notice--rejected">
          This report was rejected. Re-open it to make edits and re-submit.
        </div>
      )}

      {showAddItem && isDraft && (
        <div className="item-form-container">
          <h3>New Expense Item</h3>
          <ItemForm
            reportId={id!}
            reportStatus={report.status}
            onSaved={() => setShowAddItem(false)}
            onCancel={() => setShowAddItem(false)}
          />
        </div>
      )}

      <div className="items-section">
        <h2>Expense Items ({report.items?.length ?? 0})</h2>
        {report.items?.length === 0 && (
          <p className="empty-state">No items yet. {isDraft && 'Click "+ Add Item" to get started.'}</p>
        )}

        <div className="items-list">
          {report.items?.map((item) => (
            <div key={item.id} className="item-card">
              {editingItemId === item.id ? (
                <ItemForm
                  reportId={id!}
                  reportStatus={report.status}
                  itemId={item.id}
                  defaultValues={{
                    amount: item.amount,
                    currency: item.currency,
                    category: item.category as CreateItemBody['category'],
                    merchantName: item.merchantName,
                    transactionDate: item.transactionDate,
                  }}
                  onSaved={() => setEditingItemId(null)}
                  onCancel={() => setEditingItemId(null)}
                />
              ) : (
                <>
                  <div className="item-header">
                    <span className="merchant">{item.merchantName}</span>
                    <span className="amount">{item.currency} {Number(item.amount).toFixed(2)}</span>
                  </div>
                  <div className="item-meta">
                    <span className="category">{item.category}</span>
                    <span className="date">{item.transactionDate}</span>
                    {item.receiptUrl && (
                      <a href={item.receiptUrl} target="_blank" rel="noopener noreferrer" className="receipt-link">
                        📎 Receipt
                      </a>
                    )}
                    {item.aiStatus === 'PENDING' && (
                      <span className="ai-status ai-status--pending">🤖 Extracting…</span>
                    )}
                  </div>
                  {isDraft && (
                    <div className="item-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingItemId(item.id)}>
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          if (confirm('Delete this item?')) deleteMutation.mutate(item.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

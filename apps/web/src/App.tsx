import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ReportsListPage } from './pages/ReportsListPage';
import { ReportDetailPage } from './pages/ReportDetailPage';
import { AdminReportsPage } from './pages/AdminReportsPage';
import type { ReactNode } from 'react';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function ProtectedRoute({ children, role }: { children: ReactNode; role?: 'admin' | 'user' }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/reports" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/reports" replace /> : <LoginPage />} />
      <Route path="/signup" element={user ? <Navigate to="/reports" replace /> : <SignupPage />} />
      <Route
        path="/reports"
        element={<ProtectedRoute><ReportsListPage /></ProtectedRoute>}
      />
      <Route
        path="/reports/:id"
        element={<ProtectedRoute><ReportDetailPage /></ProtectedRoute>}
      />
      <Route
        path="/admin/reports"
        element={<ProtectedRoute role="admin"><AdminReportsPage /></ProtectedRoute>}
      />
      <Route path="*" element={<Navigate to={user ? '/reports' : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

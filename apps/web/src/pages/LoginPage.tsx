import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LoginBody } from '@expense-report/shared';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginBody>({
    resolver: zodResolver(LoginBody),
  });

  const onSubmit = async (data: LoginBody) => {
    setError('');
    try {
      await login(data.email, data.password);
      navigate('/reports');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Expense Report System</h1>
        <h2>Sign In</h2>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" {...register('email')} />
            {errors.email && <span className="error">{errors.email.message}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" {...register('password')} />
            {errors.password && <span className="error">{errors.password.message}</span>}
          </div>
          {error && <div className="error-banner">{error}</div>}
          <button type="submit" disabled={isSubmitting} className="btn btn-primary">
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p>Don't have an account? <Link to="/signup">Sign up</Link></p>
      </div>
    </div>
  );
}

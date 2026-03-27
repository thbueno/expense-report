import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SignupBody } from '@expense-report/shared';
import { useAuth } from '../context/AuthContext';

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignupBody>({
    resolver: zodResolver(SignupBody),
    defaultValues: { role: 'user' },
  });

  const onSubmit = async (data: SignupBody) => {
    setError('');
    try {
      await signup(data.email, data.password, data.role);
      navigate('/reports');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Expense Report System</h1>
        <h2>Create Account</h2>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" {...register('email')} />
            {errors.email && <span className="error">{errors.email.message}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="password">Password (min 8 chars)</label>
            <input id="password" type="password" {...register('password')} />
            {errors.password && <span className="error">{errors.password.message}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="role">Role</label>
            <select id="role" {...register('role')}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && <div className="error-banner">{error}</div>}
          <button type="submit" disabled={isSubmitting} className="btn btn-primary">
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <p>Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  );
}

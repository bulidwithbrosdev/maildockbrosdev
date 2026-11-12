import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { get, post, errorText } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Field, PasswordInput } from '../../components/ui/form';
import { Alert, PageSpinner } from '../../components/ui/misc';
import { AuthLayout } from './AuthLayout';

export function ActivatePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No activation token was provided. Please use the link sent in your invitation email.');
      setLoading(false);
      return;
    }
    setLoading(true);
    get<{ ok: boolean; name: string; email: string }>(`/auth/invitation/verify?token=${encodeURIComponent(token)}`)
      .then((res) => {
        setUser({ name: res.name, email: res.email });
      })
      .catch((err) => {
        setError(errorText(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 10) {
      setError('Password must be at least 10 characters long.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await post('/auth/invitation/accept', { token, password });
      setDone(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <AuthLayout title="Verifying invitation" subtitle="Please wait while we verify your link…">
        <div className="py-8">
          <PageSpinner />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={done ? 'Account activated' : 'Set your password'}
      subtitle={
        done
          ? 'Your business email account is now active.'
          : 'Choose a secure password for your new business email account.'
      }
      footer={<Link to="/login" className="hover:text-fg">Back to sign in</Link>}
    >
      {done ? (
        <div className="space-y-4">
          <Alert tone="success" title="Ready to sign in">
            Your password has been set successfully. You can now sign in to your Maildock inbox with {user?.email}.
          </Alert>
          <Button variant="primary" className="w-full justify-center" onClick={() => navigate('/login')}>
            Sign in
          </Button>
        </div>
      ) : error && !user ? (
        <div className="space-y-4">
          <Alert tone="danger" title="Invalid or expired link">
            {error}
          </Alert>
          <p className="text-[13px] text-muted">
            If this invitation expired or has already been used, please ask your administrator to send you a new invitation.
          </p>
          <Button variant="secondary" className="w-full justify-center" onClick={() => navigate('/login')}>
            Go to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}

          {user && (
            <div className="rounded-lg border border-border bg-surface-2 p-3 text-[13px]">
              <div className="text-xs text-faint">Account details</div>
              <div className="font-semibold text-fg">{user.name || 'Mailbox User'}</div>
              <div className="font-mono text-xs text-muted">{user.email}</div>
            </div>
          )}

          <Field label="Create password" id="password" hint="At least 10 characters.">
            <PasswordInput
              id="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter secure password"
            />
          </Field>

          <Field label="Confirm password" id="confirmPassword">
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              required
              minLength={10}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
            />
          </Field>

          <Button type="submit" variant="primary" className="w-full justify-center" loading={busy}>
            Set password & activate account
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}


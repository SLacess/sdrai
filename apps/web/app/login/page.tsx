import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-cookie';
import { loginAction } from './actions';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Invalid email or password.',
  missing_fields: 'Enter both email and password.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const existingUser = await getSessionUser();
  if (existingUser) redirect('/');

  const { error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? 'Unable to sign in.') : null;

  return (
    <div style={{ maxWidth: 360, margin: '80px auto' }}>
      <div className="brand" style={{ marginBottom: 24, padding: 0 }}>
        Sinal AI Sales OS
        <div className="brand-sub">Revenue Intelligence</div>
      </div>
      <div className="card">
        <h1 className="page-title" style={{ fontSize: 16, marginBottom: 16 }}>
          Sign in
        </h1>
        {errorMessage && <div className="error-state" style={{ marginBottom: 12 }}>{errorMessage}</div>}
        <form action={loginAction}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input type="text" id="email" name="email" required autoComplete="username" />
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input type="password" id="password" name="password" required autoComplete="current-password" />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}

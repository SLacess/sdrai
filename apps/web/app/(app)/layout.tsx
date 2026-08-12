import type { ReactNode } from 'react';
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session-cookie';
import { logoutAction } from '../logout/actions';

const NAV_LINKS = [
  { href: '/', label: 'Command Center' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/approvals', label: 'Approval Center' },
  { href: '/agent-activity', label: 'Agent Activity' },
  { href: '/policies', label: 'Policies' },
];

export default async function AppShellLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          Sinal AI Sales OS
          <div className="brand-sub">Revenue Intelligence</div>
        </div>
        <nav className="nav">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="nav-link">
              {link.label}
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: 'auto' }}>
          {user && (
            <div style={{ padding: '0 8px', marginBottom: 8 }}>
              <div className="field-value">{user.email}</div>
              <div className="brand-sub">{user.role}</div>
            </div>
          )}
          <form action={logoutAction}>
            <button type="submit" className="btn" style={{ width: '100%' }}>
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

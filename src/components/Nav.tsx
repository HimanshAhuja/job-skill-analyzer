import Link from 'next/link';
import { currentUser } from '@/lib/session';
import { signOut } from '@/app/actions';

export default async function Nav() {
  const user = await currentUser();
  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">JS</span> Skill Gap Analyzer
        </Link>
        {user && (
          <nav className="links">
            {user.role === 'student' ? (
              <>
                <Link href="/dashboard">Dashboard</Link>
                <Link href="/resume">Upload resume</Link>
                <Link href="/jobs">Jobs</Link>
                <Link href="/applications">Applications</Link>
              </>
            ) : (
              <Link href="/admin/analytics">Analytics</Link>
            )}
            <span className="who">
              {user.full_name} <em>{user.role}</em>
            </span>
            <form action={signOut}>
              <button className="btn ghost small">Sign out</button>
            </form>
          </nav>
        )}
      </div>
    </header>
  );
}

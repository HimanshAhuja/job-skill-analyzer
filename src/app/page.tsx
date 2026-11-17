import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import LoginForm from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await currentUser();
  if (user) redirect(user.role === 'admin' ? '/admin/analytics' : '/dashboard');

  return (
    <div className="hero">
      <div>
        <h1>Know your skill gap before you apply.</h1>
        <p className="lead">
          Upload your resume and every open job is scored against your skills. See which jobs fit,
          which skills to learn next, and track your applications in one place.
        </p>
        <ul className="ticks">
          <li>Weighted skill matching in PL/pgSQL</li>
          <li>Semantic job search with pgvector embeddings</li>
          <li>Placement-cell analytics on missing skills</li>
        </ul>
      </div>
      <div className="card signin">
        <h2>Sign in</h2>
        <LoginForm />
        <p className="muted small demo-note">
          Demo accounts (password <code>demo123</code>): aarav.sharma@example.com, sneha.iyer@example.com
          (students) · admin@jobskill.example (admin)
        </p>
      </div>
    </div>
  );
}

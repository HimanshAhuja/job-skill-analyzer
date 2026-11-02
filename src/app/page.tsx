import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { currentUser } from '@/lib/session';
import { signIn } from './actions';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await currentUser();
  if (user) redirect(user.role === 'admin' ? '/admin/analytics' : '/dashboard');

  const users = await query<{ user_id: number; full_name: string; email: string; role: string }>(
    'SELECT user_id, full_name, email, role FROM users WHERE is_active ORDER BY role DESC, user_id',
  );

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
        <p className="muted small">Demo accounts from the seed data</p>
        <form action={signIn} className="stack">
          <select name="user_id" defaultValue={users.find((u) => u.role === 'student')?.user_id}>
            {users.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.full_name} ({u.role}) – {u.email}
              </option>
            ))}
          </select>
          <button className="btn">Continue</button>
        </form>
      </div>
    </div>
  );
}

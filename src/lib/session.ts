import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { query } from './db';
import { verifySessionToken } from './auth';

export type User = { user_id: number; full_name: string; email: string; role: 'student' | 'admin' };

/** The signed-in user, read from the signed session cookie (null if absent, tampered or expired). */
export async function currentUser(): Promise<User | null> {
  const id = verifySessionToken((await cookies()).get('session')?.value);
  if (!id) return null;
  const [u] = await query<User>(
    'SELECT user_id, full_name, email, role FROM users WHERE user_id = $1 AND is_active',
    [id],
  );
  return u ?? null;
}

/** Role-based access: redirects to sign-in, or to the user's own home if the role does not match. */
export async function requireUser(role?: User['role']): Promise<User> {
  const u = await currentUser();
  if (!u) redirect('/');
  if (role && u.role !== role) redirect(u.role === 'admin' ? '/admin/analytics' : '/dashboard');
  return u;
}

/** The student's currently active resume (trigger keeps only one active). */
export async function activeResume(userId: number) {
  const [r] = await query<{ resume_id: number; file_name: string; uploaded_at: Date }>(
    'SELECT resume_id, file_name, uploaded_at FROM resumes WHERE user_id = $1 AND is_active',
    [userId],
  );
  return r ?? null;
}

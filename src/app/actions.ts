'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { requireUser } from '@/lib/session';
import { createSessionToken } from '@/lib/auth';

export type SignInState = { error?: string };

/** Email + password login: the password is checked against the bcrypt hash in users.password_hash. */
export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Enter your email and password.' };

  const [u] = await query<{ user_id: number; role: string; password_hash: string; is_active: boolean }>(
    'SELECT user_id, role, password_hash, is_active FROM users WHERE email = $1',
    [email],
  );
  // same message for unknown email and wrong password, so accounts cannot be guessed
  if (!u || !u.is_active || !(await bcrypt.compare(password, u.password_hash)))
    return { error: 'Incorrect email or password.' };

  await query('UPDATE users SET last_login = now() WHERE user_id = $1', [u.user_id]);
  const { token, maxAge } = createSessionToken(u.user_id);
  (await cookies()).set('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });
  redirect(u.role === 'admin' ? '/admin/analytics' : '/dashboard');
}

export async function signOut() {
  (await cookies()).delete('session');
  redirect('/');
}

/** INSERT into applications - trigger trg_applications_job_open rejects closed jobs */
export async function applyToJob(formData: FormData) {
  const u = await requireUser('student');
  const jobId = Number(formData.get('job_id'));
  try {
    await query(
      `INSERT INTO applications (user_id, job_id, notes) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, job_id) DO NOTHING`,
      [u.user_id, jobId, formData.get('notes') || null],
    );
  } catch (e: any) {
    redirect(`/jobs/${jobId}?error=${encodeURIComponent(e.message)}`);
  }
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/applications');
}

/** UPDATE status - trigger trg_applications_touch refreshes last_updated */
export async function updateApplication(formData: FormData) {
  const u = await requireUser('student');
  await query(
    'UPDATE applications SET status = $1, notes = $2 WHERE application_id = $3 AND user_id = $4',
    [formData.get('status'), formData.get('notes') || null, Number(formData.get('application_id')), u.user_id],
  );
  revalidatePath('/applications');
}

export async function deleteApplication(formData: FormData) {
  const u = await requireUser('student');
  await query('DELETE FROM applications WHERE application_id = $1 AND user_id = $2', [
    Number(formData.get('application_id')),
    u.user_id,
  ]);
  revalidatePath('/applications');
}

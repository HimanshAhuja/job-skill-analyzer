'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/session';

export async function signIn(formData: FormData) {
  const id = Number(formData.get('user_id'));
  const [u] = await query<{ role: string }>(
    'UPDATE users SET last_login = now() WHERE user_id = $1 AND is_active RETURNING role',
    [id],
  );
  if (!u) redirect('/');
  (await cookies()).set('uid', String(id), { httpOnly: true, sameSite: 'lax', path: '/' });
  redirect(u.role === 'admin' ? '/admin/analytics' : '/dashboard');
}

export async function signOut() {
  (await cookies()).delete('uid');
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

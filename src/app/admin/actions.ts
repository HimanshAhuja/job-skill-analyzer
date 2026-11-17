'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { pool, query, toVector } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { embed } from '@/lib/embeddings';

const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
const TYPES = ['Full-time', 'Part-time', 'Internship', 'Contract'];

export type JobFormState = { error?: string };

/**
 * Create a job posting with its required skills.
 * 1. job_postings + job_skills are inserted in ONE transaction (all or nothing)
 * 2. the description is embedded and stored in the pgvector column
 * 3. CALL sp_analyze_job scores every active resume against the new job
 */
export async function createJob(_prev: JobFormState, form: FormData): Promise<JobFormState> {
  await requireUser('admin');

  const title = String(form.get('title') ?? '').trim();
  const description = String(form.get('description') ?? '').trim();
  const companyId = Number(form.get('company_id'));
  const type = String(form.get('employment_type'));
  const location = String(form.get('location') ?? '').trim();
  const minExp = Number(form.get('min_experience') || 0);
  const salMin = form.get('salary_min') ? Number(form.get('salary_min')) : null;
  const salMax = form.get('salary_max') ? Number(form.get('salary_max')) : null;

  // required skills: one checkbox per skill + its importance and minimum level
  const skills = form
    .getAll('skill_id')
    .map(Number)
    .map((id) => ({
      id,
      importance: form.get(`importance_${id}`) === 'preferred' ? 'preferred' : 'required',
      level: LEVELS.includes(String(form.get(`level_${id}`))) ? String(form.get(`level_${id}`)) : 'intermediate',
    }));

  // friendly checks; the database CHECK constraints are the final guard
  if (!title || !companyId) return { error: 'Title and company are required.' };
  if (!TYPES.includes(type)) return { error: 'Choose a valid employment type.' };
  if (skills.length === 0) return { error: 'Pick at least one required skill.' };

  const client = await pool.connect();
  let jobId: number;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ job_id: number }>(
      `INSERT INTO job_postings (company_id, title, description, employment_type, location,
                                 min_experience, salary_min, salary_max, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open') RETURNING job_id`,
      [companyId, title, description, type, location, minExp, salMin, salMax],
    );
    jobId = rows[0].job_id;
    for (const s of skills) {
      await client.query(
        'INSERT INTO job_skills (job_id, skill_id, importance, min_proficiency) VALUES ($1, $2, $3, $4)',
        [jobId, s.id, s.importance, s.level],
      );
    }
    await client.query('COMMIT');
  } catch (e: any) {
    await client.query('ROLLBACK');
    client.release();
    return { error: `Not saved: ${e.message}` }; // e.g. CHECK chk_job_salary
  }

  try {
    // embedding text = title + description + skill names (same recipe as scripts/embed-all.mjs)
    const { rows: names } = await client.query<{ skill_name: string }>(
      'SELECT skill_name FROM skills WHERE skill_id = ANY($1::int[]) ORDER BY skill_name',
      [skills.map((s) => s.id)],
    );
    const text = `${title}. ${description} Skills: ${names.map((n) => n.skill_name).join(', ')}`;
    await client.query('UPDATE job_postings SET description_embedding = $1::vector WHERE job_id = $2', [
      toVector(await embed(text)),
      jobId,
    ]);
  } catch (e) {
    console.error('embedding failed, job saved without vector:', e);
  }
  await client.query('CALL sp_analyze_job($1)', [jobId]);
  client.release();

  revalidatePath('/admin/jobs');
  redirect(`/admin/jobs?created=${jobId}`);
}

/** UPDATE status; reopening fires trg_jobs_reopened which recomputes the skill gaps. */
export async function setJobStatus(form: FormData) {
  await requireUser('admin');
  const status = String(form.get('status'));
  if (!['open', 'closed', 'draft'].includes(status)) return;
  await query('UPDATE job_postings SET status = $1 WHERE job_id = $2', [status, Number(form.get('job_id'))]);
  revalidatePath('/admin/jobs');
}

/** DELETE a job; job_skills, analyses, recommendations and applications go with it (ON DELETE CASCADE). */
export async function deleteJob(form: FormData) {
  await requireUser('admin');
  await query('DELETE FROM job_postings WHERE job_id = $1', [Number(form.get('job_id'))]);
  revalidatePath('/admin/jobs');
}

/** INSERT a company (UNIQUE (name, location) prevents duplicates). */
export async function createCompany(_prev: JobFormState, form: FormData): Promise<JobFormState> {
  await requireUser('admin');
  const name = String(form.get('name') ?? '').trim();
  if (!name) return { error: 'Company name is required.' };
  try {
    await query('INSERT INTO companies (name, industry, website, location) VALUES ($1, $2, $3, $4)', [
      name,
      String(form.get('industry') ?? '').trim() || null,
      String(form.get('website') ?? '').trim() || null,
      String(form.get('location') ?? '').trim() || null,
    ]);
  } catch (e: any) {
    return { error: e.code === '23505' ? 'That company already exists in this location.' : e.message };
  }
  revalidatePath('/admin/jobs/new');
  return {};
}

import Link from 'next/link';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/session';
import JobForm from '@/components/JobForm';
import CompanyForm from '@/components/CompanyForm';

export const dynamic = 'force-dynamic';

export default async function NewJob() {
  await requireUser('admin');
  const [companies, skills] = await Promise.all([
    query<{ company_id: number; name: string; location: string }>(
      'SELECT company_id, name, location FROM companies ORDER BY name',
    ),
    query<{ skill_id: number; skill_name: string; category: string }>(
      'SELECT skill_id, skill_name, category FROM skills ORDER BY category, skill_name',
    ),
  ]);

  return (
    <>
      <Link href="/admin/jobs" className="muted small">← All jobs</Link>
      <div className="page-head">
        <div>
          <h1>New job posting</h1>
          <p className="muted">Saved in one transaction, embedded with pgvector, then scored against every student.</p>
        </div>
      </div>
      <div className="grid2">
        <JobForm companies={companies} skills={skills} />
        <CompanyForm />
      </div>
    </>
  );
}

import Link from 'next/link';
import { query } from '@/lib/db';
import { requireUser, activeResume } from '@/lib/session';
import ScoreBar from '@/components/ScoreBar';

export const dynamic = 'force-dynamic';

export default async function Jobs({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser('student');
  const resume = await activeResume(user.user_id);
  const q = ((await searchParams).q ?? '').trim();

  // keyword search uses the GIN full-text index ftx_jobs_text
  const jobs = await query(
    `SELECT j.job_id, j.title, c.name AS company, j.employment_type, j.location,
            j.salary_min, j.salary_max, sga.match_score
     FROM job_postings j
     JOIN companies c ON c.company_id = j.company_id
     LEFT JOIN skill_gap_analysis sga ON sga.job_id = j.job_id AND sga.resume_id = $1
     WHERE j.status = 'open'
       AND ($2 = '' OR to_tsvector('english', j.title || ' ' || coalesce(j.description, ''))
                       @@ plainto_tsquery('english', $2))
     ORDER BY sga.match_score DESC NULLS LAST, j.posted_date DESC`,
    [resume?.resume_id ?? 0, q],
  );

  const lakh = (v: any) => (v ? `₹${(Number(v) / 100000).toFixed(1)} L` : '–');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Open jobs</h1>
          <p className="muted">{jobs.length} open postings, sorted by your match</p>
        </div>
        <form className="search">
          <input name="q" defaultValue={q} placeholder="Search title or description…" />
          <button className="btn">Search</button>
        </form>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr><th>Role</th><th>Type</th><th>Location</th><th>Salary (p.a.)</th><th>Your match</th></tr>
          </thead>
          <tbody>
            {jobs.map((j: any) => (
              <tr key={j.job_id}>
                <td><Link href={`/jobs/${j.job_id}`}><b>{j.title}</b></Link><div className="muted small">{j.company}</div></td>
                <td>{j.employment_type}</td>
                <td>{j.location}</td>
                <td>{lakh(j.salary_min)} – {lakh(j.salary_max)}</td>
                <td><ScoreBar value={j.match_score} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

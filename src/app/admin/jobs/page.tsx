import Link from 'next/link';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { setJobStatus, deleteJob } from '@/app/admin/actions';
import ScoreBar from '@/components/ScoreBar';

export const dynamic = 'force-dynamic';

type Row = {
  job_id: number; title: string; company: string; employment_type: string; location: string;
  status: string; skills: string; applicants: string; avg_match: string | null; embedded: boolean;
};

export default async function ManageJobs({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  await requireUser('admin');
  const { created } = await searchParams;
  // one row per job from the view v_job_admin_overview (db/07_job_admin.sql)
  const jobs = await query<Row>('SELECT * FROM v_job_admin_overview ORDER BY status, posted_date DESC, job_id DESC');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Manage jobs</h1>
          <p className="muted">{jobs.filter((j) => j.status === 'open').length} open · {jobs.length} total</p>
        </div>
        <Link className="btn" href="/admin/jobs/new">New job</Link>
      </div>
      {created && (
        <p className="notice">
          Job #{created} created, embedded and scored against every active resume (CALL sp_analyze_job).
        </p>
      )}
      <div className="card">
        <table>
          <thead>
            <tr><th>Job</th><th>Type</th><th>Skills</th><th>Applicants</th><th>Avg match</th><th>Vector</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.job_id}>
                <td><b>{j.title}</b><div className="muted small">{j.company} · {j.location}</div></td>
                <td>{j.employment_type}</td>
                <td>{j.skills}</td>
                <td>{j.applicants}</td>
                <td><ScoreBar value={j.avg_match} /></td>
                <td>{j.embedded ? <span className="ok">✓</span> : <span className="muted">–</span>}</td>
                <td>
                  <form action={setJobStatus} className="row">
                    <input type="hidden" name="job_id" value={j.job_id} />
                    <select name="status" defaultValue={j.status} className={`st ${j.status}`}>
                      <option value="open">open</option>
                      <option value="closed">closed</option>
                      <option value="draft">draft</option>
                    </select>
                    <button className="btn small">Save</button>
                  </form>
                </td>
                <td>
                  <form action={deleteJob}>
                    <input type="hidden" name="job_id" value={j.job_id} />
                    <button className="btn ghost small">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          Reopening a job fires trigger trg_jobs_reopened, which recomputes every student's skill gap for it.
          Deleting a job also deletes its skills, analyses and applications (ON DELETE CASCADE).
        </p>
      </div>
    </>
  );
}

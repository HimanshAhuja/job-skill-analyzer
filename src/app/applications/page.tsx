import Link from 'next/link';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { updateApplication, deleteApplication } from '@/app/actions';

export const dynamic = 'force-dynamic';

const STATUSES = ['applied', 'under_review', 'interviewing', 'offer', 'rejected', 'accepted', 'withdrawn'];

export default async function Applications() {
  const user = await requireUser('student');
  const apps = await query(
    `SELECT a.application_id, a.status, a.applied_date, a.last_updated, a.notes,
            j.job_id, j.title, c.name AS company
     FROM applications a
     JOIN job_postings j ON j.job_id = a.job_id
     JOIN companies c ON c.company_id = j.company_id
     WHERE a.user_id = $1
     ORDER BY a.last_updated DESC`,
    [user.user_id],
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My applications</h1>
          <p className="muted">{apps.length} tracked · last updated is set by a database trigger</p>
        </div>
      </div>
      <div className="card">
        {apps.length === 0 && <p className="muted">No applications yet – find a job on the Jobs page.</p>}
        <table>
          <thead>
            <tr><th>Job</th><th>Applied</th><th>Status &amp; note</th><th>Last updated</th><th></th></tr>
          </thead>
          <tbody>
            {apps.map((a: any) => (
              <tr key={a.application_id}>
                <td><Link href={`/jobs/${a.job_id}`}><b>{a.title}</b></Link><div className="muted small">{a.company}</div></td>
                <td>{new Date(a.applied_date).toLocaleDateString('en-IN')}</td>
                <td>
                  <form action={updateApplication} className="row" key={`${a.status}-${a.last_updated}`}>
                    <input type="hidden" name="application_id" value={a.application_id} />
                    <select name="status" defaultValue={a.status} className={`st ${a.status}`}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                    <input name="notes" defaultValue={a.notes ?? ''} placeholder="note" />
                    <button className="btn small">Save</button>
                  </form>
                </td>
                <td className="small">{new Date(a.last_updated).toLocaleString('en-IN')}</td>
                <td>
                  <form action={deleteApplication}>
                    <input type="hidden" name="application_id" value={a.application_id} />
                    <button className="btn ghost small">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

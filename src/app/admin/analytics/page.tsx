import { query } from '@/lib/db';
import { requireUser } from '@/lib/session';
import ScoreBar from '@/components/ScoreBar';

export const dynamic = 'force-dynamic';

export default async function Analytics() {
  await requireUser('admin');

  const [missing, companies, pipeline, [totals]] = await Promise.all([
    query('SELECT skill_name, category, times_missing FROM v_top_missing_skills LIMIT 10'),
    query(
      `SELECT c.name AS company, COUNT(DISTINCT j.job_id) AS open_jobs,
              ROUND(AVG(sga.match_score), 2) AS avg_match, MAX(sga.match_score) AS best_match
       FROM companies c
       JOIN job_postings j ON j.company_id = c.company_id AND j.status = 'open'
       JOIN skill_gap_analysis sga ON sga.job_id = j.job_id
       JOIN resumes r ON r.resume_id = sga.resume_id AND r.is_active
       GROUP BY c.name ORDER BY avg_match DESC`,
    ),
    query('SELECT status, COUNT(*) AS n FROM applications GROUP BY status ORDER BY n DESC, status'),
    query(
      `SELECT (SELECT COUNT(*) FROM users WHERE role = 'student') AS students,
              (SELECT COUNT(*) FROM job_postings WHERE status = 'open') AS open_jobs,
              (SELECT COUNT(*) FROM skill_gap_analysis) AS analyses,
              (SELECT COUNT(*) FROM applications) AS applications`,
    ),
  ]);
  const max = Math.max(...missing.map((m: any) => Number(m.times_missing)), 1);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Placement analytics</h1>
          <p className="muted">Where the student body falls short of what employers ask for</p>
        </div>
      </div>
      <div className="tiles">
        <div className="tile"><span>Students</span><b>{totals.students}</b></div>
        <div className="tile"><span>Open jobs</span><b>{totals.open_jobs}</b></div>
        <div className="tile"><span>Gap analyses</span><b>{totals.analyses}</b></div>
        <div className="tile"><span>Applications</span><b>{totals.applications}</b></div>
      </div>
      <div className="grid2">
        <section className="card">
          <h2>Most commonly missing skills</h2>
          <div className="bars">
            {missing.map((m: any) => (
              <div className="bar-row" key={m.skill_name}>
                <span className="bar-label">{m.skill_name}<small>{m.category}</small></span>
                <span className="bar"><span style={{ width: `${(100 * Number(m.times_missing)) / max}%` }} /></span>
                <b>{m.times_missing}</b>
              </div>
            ))}
          </div>
        </section>
        <div className="stack">
          <section className="card">
            <h2>Match quality by company</h2>
            <table>
              <thead><tr><th>Company</th><th>Open jobs</th><th>Avg match</th><th>Best</th></tr></thead>
              <tbody>
                {companies.map((c: any) => (
                  <tr key={c.company}>
                    <td>{c.company}</td><td>{c.open_jobs}</td>
                    <td><ScoreBar value={c.avg_match} /></td><td>{Number(c.best_match).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="card">
            <h2>Application pipeline</h2>
            <div className="chips">
              {pipeline.map((p: any) => (
                <span key={p.status} className={`chip st ${p.status}`}>{p.status.replace('_', ' ')} <small>{p.n}</small></span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

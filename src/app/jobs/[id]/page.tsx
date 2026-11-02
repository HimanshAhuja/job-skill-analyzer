import { notFound } from 'next/navigation';
import Link from 'next/link';
import { query } from '@/lib/db';
import { requireUser, activeResume } from '@/lib/session';
import { applyToJob } from '@/app/actions';
import ScoreBar from '@/components/ScoreBar';

export const dynamic = 'force-dynamic';

export default async function JobDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser('student');
  const jobId = Number((await params).id);
  const { error } = await searchParams;
  const resume = await activeResume(user.user_id);
  const rid = resume?.resume_id ?? 0;

  const [job] = await query(
    `SELECT j.*, c.name AS company, c.industry FROM job_postings j
     JOIN companies c ON c.company_id = j.company_id WHERE j.job_id = $1`,
    [jobId],
  );
  if (!job) notFound();

  const [skills, [gap], recs, [app]] = await Promise.all([
    // requirement vs what the resume has (same rule as fn_compute_skill_gap)
    query(
      `SELECT s.skill_name, js.importance, js.min_proficiency, rs.proficiency AS have,
              (rs.skill_id IS NOT NULL AND fn_prof_rank(rs.proficiency) >= fn_prof_rank(js.min_proficiency)) AS ok
       FROM job_skills js
       JOIN skills s ON s.skill_id = js.skill_id
       LEFT JOIN resume_skills rs ON rs.skill_id = js.skill_id AND rs.resume_id = $2
       WHERE js.job_id = $1
       ORDER BY js.importance DESC, s.skill_name`,
      [jobId, rid],
    ),
    query('SELECT * FROM skill_gap_analysis WHERE job_id = $1 AND resume_id = $2', [jobId, rid]),
    query(
      `SELECT s.skill_name, sr.priority, sr.reason FROM skill_recommendations sr
       JOIN skill_gap_analysis sga ON sga.analysis_id = sr.analysis_id
       JOIN skills s ON s.skill_id = sr.skill_id
       WHERE sga.job_id = $1 AND sga.resume_id = $2 ORDER BY sr.priority, s.skill_name`,
      [jobId, rid],
    ),
    query('SELECT status, applied_date FROM applications WHERE job_id = $1 AND user_id = $2', [
      jobId,
      user.user_id,
    ]),
  ]);

  return (
    <>
      <Link href="/jobs" className="muted small">← All jobs</Link>
      <div className="page-head">
        <div>
          <h1>{job.title}</h1>
          <p className="muted">
            {job.company} · {job.industry} · {job.location} · {job.employment_type} · {Number(job.min_experience)}+ yrs
          </p>
        </div>
        {gap && <div className="big-score"><ScoreBar value={gap.match_score} /><span className="muted small">your match</span></div>}
      </div>
      {error && <p className="alert">{error}</p>}

      <div className="grid2">
        <section className="card">
          <h2>Skill requirements</h2>
          <p>{job.description}</p>
          <table>
            <thead><tr><th>Skill</th><th>Importance</th><th>Needed</th><th>You have</th><th></th></tr></thead>
            <tbody>
              {skills.map((s: any) => (
                <tr key={s.skill_name}>
                  <td>{s.skill_name}</td>
                  <td>{s.importance}</td>
                  <td><span className={`lvl ${s.min_proficiency}`}>{s.min_proficiency}</span></td>
                  <td>{s.have ? <span className={`lvl ${s.have}`}>{s.have}</span> : <span className="muted">–</span>}</td>
                  <td className={s.ok ? 'ok' : 'no'}>{s.ok ? '✓' : '✗'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2>Your gap</h2>
          {gap ? (
            <p className="muted">
              {gap.matched_skills_count} matched · {gap.missing_skills_count} to work on
            </p>
          ) : (
            <p className="muted">Upload a resume to see your gap.</p>
          )}
          <ol className="recs">
            {recs.map((r: any) => (
              <li key={r.skill_name} className={`p${r.priority}`}>
                <b>{r.skill_name}</b> <span className="muted small">{r.reason}</span>
              </li>
            ))}
          </ol>
          <div className="apply">
            {app ? (
              <p>Applied on {new Date(app.applied_date).toLocaleDateString('en-IN')} – status <b>{app.status}</b></p>
            ) : (
              <form action={applyToJob} className="stack">
                <input type="hidden" name="job_id" value={jobId} />
                <input name="notes" placeholder="Note for yourself (optional)" />
                <button className="btn">Apply for this job</button>
              </form>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

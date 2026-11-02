import Link from 'next/link';
import { query } from '@/lib/db';
import { requireUser, activeResume } from '@/lib/session';
import ScoreBar from '@/components/ScoreBar';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const user = await requireUser('student');
  const resume = await activeResume(user.user_id);

  if (!resume)
    return (
      <div className="card empty">
        <h1>Welcome, {user.full_name}</h1>
        <p>Upload your resume to see your job matches and skill gaps.</p>
        <Link className="btn" href="/resume">Upload resume</Link>
      </div>
    );

  const [matches, semantic, toLearn, [stats]] = await Promise.all([
    // skill-based ranking (view v_job_recommendations)
    query(
      `SELECT job_id, title, company, match_score, missing_skills_count
       FROM v_job_recommendations WHERE resume_id = $1 ORDER BY match_score DESC LIMIT 5`,
      [resume.resume_id],
    ),
    // meaning-based ranking (pgvector cosine distance inside fn_recommend_jobs)
    query('SELECT * FROM fn_recommend_jobs($1, 5)', [resume.resume_id]),
    // most valuable skills to learn across all open jobs
    query(
      `SELECT s.skill_name, s.category, COUNT(*) AS jobs, MIN(sr.priority) AS priority
       FROM skill_recommendations sr
       JOIN skill_gap_analysis sga ON sga.analysis_id = sr.analysis_id
       JOIN job_postings j ON j.job_id = sga.job_id AND j.status = 'open'
       JOIN skills s ON s.skill_id = sr.skill_id
       WHERE sga.resume_id = $1
       GROUP BY s.skill_name, s.category
       ORDER BY MIN(sr.priority), COUNT(*) DESC, s.skill_name LIMIT 8`,
      [resume.resume_id],
    ),
    query(
      `SELECT COUNT(*) AS analysed, MAX(match_score) AS best,
              (SELECT COUNT(*) FROM applications WHERE user_id = $2) AS applications,
              (SELECT COUNT(*) FROM resume_skills WHERE resume_id = $1) AS skills
       FROM skill_gap_analysis WHERE resume_id = $1`,
      [resume.resume_id, user.user_id],
    ),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hi {user.full_name.split(' ')[0]}</h1>
          <p className="muted">
            Active resume: <b>{resume.file_name}</b>
          </p>
        </div>
        <Link className="btn ghost" href="/resume">Upload new version</Link>
      </div>

      <div className="tiles">
        <div className="tile"><span>Skills on resume</span><b>{stats.skills}</b></div>
        <div className="tile"><span>Jobs analysed</span><b>{stats.analysed}</b></div>
        <div className="tile"><span>Best match</span><b>{Number(stats.best ?? 0).toFixed(0)}%</b></div>
        <div className="tile"><span>Applications</span><b>{stats.applications}</b></div>
      </div>

      <div className="grid2">
        <section className="card">
          <h2>Top matches by skills</h2>
          <table>
            <thead><tr><th>Job</th><th>Match</th><th>Missing</th></tr></thead>
            <tbody>
              {matches.map((m: any) => (
                <tr key={m.job_id}>
                  <td><Link href={`/jobs/${m.job_id}`}>{m.title}</Link><div className="muted small">{m.company}</div></td>
                  <td><ScoreBar value={m.match_score} /></td>
                  <td>{m.missing_skills_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2>Similar by meaning <span className="pill">pgvector</span></h2>
          {semantic.length === 0 ? (
            <p className="muted">No embeddings yet – run <code>npm run embed</code>.</p>
          ) : (
            <table>
              <thead><tr><th>Job</th><th>Similarity</th><th>Skill match</th></tr></thead>
              <tbody>
                {semantic.map((s: any) => (
                  <tr key={s.job_id}>
                    <td><Link href={`/jobs/${s.job_id}`}>{s.title}</Link><div className="muted small">{s.company}</div></td>
                    <td><b>{Number(s.semantic_similarity).toFixed(3)}</b></td>
                    <td><ScoreBar value={s.match_score} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Skills to learn next</h2>
        <div className="chips">
          {toLearn.map((t: any) => (
            <span key={t.skill_name} className={`chip p${t.priority}`}>
              {t.skill_name}
              <small>{t.jobs} job{Number(t.jobs) > 1 ? 's' : ''}</small>
            </span>
          ))}
        </div>
        <p className="muted small">Red = required skill you don’t have · amber = level too low · grey = nice to have</p>
      </section>
    </>
  );
}

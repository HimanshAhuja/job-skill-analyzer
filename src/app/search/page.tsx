import Link from 'next/link';
import { requireUser, activeResume } from '@/lib/session';
import { semanticJobSearch, searchFilters, type SemanticHit } from '@/lib/vector-search';
import ScoreBar from '@/components/ScoreBar';

export const dynamic = 'force-dynamic';

type Params = { q?: string; type?: string; location?: string; rank?: string };

export default async function SemanticSearch({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireUser('student');
  const resume = await activeResume(user.user_id);
  const { q = '', type = '', location = '', rank = 'meaning' } = await searchParams;
  const rankBy = rank === 'hybrid' ? 'hybrid' : 'meaning';
  const filters = await searchFilters();

  let hits: SemanticHit[] = [];
  let error = '';
  if (q.trim()) {
    try {
      hits = await semanticJobSearch({ text: q.trim(), resumeId: resume?.resume_id ?? 0, type, location, rank: rankBy });
    } catch (e: any) {
      error = `Semantic search is unavailable: ${e.message}`;
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Semantic job search <span className="pill">pgvector</span></h1>
          <p className="muted">Describe the job you want in your own words – results are ranked by meaning, not keywords.</p>
        </div>
      </div>

      <form className="card filters">
        <input name="q" defaultValue={q} placeholder="e.g. web backend developer who writes Python APIs" />
        <select name="type" defaultValue={type}>
          <option value="">Any type</option>
          {filters.types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select name="location" defaultValue={location}>
          <option value="">Any location</option>
          {filters.locations.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select name="rank" defaultValue={rankBy}>
          <option value="meaning">Rank by meaning</option>
          <option value="hybrid">Rank by meaning + my skills</option>
        </select>
        <button className="btn">Search</button>
      </form>

      {error && <p className="alert">{error}</p>}

      {q && !error && (
        <div className="card">
          <h2>Top {hits.length} matches for “{q}”</h2>
          {hits.length === 0 ? (
            <p className="muted">No open jobs match these filters.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Rank</th><th>Job</th><th>Type</th><th>Location</th><th>Similarity</th><th>Your skill match</th>{rankBy === 'hybrid' && <th>Hybrid</th>}</tr>
              </thead>
              <tbody>
                {hits.map((h, i) => (
                  <tr key={h.job_id}>
                    <td>{i + 1}</td>
                    <td><Link href={`/jobs/${h.job_id}`}><b>{h.title}</b></Link><div className="muted small">{h.company}</div></td>
                    <td>{h.employment_type}</td>
                    <td>{h.location}</td>
                    <td className="sim">{Number(h.similarity).toFixed(3)}</td>
                    <td><ScoreBar value={h.match_score} /></td>
                    {rankBy === 'hybrid' && <td className="sim">{Number(h.hybrid_score).toFixed(3)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="muted small">
            Similarity = 1 − cosine distance between the embedding of your text and each job description.
            {rankBy === 'hybrid' && ' Hybrid = 0.6 × skill match + 0.4 × similarity.'}
          </p>
        </div>
      )}
    </>
  );
}

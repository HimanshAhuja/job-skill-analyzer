import { query, toVector } from './db';
import { embed } from './embeddings';

export type SemanticHit = {
  job_id: number;
  title: string;
  company: string;
  employment_type: string;
  location: string;
  similarity: string;
  match_score: string | null;
};

/**
 * Retrieval strategy for free-text job search:
 *  1. the query text is embedded with the same model as the job descriptions (all-MiniLM-L6-v2, 384-d)
 *  2. metadata filters (status, employment type, location) are applied in the WHERE clause
 *  3. open jobs are ranked by cosine distance (<=>), served by the HNSW index, top k returned
 *  4. the student's skill-based match score is joined in, so meaning and skills are shown side by side
 */
export async function semanticJobSearch(opts: {
  text: string;
  resumeId: number;
  type?: string;
  location?: string;
  k?: number;
}): Promise<SemanticHit[]> {
  const vec = toVector(await embed(opts.text));
  return query<SemanticHit>(
    `SELECT j.job_id, j.title, c.name AS company, j.employment_type, j.location,
            ROUND((1 - (j.description_embedding <=> $1::vector))::numeric, 3) AS similarity,
            sga.match_score
     FROM job_postings j
     JOIN companies c ON c.company_id = j.company_id
     LEFT JOIN skill_gap_analysis sga ON sga.job_id = j.job_id AND sga.resume_id = $2
     WHERE j.status = 'open'
       AND j.description_embedding IS NOT NULL
       AND ($3 = '' OR j.employment_type = $3)
       AND ($4 = '' OR j.location = $4)
     ORDER BY j.description_embedding <=> $1::vector
     LIMIT $5`,
    [vec, opts.resumeId, opts.type ?? '', opts.location ?? '', opts.k ?? 5],
  );
}

/** Distinct values for the filter dropdowns. */
export async function searchFilters() {
  const [types, locations] = await Promise.all([
    query<{ v: string }>(`SELECT DISTINCT employment_type AS v FROM job_postings WHERE status = 'open' ORDER BY 1`),
    query<{ v: string }>(`SELECT DISTINCT location AS v FROM job_postings WHERE status = 'open' ORDER BY 1`),
  ]);
  return { types: types.map((t) => t.v), locations: locations.map((l) => l.v) };
}

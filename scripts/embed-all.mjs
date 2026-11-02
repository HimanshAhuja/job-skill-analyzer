// Generates pgvector embeddings for every job posting and resume that has none yet.
// Usage:  DATABASE_URL=postgresql://... node scripts/embed-all.mjs
import path from 'node:path';
import pg from 'pg';
import { pipeline, env } from '@huggingface/transformers';

env.localModelPath = path.join(process.cwd(), 'models') + path.sep;
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'fp32' });
const embed = async (text) =>
  `[${Array.from((await extractor(text, { pooling: 'mean', normalize: true })).data).join(',')}]`;

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const jobs = await db.query(
  `SELECT j.job_id, j.title || '. ' || coalesce(j.description, '') || ' Skills: ' ||
          coalesce(string_agg(s.skill_name, ', '), '') AS text
   FROM job_postings j
   LEFT JOIN job_skills js ON js.job_id = j.job_id
   LEFT JOIN skills s ON s.skill_id = js.skill_id
   WHERE j.description_embedding IS NULL
   GROUP BY j.job_id`,
);
for (const j of jobs.rows)
  await db.query('UPDATE job_postings SET description_embedding = $1::vector WHERE job_id = $2', [await embed(j.text), j.job_id]);

const resumes = await db.query(
  `SELECT resume_id, coalesce(parsed_text, file_name) AS text FROM resumes WHERE resume_embedding IS NULL`,
);
for (const r of resumes.rows)
  await db.query('UPDATE resumes SET resume_embedding = $1::vector WHERE resume_id = $2', [await embed(r.text), r.resume_id]);

console.log(`embedded ${jobs.rowCount} job postings and ${resumes.rowCount} resumes`);
await db.end();

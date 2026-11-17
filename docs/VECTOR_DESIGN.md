# Vector Database Design (pgvector)

Owner: Abhishek Kumar Singh (PES2UG24CS026)

## Why a vector database

Resumes and job descriptions are free text. Exact skill matching (PL/pgSQL, `fn_compute_skill_gap`) only
sees skills from the catalogue; it cannot tell that "REST APIs in Django" and "Python web backend" mean
nearly the same thing. Embeddings capture that meaning, so we store them in PostgreSQL with the pgvector
extension, next to the relational data they describe.

## Data model

| Table | Column | Type | What it holds |
| --- | --- | --- | --- |
| `resumes` | `resume_embedding` | `VECTOR(384)` | Embedding of the parsed resume text |
| `job_postings` | `description_embedding` | `VECTOR(384)` | Embedding of title + description + required skills |

Metadata used with the vectors (same rows, no duplication): `job_postings.status`, `employment_type`,
`location`, `company_id`; `resumes.user_id`, `is_active`.

## Embedding model

- Model: `all-MiniLM-L6-v2` (sentence-transformers), run locally with Transformers.js / ONNX Runtime.
- Output: 384 numbers, mean-pooled and L2-normalised (every vector has length 1).
- Where it runs: `src/lib/embeddings.ts` (resume upload, search queries) and `scripts/embed-all.mjs`
  (bulk fill for seed data). No text is sent to an external API.

## Index and metric

```sql
CREATE INDEX hnsw_jobs_embedding    ON job_postings USING hnsw (description_embedding vector_cosine_ops);
CREATE INDEX hnsw_resumes_embedding ON resumes      USING hnsw (resume_embedding vector_cosine_ops);
```

- Metric: cosine distance, operator `<=>` (0 = same direction). Similarity shown to users = `1 - distance`.
- HNSW gives approximate nearest-neighbour search without scanning every row; `EXPLAIN` in
  `db/05_vector.sql` shows the planner using it.

## Retrieval strategy

1. Embed the query text (free-text search) or take the student's `resume_embedding` (recommendations).
2. Filter on metadata in the same query: `status = 'open'`, optional `employment_type` and `location`.
3. Rank by `description_embedding <=> query_vector` and return the top k (default 5).
4. Join `skill_gap_analysis` so each hit also shows the student's skill-based match score.
5. Optional **hybrid ranking** (search page, "Rank by meaning + my skills"):

```sql
hybrid_score = 0.6 * match_score / 100 + 0.4 * (1 - (description_embedding <=> query_vector))
```

Example (student Aarav, query "data analysis with Python"):

| Rank | By meaning only | Similarity | By hybrid score | Hybrid |
| --- | --- | --- | --- | --- |
| 1 | Data Analyst Intern | 0.474 | Backend Developer | 0.497 |
| 2 | ML Engineer | 0.244 | Data Analyst Intern | 0.456 |
| 3 | Backend Developer | 0.243 | Java Developer | 0.299 |

Hybrid ranking lifts jobs the student is already qualified for, while meaning-only ranking follows the
wording of the query.

## Where it is used

| Feature | Code |
| --- | --- |
| Semantic job search page with filters and hybrid ranking | `src/app/search/page.tsx`, `src/lib/vector-search.ts` |
| "Similar by meaning" on the dashboard | `fn_recommend_jobs` in `db/02_plpgsql.sql` |
| Vector commands and examples | `db/05_vector.sql` |
| Tests A05, A06 | `docs/TESTING.md` |

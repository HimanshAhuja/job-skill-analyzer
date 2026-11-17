# AI-Powered Job & Skill Gap Analyzer

Students upload a resume; the system compares it with every stored job posting, computes a skill gap per job,
recommends jobs and skills to learn, tracks applications and shows analytics on the most commonly missing skills.

DBMS Level 3 Project (UE24CS351A) – Option 2: **SQL + vector database** (PostgreSQL + pgvector), **Next.js** web app.

## Team

| Member | SRN | Responsibilities |
| --- | --- | --- |
| Himansh Ahuja | PES2UG24CS923 | Relational database design (ER, schema, DDL), PL/pgSQL functions, procedure and triggers, sample data and SQL queries, resume-upload API, student pages, authentication and security |
| Abhishek Kumar Singh | PES2UG24CS026 | Vector database (pgvector columns, HNSW indexes, embedding pipeline, vector queries), semantic job search with hybrid ranking, admin job management (procedure, trigger, view, pages), admin analytics, testing, documentation |

## Tech stack

Next.js 15 (App Router, TypeScript) · PostgreSQL 16 + pgvector 0.8 · node-postgres · bcryptjs ·
Transformers.js (all-MiniLM-L6-v2, 384-d embeddings) · pdf-parse

## Run it (only Node.js 20+ needed)

Terminal 1 – start PostgreSQL with pgvector (PGlite build, no installation) and leave it running:

    npm install
    npm run db:start

Terminal 2:

    cp .env.example .env          # sets DATABASE_URL and SESSION_SECRET
    npm run db:init               # runs db/01_ddl.sql, 02_plpgsql.sql, 03_dml.sql
    npm run embed                 # embeddings for jobs and resumes (downloads the model once)
    npm run dev                   # http://localhost:3000

Using Docker or a hosted PostgreSQL with pgvector instead: put its connection string in `DATABASE_URL`
and skip `npm run db:start`. Database credentials and the session secret come only from `.env`.

## Sign in

Passwords are stored as bcrypt hashes; sessions use an HMAC-signed, http-only cookie.

| Role | Email | Password |
| --- | --- | --- |
| Student | aarav.sharma@example.com | demo123 |
| Student | sneha.iyer@example.com | demo123 |
| Admin | admin@jobskill.example | demo123 |

## Features

- **Student:** dashboard (skill matches + semantic matches + skills to learn), resume upload (PDF → skills →
  embedding → `CALL sp_analyze_resume`), job board with full-text search, semantic job search with filters,
  job detail with skill-by-skill gap, application tracker.
- **Admin:** analytics on most commonly missing skills, match quality per company, application pipeline;
  job management – create jobs with required skills (one transaction + embedding + `CALL sp_analyze_job`),
  add companies, close/reopen (trigger recomputes gaps) and delete jobs (cascade).

## Database files

| File | Contents |
| --- | --- |
| `db/01_ddl.sql` | 11 tables, keys, constraints, indexes (B-tree, GIN full-text, HNSW), views, ALTER, DROP |
| `db/02_plpgsql.sql` | `fn_compute_skill_gap`, `sp_analyze_resume`, `fn_recommend_jobs`, 4 triggers |
| `db/03_dml.sql` | Sample data |
| `db/04_queries.sql` | GROUP BY/HAVING, UPDATE, DELETE, correlated and nested queries |
| `db/05_vector.sql` | pgvector commands: operators, semantic search, hybrid ranking, EXPLAIN |
| `db/06_tests.sql` | Database test cases (constraints, triggers, transaction, cascade) |
| `db/07_job_admin.sql` | `sp_analyze_job` procedure, `trg_jobs_reopened` trigger, `v_job_admin_overview` view |

## Testing

11 database tests, 9 application tests and 8 admin tests, all passing – see [docs/TESTING.md](docs/TESTING.md).

## Demo flow

1. Sign in as Aarav → Dashboard → Jobs (search "python") → open a job → Apply.
2. Semantic search: "web backend developer who writes Python APIs" → Backend Developer ranks first.
3. Applications → change a status (a trigger updates `last_updated`).
4. Sign in as Sneha → Upload `public/sample-resume.pdf` → Java Developer match goes from 67% to 100%.
5. Sign in as admin → Analytics → Manage jobs → New job (it is scored against every student immediately).

Reset the demo data at any time with `npm run db:init` followed by `npm run embed`.

# Demo Guide and Architecture – AI-Powered Job & Skill Gap Analyzer

DBMS Mini Project (UE24CS351A) – Himansh Ahuja (PES2UG24CS923), Abhishek Kumar Singh (PES2UG24CS026)

## Before the demo

Start the app and reset the data 10 minutes before presenting, so every number on screen matches the report.

1. Terminal tab 1 – start the database and leave it running:
   - `cd ~/Downloads/job-skill-analyzer`
   - `npm run db:start` (wait for "listening on port 5432")
2. Terminal tab 2 – reset the demo data and start the app:
   - `npm run db:init` (ends with "Database ready: 8 jobs, 5 resumes, 28 analyses")
   - `npm run embed` (ends with "embedded 8 job postings and 5 resumes")
   - `npm run dev`
3. Open http://localhost:3000 and zoom to 110–125%.
4. Keep `db/01_ddl.sql`, `db/02_plpgsql.sql` and the report (Chapters 4 and 5) open in case SQL is asked for.
5. The demo resume is `public/sample-resume.pdf`.

**Time plan (about 8 minutes):** introduction 1 min · student flow 4 min · resume upload 1.5 min · admin analytics 1 min · questions after.

## Demo script

1. **Introduction (home page)**
   - Say: "Students upload a resume, and our system compares it with every stored job posting. For each job it computes a skill gap, recommends jobs and skills to learn, tracks applications, and shows analytics on the most commonly missing skills. Everything runs on PostgreSQL with the pgvector extension, and the web app is built with Next.js."
2. **Student dashboard** – sign in as Aarav Sharma.
   - Say: "The left table is the skill match, computed inside the database by our PL/pgSQL function: required skills count double, and a skill only counts if the level is high enough. The right table ranks jobs by meaning, using AI embeddings stored in pgvector and cosine distance. At the bottom are the skills to learn next."
3. **Job board and search** – click Jobs, search "python".
   - Say: "The list is sorted by match score. Search uses PostgreSQL full-text search on a GIN index."
4. **Job detail and apply** – open Data Analyst Intern, click Apply.
   - Say: "This is the gap skill by skill. Applying inserts a row into applications; a BEFORE INSERT trigger first checks that the job is still open."
5. **Application tracker** – change a status, click Save.
   - Say: "Last updated is never set by the app. A BEFORE UPDATE trigger sets it on every change."
6. **Resume upload** – sign in as Sneha Iyer, note Java Developer at 67%, upload `public/sample-resume.pdf`.
   - Say: "The PDF is parsed, 8 skills are found with their levels, the resume is saved in one transaction, its embedding is stored in pgvector, and the stored procedure sp_analyze_resume re-analyses every open job. A trigger archives her older resume."
   - Open the dashboard: Java Developer is now 100%.
7. **Placement-cell analytics** – sign in as Placement Admin.
   - Say: "The bar chart comes from the view v_top_missing_skills: Docker tops the list, so that is the training to run. Next to it are the average match per company and the application pipeline, from GROUP BY queries."
8. **Close**
   - Say: "The database does the real work: 11 normalised tables, constraints, a stored procedure, functions, 4 triggers, views and vector search, with a Next.js front end on top."

## How the system works

Three layers: the browser shows pages, the Next.js server handles every request, and PostgreSQL stores everything and does the scoring. The browser never talks to the database directly.

```
Browser (React 19 pages)
   │  pages        │  form submits      │  PDF upload
   ▼               ▼                    ▼
┌──────────────────── Next.js 15 server (Node.js) ─────────────────────┐
│ Server components   Server actions    Route handler ──► AI helpers   │
│ (SELECT for pages)  (apply, update,   POST /api/resume  pdf-parse,   │
│                      delete)                            MiniLM-L6-v2 │
│            └──────────────┴───────────────┴──────────────┘           │
│                 node-postgres connection pool (src/lib/db.ts)        │
└──────────────────────────────────┬────────────────────────────────────┘
                                   │ SQL, CALL, vector search
┌──────────────────── PostgreSQL 16 + pgvector ─────────────────────────┐
│ 11 relational tables   PL/pgSQL: fn_compute_skill_gap,   VECTOR(384)  │
│ PK, FK, CHECK, UNIQUE  sp_analyze_resume, 4 triggers,    HNSW index,  │
│                        2 views                           cosine <=>   │
└────────────────────────────────────────────────────────────────────────┘
```

Uploaded PDF files are the only thing kept outside the database, in `uploads/`; the database stores their path.

## Frontend

Next.js 15 (App Router), React 19 and TypeScript. Every folder under `src/app` is a page URL. Most pages are **server components**: they run SQL on the server and send finished HTML, so no query or database password reaches the browser. Only the upload page is a **client component**.

| Page (URL) | Who | What it shows | File |
| --- | --- | --- | --- |
| Sign in ( / ) | Everyone | Demo account picker; user id in a cookie | `src/app/page.tsx` |
| Dashboard ( /dashboard ) | Student | Tiles, skill matches, semantic matches, skills to learn | `src/app/dashboard/page.tsx` |
| Upload resume ( /resume ) | Student | PDF upload and the skills found | `src/app/resume/page.tsx` |
| Jobs ( /jobs ) | Student | Open jobs, full-text search, match score | `src/app/jobs/page.tsx` |
| Job detail ( /jobs/[id] ) | Student | Skill-by-skill gap, recommendations, Apply | `src/app/jobs/[id]/page.tsx` |
| Applications ( /applications ) | Student | Status tracker, Save, Delete | `src/app/applications/page.tsx` |
| Analytics ( /admin/analytics ) | Admin | Missing skills, match per company, pipeline | `src/app/admin/analytics/page.tsx` |

## Backend

The backend runs inside the same Next.js server. It uses one node-postgres (`pg`) pool in `src/lib/db.ts`, always with parameterised queries (`$1, $2`), which prevents SQL injection.

| Mechanism | Used for | File |
| --- | --- | --- |
| Server components | SELECTs while rendering pages | `src/app/*/page.tsx` |
| Server actions | Sign in, apply, update status, delete | `src/app/actions.ts` |
| Route handler | `POST /api/resume` – resume upload | `src/app/api/resume/route.ts` |

**Resume upload, step by step**

1. The PDF is saved to `uploads/<user id>/` and its text is extracted with pdf-parse.
2. `src/lib/skills.ts` matches the text against the 18 catalogue skills (whole words only) and reads the level and years next to each skill, e.g. "Java (advanced, 2 yrs)".
3. One transaction: INSERT into `resumes`, one INSERT per skill into `resume_skills`, COMMIT. Trigger `trg_resumes_single_active` deactivates older resumes.
4. Transformers.js runs all-MiniLM-L6-v2 and stores a 384-number embedding: `UPDATE resumes SET resume_embedding = $1::vector`.
5. `CALL sp_analyze_resume(resume_id)` runs `fn_compute_skill_gap` for every open job.

**Match score** (`fn_compute_skill_gap`): required skills weigh 2, preferred 1. A skill counts only if the resume level is at least the job's minimum level (`fn_prof_rank`: beginner < intermediate < advanced < expert). Match score = 100 × matched weight ÷ total weight. Missing or too-weak skills go to `skill_recommendations` with priority 1 (required, absent), 2 (required, level too low) or 3 (preferred).

**Semantic match** (`fn_recommend_jobs`): resumes and job descriptions both have 384-number embeddings; pgvector's cosine-distance operator `<=>` ranks jobs by meaning (similarity = 1 − distance), accelerated by an HNSW index.

## How the data is stored

| Table | One row is | Key | Links to |
| --- | --- | --- | --- |
| users | A student or admin account | user_id | – |
| student_profiles | Extra student details (1:1) | profile_id; user_id UNIQUE | users |
| companies | A company that posts jobs | company_id | – |
| skills | One catalogue skill (18) | skill_id; skill_name UNIQUE | – |
| job_postings | A job plus its description embedding | job_id | companies |
| resumes | An uploaded resume: text, path, embedding, is_active | resume_id | users |
| resume_skills | A skill on a resume with level and years (M:N) | (resume_id, skill_id) | resumes, skills |
| job_skills | A skill a job needs, importance and minimum level (M:N) | (job_id, skill_id) | job_postings, skills |
| skill_gap_analysis | One resume vs one job: score, matched, missing | analysis_id; (resume_id, job_id) UNIQUE | resumes, job_postings |
| skill_recommendations | A skill to learn from an analysis, with priority | recommendation_id | skill_gap_analysis, skills |
| applications | An application to a job, with status | application_id; (user_id, job_id) UNIQUE | users, job_postings |

- **Constraints:** PK/FK with ON DELETE CASCADE; CHECK on role, status, employment type, proficiency, score 0–100, salary_max ≥ salary_min; UNIQUE on email and on each (resume, job) and (user, job) pair.
- **Triggers (4):** keep `last_updated` current; block applications to jobs that are not open; keep only the newest resume active; allow student profiles only for students.
- **Views (2):** `v_top_missing_skills` and `v_job_recommendations`.
- **Indexes:** B-tree on foreign keys and status columns, GIN full-text on job title + description, HNSW on both embedding columns.
- **On disk:** locally the database runs through PGlite (PostgreSQL with pgvector, inside Node.js) and stores its files in `pgdata/`. The same `db/` scripts run unchanged on PostgreSQL 16 with pgvector.

## Likely viva questions

- **Why PostgreSQL + pgvector instead of a separate vector database?** Relational data and embeddings share one database and one transaction; deleting a resume deletes its vector, and one query can combine skill score and semantic similarity.
- **What is an embedding?** 384 numbers that represent the meaning of a text (all-MiniLM-L6-v2). Similar texts point in similar directions.
- **What does `<=>` do?** Cosine distance; similarity = 1 − distance. `<->` is Euclidean, `<#>` is negative inner product.
- **Why HNSW?** It finds nearest vectors without scanning every row.
- **Normal form?** 3NF; M:N relationships have their own tables (resume_skills, job_skills).
- **Why store match_score?** A derived attribute kept for fast dashboards; the function recomputes it whenever skills change.
- **Function vs procedure?** `fn_compute_skill_gap` returns the analysis id for one resume and one job; `sp_analyze_resume` returns nothing, loops over all open jobs and is run with CALL.
- **Correlated query?** Best student per job: the inner MAX(match_score) is re-evaluated for each outer row's job_id (report Section 4.4).
- **SQL injection?** Every query is parameterised (`$1, $2`).
- **Where does the AI model run?** On our own server via Transformers.js and ONNX Runtime; no resume text leaves the machine.

## If something breaks during the demo

| What you see | Fix |
| --- | --- |
| "relation users does not exist" | Tab 2: Ctrl+C, `npm run db:init`, `npm run embed`, `npm run dev` |
| Page won't load | Tab 2 stopped: `npm run dev` |
| ECONNREFUSED 127.0.0.1:5432 | Tab 1 stopped: `npm run db:start`, then refresh |
| "No embeddings yet" | Tab 2: Ctrl+C, `npm run embed`, `npm run dev` |
| Sneha already at 100% before upload | Reset: `npm run db:init` + `npm run embed` |
| "embedding not available" on upload | No internet on first model load; skill scores still update |

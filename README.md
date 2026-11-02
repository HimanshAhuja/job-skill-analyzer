# AI-Powered Job & Skill Gap Analyzer

Next.js 15 + PostgreSQL + pgvector. DBMS mini project (UE24CS351A).

## Run it (only Node.js 20+ needed – no Docker, no PostgreSQL install)

Open two terminals in this folder.

Terminal 1 – start the database (PostgreSQL with pgvector, via PGlite) and leave it running:

    npm install
    npm run db:start

Terminal 2 – create tables + data, embeddings, then the app:

    copy .env.example .env        (Mac/Linux: cp .env.example .env)
    npm run db:init               # runs db/01_ddl.sql, 02_plpgsql.sql, 03_dml.sql
    npm run embed                 # first run downloads the all-MiniLM-L6-v2 model (~90 MB)
    npm run dev                   # open http://localhost:3000

`npm run db:init` can be re-run at any time to reset the demo data (then run `npm run embed` again).
Data is stored in the `pgdata` folder.

Using Docker or a cloud PostgreSQL (Neon, Supabase) instead: put its connection string in
`DATABASE_URL` in `.env` and skip `npm run db:start`.

## Demo flow

1. Sign in as a student (e.g. Aarav Sharma) and open the Dashboard.
2. Jobs → search "python", open a job to see the skill-by-skill gap, Apply.
3. Applications → change a status (a trigger updates `last_updated`).
4. Sign in as Sneha Iyer → Upload resume → `public/sample-resume.pdf` → Dashboard: scores change.
5. Sign in as Placement Admin → Analytics.

`db/04_queries.sql` (report queries) and `db/05_vector.sql` (pgvector commands) are the
report's SQL; 04 changes data, so run `npm run db:init` afterwards to reset.

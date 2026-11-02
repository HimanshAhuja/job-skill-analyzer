// Creates the schema, PL/pgSQL code and sample data without needing psql.
// Works with any PostgreSQL + pgvector: the bundled PGlite server, Docker or a cloud database.
// Usage:  npm run db:init     (reads DATABASE_URL from .env)
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
db.on('notice', (n) => console.log('  NOTICE:', n.message));

// start from a clean schema so the script can be re-run any time
await db.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');

for (const file of ['01_ddl.sql', '02_plpgsql.sql', '03_dml.sql']) {
  let sql = await readFile(new URL(`../db/${file}`, import.meta.url), 'utf8');
  if (file === '01_ddl.sql') {
    // the first lines (DROP/CREATE DATABASE, \c) are for psql only
    sql = sql.slice(sql.indexOf('-- pgvector adds'));
  }
  sql = sql.replace(/^\\.*$/gm, ''); // drop psql meta-commands such as \dt
  await db.query(sql);
  console.log(`✓ ${file}`);
}

const { rows } = await db.query(
  `SELECT (SELECT COUNT(*) FROM job_postings) AS jobs, (SELECT COUNT(*) FROM resumes) AS resumes,
          (SELECT COUNT(*) FROM skill_gap_analysis) AS analyses`,
);
console.log(`Database ready: ${rows[0].jobs} jobs, ${rows[0].resumes} resumes, ${rows[0].analyses} analyses`);
await db.end();

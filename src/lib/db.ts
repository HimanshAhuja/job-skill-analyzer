import { Pool } from 'pg';

// One connection pool per server process (re-used across hot reloads in dev)
const g = globalThis as unknown as { pgPool?: Pool };

export const pool =
  g.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PG_POOL_MAX ?? 10),
  });

if (process.env.NODE_ENV !== 'production') g.pgPool = pool;

/** Run a parameterised SQL statement and return its rows. */
export async function query<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

/** pgvector text format: [0.1,0.2,...] */
export const toVector = (v: number[]) => `[${v.join(',')}]`;

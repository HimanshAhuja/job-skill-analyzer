import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import { pool, toVector } from '@/lib/db';
import { currentUser } from '@/lib/session';
import { extractSkills, type CatalogueSkill } from '@/lib/skills';
import { embed } from '@/lib/embeddings';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || user.role !== 'student')
    return NextResponse.json({ error: 'Sign in as a student first' }, { status: 401 });

  const file = (await req.formData()).get('resume') as File | null;
  if (!file || !file.name.toLowerCase().endsWith('.pdf'))
    return NextResponse.json({ error: 'Please choose a PDF file' }, { status: 400 });

  // 1. store the file and extract its text
  const bytes = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), 'uploads', String(user.user_id));
  await mkdir(dir, { recursive: true });
  const safeName = `${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`;
  await writeFile(path.join(dir, safeName), bytes);
  const parser = new PDFParse({ data: bytes });
  const text = (await parser.getText()).text;
  await parser.destroy();

  const client = await pool.connect();
  try {
    // 2. one transaction: resume row + its skills (trigger deactivates older resumes)
    await client.query('BEGIN');
    const { rows: catalogue } = await client.query<CatalogueSkill>('SELECT skill_id, skill_name FROM skills');
    const skills = extractSkills(text, catalogue);
    const { rows } = await client.query<{ resume_id: number }>(
      `INSERT INTO resumes (user_id, file_name, file_path, parsed_text)
       VALUES ($1, $2, $3, $4) RETURNING resume_id`,
      [user.user_id, file.name, `/uploads/${user.user_id}/${safeName}`, text],
    );
    const resumeId = rows[0].resume_id;
    for (const s of skills) {
      await client.query(
        'INSERT INTO resume_skills (resume_id, skill_id, proficiency, years_used) VALUES ($1, $2, $3, $4)',
        [resumeId, s.skill_id, s.proficiency, s.years_used],
      );
    }
    await client.query('COMMIT');

    // 3. semantic embedding of the whole resume (pgvector column)
    let embedded = true;
    try {
      const vec = await embed(text);
      await client.query('UPDATE resumes SET resume_embedding = $1::vector WHERE resume_id = $2', [
        toVector(vec),
        resumeId,
      ]);
    } catch (e) {
      embedded = false; // skill-based analysis still works without the vector
      console.error('embedding failed:', e);
    }

    // 4. skill-gap analysis against every open job (stored procedure)
    await client.query('CALL sp_analyze_resume($1)', [resumeId]);

    return NextResponse.json({ resumeId, skills, embedded });
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    client.release();
  }
}

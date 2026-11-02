'use client';

import { useState } from 'react';
import Link from 'next/link';

type Result = {
  resumeId: number;
  embedded: boolean;
  skills: { skill_name: string; proficiency: string; years_used: number }[];
  error?: string;
};

export default function ResumeUpload() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const res = await fetch('/api/resume', { method: 'POST', body: new FormData(e.currentTarget) });
    setResult(await res.json());
    setBusy(false);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Upload resume</h1>
          <p className="muted">PDF only. Your previous resume is archived automatically.</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="card upload">
        <input type="file" name="resume" accept="application/pdf" required />
        <button className="btn" disabled={busy}>{busy ? 'Analysing…' : 'Upload and analyse'}</button>
      </form>

      {result?.error && <p className="alert">{result.error}</p>}

      {result && !result.error && (
        <section className="card">
          <h2>Resume #{result.resumeId} analysed</h2>
          <p className="muted">
            {result.skills.length} skills found · embedding {result.embedded ? 'stored in pgvector' : 'not available'}
            {' '}· compared with every open job
          </p>
          <table>
            <thead><tr><th>Skill</th><th>Level</th><th>Years</th></tr></thead>
            <tbody>
              {result.skills.map((s) => (
                <tr key={s.skill_name}>
                  <td>{s.skill_name}</td>
                  <td><span className={`lvl ${s.proficiency}`}>{s.proficiency}</span></td>
                  <td>{s.years_used}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link className="btn" href="/dashboard">See my matches</Link>
        </section>
      )}
    </>
  );
}

'use client';

import { useActionState } from 'react';
import { createJob, type JobFormState } from '@/app/admin/actions';

type Company = { company_id: number; name: string; location: string };
type Skill = { skill_id: number; skill_name: string; category: string };

export default function JobForm({ companies, skills }: { companies: Company[]; skills: Skill[] }) {
  const [state, action, pending] = useActionState<JobFormState, FormData>(createJob, {});

  return (
    <form action={action} className="card stack">
      <h2>Job details</h2>
      <label className="field"><span>Title</span><input name="title" required placeholder="e.g. Data Engineer" /></label>
      <label className="field">
        <span>Company</span>
        <select name="company_id" required defaultValue="">
          <option value="" disabled>Choose a company</option>
          {companies.map((c) => (
            <option key={c.company_id} value={c.company_id}>{c.name} ({c.location})</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Description (used for the semantic embedding)</span>
        <textarea name="description" rows={3} placeholder="What the role does" />
      </label>
      <div className="row wrap">
        <label className="field">
          <span>Type</span>
          <select name="employment_type" defaultValue="Full-time">
            <option>Full-time</option><option>Part-time</option><option>Internship</option><option>Contract</option>
          </select>
        </label>
        <label className="field"><span>Location</span><input name="location" placeholder="Bengaluru" /></label>
        <label className="field"><span>Min. years</span><input name="min_experience" type="number" min="0" step="0.5" defaultValue="0" /></label>
      </div>
      <div className="row wrap">
        <label className="field"><span>Salary min (₹ p.a.)</span><input name="salary_min" type="number" min="0" step="10000" /></label>
        <label className="field"><span>Salary max (₹ p.a.)</span><input name="salary_max" type="number" min="0" step="10000" /></label>
      </div>

      <h2>Required skills</h2>
      <table className="skill-picker">
        <thead><tr><th></th><th>Skill</th><th>Importance</th><th>Minimum level</th></tr></thead>
        <tbody>
          {skills.map((s) => (
            <tr key={s.skill_id}>
              <td><input type="checkbox" name="skill_id" value={s.skill_id} /></td>
              <td>{s.skill_name}<div className="muted small">{s.category}</div></td>
              <td>
                <select name={`importance_${s.skill_id}`} defaultValue="required">
                  <option value="required">required</option>
                  <option value="preferred">preferred</option>
                </select>
              </td>
              <td>
                <select name={`level_${s.skill_id}`} defaultValue="intermediate">
                  <option>beginner</option><option>intermediate</option><option>advanced</option><option>expert</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {state.error && <p className="alert">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? 'Saving and scoring…' : 'Create job'}</button>
    </form>
  );
}

'use client';

import { useActionState } from 'react';
import { createCompany, type JobFormState } from '@/app/admin/actions';

export default function CompanyForm() {
  const [state, action, pending] = useActionState<JobFormState & { ok?: boolean }, FormData>(
    async (prev, form) => {
      const r = await createCompany(prev, form);
      return r.error ? r : { ok: true };
    },
    {},
  );

  return (
    <form action={action} className="card stack">
      <h2>Add a company</h2>
      <p className="muted small">Not in the list? Add it here, then pick it in the job form (refresh the page).</p>
      <label className="field"><span>Name</span><input name="name" required /></label>
      <label className="field"><span>Industry</span><input name="industry" /></label>
      <label className="field"><span>Website</span><input name="website" /></label>
      <label className="field"><span>Location</span><input name="location" /></label>
      {state.error && <p className="alert">{state.error}</p>}
      {state.ok && <p className="notice">Company added.</p>}
      <button className="btn ghost" disabled={pending}>{pending ? 'Adding…' : 'Add company'}</button>
    </form>
  );
}

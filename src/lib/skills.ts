export type CatalogueSkill = { skill_id: number; skill_name: string };
export type FoundSkill = CatalogueSkill & { proficiency: string; years_used: number };

const LEVELS = /expert|advanced|intermediate|beginner/;
const YEARS = /(\d+(?:\.\d+)?)\s*\+?\s*(?:yrs?|years?)/;

/**
 * Finds every catalogue skill mentioned in the resume text.
 * "Python (advanced, 2 yrs)" -> { Python, advanced, 2 }.
 * Whole-word matching, so "Java" does not match inside "JavaScript"
 * and "SQL" does not match inside "PostgreSQL".
 */
export function extractSkills(text: string, catalogue: CatalogueSkill[]): FoundSkill[] {
  const found: FoundSkill[] = [];
  for (const s of catalogue) {
    const esc = s.skill_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^A-Za-z0-9])${esc}(?![A-Za-z0-9])`, 'gi');
    let best: { level?: string; years: number } | null = null;
    for (const m of text.matchAll(re)) {
      // look only at the text right after the skill, up to ")" or end of line
      const end = m.index + m[0].length;
      const after = text.slice(end, end + 40).split(/[)\n]/)[0].toLowerCase();
      const yrs = YEARS.exec(after);
      const hit = { level: LEVELS.exec(after)?.[0], years: yrs ? Number(yrs[1]) : 0 };
      if (!best || (!best.level && hit.level)) best = hit; // prefer the mention that states a level
      if (best.level) break;
    }
    if (best) found.push({ ...s, proficiency: best.level ?? 'intermediate', years_used: best.years });
  }
  return found;
}

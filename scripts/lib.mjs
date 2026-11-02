// Shared helpers: no dependencies, used by build.mjs and the CLI.
export const SITE = 'https://ernestmoyo.com';

export const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDate = d => {
  if (!d) return '';
  const [y, m] = String(d).split('-');
  return m ? `${MONTHS[+m - 1]} ${y}` : y;
};
export const range = (a, b) => !a && !b ? 'Current' : `${fmtDate(a)}${a ? ' – ' : ''}${b ? fmtDate(b) : a ? 'present' : ''}`;
export const isCurrent = w => !w.endDate;

/** Full CV as Markdown. Single renderer shared by cv.md, llms-full.txt and the CLI. */
export function toMarkdown(cv, { site = SITE } = {}) {
  const b = cv.basics;
  const L = [];
  L.push(`# ${b.name}`, '', `> ${b.label}`, '', b.summary, '');
  L.push(`- Location: ${b.location.city}, Tanzania (${b.location.region}). Nationality: ${cv.meta.nationality}.`);
  L.push(`- Email: ${b.email}`);
  L.push(`- Website: ${b.url}`);
  for (const p of b.profiles) L.push(`- ${p.network}: ${p.url}`);
  L.push(`- Machine-readable CV (JSON Resume): ${site}/cv.json`, '');

  L.push('## Experience', '');
  for (const w of cv.work) {
    L.push(`### ${w.position}, ${w.name}`, `${range(w.startDate, w.endDate)}${w.location ? ' · ' + w.location : ''}`, '');
    if (w.summary) L.push(w.summary, '');
    for (const h of w.highlights || []) L.push(`- ${h}`);
    if (w.highlights?.length) L.push('');
  }
  L.push('## Education', '');
  for (const e of cv.education) {
    L.push(`- **${e.studyType}, ${e.area}**, ${e.institution}${e.startDate || e.endDate ? ` (${e.endDate ? fmtDate(e.endDate) : fmtDate(e.startDate) + ' – present'})` : ''}`);
    for (const c of e.courses || []) L.push(`  - ${c}`);
  }
  L.push('', '## Publications', '');
  for (const p of cv.publications) L.push(`- ${p.name}. *${p.publisher}*, ${fmtDate(p.releaseDate.slice(0, 7))}. ${p.url}`);
  L.push('', '## Selected projects', '');
  for (const p of cv.projects) L.push(`- **${p.name}**: ${p.description}${p.url ? ' ' + p.url : ''}`);
  L.push('', '## Talks and recognition', '');
  for (const a of cv.awards) L.push(`- ${a.title} (${a.awarder}, ${fmtDate(a.date)})`);
  L.push('', '## Fellowships and service', '');
  for (const v of cv.volunteer) L.push(`- ${v.position}, ${v.organization}${v.startDate ? ` (${range(v.startDate, v.endDate)})` : ''}`);
  L.push('', '## Training', '');
  for (const c of cv.certificates) L.push(`- ${c.name}, ${c.issuer} (${fmtDate(c.date)})`);
  L.push('', '## Skills', '');
  for (const s of cv.skills) L.push(`- **${s.name}**: ${s.keywords.join(', ')}`);
  L.push('', '## Languages', '');
  L.push(cv.languages.map(l => `${l.language} (${l.fluency.toLowerCase()})`).join(', '));
  L.push('', '## Countries worked in', '', cv.meta.countries.join(', '));
  L.push('', '## Open to', '');
  for (const k of cv.interests[0].keywords) L.push(`- ${k}`);
  L.push('', `_Last updated ${cv.meta.lastModified.slice(0, 10)}. Source of truth: ${site}/cv.json_`, '');
  return L.join('\n');
}

/** Plain-text CV for terminals (no Markdown syntax). */
export function toText(cv) {
  return toMarkdown(cv)
    .replace(/^#{1,3} /gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^> /gm, '')
    .replace(/^_(.+)_$/gm, '$1');
}

/** Search across the CV; returns matching lines with their section. Used by the CLI and MCP tool. */
export function search(cv, q) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  let section = '';
  const hits = [];
  for (const line of toMarkdown(cv).split('\n')) {
    if (/^#{2,3} /.test(line)) section = line.replace(/^#+ /, '');
    const l = line.toLowerCase();
    if (line.trim() && terms.every(t => l.includes(t))) hits.push({ section, line: line.replace(/^[-#>\s]+/, '').replace(/\*\*/g, '') });
  }
  return hits;
}

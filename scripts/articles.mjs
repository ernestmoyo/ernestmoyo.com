// Articles: one Markdown file per article in content/articles/. Zero dependencies.
// Front matter (between --- lines): title, date (YYYY-MM-DD), summary, tags (comma list),
// optional url (published elsewhere, e.g. LinkedIn; body may be empty), optional draft: true.
// Files starting with "_" are ignored (templates).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { esc } from './lib.mjs';

export function loadArticles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.md') && !f.startsWith('_'))
    .map(f => {
      const raw = readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n');
      const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
      if (!m) throw new Error(`${f}: missing front matter`);
      const fm = Object.fromEntries(m[1].split('\n').filter(l => l.includes(':')).map(l => {
        const i = l.indexOf(':');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
      }));
      if (!fm.title || !/^\d{4}-\d{2}-\d{2}$/.test(fm.date || '')) throw new Error(`${f}: needs title and date (YYYY-MM-DD)`);
      const body = m[2].trim();
      if (!body && !fm.url) throw new Error(`${f}: needs a body or an external url`);
      return {
        slug: f.replace(/\.md$/, ''),
        title: fm.title,
        date: fm.date,
        summary: fm.summary || '',
        tags: fm.tags ? fm.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        url: fm.url || '',
        draft: fm.draft === 'true',
        body,
      };
    })
    .filter(a => !a.draft)
    .sort((a, b) => b.date.localeCompare(a.date));
}

const inline = s => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>');

/** Small Markdown subset: headings, paragraphs, lists, quotes, code blocks, images, links, rules. */
export function mdToHtml(md) {
  const out = [];
  const lines = md.split('\n');
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (l.startsWith('```')) {
      const code = [];
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) code.push(lines[i]);
      i++;
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
      continue;
    }
    const h = l.match(/^(#{1,6})\s+(.*)$/);
    if (h) { const n = Math.min(h[1].length + 1, 6); out.push(`<h${n}>${inline(h[2])}</h${n}>`); i++; continue; }
    if (/^(-{3,}|\*{3,})$/.test(l.trim())) { out.push('<hr>'); i++; continue; }
    if (l.startsWith('>')) {
      const q = [];
      for (; i < lines.length && lines[i].startsWith('>'); i++) q.push(lines[i].replace(/^>\s?/, ''));
      out.push(`<blockquote>${mdToHtml(q.join('\n'))}</blockquote>`);
      continue;
    }
    const list = l.match(/^(\s*)([-*]|\d+\.)\s+/);
    if (list) {
      const ordered = /\d/.test(list[2]);
      const items = [];
      for (; i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]); i++) items.push(`<li>${inline(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''))}</li>`);
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    const p = [];
    for (; i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>|\s*([-*]|\d+\.)\s+)/.test(lines[i]); i++) p.push(lines[i].trim());
    out.push(`<p>${inline(p.join(' '))}</p>`);
  }
  return out.join('\n');
}

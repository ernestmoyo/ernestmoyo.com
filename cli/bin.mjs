#!/usr/bin/env node
// npx ernestmoyo — Ernest Moyo's CV in your terminal, and an MCP server for agents.
// Zero dependencies. Fetches the live https://ernestmoyo.com/cv.json, falls back to a bundled snapshot.
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { toMarkdown, toText, search, SITE } from './lib.mjs';

const args = process.argv.slice(2);
const has = f => args.includes(f);
const VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;

async function loadCv() {
  if (!has('--offline')) {
    try {
      const r = await fetch(`${SITE}/cv.json`, { signal: AbortSignal.timeout(2500), headers: { 'user-agent': `ernestmoyo-cli/${VERSION}` } });
      if (r.ok) return await r.json();
    } catch {}
  }
  return JSON.parse(readFileSync(new URL('./cv.snapshot.json', import.meta.url), 'utf8'));
}

const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
function pretty(cv) {
  return toText(cv)
    .split('\n')
    .map((l, i, a) => {
      if (i === 0) return c('1;38;5;166', l);
      if (/^(Experience|Education|Publications|Selected projects|Talks and recognition|Fellowships and service|Training|Skills|Languages|Countries worked in|Open to)$/.test(l)) return '\n' + c('1;38;5;61', l.toUpperCase());
      if (a[i + 1] && /^[A-Z][a-z]{2} \d{4}|^\d{4} – /.test(a[i + 1])) return c('1', l);
      if (/^[A-Z][a-z]{2} \d{4}|^\d{4} – /.test(l)) return c('2', l);
      return l;
    })
    .join('\n');
}

const HELP = `ernestmoyo ${VERSION} — Ernest Moyo, epidemiologist, malaria modeller and AI builder (Dar es Salaam)

Usage: npx ernestmoyo [option]
  (none)             print the CV
  --json             CV as JSON Resume v1
  --md               CV as Markdown
  --search <terms>   find lines in the CV, e.g. --search malaria bayesian
  --contact          how to reach Ernest
  --mcp              run as a Model Context Protocol server over stdio
  --offline          use the bundled snapshot instead of ${SITE}/cv.json
  --version, --help`;

// ------------------------------------------------------------------ MCP (stdio, JSON-RPC 2.0)
async function mcp() {
  const cv = await loadCv();
  const SECTIONS = ['basics', 'work', 'education', 'publications', 'projects', 'skills', 'languages', 'awards', 'volunteer', 'certificates', 'interests'];
  const tools = [
    { name: 'get_profile', description: 'Summary of Ernest Moyo: headline, bio, location, contact, current roles and what he is open to.', inputSchema: { type: 'object', properties: {} } },
    { name: 'get_cv', description: 'Ernest Moyo\'s full CV as Markdown, or one section as JSON.', inputSchema: { type: 'object', properties: { section: { type: 'string', enum: SECTIONS, description: 'Optional section; omit for the full Markdown CV.' } } } },
    { name: 'search_cv', description: 'Search Ernest Moyo\'s CV (roles, publications, projects, skills) for terms such as "malaria", "DHIS2" or "MCP".', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  ];
  const text = t => ({ content: [{ type: 'text', text: typeof t === 'string' ? t : JSON.stringify(t, null, 2) }] });
  const call = (name, a = {}) => {
    if (name === 'get_profile') {
      const b = cv.basics;
      return text({ name: b.name, headline: b.label, summary: b.summary, location: `${b.location.city}, Tanzania`, email: b.email, website: b.url, profiles: b.profiles, currentRoles: cv.work.filter(w => !w.endDate).map(w => `${w.position}, ${w.name}`), openTo: cv.interests?.[0]?.keywords });
    }
    if (name === 'get_cv') return text(a.section ? cv[a.section] : toMarkdown(cv));
    if (name === 'search_cv') { const h = search(cv, String(a.query || '')); return text(h.length ? h : `No matches for "${a.query}".`); }
    throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
  };
  const send = m => process.stdout.write(JSON.stringify(m) + '\n');
  const rl = createInterface({ input: process.stdin });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); continue; }
    const { id, method, params } = msg;
    if (id === undefined) continue; // notification
    try {
      let result;
      if (method === 'initialize') result = { protocolVersion: params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'ernestmoyo', version: VERSION }, instructions: 'Facts about Ernest Moyo (epidemiologist, Bayesian malaria modeller, 7Square co-founder, Dar es Salaam). Source of truth: https://ernestmoyo.com/cv.json' };
      else if (method === 'ping') result = {};
      else if (method === 'tools/list') result = { tools };
      else if (method === 'tools/call') result = call(params?.name, params?.arguments);
      else throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
      send({ jsonrpc: '2.0', id, result });
    } catch (e) {
      send({ jsonrpc: '2.0', id, error: { code: e.code || -32603, message: e.message } });
    }
  }
}

// ------------------------------------------------------------------ main
if (has('--help') || has('-h')) console.log(HELP);
else if (has('--version') || has('-v')) console.log(VERSION);
else if (has('--mcp')) await mcp();
else {
  const cv = await loadCv();
  if (has('--json')) console.log(JSON.stringify(cv, null, 2));
  else if (has('--md')) console.log(toMarkdown(cv));
  else if (has('--contact')) console.log(`${cv.basics.name}\n${cv.basics.email}\n${cv.basics.url}\n${cv.basics.profiles.map(p => p.url).join('\n')}`);
  else if (has('--search')) {
    const q = args.slice(args.indexOf('--search') + 1).filter(a => !a.startsWith('--')).join(' ');
    const hits = search(cv, q);
    console.log(hits.length ? hits.map(h => `${c('2', h.section.padEnd(28).slice(0, 28))} ${h.line}`).join('\n') : `No matches for "${q}".`);
  } else console.log(pretty(cv) + '\n' + c('2', `\n→ ${SITE} · --help for more · --mcp to plug into your agent`));
}

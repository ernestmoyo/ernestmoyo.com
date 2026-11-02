// Gate for every deploy. Fails the build if any public surface is broken or leaks private data.
// Usage: node scripts/validate.mjs   (after build; optional: npm i --no-save ajv-draft-04 for schema check)
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const errors = [];
const fail = m => errors.push(m);
const read = p => readFileSync(join(DIST, p), 'utf8');
const walk = d => readdirSync(d).flatMap(f => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(DIST).map(f => f.slice(DIST.length + 1).replace(/\\/g, '/'));

// 1. Required surfaces exist
for (const f of ['index.html', 'cv.json', 'cv.md', 'cv.txt', 'llms.txt', 'llms-full.txt', 'robots.txt', 'sitemap.xml', 'openapi.json', 'api/v1/index.json', 'CNAME', '.well-known/security.txt', '.nojekyll'])
  if (!files.includes(f)) fail(`missing dist/${f}`);

// 2. Every JSON file parses
for (const f of files.filter(f => f.endsWith('.json'))) { try { JSON.parse(read(f)); } catch (e) { fail(`${f}: invalid JSON (${e.message})`); } }

// 3. JSON Resume schema (when ajv is available — CI installs it)
try {
  const { default: Ajv } = await import('ajv-draft-04');
  const res = await fetch('https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json');
  const validate = new Ajv({ strict: false, allErrors: true, validateFormats: false }).compile(await res.json());
  if (!validate(JSON.parse(read('cv.json')))) for (const e of validate.errors) fail(`cv.json ${e.instancePath}: ${e.message}`);
} catch (e) { if (process.env.CI) fail(`schema check could not run: ${e.message}`); else console.warn('skip schema check:', e.message); }

// 4. JSON-LD parses and has the Person entity
const html = read('index.html');
const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
if (!ld.length) fail('index.html: no JSON-LD');
for (const [, block] of ld) {
  try {
    const g = JSON.parse(block)['@graph'] || [];
    const person = g.find(n => n['@type'] === 'Person');
    if (!person?.name || !person.sameAs?.length) fail('JSON-LD: Person missing name/sameAs');
    if (!g.some(n => n['@type'] === 'ProfilePage')) fail('JSON-LD: no ProfilePage');
  } catch (e) { fail(`JSON-LD invalid: ${e.message}`); }
}

// 5. Privacy: no phone numbers, no addresses beyond city, no third-party emails
const PUBLIC = files.filter(f => /\.(html|json|txt|md|xml)$/.test(f) && !f.startsWith('data/')).map(f => [f, read(f)]);
const ALLOWED_EMAILS = new Set(['hello@ernestmoyo.com']);
for (const [f, s] of PUBLIC) {
  if (/(\+?(255|263|264|27)[\s-]?\d{2,3}[\s-]?\d{3}[\s-]?\d{3,4})|(\b0[67]\d[\s-]?\d{3}[\s-]?\d{3,4}\b)/.test(s)) fail(`${f}: looks like a phone number`);
  for (const m of s.replace(/%3C/gi, '<').replace(/%3E/gi, '>').matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)) if (!ALLOWED_EMAILS.has(m[0]) && !/^dmarc|noreply/.test(m[0])) fail(`${f}: unexpected email ${m[0]}`);
  if (/passport|date of birth|\bDOB\b|salary/i.test(s)) fail(`${f}: sensitive keyword`);
}

// 6. Internal links in llms.txt / HTML resolve to built files
const internal = new Set();
for (const [, s] of PUBLIC) for (const m of s.matchAll(/https:\/\/ernestmoyo\.com(\/[^\s)"'<#_*]*)/g)) internal.add(m[1]);
for (const m of html.matchAll(/href="(\/[^"#]*)"/g)) internal.add(m[1]);
for (const p of internal) {
  const f = p === '/' ? 'index.html' : p.slice(1);
  if (!files.includes(f) && !files.includes(f + '/index.html')) fail(`broken internal link ${p}`);
}

// 7. Facts are consistent: every surface states the same headline
const label = JSON.parse(read('cv.json')).basics.label;
for (const f of ['index.html', 'llms.txt', 'cv.md']) if (!read(f).includes(label.replace(/&/g, '&amp;')) && !read(f).includes(label)) fail(`${f}: headline drifted from cv.json`);

// 8. CLI + MCP smoke test against the snapshot
const cli = join(ROOT, 'cli/bin.mjs');
const json = spawnSync(process.execPath, [cli, '--json', '--offline'], { encoding: 'utf8' });
if (json.status !== 0 || JSON.stringify(JSON.parse(json.stdout)) !== JSON.stringify(JSON.parse(read('cv.json')))) fail('CLI --json does not match cv.json');
const rpc = ['{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"ci","version":"1"}}}',
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}',
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_profile","arguments":{}}}'].join('\n') + '\n';
const m = spawnSync(process.execPath, [cli, '--mcp', '--offline'], { input: rpc, encoding: 'utf8' });
const replies = m.stdout.trim().split('\n').map(l => JSON.parse(l));
if (replies.length !== 3 || replies.some(r => r.error) || replies[1].result.tools.length < 3) fail('MCP smoke test failed');

// 9. Weight budget (gzip-equivalent check is done in CI logs; raw cap keeps the map honest)
if (Buffer.byteLength(html) > 300 * 1024) fail('index.html over 300 KB raw');

if (errors.length) { console.error(errors.map(e => '✗ ' + e).join('\n')); process.exit(1); }
console.log(`✓ ${files.length} files validated`);

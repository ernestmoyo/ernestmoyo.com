// One-off: turns Natural Earth 1:50m country boundaries (world-atlas@2.0.2, public domain)
// into projected SVG paths for Africa, written to data/africa-countries.json.
// Usage: node scripts/make-africa-map.mjs <path-to-countries-50m.json>
import { readFileSync, writeFileSync } from 'node:fs';

const src = process.argv[2];
if (!src) throw new Error('pass the path to world-atlas countries-50m.json');
const topo = JSON.parse(readFileSync(src, 'utf8'));

// ISO 3166-1 numeric -> alpha-3, African countries and territories
const AFR = {
  '012': 'DZA', '024': 'AGO', '204': 'BEN', '072': 'BWA', '854': 'BFA', '108': 'BDI', '120': 'CMR', '132': 'CPV',
  '140': 'CAF', '148': 'TCD', '174': 'COM', '178': 'COG', '180': 'COD', '384': 'CIV', '262': 'DJI', '818': 'EGY',
  '226': 'GNQ', '232': 'ERI', '748': 'SWZ', '231': 'ETH', '266': 'GAB', '270': 'GMB', '288': 'GHA', '324': 'GIN',
  '624': 'GNB', '404': 'KEN', '426': 'LSO', '430': 'LBR', '434': 'LBY', '450': 'MDG', '454': 'MWI', '466': 'MLI',
  '478': 'MRT', '480': 'MUS', '504': 'MAR', '508': 'MOZ', '516': 'NAM', '562': 'NER', '566': 'NGA', '646': 'RWA',
  '678': 'STP', '686': 'SEN', '690': 'SYC', '694': 'SLE', '706': 'SOM', '710': 'ZAF', '728': 'SSD', '729': 'SDN',
  '834': 'TZA', '768': 'TGO', '788': 'TUN', '800': 'UGA', '732': 'ESH', '894': 'ZMB', '716': 'ZWE',
};
const BY_NAME = { Somaliland: 'SOM' }; // merged into Somalia

// Lambert azimuthal equal-area, centred on Africa
const L0 = 18 * Math.PI / 180, P0 = 2 * Math.PI / 180;
const W = 700, H = 760, S = 1, PAD = 16;
function proj([lon, lat]) {
  const l = lon * Math.PI / 180, p = lat * Math.PI / 180;
  const k = Math.sqrt(2 / (1 + Math.sin(P0) * Math.sin(p) + Math.cos(P0) * Math.cos(p) * Math.cos(l - L0)));
  const x = k * Math.cos(p) * Math.sin(l - L0);
  const y = k * (Math.cos(P0) * Math.sin(p) - Math.sin(P0) * Math.cos(p) * Math.cos(l - L0));
  return [x, -y];
}
let fit = p => p; // set after bounds are known

// decode quantised, delta-encoded arcs
const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
const arcs = topo.arcs.map(a => { let x = 0, y = 0; return a.map(([dx, dy]) => (x += dx, y += dy, [x * sx + tx, y * sy + ty])); });
const arc = i => (i < 0 ? [...arcs[~i]].reverse() : arcs[i]);
const ring = idx => idx.flatMap((i, n) => (n ? arc(i).slice(1) : arc(i)));

const r1 = v => Math.round(v * 10) / 10;
function ringPath(pts) {
  const out = [];
  for (const p of pts.map(q => fit(proj(q)))) {
    const q = [Math.round(p[0]), Math.round(p[1])];
    const last = out[out.length - 1];
    if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) >= 2.2) out.push(q);
  }
  if (out.length < 4) return '';
  return 'M' + out[0].join(' ') + 'l' + out.slice(1).map(([x, y], i) => `${x - out[i][0]} ${y - out[i][1]}`).join(' ').replace(/ -/g, '-') + 'z';
}

const geoms = topo.objects.countries.geometries.filter(g => AFR[g.id] || BY_NAME[g.properties?.name]);
const polysOf = g => (g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : []);
let bx = [1e9, -1e9], by = [1e9, -1e9];
for (const g of geoms) for (const poly of polysOf(g)) for (const [x, y] of ring(poly[0]).map(proj)) { bx = [Math.min(bx[0], x), Math.max(bx[1], x)]; by = [Math.min(by[0], y), Math.max(by[1], y)]; }
const k = Math.min((W - 2 * PAD) / (bx[1] - bx[0]), (H - 2 * PAD) / (by[1] - by[0]));
const ox = (W - k * (bx[1] - bx[0])) / 2, oy = (H - k * (by[1] - by[0])) / 2;
fit = ([x, y]) => [ox + (x - bx[0]) * k, oy + (y - by[0]) * k];
const shapes = {};
for (const g of topo.objects.countries.geometries) {
  const iso = AFR[g.id] || BY_NAME[g.properties?.name];
  if (!iso) continue;
  const polys = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
  const d = polys.flatMap(poly => poly.map(r => ringPath(ring(r)))).join('');
  if (d) shapes[iso] = (shapes[iso] || '') + d;
}
const cities = Object.fromEntries(Object.entries({
  'Dar es Salaam': [39.28, -6.8], Windhoek: [17.08, -22.56], Harare: [31.05, -17.83],
}).map(([c, v]) => [c, fit(proj(v)).map(r1)]));

writeFileSync(new URL('../data/africa-countries.json', import.meta.url), JSON.stringify({
  source: 'Natural Earth 1:50m admin-0 countries (public domain), via world-atlas@2.0.2. Lambert azimuthal equal-area projection centred on 18E, 2N.',
  viewBox: `0 0 ${W} ${H}`, cities, shapes,
}));
console.log(Object.keys(shapes).length, 'countries,', JSON.stringify(shapes).length, 'bytes');

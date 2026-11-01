// One-off generator: turns the Malaria Atlas Project PfPR2-10 raster (2022, Africa)
// into a compact hex grid committed as data/africa-hex.json.
// Run with dev tools installed (geotiff, world-atlas, topojson-client, d3-geo):
//   node scripts/gen-map.mjs <pfpr.tif> <tools/node_modules dir>
// Source raster (WCS 1.0.0):
//   https://data.malariaatlas.org/geoserver/Malaria/wcs?service=WCS&version=1.0.0&request=GetCoverage
//   &coverage=Malaria:202406_Global_Pf_Parasite_Rate&bbox=-18,-35,52,38&width=140&height=146
//   &crs=EPSG:4326&format=GeoTIFF&time=2022-01-01T00:00:00.000Z
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [tif, modules] = process.argv.slice(2);
const req = createRequire(resolve(modules, 'x.js'));
const { fromFile } = await import(pathToFileURL(req.resolve('geotiff')));
const topo = req('topojson-client');
const { geoContains } = await import(pathToFileURL(req.resolve('d3-geo')));
const world = req('world-atlas/countries-110m.json');

// ISO 3166 numeric -> alpha-3 for African states (world-atlas uses numeric ids)
const AF = {
  '012':'DZA','024':'AGO','072':'BWA','108':'BDI','120':'CMR','140':'CAF','148':'TCD','178':'COG','180':'COD',
  '204':'BEN','226':'GNQ','231':'ETH','232':'ERI','262':'DJI','266':'GAB','270':'GMB','288':'GHA','324':'GIN',
  '384':'CIV','404':'KEN','426':'LSO','430':'LBR','434':'LBY','450':'MDG','454':'MWI','466':'MLI','478':'MRT',
  '504':'MAR','508':'MOZ','516':'NAM','562':'NER','566':'NGA','624':'GNB','646':'RWA','686':'SEN','694':'SLE',
  '706':'SOM','710':'ZAF','716':'ZWE','728':'SSD','729':'SDN','732':'ESH','748':'SWZ','768':'TGO','788':'TUN',
  '800':'UGA','818':'EGY','834':'TZA','854':'BFA','894':'ZMB',
};
const fc = topo.feature(world, world.objects.countries);
const africa = fc.features
  .map(f => ({ f, iso: AF[f.id] || (f.properties.name === 'Somaliland' ? 'SOM' : null) }))
  .filter(x => x.iso);

const img = await (await fromFile(tif)).getImage();
const [band] = await img.readRasters({ samples: [0] });
const W = img.getWidth(), H = img.getHeight();
const [x0, y0, x1, y1] = img.getBoundingBox();
const sample = (lon, lat) => {
  const c = Math.floor(((lon - x0) / (x1 - x0)) * W);
  const r = Math.floor(((y1 - lat) / (y1 - y0)) * H);
  if (c < 0 || r < 0 || c >= W || r >= H) return null;
  const v = band[r * W + c];
  return v >= 0 && v <= 1 ? v : null;
};

// Pointy-top hex grid in plain lon/lat (equirectangular). Spacing in degrees.
const S = 0.9, dx = S, dy = S * Math.sqrt(3) / 2;
const cells = [];
for (let row = 0, lat = 37.5; lat > -35; row++, lat -= dy) {
  for (let lon = -17.5 + (row % 2 ? dx / 2 : 0); lon < 51.5; lon += dx) {
    const hit = africa.find(a => geoContains(a.f, [lon, lat]));
    if (!hit) continue;
    const v = sample(lon, lat);
    // 0 = no stable Pf transmission in MAP surface (nodata/0); 1..9 = PfPR deciles of 0..~0.8
    const q = v == null || v < 0.001 ? 0 : Math.min(9, 1 + Math.floor(v * 11.5));
    cells.push([+lon.toFixed(2), +lat.toFixed(2), q, hit.iso]);
  }
}
const out = {
  source: 'Malaria Atlas Project, Plasmodium falciparum parasite rate (PfPR2-10), 2022 surface (202406 release). CC BY 3.0. https://data.malariaatlas.org',
  spacingDeg: S,
  cells,
};
writeFileSync(new URL('../data/africa-hex.json', import.meta.url), JSON.stringify(out));
console.log(cells.length, 'cells');

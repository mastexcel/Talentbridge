/**
 * Carte d'Afrique en pointillés avec connexions (intra-africaines et internationales),
 * utilisée en filigrane sur les certificats. Génère :
 *   public/brand/afrique-connexions.svg  (écran, vectoriel)
 *   public/brand/afrique-connexions.png  (PDF, 2000 px)
 *   npx tsx scripts/brand/generate-africa-map.ts
 * Contour simplifié (longitude, latitude), projection équirectangulaire.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const AFRICA: [number, number][] = [
  [-5.9, 35.8], [-9.8, 31.5], [-13.2, 27.6], [-17, 21], [-17.5, 14.7], [-16.7, 12.3], [-15, 10.8], [-13.3, 9], [-11.5, 6.9], [-7.5, 4.4], [-4, 5.2], [1, 6], [4, 6.3], [6, 4.3], [9.5, 4], [9.6, 1], [9, -1],
  [11.8, -4.8], [12.3, -6.1], [13.3, -9], [12, -15], [11.8, -17.3], [14.5, -22.9], [15.2, -27], [16.5, -28.6], [18.4, -33.9], [20, -34.8], [25.6, -34], [28, -32.7], [31, -29.9], [32.9, -26], [35.5, -24],
  [35, -20], [36.8, -17.8], [40.5, -15], [40.4, -10.4], [39.3, -6.8], [40.2, -3.3], [41.5, -1.7], [43.5, 1.5], [46, 3.5], [48, 5], [51.2, 10.5], [50, 11.8], [45, 10.5], [43.3, 11.6], [42, 13.5], [39.5, 15.5],
  [38.5, 18], [37.2, 21], [36, 23.5], [34.5, 26.5], [33.5, 28], [32.5, 29.9], [32.3, 31.3], [29.9, 31.2], [25, 31.6], [20, 30.9], [19, 30.3], [15.5, 32], [11.5, 33], [10.2, 36.9], [8, 36.9], [3, 36.8], [-1, 35.3],
];
const MADAGASCAR: [number, number][] = [[49.3, -12], [50.4, -15.5], [49.7, -17.5], [48.2, -21.5], [47.1, -24.9], [45.2, -25.5], [43.7, -23], [43.3, -20], [44.4, -16.5], [46.3, -15.7], [47.9, -13.6]];

const W = 1000;
const H = 1000;
const K = 12.4;
const X0 = -28;
const Y0 = 39.5;
const px = (lon: number, lat: number): [number, number] => [(lon - X0) * K + 30, (Y0 - lat) * K + 20];

function inside([x, y]: [number, number], poly: [number, number][]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

const dots: string[] = [];
const STEP = 1.35;
for (let lat = 38; lat > -36; lat -= STEP) {
  for (let lon = -19; lon < 52; lon += STEP) {
    const shift = Math.round((38 - lat) / STEP) % 2 ? STEP / 2 : 0;
    const p: [number, number] = [lon + shift, lat];
    if (inside(p, AFRICA) || inside(p, MADAGASCAR)) {
      const [x, y] = px(p[0], p[1]);
      dots.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.8"/>`);
    }
  }
}

const HUBS: Record<string, [number, number]> = {
  dakar: [-17.4, 14.7], abidjan: [-4, 5.3], lagos: [3.4, 6.5], casablanca: [-7.6, 33.6], cairo: [31.2, 30], addis: [38.7, 9],
  nairobi: [36.8, -1.3], kinshasa: [15.3, -4.3], johannesburg: [28, -26.2], luanda: [13.2, -8.8], douala: [9.7, 4],
};
// Destinations internationales : points hors du continent, sur les bords de la carte.
const WORLD: Record<string, [number, number]> = { europe: [6, 46], amerique: [-34, 22], bresil: [-34, -12], moyenOrient: [56, 30], asie: [62, 12], oceanIndien: [60, -22] };

const curve = (a: [number, number], b: [number, number], bend = 0.22) => {
  const [x1, y1] = a;
  const [x2, y2] = b;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  return `M${x1.toFixed(1)},${y1.toFixed(1)} Q${(mx - dy * bend).toFixed(1)},${(my + dx * bend).toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
};
const h = (k: string) => px(...HUBS[k]);
const w = (k: string) => px(...WORLD[k]);
const local = [["dakar", "abidjan"], ["abidjan", "lagos"], ["lagos", "kinshasa"], ["kinshasa", "nairobi"], ["nairobi", "johannesburg"], ["casablanca", "dakar"], ["cairo", "addis"], ["addis", "nairobi"], ["douala", "luanda"], ["luanda", "johannesburg"], ["lagos", "cairo"], ["abidjan", "kinshasa"]];
const intl = [["casablanca", "europe"], ["abidjan", "europe"], ["cairo", "europe"], ["dakar", "amerique"], ["abidjan", "bresil"], ["luanda", "bresil"], ["cairo", "moyenOrient"], ["addis", "asie"], ["nairobi", "asie"], ["johannesburg", "oceanIndien"]];

const lines = [
  ...local.map(([a, b]) => `<path d="${curve(h(a), h(b))}" stroke-width="3"/>`),
  ...intl.map(([a, b]) => `<path d="${curve(h(a), w(b), -0.18)}" stroke-width="3" stroke-dasharray="10 8"/>`),
].join("");
const nodes = [
  ...Object.keys(HUBS).map((k) => { const [x, y] = h(k); return `<circle cx="${x}" cy="${y}" r="11" fill="#E8731A"/><circle cx="${x}" cy="${y}" r="20" fill="none" stroke="#E8731A" stroke-width="3"/>`; }),
  ...Object.keys(WORLD).map((k) => { const [x, y] = w(k); return `<circle cx="${x}" cy="${y}" r="9" fill="none" stroke="#E8731A" stroke-width="4"/>`; }),
].join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<g fill="#7B1F2B">${dots.join("")}</g>
<g fill="none" stroke="#E8731A" stroke-linecap="round">${lines}</g>
${nodes}
</svg>`;

const out = path.join(process.cwd(), "public/brand");
writeFileSync(path.join(out, "afrique-connexions.svg"), svg);
await sharp(Buffer.from(svg)).resize(2000, 2000).png().toFile(path.join(out, "afrique-connexions.png"));
console.log(`afrique-connexions : ${dots.length} points, ${local.length} liaisons africaines, ${intl.length} internationales`);

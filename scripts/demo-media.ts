import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type postgres from "postgres";

const WIDTHS = [480, 960, 1600];
const PALETTES = [
  ["#3a5fa6", "#1b2d52"],
  ["#5b6b7d", "#232a33"],
  ["#2f6f62", "#132e29"],
  ["#7a4b3a", "#2e1c16"],
  ["#6a5ea6", "#272246"],
  ["#4d5a3a", "#1e2416"],
];

/** Ilustração genérica (não é fotografia de viatura real), claramente marcada como demonstração. */
function svg(label: string, angle: number, c: string[]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient></defs>
  <rect width="1600" height="1200" fill="url(#g)"/>
  <rect y="860" width="1600" height="340" fill="#000" opacity="0.18"/>
  <g transform="translate(800 720) rotate(${angle}) translate(-560 -170)" fill="none" stroke="#eef1f4" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" opacity="0.92">
    <path d="M20 250c10-40 50-60 110-70l150-30 100-70c50-30 110-46 190-46l150 4c60 3 95 20 110 50l16 45c10 30 10 60-4 86"/>
    <path d="M300 205l75-56c30-20 70-30 120-32l175-1c30 0 50 10 62 30l18 46"/>
    <path d="M95 255a84 84 0 0 1 166 0M615 255a84 84 0 0 1 166 0"/>
  </g>
  <text x="800" y="1080" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="700" fill="#ffffff" opacity="0.9">DEMONSTRAÇÃO · ${label}</text>
</svg>`;
}

export async function seedDemoMedia(sql: postgres.Sql, storageRoot: string) {
  const vehicles = (await sql`select id, reference, make, model from app.vehicles where is_demo order by reference`) as unknown as { id: string; reference: string; make: string; model: string }[];
  let n = 0;
  for (const [i, v] of vehicles.entries()) {
    const shots = [0, -4, 5];
    for (const [j, angle] of shots.entries()) {
      const base = `${v.id}/demo-${j + 1}`;
      const png = await sharp(Buffer.from(svg(v.reference, angle, PALETTES[i % PALETTES.length]!))).png().toBuffer();
      for (const w of WIDTHS) {
        const out = await sharp(png).resize({ width: w }).webp({ quality: 78 }).toBuffer();
        const file = path.join(storageRoot, "vehicle-media", `${base}-${w}.webp`);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, out);
      }
      await sql`insert into app.vehicle_media (vehicle_id, storage_path, width, height, alt_text, position, is_cover)
                values (${v.id}, ${base}, 1600, 1200, ${`Ilustração de demonstração ${v.make} ${v.model}`}, ${j}, ${j === 0})`;
      n++;
    }
  }
  return n;
}

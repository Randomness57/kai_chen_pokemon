import { writeFile, mkdir } from 'node:fs/promises';

// Must stay in sync with src/data.js ROSTER ids.
const IDS = [25, 133, 1, 4, 7, 39, 52, 143, 94, 130, 282, 700, 448, 6, 9, 3, 658, 149, 530, 150, 384, 718];
const BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';

async function grab(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) throw new Error(`Suspiciously small file for ${url}`);
  await writeFile(dest, buf);
}

await mkdir('images/shiny', { recursive: true });
for (const id of IDS) {
  await grab(`${BASE}/${id}.png`, `images/${id}.png`);
  await grab(`${BASE}/shiny/${id}.png`, `images/shiny/${id}.png`);
  console.log('saved', id);
}
await writeFile('images/manifest.json', JSON.stringify(IDS));
console.log(`done: ${IDS.length} Pokemon (normal + shiny)`);

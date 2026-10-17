// Baixa texturas PBR e céus HDRI gratuitos (licença CC0) da Poly Haven.
// Uso: npm run assets   (pode rodar de novo; pula o que já existe)
// O jogo funciona sem eles (usa texturas procedurais), mas fica bem mais realista com.
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');

// chave interna -> id na Poly Haven
export const TEXTURES = {
  brick: 'brick_wall_001',
  concrete: 'dirty_concrete',
  concreteForm: 'concrete_layers_02',
  concreteFloor: 'concrete_floor_damaged_01',
  rust: 'rusty_metal_02',
  corrugatedRust: 'rusty_corrugated_iron',
  corrugated: 'corrugated_iron_02',
  shutter: 'painted_metal_shutter',
  grass: 'leafy_grass',
  forestFloor: 'forest_floor',
  dirt: 'park_dirt',
  gravel: 'gravel_road',
  asphalt: 'asphalt_02',
  barkBroad: 'bark_brown_02',
  barkPine: 'pine_bark',
  roofTiles: 'grey_roof_tiles',
  wood: 'rough_wood',
  plaster: 'grey_plaster_02',
  plasterDamaged: 'damaged_plaster',
  sand: 'damp_beach_sand',
  sandCoarse: 'coast_sand_01',
  rock: 'rock_face',
  rockyGround: 'rocky_terrain_02',
  quarry: 'quarry_wall_02',
  boulder: 'rock_boulder_dry',
  mudDry: 'brown_mud_dry',
  parquet: 'rectangular_parquet',
  paintedBrick: 'painted_brick',
  palmBark: 'palm_bark',
};

export const HDRIS = {
  partlyCloudy: 'kloofendal_48d_partly_cloudy_puresky',
  overcast: 'kloofendal_overcast_puresky',
  sunset: 'belfast_sunset_puresky',
  cloudy: 'kloofendal_38d_partly_cloudy_puresky',
  noon: 'qwantani_noon_puresky',
  ridge: 'rocky_ridge_puresky',
  quarry: 'drackenstein_quarry_puresky',
  gym: 'crossfit_gym',
};

const MAPS = { diff: 'Diffuse', nor: 'nor_gl', arm: 'arm' };

async function exists(p) { try { await access(p); return true; } catch { return false; } }

async function download(url, dest) {
  if (await exists(dest)) return 'skip';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return 'ok';
}

async function main() {
  const manifest = { textures: {}, hdris: {}, license: 'CC0 — Poly Haven (polyhaven.com)' };
  for (const [key, id] of Object.entries(TEXTURES)) {
    try {
      const files = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
      manifest.textures[key] = { id };
      for (const [short, apiKey] of Object.entries(MAPS)) {
        const entry = files[apiKey]?.['1k']?.jpg;
        if (!entry) continue;
        const rel = `tex/${key}/${short}.jpg`;
        const r = await download(entry.url, join(ROOT, rel));
        manifest.textures[key][short] = rel;
        console.log(`${r === 'skip' ? '·' : '↓'} ${rel}`);
      }
    } catch (e) { console.warn(`! textura ${key} (${id}) falhou: ${e.message}`); }
  }
  for (const [key, id] of Object.entries(HDRIS)) {
    try {
      const files = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
      const rel = `hdri/${key}.hdr`;
      const r = await download(files.hdri['2k'].hdr.url, join(ROOT, rel));
      manifest.hdris[key] = { id, file: rel };
      console.log(`${r === 'skip' ? '·' : '↓'} ${rel}`);
    } catch (e) { console.warn(`! HDRI ${key} (${id}) falhou: ${e.message}`); }
  }
  await writeFile(join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('manifest.json escrito.');
}

main();

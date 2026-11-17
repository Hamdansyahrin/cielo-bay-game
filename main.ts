// main.ts — Cielo Bay entry program (Node 22, standard library only).
// Copies game/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with buildDossier from
// vendor/makefun-game.ts. Runs twice in the grader; both runs write
// identical bytes. The output directory itself is never deleted (it is
// a mount in the grader) — only its contents are cleared.
import { buildDossier } from './vendor/makefun-game.ts';
import {
  copyFileSync, existsSync, mkdirSync, readdirSync, rmSync,
  statSync, writeFileSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function copyTree(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  const entries = readdirSync(srcDir, { withFileTypes: true });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const src = join(srcDir, entry.name);
    const dest = join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyTree(src, dest);
    } else if (entry.isFile()) {
      copyFileSync(src, dest);
    }
  }
}

function clearContents(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    rmSync(join(dir, entry), { recursive: true, force: true });
  }
}

function main() {
  const gameSrc = join(repoRoot, 'game');
  const shotsSrc = join(repoRoot, 'screenshots');
  if (!existsSync(gameSrc) || !statSync(gameSrc).isDirectory()) {
    throw new Error('main.ts: game/ is missing from the repository');
  }
  if (!existsSync(shotsSrc) || !statSync(shotsSrc).isDirectory()) {
    throw new Error('main.ts: screenshots/ is missing from the repository');
  }
  mkdirSync(outDir, { recursive: true });
  clearContents(outDir);
  copyTree(gameSrc, join(outDir, 'game'));
  copyTree(shotsSrc, join(outDir, 'screenshots'));
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`cielo-bay: wrote ${join(outDir, 'dossier.json')} (${dossier.length} bytes)`);
}

main();

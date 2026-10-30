import { statSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// ============================================================
// IMAGE OPTIMIZATION (BRAIN.md §21/§24 performance pass)
// ------------------------------------------------------------
// Converts the photographic assets the app actually ships to WebP.
// Only images that are statically imported by src/ end up in dist/ —
// this manifest mirrors those imports; anything else in src/assets
// is repo-only weight and is intentionally left untouched.
//
// Usage:  node scripts/optimize-images.mjs [--check]
//   --check   report sizes only, write nothing (exit 1 if a WebP
//             is missing or larger than its source — useful in CI)
// ============================================================

const ROOT = dirname(fileURLToPath(import.meta.url)) + '/..';

// Source → WebP quality. Photos at q80 are visually indistinguishable
// from the source JPGs at these dimensions; the PNG logo keeps alpha
// and needs a higher quality to stay crisp at 120px render size.
const MANIFEST = [
  { file: 'src/assets/admin_library-1.jpg', quality: 80 },          // Home hero (LCP background)
  { file: 'src/assets/campus/college_auditorium.jpg', quality: 80 }, // PhotoCarousel 1
  { file: 'src/assets/campus/library_2nd_floor.jpg', quality: 80 },  // PhotoCarousel 2
  { file: 'src/assets/campus/computer_science_advance_lab.jpg', quality: 80 },
  { file: 'src/assets/campus/mechanical_lab1.jpg', quality: 80 },
  { file: 'src/assets/campus/college_playground.jpg', quality: 80 },
  { file: 'src/assets/mbslogo.png', quality: 90 },                   // Navbar logo (alpha)
];

const checkOnly = process.argv.includes('--check');
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

let totalBefore = 0;
let totalAfter = 0;
let failed = false;

for (const { file, quality } of MANIFEST) {
  const src = join(ROOT, file);
  const dst = src.replace(/\.(jpg|png)$/i, '.webp');
  const before = statSync(src).size;
  totalBefore += before;

  if (checkOnly) {
    let after;
    try {
      after = statSync(dst).size;
    } catch {
      console.error(`MISSING ${dst} — run: node scripts/optimize-images.mjs`);
      failed = true;
      continue;
    }
    totalAfter += after;
    if (after >= before) {
      console.error(`NOT SMALLER ${basename(dst)}: ${kb(before)} → ${kb(after)}`);
      failed = true;
    } else {
      console.log(`ok  ${basename(dst)}  ${kb(before)} → ${kb(after)}  (−${kb(before - after)})`);
    }
    continue;
  }

  await sharp(src).webp({ quality, effort: 5 }).toFile(dst);
  const after = statSync(dst).size;
  totalAfter += after;
  const delta = ((1 - after / before) * 100).toFixed(1);
  console.log(
    `${basename(dst)}  ${kb(before)} → ${kb(after)}  (−${delta}%)`
  );
}

console.log(
  `\nTotal: ${kb(totalBefore)} → ${kb(totalAfter)} (−${kb(totalBefore - totalAfter)}, ` +
    `${((1 - totalAfter / totalBefore) * 100).toFixed(1)}%)`
);

if (checkOnly && failed) process.exitCode = 1;

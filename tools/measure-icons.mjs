// Measures where each icon's drawing sits inside its square (transparent
// margins excluded) and stores it in assets/icons/icons.json as
// "box": [left, top, right, bottom], as fractions of the square the image is
// fitted into. registerImageProp uses it to centre the drawing, scale it to a
// common size and set it on a surface by its lowest point.
// Run after adding or changing icons: node tools/measure-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/icons');
const words = JSON.parse(readFileSync(resolve(dir, 'icons.json'), 'utf8'));
const types = { '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' };

const browser = await chromium.launch();
const page = await browser.newPage();
for (const w of words) {
  w.boxes = [];
  for (const f of w.files) {
    const uri = `data:${types[extname(f)]};base64,${readFileSync(resolve(dir, f)).toString('base64')}`;
    const box = await page.evaluate(async uri => {
      const N = 400, img = new Image();
      img.src = uri;
      await img.decode();
      const iw = img.naturalWidth || N, ih = img.naturalHeight || N, k = Math.min(N / iw, N / ih);
      const c = document.createElement('canvas');
      c.width = c.height = N;
      const g = c.getContext('2d');
      g.drawImage(img, (N - iw * k) / 2, (N - ih * k) / 2, iw * k, ih * k);
      const a = g.getImageData(0, 0, N, N).data;
      let x0 = N, y0 = N, x1 = -1, y1 = -1;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (a[(y * N + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < 0) return [0, 0, 1, 1];
      return [x0 / N, y0 / N, (x1 + 1) / N, (y1 + 1) / N].map(v => Math.round(v * 1000) / 1000);
    }, uri);
    w.boxes.push(box);
  }
}
await browser.close();
writeFileSync(resolve(dir, 'icons.json'), JSON.stringify(words, null, 1) + '\n');
console.log(`measured ${words.reduce((n, w) => n + w.files.length, 0)} icons`);

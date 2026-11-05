// Renders preview PNGs of the rig with Playwright.
// Usage: node tools/render-previews.mjs [outDir]
// Writes compare.png (reference next to the redraw), emotions.png (every
// emotion), visemes.png (talking mouth shapes) and hands.png (hand poses
// and props).
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(process.argv[2] || resolve(root, 'docs'));
mkdirSync(outDir, { recursive: true });

const rig = readFileSync(resolve(root, 'assets/goat/rig.svg'), 'utf8');
const ref = readFileSync(resolve(root, 'assets/goat/reference.png')).toString('base64');
const { EMOTIONS } = await import(resolve(root, 'src/emotions.js'));

const page = await (await chromium.launch()).newPage({ deviceScaleFactor: 1 });

async function shot(html, file, width, height) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><body style="margin:0;background:#fff;font:16px sans-serif">${html}</body>`);
  await page.screenshot({ path: resolve(outDir, file) });
  console.log('wrote', file);
}

// Each head needs its own scoped style, so render each one inside an iframe.
function frame(variants, label, w = 210, h = 270) {
  const css = Object.entries(variants)
    .map(([part, v]) => `[data-part="${part}"] > [data-variant]:not([data-variant="${v}"]){display:none}`)
    .join('');
  const svg = rig.replace('width="512" height="600"', `width="${w - 10}" height="${Math.round((w - 10) * 600 / 512)}"`);
  const doc = `<style>body{margin:0;text-align:center;font:15px sans-serif}${css}#hand-template,#props-library{display:none}</style>${svg}<div>${label}</div>`;
  return `<iframe style="border:0;width:${w}px;height:${h}px" srcdoc="${doc.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></iframe>`;
}

const happy = { eyes: 'happy', mouth: 'smile', brows: 'none', cheeks: 'off' };
await shot(`<img src="data:image/png;base64,${ref}" style="width:400px;vertical-align:top">` +
  frame(happy, '', 410, 480), 'compare.png', 830, 480);

await shot(Object.entries(EMOTIONS).map(([name, e]) =>
  frame({ eyes: e.eyes, mouth: e.mouth, brows: e.brows, cheeks: e.cheeks ? 'on' : 'off' }, name)).join(''),
  'emotions.png', 5 * 214, 2 * 274);

await shot(['viseme-a', 'viseme-e', 'viseme-o', 'viseme-u', 'viseme-m'].map(m =>
  frame({ eyes: 'open', mouth: m, brows: 'none', cheeks: 'off' }, m)).join(''), 'visemes.png', 5 * 214, 274);

// Hands and props.
const poses = ['open', 'point', 'grip', 'palm-up', 'thumbs-up'];
const props = [...rig.matchAll(/data-prop="([^"]+)"/g)].map(m => m[1]);
const defs = rig.match(/<defs>[\s\S]*?<\/defs>/)[0];
const handTpl = rig.match(/<g id="hand-template"[\s\S]*?(?=\s*<!-- Sample props)/)[0];
const propLib = rig.match(/<g id="props-library"[\s\S]*<\/g>(?=\s*<\/svg>)/)[0];

// Render each pose from a copy of the template with the other poses removed.
let handHtml = '<svg xmlns="http://www.w3.org/2000/svg" width="860" height="340">' + defs;
poses.forEach((p, i) => {
  const only = handTpl.replace('transform="translate(-200 -200)"', `transform="translate(${85 + i * 170} 80)"`)
    .replace(/id="hand-template"/, '')
    .replace(new RegExp(`<g data-pose="(?!${p}")[^"]+">[\\s\\S]*?\\n    </g>`, 'g'), '');
  handHtml += only;
});
props.forEach((p, i) => {
  const m = propLib.match(new RegExp(`<g data-prop="${p}"[\\s\\S]*?\\n    </g>`))[0];
  handHtml += `<g transform="translate(${80 + i * 160} 250)">${m}</g>`;
});
handHtml += '</svg>';
await shot(handHtml, 'hands.png', 860, 340);

process.exit(0);

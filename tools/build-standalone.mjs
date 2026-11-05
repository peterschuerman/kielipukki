// Builds one self-contained HTML file from demo/index.html, with the rig,
// the icons (as data: URIs) and the JavaScript modules inlined.
// The result works without a web server and can be shared as a single file.
// Usage: node tools/build-standalone.mjs [out.html]   (default: dist/kielipukki.html)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] || resolve(root, 'dist/kielipukki.html'));
const read = p => readFileSync(resolve(root, p), 'utf8');

// Turn an ES module into plain code that can share one <script type="module">.
const unmodule = src => src
  .replace(/^[ \t]*import .*\n/gm, '')
  .replace(/^export (const|async function|function|class) /gm, '$1 ');

const words = JSON.parse(read('assets/icons/icons.json'));
const types = { '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' };
const files = {};
for (const w of words) for (const f of w.files) {
  const data = readFileSync(resolve(root, 'assets/icons', f)).toString('base64');
  files[f] = `data:${types[extname(f)]};base64,${data}`;
}
const inline = { rig: read('assets/goat/rig.svg'), words, files };

const demo = read('demo/index.html');
const [, before, script, after] = demo.match(/^([\s\S]*<script type="module">)([\s\S]*?)(<\/script>[\s\S]*)$/);
const code = [
  `window.KIELIPUKKI_INLINE = ${JSON.stringify(inline).replace(/<\//g, '<\\/')};`,
  unmodule(read('src/emotions.js')),
  unmodule(read('src/kielipukki.js')),
  unmodule(read('src/icons.js')),
  unmodule(script),
].join('\n');

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, before + '\n' + code + '\n' + after);
console.log(`wrote ${out} (${Math.round((before.length + code.length + after.length) / 1024)} KB)`);

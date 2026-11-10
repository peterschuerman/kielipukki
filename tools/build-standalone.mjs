// Builds self-contained HTML files: the page, every JavaScript module it
// imports (followed recursively), the rig and the icons (as data: URIs) all
// in one file that works without a web server.
//
// Usage: node tools/build-standalone.mjs
// Writes dist/kielipukki.html (the demo) and dist/kielipukki-lessons.html.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(p, 'utf8');

const PAGES = [
  ['demo/index.html', 'dist/kielipukki.html'],
  ['lessons/index.html', 'dist/kielipukki-lessons.html'],
];

const IMPORT = /^[ \t]*import\s+(?:(\w+)|\{([^}]*)\})\s+from\s+'([^']+)';?[ \t]*\n/gm;

// Rewrite `import` lines into reads from the bundle's module table.
function rewriteImports(src, dir, deps) {
  return src.replace(IMPORT, (_, def, named, spec) => {
    const path = resolve(dir, spec);
    deps.push(path);
    const key = JSON.stringify(relative(root, path));
    if (def) return `const ${def} = __m[${key}].default;\n`;
    const names = named.split(',').map(s => s.trim()).filter(Boolean).map(s => s.replace(/\s+as\s+/, ': '));
    return `const { ${names.join(', ')} } = __m[${key}];\n`;
  });
}

// Wrap one module so its top-level names stay private, and return its exports.
function wrapModule(path, order, seen) {
  if (seen.has(path)) return;
  seen.add(path);
  const deps = [];
  let src = rewriteImports(read(path), dirname(path), deps);
  for (const d of deps) wrapModule(d, order, seen);
  const names = [];
  src = src.replace(/^export\s+(const|let|async function|function|class)\s+(\w+)/gm, (_, kind, name) => { names.push(name); return `${kind} ${name}`; });
  let hasDefault = false;
  src = src.replace(/^export\s+default\s+/m, () => { hasDefault = true; return 'const __default = '; });
  const exportsList = [...names, ...(hasDefault ? ['default: __default'] : [])].join(', ');
  order.push(`__m[${JSON.stringify(relative(root, path))}] = (() => {\n${src}\nreturn { ${exportsList} };\n})();`);
}

function inlineData() {
  const words = JSON.parse(read(resolve(root, 'assets/icons/icons.json')));
  const types = { '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' };
  const files = {};
  for (const w of words) for (const f of w.files) {
    files[f] = `data:${types[extname(f)]};base64,${readFileSync(resolve(root, 'assets/icons', f)).toString('base64')}`;
  }
  return { rig: read(resolve(root, 'assets/goat/rig.svg')), words, files };
}

const inline = JSON.stringify(inlineData()).replace(/<\//g, '<\\/');

for (const [page, outFile] of PAGES) {
  const pagePath = resolve(root, page);
  const html = read(pagePath);
  const [, before, script, after] = html.match(/^([\s\S]*<script type="module">)([\s\S]*?)(<\/script>[\s\S]*)$/);
  const deps = [], order = [], seen = new Set();
  const entry = rewriteImports(script, dirname(pagePath), deps);
  for (const d of deps) wrapModule(d, order, seen);
  const code = [`window.KIELIPUKKI_INLINE = ${inline};`, 'const __m = {};', ...order, entry].join('\n');
  const out = resolve(root, outFile);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, before + '\n' + code + '\n' + after);
  console.log(`wrote ${outFile} (${Math.round((before.length + code.length + after.length) / 1024)} KB)`);
}

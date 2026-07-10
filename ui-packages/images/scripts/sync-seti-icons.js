// Sync vendored seti-ui icon pack with upstream.
//
// Usage:
//   yarn sync-seti-icons            # pin to upstream master HEAD
//   yarn sync-seti-icons <sha>      # pin to a specific commit
//
// Workflow:
//   1. Resolve the upstream seti-ui SHA.
//   2. Read ../assets/file-icons/manifest.ts to learn which pack icons we use.
//   3. Fetch those SVGs in parallel from jesseweed/seti-ui at the pinned SHA
//      and write them under ../assets/file-icons/seti/svg/. Prune orphans.
//   4. Fetch upstream LESS sources, extract color tokens + icon→token map,
//      rewrite the `colors` field of ../assets/file-icons/seti/colors.json.
//   5. Regenerate ../assets/file-icons/seti/index.ts (SVGR ?react barrel).
//   6. Write the pinned SHA to ../assets/file-icons/seti/VERSION so the
//      Debian copyright pipeline can attribute the exact upstream snapshot.

import {
  existsSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const setiDir = resolve(pkgRoot, 'assets/file-icons/seti');
const svgDir = resolve(setiDir, 'svg');
const manifestPath = resolve(pkgRoot, 'assets/file-icons/manifest.ts');
const colorsJsonPath = resolve(setiDir, 'colors.json');
const indexPath = resolve(setiDir, 'index.ts');
const versionPath = resolve(setiDir, 'VERSION');

const raw = (sha, path) =>
  `https://raw.githubusercontent.com/jesseweed/seti-ui/${sha}/${path}`;

const get = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.text();
};

// 1. Resolve SHA (top-level await — Node 20+).
const arg = process.argv[2];
const sha = /^[0-9a-f]{7,40}$/i.test(arg ?? '')
  ? arg
  : (
      await (
        await fetch(
          'https://api.github.com/repos/jesseweed/seti-ui/commits/master',
        )
      ).json()
    ).sha;
console.log(`Pinning seti-ui to ${sha}`);

// 2. Collect the set of pack icon keys referenced by manifest.ts.
const manifestSrc = readFileSync(manifestPath, 'utf8');
const customBlock =
  manifestSrc.match(/customIcons[\s\S]*?\{([\s\S]*?)\};/)?.[1] ?? '';
const customKeys = new Set(
  [...customBlock.matchAll(/^\s*([A-Za-z0-9_]+)\s*:/gm)].map((m) => m[1]),
);
const keys = [
  ...new Set(
    [
      ...manifestSrc.matchAll(
        /(?:fileExtensions|fileNames)\s*:[^=]*=\s*\{([\s\S]*?)\n\};/g,
      ),
    ]
      .flatMap((b) =>
        [...b[1].matchAll(/:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]),
      )
      .filter((k) => !customKeys.has(k)),
  ),
  'default',
].sort();
console.log(`Manifest references ${keys.length} pack icons`);

// 3. Sync SVGs (parallel).
const svgs = await Promise.all(
  keys.map(async (k) => [k, await get(raw(sha, `icons/${k}.svg`))]),
);
let added = 0;
let updated = 0;
for (const [key, fresh] of svgs) {
  const target = resolve(svgDir, `${key}.svg`);
  if (!existsSync(target)) {
    writeFileSync(target, fresh);
    added++;
  } else if (readFileSync(target, 'utf8') !== fresh) {
    writeFileSync(target, fresh);
    updated++;
  }
}
const keep = new Set(keys.map((k) => `${k}.svg`));
const removed = readdirSync(svgDir).filter(
  (f) => f.endsWith('.svg') && !keep.has(f),
);
removed.forEach((f) => unlinkSync(resolve(svgDir, f)));

// 4. Resolve color tokens (hex + aliases) and pull the icon-name → token map.
const [vars, theme, mapping] = await Promise.all([
  get(raw(sha, 'styles/ui-variables.less')),
  get(raw(sha, 'styles/default-theme.less')),
  get(raw(sha, 'styles/components/icons/mapping.less')),
]);
const tokens = {};
const lessSrc = `${vars}\n${theme}`;
for (const [, k, v] of lessSrc.matchAll(
  /^@([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/gm,
)) {
  tokens[k] = v.toLowerCase();
}
const aliases = [...lessSrc.matchAll(/^@([\w-]+):\s*@([\w-]+)\s*;/gm)];
for (let i = 0; i < aliases.length; i++) {
  for (const [, k, target] of aliases) {
    if (!tokens[k] && tokens[target]) tokens[k] = tokens[target];
  }
}
// .icon-set / .icon-partial take (extension, iconName, @color);
// .icon takes (iconName, @color).
const colors = {};
const select = (name, token) => {
  if (!colors[name] && tokens[token] && keys.includes(name))
    colors[name] = tokens[token];
};
const threeArg =
  /\.icon(?:-set|-partial)\(\s*['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*@([\w-]+)\s*\)/g;
const twoArg = /\.icon\(\s*['"]([^'"]+)['"]\s*,\s*@([\w-]+)\s*\)/g;
for (const [, name, token] of mapping.matchAll(threeArg)) select(name, token);
for (const [, name, token] of mapping.matchAll(twoArg)) select(name, token);

const colorsDoc = JSON.parse(readFileSync(colorsJsonPath, 'utf8'));
colorsDoc.colors = Object.fromEntries(
  Object.keys(colors)
    .sort()
    .map((k) => [k, colors[k]]),
);
writeFileSync(colorsJsonPath, `${JSON.stringify(colorsDoc, null, 2)}\n`);

// 5. Regenerate the ?react barrel.
const ident = (k) => `Icon_${k.replace(/[^A-Za-z0-9]/g, '_')}`;
writeFileSync(
  indexPath,
  [
    '/* eslint-disable simple-import-sort/imports */',
    '/* eslint-disable prettier/prettier */',
    '// AUTO-GENERATED by scripts/sync-seti-icons.js — do not edit by hand.',
    "import { FunctionComponent, SVGProps } from 'react';",
    '',
    ...keys.map((k) => `import ${ident(k)} from './svg/${k}.svg?react';`),
    '',
    'export type PackSvgComponent = FunctionComponent<',
    '  SVGProps<SVGSVGElement> & { title?: string | undefined }',
    '>;',
    '',
    'export const packIconComponents: Record<string, PackSvgComponent> = {',
    ...keys.map((k) => `  '${k}': ${ident(k)},`),
    '};',
    '',
  ].join('\n'),
);

// 6. Record the pinned SHA next to the LICENSE so the Debian copyright /
// NOTICE pipeline can attribute the exact upstream snapshot.
const versionSrc = existsSync(versionPath)
  ? readFileSync(versionPath, 'utf8').trim()
  : '';
if (versionSrc !== sha) writeFileSync(versionPath, `${sha}\n`);

console.log('---');
console.log(`SHA:           ${sha}`);
console.log(`Added:         ${added}`);
console.log(`Updated:       ${updated}`);
console.log(
  `Removed:       ${removed.length}${
    removed.length ? ` (${removed.join(', ')})` : ''
  }`,
);
console.log(`Colors:        ${Object.keys(colors).length}/${keys.length} keys`);
console.log(`VERSION:       ${versionSrc === sha ? 'unchanged' : 'updated'}`);

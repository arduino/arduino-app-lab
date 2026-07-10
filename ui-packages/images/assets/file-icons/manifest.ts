/**
 * Drives the <FileIcon /> resolver.
 *
 * Two flavors of icon are supported:
 * - "pack" icons: SVGs from the Seti UI icon theme vendored under ./seti/svg/,
 *   mapped by their base filename without the .svg extension
 *   (e.g. typescript, image). See ./seti/LICENSE for upstream attribution.
 * - "custom" icons: React components from ../icons for icons Seti doesn't ship
 *   (.ino, .brick).
 *
 * Resolution order in <FileIcon />:
 * 1. exact filename match (case-insensitive) via `fileNames`
 * 2. extension match (case-insensitive) via `fileExtensions`
 * 3. fallback to `defaultFile`
 *
 * To seti-ui icons, run `yarn sync-seti-icons`
 *
 * To add a new custom existing icon, use the generic Icon component (see FileIno below)
 */

import { Bricks, FileIno } from '../icons';
import type { PackSvgComponent } from './seti';

export const customIcons: Record<string, PackSvgComponent> = {
  app_lab_ino: FileIno,
  app_lab_brick: Bricks,
};

export type CustomIconKey = 'app_lab_ino' | 'app_lab_brick';
export type IconKey = string | CustomIconKey;

export const defaultFile = 'default';

export const fileExtensions: Record<string, IconKey> = {
  // Arduino
  ino: 'app_lab_ino',
  pde: 'app_lab_ino',
  brick: 'app_lab_brick',

  // C / C++
  c: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  cxx: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cu: 'cu',

  // Python
  py: 'python',
  pyc: 'python',
  pyw: 'python',
  ipynb: 'notebook',

  // JS / TS
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'react',
  ts: 'typescript',
  tsx: 'react',

  // Data / config
  json: 'json',
  json5: 'json',
  jsonc: 'json',
  yaml: 'yml',
  yml: 'yml',
  toml: 'config',
  ini: 'config',
  conf: 'config',
  cfg: 'config',
  env: 'config',
  xml: 'xml',
  csv: 'csv',
  tsv: 'csv',

  // Docs
  md: 'markdown',
  mdx: 'markdown',
  markdown: 'markdown',
  rst: 'markdown',
  pdf: 'pdf',
  tex: 'tex',
  latex: 'tex',
  ltx: 'tex',
  sty: 'tex',

  // Web markup / styles
  html: 'html',
  htm: 'html',
  xhtml: 'html',
  css: 'css',
  scss: 'sass',
  sass: 'sass',
  less: 'less',
  styl: 'stylus',
  stylus: 'stylus',

  // Images
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  bmp: 'image',
  ico: 'image',
  webp: 'image',
  tiff: 'image',
  tif: 'image',
  heic: 'image',
  avif: 'image',
  svg: 'svg',
  psd: 'photoshop',
  ai: 'illustrator',

  // Audio / video
  mp3: 'audio',
  wav: 'audio',
  ogg: 'audio',
  flac: 'audio',
  aac: 'audio',
  m4a: 'audio',
  mp4: 'video',
  mov: 'video',
  avi: 'video',
  webm: 'video',
  mkv: 'video',
  m4v: 'video',

  // Archives
  zip: 'zip',
  tar: 'zip',
  gz: 'zip',
  tgz: 'zip',
  bz2: 'zip',
  '7z': 'zip',
  rar: 'zip',
  xz: 'zip',

  // Fonts
  ttf: 'font',
  otf: 'font',
  woff: 'font',
  woff2: 'font',
  eot: 'font',

  // Languages
  rs: 'rust',
  go: 'go',
  rb: 'ruby',
  java: 'java',
  jar: 'java',
  class: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  swift: 'swift',
  php: 'php',
  phtml: 'php',
  pl: 'perl',
  pm: 'perl',
  lua: 'lua',
  r: 'R',
  rdata: 'R',
  rds: 'R',
  dart: 'dart',
  ex: 'elixir',
  exs: 'elixir',
  elm: 'elm',
  clj: 'clojure',
  cljs: 'clojure',
  cljc: 'clojure',
  edn: 'clojure',
  hs: 'haskell',
  lhs: 'haskell',
  scala: 'scala',

  // Shells
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  fish: 'shell',
  ps1: 'powershell',
  psm1: 'powershell',
  bat: 'windows',
  cmd: 'windows',

  // Frameworks / DSLs
  vue: 'vue',
  svelte: 'svelte',
  graphql: 'graphql',
  gql: 'graphql',
  prisma: 'prisma',
  tf: 'terraform',
  tfvars: 'terraform',
  wasm: 'wasm',
  wat: 'wat',
  sol: 'ethereum',
  bzl: 'bazel',

  // Databases
  db: 'db',
  sqlite: 'db',
  sqlite3: 'db',
  sqlitedb: 'db',
  sql: 'db',

  // Misc
  lock: 'lock',
};

export const fileNames: Record<string, IconKey> = {
  // npm / yarn
  'package.json': 'npm',
  'package-lock.json': 'npm_ignored',
  'yarn.lock': 'yarn',
  '.npmignore': 'npm_ignored',
  '.npmrc': 'npm',
  '.yarnrc': 'yarn',
  '.yarnrc.yml': 'yarn',

  // TS / lint / style
  'tsconfig.json': 'tsconfig',
  '.eslintrc': 'eslint',
  '.eslintrc.js': 'eslint',
  '.eslintrc.cjs': 'eslint',
  '.eslintrc.json': 'eslint',
  '.eslintrc.yml': 'eslint',
  'eslint.config.js': 'eslint',
  'eslint.config.mjs': 'eslint',
  '.prettierrc': 'config',
  '.prettierrc.js': 'config',
  '.prettierrc.json': 'config',
  '.stylelintrc': 'config',
  '.editorconfig': 'editorconfig',

  // Git
  '.gitignore': 'git_ignore',
  '.gitattributes': 'git',
  '.gitmodules': 'git',
  '.gitlab-ci.yml': 'gitlab',

  // Docker
  '.dockerignore': 'docker',
  dockerfile: 'docker',
  'docker-compose.yml': 'docker',
  'docker-compose.yaml': 'docker',

  // App Lab
  'app.yaml': 'yml',

  // Project / build tools
  makefile: 'makefile',
  'cmakelists.txt': 'makefile',
  'platformio.ini': 'platformio',
  'pom.xml': 'maven',
  build: 'bazel',
  workspace: 'bazel',
  procfile: 'heroku',
  jenkinsfile: 'jenkins',
  'karma.conf.js': 'karma',
  'karma.conf.ts': 'karma',
  'gruntfile.js': 'grunt',
  'gulpfile.js': 'gulp',
  'gulpfile.babel.js': 'gulp',
  'bower.json': 'bower',
  '.bowerrc': 'bower',
  'firebase.json': 'firebase',
  '.firebaserc': 'firebase',
  '.codeclimate.yml': 'code-climate',

  // Bundlers / build configs
  'vite.config.ts': 'vite',
  'vite.config.js': 'vite',
  'webpack.config.js': 'webpack',
  'webpack.config.ts': 'webpack',
  'rollup.config.js': 'rollup',
  'rollup.config.ts': 'rollup',
  'babel.config.js': 'babel',
  'babel.config.json': 'babel',
  '.babelrc': 'babel',

  // Docs / meta
  license: 'license',
  'license.md': 'license',
  'license.txt': 'license',
  todo: 'todo',
  'todo.md': 'todo',

  // Specific images
  'favicon.ico': 'favicon',
};

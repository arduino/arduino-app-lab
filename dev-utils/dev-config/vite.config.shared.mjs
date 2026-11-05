import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { dts } from 'rolldown-plugin-dts';
import { pathToFileURL } from 'url';
import { fileURLToPath } from 'url';
import { esmExternalRequirePlugin, loadEnv } from 'vite';
import svgrModule from 'vite-plugin-svgr';

const svgr = svgrModule.default || svgrModule;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_ENV_DIR = '../../app/common/cloud-editor-standalone-config';

// Some pure-ESM dependencies ship compiled files with extension-less relative
// imports, which Node's native ESM loader rejects with ERR_MODULE_NOT_FOUND
// (bundlers auto-append the extension, so `vite dev`/`vite build` are fine, but
// Vitest hands externalized node_modules ESM to Node's loader). This resolve hook
// retries such a failed import once with `.js`. It is passed to the Vitest worker
// pools via execArgv so it applies only to tests — not the dev server or build.
// See ./vitest-esm-extension-fix.mjs. Version-independent: a no-op unless a
// resolution actually fails.
const ESM_EXTENSION_FIX_LOADER = pathToFileURL(
  path.resolve(__dirname, 'vitest-esm-extension-fix.mjs'),
).href;

// Node args for the Vitest worker pool. Vitest 4 removed `test.poolOptions`
// (the per-pool `execArgv`) in favour of a single top-level `test.execArgv`,
// which applies to whichever pool is active.
//
// `--no-experimental-webstorage` keeps jsdom's `localStorage`/`sessionStorage`
// reachable. Node 26 defines both as its own globals, and Vitest's
// `populateGlobal` skips any jsdom key that already exists on `globalThis`
// unless it is on its own allowlist, which these are not. Without the flag a
// test reads Node's `localStorage` — `undefined` unless `--localstorage-file`
// is given — instead of jsdom's. The flag needs Node >= 22.4; older versions
// exit with `bad option`. The repo pins 26.1.0 (setup-dev-env.sh, CI).
const VITEST_EXEC_ARGV = [
  '--loader',
  ESM_EXTENSION_FIX_LOADER,
  '--no-experimental-webstorage',
];

function libConfig({
  exportName,
  externalDependencies = [],
  plugins = [],
  options = {},
  noUI = false,
  vitestSetupFiles = [],
  envDir,
  dtsFirst = false,
} = {}) {
  return ({ command, mode }) => {
    const { build: buildOptions, ...restOptions } = options;

    return {
      base: './',
      plugins: [
        // Vite also runs `build.rollupOptions.plugins` for web worker bundles.
        // A worker cannot import from the host page, so its dependencies must
        // stay bundled; top-level plugins do not reach worker bundles.
        command === 'build'
          ? esmExternalRequirePlugin({ external: externalDependencies })
          : [],
        noUI ? [] : [react(), svgr()],
        // dts only makes sense for library builds. Vitest runs a dev server
        // (command === 'serve') with no rollup `input`, where
        // rolldown-plugin-dts' buildStart crashes on `Object.entries(input)`.
        // Restricting the plugins to `apply: 'build'` keeps them out of tests.
        // `dtsFirst` runs the plugins before Vite's TypeScript transform, which
        // otherwise strips a generated .d.ts down to `export {}`. It is opt-in:
        // running first also parses the real .d.ts files a package reaches, and
        // overloaded declarations there fail as duplicated exports.
        dts({
          compilerOptions: {
            noEmit: false,
            declaration: true,
          },
        }).map((plugin) => ({
          ...plugin,
          apply: 'build',
          ...(dtsFirst && { enforce: 'pre' }),
        })),
        ...plugins,
      ],
      build: {
        minify: mode !== 'development',
        cssMinify: 'esbuild',
        sourcemap: mode === 'development' ? 'inline' : false,
        lib: {
          entry: 'lib/index.ts',
          name: exportName,
          formats: ['es'],
          fileName: (format) => `${exportName}.${format}.js`,
          // Vite 6 renamed library CSS from style.css to <package-name>.css.
          // Since some packages use the library css with ./dist/style.css ,
          // the name has to be pinned.
          cssFileName: 'style',
        },
        rollupOptions: {
          output: {
            preserveModules: mode === 'development',
            // The plugin only converts a chunk back from its fake-JS form when
            // the chunk is named like a declaration, and it marks the dts entry
            // by suffixing the chunk name with `.d`. With `preserveModules`
            // every module comes through here, and only the entry gets the
            // package name.
            entryFileNames: (chunk) => {
              if (!chunk.isEntry) {
                return chunk.name.endsWith('.d') ? '[name].ts' : '[name].js';
              }

              return chunk.name.endsWith('.d')
                ? `${exportName}.d.ts`
                : `${exportName}.es.js`;
            },
          },
        },
        ...buildOptions,
      },
      appType: 'custom',
      envDir: envDir || DEFAULT_ENV_DIR,
      ssr:
        mode === 'test'
          ? {
              noExternal: ['@react-aria/i18n', 'react-aria'],
            }
          : undefined,
      test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: [
          '../../dev-utils/dev-config/tests-setup.ts',
          ...vitestSetupFiles,
        ],
        watch: false,
        cleanMocks: true,
        // Stylesheets are not processed for tests. jsdom's `getComputedStyle`
        // gets expensive once they are, and `getByRole`'s accessible-name
        // computation calls it per node: one such query cost ~580ms on a
        // 258-node tree and timed tests out on CI. CSS modules still resolve
        // to their hashed class names, so only computed styles are
        // unavailable.
        css: false,
        execArgv: VITEST_EXEC_ARGV,
      },
      ...restOptions,
    };
  };
}

const isPolyfillsModule = (id) =>
  !id.includes('/node_modules/') && /\/src\/polyfills\.ts$/.test(id);

function cloudEditorChunking(id) {
  // The serial uploader reads the Node `Buffer` and `process` globals when it
  // loads. index.html runs src/polyfills.ts first to set them, but a module
  // merged into the entry chunk runs after every chunk the entry imports. In
  // its own chunk it is imported first, so it runs before the uploader.
  if (isPolyfillsModule(id)) {
    return 'polyfills';
  }
  if (id.includes('@codemirror')) {
    return 'a-split';
  }
  // Keep React core (react, react-dom, scheduler) in its own dependency-free
  // leaf chunk. If it is bundled together with react-* libraries it ends up in
  // a circular dependency with the ui-components chunk, and with Vite 6 /
  // Rollup 4 chunk init ordering React can be accessed before it is
  // initialized, causing "undefined is not an object (evaluating 's.forwardRef')".
  if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
    return 'react-vendor';
  }
  // Everything else is left to Rolldown's automatic chunking. A named group
  // loads at startup, so a group for ui-components would also pull in the
  // components its lazy routes and lazy views import.
  return null;
}

// App Lab keeps the single b-split chunk. It loads the bundle from disk, and
// its production build has not been checked for chunk init-order errors
// without the group.
function appLabChunking(id) {
  const shared = cloudEditorChunking(id);
  if (shared) {
    return shared;
  }
  // The react-* libraries (react-modal, react-aria, ...) and ui-components are
  // mutually dependent. Splitting them into two chunks (b-split / c-split)
  // creates a circular dependency between those chunks; with Rollup 4 the init
  // order is no longer guaranteed and a module can be accessed before it is
  // initialized (e.g. "Cannot access 'q5' before initialization" in
  // react-modal). Keeping them in a single chunk keeps such cycles intra-chunk,
  // where Rollup resolves module ordering correctly (same as the dev server).
  if (id.includes('react-')) {
    return 'b-split';
  }
  // The exclusion that used to sit here kept ui-components/lib/code-editor out
  // of this chunk, so the .ino keyword table could split off on its own. The
  // editor cluster moved to ui-packages/ide-workbench (ADR-0002 phase 4a) and
  // is not matched by this rule at all, so it is already outside b-split and
  // the exclusion named a path that no longer exists.
  if (id.includes('ui-packages/ui-components')) {
    return 'b-split';
  }
  return null;
}

function appConfig({ port, envDir, pathLevel, isWails } = {}) {
  return ({ mode }) => {
    const startPath = !pathLevel
      ? '../../'
      : Array(pathLevel).fill('../').join('');
    const env = loadEnv(mode, envDir || DEFAULT_ENV_DIR);
    const baseRoute = isWails ? undefined : env.VITE_ROUTING_BASE_URL;

    const routesRootDir = getRoutesRootDir(env.VITE_ROUTER_TYPE, startPath);

    return {
      plugins: [
        augmentWithDatePlugin(),
        routesRootDir &&
          TanStackRouterVite({
            target: 'react',
            autoCodeSplitting: true,
            routesDirectory: `${routesRootDir}/routes`,
            generatedRouteTree: `${routesRootDir}/routeTree.gen.ts`,
          }),
        react(),
        svgr(),
        injectReloadInHtml(mode, isWails),
        !isWails && polyfillsFirst(),
      ],
      base: baseRoute ? `/${baseRoute}` : undefined,
      preview: {
        port: env.VITE_PORT || port || 8000,
      },
      build: {
        cssMinify: 'esbuild',
        sourcemap: false,
        rollupOptions: {
          output: {
            // Rolldown replaces Rollup's `manualChunks` with the more flexible
            // `codeSplitting` option. A group whose `name` is a function
            // behaves like the old `manualChunks(id)` callback: the returned
            // string is the chunk name, `null` falls back to automatic chunking.
            codeSplitting: {
              groups: [
                { name: isWails ? appLabChunking : cloudEditorChunking },
              ],
            },
            sourcemapBaseUrl:
              mode === 'test' || mode === 'production'
                ? env.VITE_APP_URL
                : undefined,
          },
        },
      },
      server:
        mode === 'test' || mode === 'production'
          ? undefined
          : {
              ...(isWails
                ? {
                    hmr: {
                      host: 'localhost',
                      protocol: 'ws',
                    }, // fix for wails hmr: https://github.com/wailsapp/wails/issues/3064
                  }
                : {}),
              host: '127.0.0.1',
              port: env.VITE_PORT || port || 8000,
              strictPort: true,
              https: devServerHttps(),
            },
      optimizeDeps:
        mode === 'test' || mode === 'production'
          ? {
              exclude: [],
            }
          : {
              exclude: [
                '@bcmi-labs/cloud-editor-images',
                '@bcmi-labs/cloud-editor-ui-components',
                '@bcmi-labs/cloud-editor-common',
                '@bcmi-labs/cloud-editor-core-ui',
                '@bcmi-labs/cloud-editor-create-agent-client-ts',
                '@bcmi-labs/cloud-editor-web-board-communication',
                '@bcmi-labs/cloud-editor-board-communication-tools',
                '@bcmi-labs/cloud-editor-domain',
                '@bcmi-labs/cloud-editor-infrastructure',
                '@bcmi-labs/cloud-editor-component',
                '@bcmi-labs/app-lab-desktop',
              ],
            },
      ssr:
        mode === 'test'
          ? {
              noExternal: [
                '@react-aria/i18n',
                'react-aria',
                '@cloud-editor-ui-components',
              ],
            }
          : undefined,
      envDir: envDir || DEFAULT_ENV_DIR,
      publicDir: `${startPath}ui-packages/images/public`,
      css: {
        devSourcemap: mode === 'development',
      },
      test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: [`${startPath}dev-utils/dev-config/tests-setup.ts`],
        watch: false,
        cleanMocks: true,
        css: false,
        execArgv: VITEST_EXEC_ARGV,
      },
    };
  };
}

// Workaround for 'react-virtualized' issue: https://github.com/uber/baseweb/issues/4129#issuecomment-1208168306
// No longer needed for react-virtualized 9.22.5 - exports are already present
function augmentWithDatePlugin() {
  return {
    name: 'augment-with-date',
    augmentChunkHash() {
      return Date.now().toString();
    },
  };
}

function getRoutesRootDir(type, prefix) {
  if (type === 'app-lab') {
    return `${prefix}app/core-ui/src/app-lab`;
  }
  if (type === 'cloud-editor') {
    return undefined;
    // TODO enable once cloud-editor is using @tanstack/react-router
    // return '../../app/core-ui/src/cloud-editor';
  }
  return undefined;
}

function devServerHttps() {
  const certDir = __dirname;
  const keyPath = path.join(certDir, 'localhost+1-key.pem');
  const certPath = path.join(certDir, 'localhost+1.pem');

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.warn(
      `\n\u26a0\ufe0f  No local certificate in ${certDir} \u2014 serving over http.` +
        `\n   Generate one with mkcert to serve over https.\n`,
    );
    return undefined;
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
}

// Fails the build when src/polyfills.ts would run after another chunk: the
// page would then load blank with "Buffer is not defined" (see
// cloudEditorChunking).
function polyfillsFirst() {
  return {
    name: 'cloud-editor:polyfills-first',
    apply: 'build',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter((c) => c.type === 'chunk');
      const owner = chunks.find((c) =>
        Object.keys(c.modules).some(isPolyfillsModule),
      );
      if (!owner) return;

      const isRuntime = (fileName) =>
        Object.keys(bundle[fileName]?.modules ?? {}).some((id) =>
          id.includes('rolldown/runtime'),
        );

      for (const entry of chunks.filter((c) => c.isEntry)) {
        const [first] = entry.imports.filter((f) => !isRuntime(f));
        const polyfillsRunFirst =
          owner === entry ? first === undefined : first === owner.fileName;
        if (!polyfillsRunFirst) {
          this.error(
            `${entry.fileName} imports ${first} before src/polyfills.ts ` +
              `(in ${owner.fileName}) runs`,
          );
        }
      }
    },
  };
}

function injectReloadInHtml(mode, isWails) {
  if (isWails && mode !== 'production') {
    return {
      name: 'inject-reload-in-html',
      apply: 'serve',
      transformIndexHtml() {
        return [
          {
            tag: 'script',
            children: `
              if (!('go' in window)) {
                location.replace('/');
              }`,
            injectTo: 'head',
            order: 'post',
          },
        ];
      },
    };
  }
}

export { appConfig, libConfig };

const react = require('@vitejs/plugin-react');
const path = require('path');
const dts = require('vite-plugin-dts').default;
const svgr = require('vite-plugin-svgr').default;
const fs = require('fs');
const { loadEnv } = require('vite'); // TODO - CJS deprecated in Node API of Vite 6
const { TanStackRouterVite } = require('@tanstack/router-plugin/vite');

const DEFAULT_ENV_DIR = '../../app/common/cloud-editor-standalone-config';

function libConfig(
  exportName,
  externalDependencies = [],
  plugins = [],
  options = {},
  noUI = false,
  vitestSetupFiles = [],
  envDir,
) {
  return ({ mode }) => {
    const { build: buildOptions, ...restOptions } = options;

    return {
      base: './',
      plugins: [
        reactVirtualized(),
        noUI ? [] : [react(), svgr()],
        dts({
          insertTypesEntry: true,
        }),
        ...plugins,
      ],
      build: {
        minify: mode !== 'development',
        sourcemap: mode === 'development' ? 'inline' : false,
        lib: {
          entry: 'lib/index.ts',
          name: exportName,
          formats: ['es'],
          fileName: (format) => `${exportName}.${format}.js`,
        },
        rollupOptions: {
          output: {
            preserveModules: mode === 'development',
          },
          external: externalDependencies,
        },
        ...buildOptions,
      },
      appType: 'custom',
      envDir: envDir || DEFAULT_ENV_DIR,
      test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: [
          '../../dev-utils/dev-config/tests-setup.ts',
          ...vitestSetupFiles,
        ],
        watch: false,
        cleanMocks: true,
        css: true, // we might want to disable it, if we won't have tests that rely on CSS since parsing CSS is slow
      },
      ...restOptions,
    };
  };
}

function defaultChunking(id) {
  if (id.includes('@cloud-editor-mono/images')) {
    return 'images';
  }
  if (id.includes('@codemirror')) {
    return 'a-split';
  }
  if (id.includes('react-')) {
    return 'b-split';
  }
  if (
    id.includes('ui-packages/ui-components') &&
    !id.includes('ui-packages/ui-components/lib/code-editor') // separate code-editor to permit code splitting of keywords
  ) {
    return 'c-split';
  }
}

function appConfig(port, envDir, pathLevel, isWails) {
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
        reactVirtualized(),
        routesRootDir &&
          TanStackRouterVite({
            target: 'react',
            autoCodeSplitting: true,
            routesDirectory: `${routesRootDir}/routes`,
            generatedRouteTree: `${routesRootDir}/routeTree.gen.ts`,
          }),
        react(),
        svgr(),
      ],
      base: baseRoute ? `/${baseRoute}` : undefined,
      preview: {
        port: env.VITE_PORT || port || 8000,
      },
      build: {
        sourcemap: false,
        rollupOptions: {
          output: {
            ...(!isWails
              ? {
                  manualChunks: defaultChunking,
                }
              : {
                  manualChunks: defaultChunking,
                }),
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
              https: isWails
                ? null
                : {
                    key: fs.readFileSync(
                      `${startPath}dev-utils/dev-config/localhost+1-key.pem`,
                    ),
                    cert: fs.readFileSync(
                      `${startPath}dev-utils/dev-config/localhost+1.pem`,
                    ),
                  },
            },
      optimizeDeps:
        mode === 'test' || mode === 'production'
          ? undefined
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
                '@bcmi-labs/app-lab-desktop',
              ],
            },
      envDir: envDir || DEFAULT_ENV_DIR,
      publicDir: `${startPath}ui-packages/images/public`,
      css: {
        devSourcemap: mode === 'development',
      },
    };
  };
}

// Workaround for 'react-virtualized' issue: https://github.com/uber/baseweb/issues/4129#issuecomment-1208168306
const BAD_CODE = `import { bpfrpt_proptype_WindowScroller } from "../WindowScroller.js";`;
function reactVirtualized() {
  return {
    name: 'my:react-virtualized',
    configResolved() {
      const file = require
        .resolve('react-virtualized')
        .replace(
          path.join('dist', 'commonjs', 'index.js'),
          path.join('dist', 'es', 'WindowScroller', 'utils', 'onScroll.js'),
        );
      const code = fs.readFileSync(file, 'utf-8');
      const modified = code.replace(BAD_CODE, '');
      fs.writeFileSync(file, modified);
    },
  };
}

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

module.exports = { appConfig, libConfig };

// Using js with module.exports as a workaround
// in relation to the below:
// https://github.com/vitejs/vite/issues/5370

import { libConfig } from '@cloud-editor-mono/dev-config';
import { defineConfig } from 'vite';

import pkgJson from './package.json';

const pkg: any = pkgJson;

const externalDependencies = pkg.peerDependencies
  ? Object.keys(pkg.peerDependencies)
  : [];

export default defineConfig(
  libConfig({
    exportName: 'domain',
    externalDependencies,
    options: {
      css: {
        modules: {
          hashPrefix: pkg.name,
        },
      },
    },
    vitestSetupFiles: ['./tests-setup.ts'],
  }),
);

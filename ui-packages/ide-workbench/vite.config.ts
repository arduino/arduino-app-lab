import { libConfig } from '@cloud-editor-mono/dev-config';
import { defineConfig } from 'vite';

import pkgJson from './package.json';

const pkg = pkgJson as {
  name: string;
  peerDependencies?: Record<string, string>;
};

const externalDependencies = pkg.peerDependencies
  ? Object.keys(pkg.peerDependencies)
  : [];

export default defineConfig(
  libConfig({
    exportName: 'ide-workbench',
    externalDependencies,
    options: {
      css: {
        modules: {
          hashPrefix: pkg.name,
        },
      },
    },
  }),
);

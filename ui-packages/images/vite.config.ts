import { libConfig } from '@cloud-editor-mono/dev-config';
import { defineConfig } from 'vite';

import pkgJson from './package.json';

const pkg: any = pkgJson;

const externalDependencies = pkg.peerDependencies
  ? Object.keys(pkg.peerDependencies)
  : [];

export default defineConfig(libConfig('images', externalDependencies));

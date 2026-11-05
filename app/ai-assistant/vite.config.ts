import { libConfig } from '@cloud-editor-mono/dev-config';
import { defineConfig } from 'vite';

import pkgJson from './package.json';

const pkg: { name: string; peerDependencies?: Record<string, string> } =
  pkgJson;

const externalDependencies = pkg.peerDependencies
  ? Object.keys(pkg.peerDependencies)
  : [];

export default defineConfig((env) => {
  const config = libConfig({
    exportName: 'ai-assistant',
    externalDependencies,
    options: {
      css: {
        modules: {
          hashPrefix: pkg.name,
        },
      },
    },
    vitestSetupFiles: ['./tests-setup.ts'],
  })(env);
  // No test here asserts on CSS (layout and paint are only ever checked on the real engines),
  // and letting jsdom parse the stylesheet on every render cost this suite 30x: the two
  // AgentPanelContainer render tests took 0.5-0.7s each locally and over 25s on a CI runner.
  return { ...config, test: { ...config.test, css: false } };
});

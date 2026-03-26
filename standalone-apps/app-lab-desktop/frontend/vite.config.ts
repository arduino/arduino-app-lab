import { appConfig } from '@cloud-editor-mono/dev-config';
import { defineConfig } from 'vite';

export default defineConfig(
  appConfig({
    envDir: '../../../app/common/app-lab-config',
    pathLevel: 3,
    isWails: true,
  }),
);

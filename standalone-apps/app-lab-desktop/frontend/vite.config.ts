import { appConfig } from '@cloud-editor-mono/dev-config';
import { defineConfig } from 'vite';

export default defineConfig(
  appConfig(undefined, '../../../app/common/app-lab-config', 3, true),
);

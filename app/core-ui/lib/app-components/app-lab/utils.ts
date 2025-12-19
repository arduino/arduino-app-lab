import { resetAppFilesState } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';

export function resetModuleScopedState(): void {
  resetAppFilesState();
}

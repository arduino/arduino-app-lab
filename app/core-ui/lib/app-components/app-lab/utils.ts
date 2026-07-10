import { resetAppFilesState } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { clearEditorStateCaches } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export function resetModuleScopedState(): void {
  resetAppFilesState();
  clearEditorStateCaches();
}

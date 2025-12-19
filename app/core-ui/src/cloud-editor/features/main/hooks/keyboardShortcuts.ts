import { getOS } from '@cloud-editor-mono/domain';
import { useEvent } from 'react-use';

const os = getOS();

export function useSaveFileShortcut(
  saveFile: (fileId: string) => Promise<void>,
  fileId?: string,
): void {
  useEvent('keydown', (event) => {
    if (
      (event.ctrlKey || (os === 'Mac OS' && event.metaKey)) &&
      event.key === 's'
    ) {
      event.preventDefault();
      if (fileId) {
        saveFile(fileId);
      }
    }
  });
}

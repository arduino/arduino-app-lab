import { openBoardTerminal } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { snackbar } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export interface UseTerminal {
  onOpenTerminal: () => Promise<void>;
}

export const useTerminal = (): UseTerminal => {
  const onOpenTerminal = async (): Promise<void> => {
    try {
      const result = await openBoardTerminal();
      // The terminal selected in the settings could not be started and another
      // one was used instead: the user has to know it.
      if (result?.warning) {
        snackbar({
          message: result.warning,
          variant: 'warning',
        });
      }
    } catch (e) {
      snackbar({
        message: (e as Error).message,
        variant: 'error',
      });
    }
  };

  return { onOpenTerminal };
};

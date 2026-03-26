import { SystemPropertyValue } from '@cloud-editor-mono/infrastructure';
import { create } from 'zustand';

interface SystemPropsStore {
  data?: Record<string, SystemPropertyValue>;
  isSuccess?: boolean;
  isError?: boolean;
  setData: (data: Record<string, string | undefined>) => void;
  setError: (isError: boolean) => void;
  isSetupDone: () => boolean;
}

export enum SystemPropKey {
  SetupBoardName = 'setup-board-name',
  SetupKeyboard = 'setup-keyboard-name',
  SetupCredentials = 'setup-credentials',
  SetupNetwork = 'setup-network',
}

export const useSystemPropsStore = create<SystemPropsStore>((set, get) => ({
  data: undefined,
  isSuccess: undefined,
  isError: undefined,
  setData: (data: Record<string, string | undefined>): void =>
    set({ data, isSuccess: true, isError: false }),
  setError: (isError: boolean): void => set({ isError, isSuccess: !isError }),
  isSetupDone: (): boolean => {
    const data = get().data;
    return (
      data &&
      data[SystemPropKey.SetupBoardName] &&
      data[SystemPropKey.SetupKeyboard] &&
      data[SystemPropKey.SetupCredentials]
    );
  },
}));

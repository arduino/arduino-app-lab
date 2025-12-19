import {
  getSystemProperty,
  getSystemPropertyKeys,
  upsertSystemProperty,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { SystemPropertyValue } from '@cloud-editor-mono/infrastructure';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';

import { useBoardLifecycleStore } from './boards/boards';

interface SystemPropsStore {
  data?: Record<string, SystemPropertyValue>;
  isSuccess?: boolean;
  isError?: boolean;
  setData: (data: Record<string, string | undefined>) => void;
  setError: (isError: boolean) => void;
  isSetupDone: () => boolean;
}

type UseSystemProps = () => {
  systemProps: Record<string, SystemPropertyValue> | undefined;
  getPropsError: boolean | undefined;
  getPropsSuccess: boolean | undefined;
  getPropsLoading: boolean | undefined;
  upsertPropsLoading: boolean | undefined;
  upsertProp: (prop: {
    key: SystemPropKey;
    value: string;
  }) => Promise<SystemPropertyValue>;
};

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

export const useSystemProps: UseSystemProps = () => {
  const { setData, setError } = useSystemPropsStore();

  const queryClient = useQueryClient();

  const { boardIsReachable } = useBoardLifecycleStore();

  const {
    data: systemProps,
    isSuccess: getPropsSuccess,
    isError: getPropsError,
    isLoading: getPropsLoading,
  } = useQuery<Record<string, string | undefined>>(
    ['system-properties'],
    async () => {
      const storedKeys = await getSystemPropertyKeys();
      const obj = {} as Record<string, SystemPropertyValue>;
      for (const key of Object.values(SystemPropKey)) {
        if (storedKeys.includes(key)) {
          const value = await getSystemProperty(key);
          obj[key] = value;
        }
      }
      return obj;
    },
    {
      onError: () => {
        setError(true);
      },
      onSuccess: (data) => {
        setData(data);
      },
      refetchOnWindowFocus: false,
      enabled: boardIsReachable,
    },
  );

  const { mutateAsync, isLoading: upsertPropsLoading } = useMutation({
    mutationFn: async (prop: {
      key: SystemPropKey;
      value: SystemPropertyValue;
    }) => upsertSystemProperty(prop.key, prop.value),
    onSuccess: (_, { key, value }) => {
      queryClient.setQueryData<Record<string, SystemPropertyValue>>(
        ['system-properties'],
        (prevProps) => ({ ...prevProps, [key]: value }),
      );
    },
  });

  return {
    systemProps,
    getPropsError,
    getPropsSuccess,
    getPropsLoading,
    upsertPropsLoading,
    upsertProp: mutateAsync,
  };
};

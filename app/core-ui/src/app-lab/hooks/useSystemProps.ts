import {
  getSystemProperty,
  getSystemPropertyKeys,
  upsertSystemProperty,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { SystemPropertyValue } from '@cloud-editor-mono/infrastructure';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';

import { useBoardLifecycleStore } from '../store/boardLifecycle';
import { SystemPropKey, useSystemPropsStore } from '../store/systemProps';

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

export const useSystemProps: UseSystemProps = () => {
  const { setData, setError } = useSystemPropsStore(
    useShallow((state) => ({
      setData: state.setData,
      setError: state.setError,
    })),
  );

  const queryClient = useQueryClient();

  const boardIsReachable = useBoardLifecycleStore(
    (state) => state.boardIsReachable,
  );

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

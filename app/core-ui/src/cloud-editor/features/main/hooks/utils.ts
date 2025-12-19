import { useCallback, useMemo } from 'react';

import { CoreCommandType } from '../main.type';

type UseCachedCompilation = () => {
  deleteCompilationData: () => void;
  setCompilationData: (
    id: string,
    fqbn: string,
    type?: CoreCommandType,
  ) => void;
  id: string | null;
  type: CoreCommandType | null;
  fqbn: string | null;
};

export let compileDataWasStored = false;
const compilationDataKey = 'compilationId';

export function clearCompileDataWasStored(): void {
  compileDataWasStored = false;
}

export const useCacheCompile: UseCachedCompilation =
  function (): ReturnType<UseCachedCompilation> {
    const compilationId = sessionStorage.getItem(compilationDataKey);
    const setCompilationData = useCallback(
      (id: string, fqbn: string, type = 'verify'): void => {
        compileDataWasStored = true;
        sessionStorage.setItem(compilationDataKey, `${id}|${type}|${fqbn}`);
      },
      [],
    );

    const deleteCompilationData = useCallback((): void => {
      sessionStorage.removeItem(compilationDataKey);
    }, []);

    const [id, type, fqbn] = useMemo(() => {
      if (!compilationId) return [null, null, null];

      const [id, type, fqbn] = compilationId.split('|');

      return [id, type as CoreCommandType, fqbn];
    }, [compilationId]);

    return {
      deleteCompilationData,
      setCompilationData,
      id,
      type,
      fqbn,
    };
  };

// Variables for board selection exceptions in IoT context
export const ARDUINO_PACKAGER = 'arduino';
export const ARDUINO_UNSTABLE_SERIAL_NUMBER_BOARDS = [
  'arduino:mbed_nano:nanorp2040connect',
];
export const THIRD_PARTY_STABLE_SERIAL_NUMBER_BOARDS = [
  'esp32:esp32:nano_nora',
];

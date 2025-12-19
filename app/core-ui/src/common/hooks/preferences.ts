import {
  getPreferencesSubjectById,
  restorePreferencesSubject,
  setPreferenceValue,
} from '@cloud-editor-mono/domain/src/services/preferences-service';
import {
  defaultPreferences,
  Preferences,
  PreferenceValue,
} from '@cloud-editor-mono/ui-components/lib/sidenav/sections/settings/settings.type';
import { useCallback, useEffect, useState } from 'react';
import { BehaviorSubject, NEVER, Observable } from 'rxjs';

import { useObservable } from './useObservable';

export type UsePreferences = () => {
  setPreference: (id: Preferences, value: PreferenceValue) => void;
  restorePreferences: () => void;
};

export const usePreferences: UsePreferences =
  function (): ReturnType<UsePreferences> {
    const setPreference = useCallback(
      (id: Preferences, value: PreferenceValue): void => {
        setPreferenceValue(id, value);
      },
      [],
    );

    const restorePreferences = useCallback(() => {
      restorePreferencesSubject();
    }, []);

    return {
      setPreference,
      restorePreferences,
    };
  };

export function usePreferenceObservable<T extends Preferences>(
  preferenceId: T,
): typeof defaultPreferences[T] | undefined {
  const [preferenceSubject$, setPreferenceSubject$] = useState<
    BehaviorSubject<typeof defaultPreferences[T]> | Observable<never>
  >(NEVER);

  useEffect(() => {
    (async (): Promise<void> => {
      const subject$ = await getPreferencesSubjectById(preferenceId);

      setPreferenceSubject$(subject$ || NEVER);
    })();
  }, [preferenceId, preferenceSubject$]);

  const preferenceItem =
    useObservable<typeof defaultPreferences[T]>(preferenceSubject$);

  return preferenceSubject$ instanceof BehaviorSubject
    ? preferenceItem
    : undefined;
}

import {
  defaultPreferences,
  Preferences,
  PreferenceValue,
} from '@cloud-editor-mono/ui-components/lib/sidenav/sections/settings/settings.type';
import { getMany, set } from 'idb-keyval';
import { BehaviorSubject } from 'rxjs';
import { ValueOf } from 'type-fest';

export type PreferenceSubjectById<T extends Preferences> =
  | BehaviorSubject<typeof defaultPreferences[T]>
  | undefined;

export type PreferenceSubjectIdParam = Preferences;

type PreferencesMap = Map<Preferences, BehaviorSubject<PreferenceValue>>;

interface PreferencesState {
  preferencesSubjects?: PreferencesMap;
}

let preferencesState: PreferencesState = {};

export function resetPreferencesState(): void {
  preferencesState = {};
}

function createPreferencesState(
  currentState: PreferencesState,
  newStateProps: Partial<PreferencesState>,
): PreferencesState {
  return {
    ...currentState,
    ...newStateProps,
  };
}

function setPreferencesState(newStateProps: Partial<PreferencesState>): void {
  preferencesState = createPreferencesState(preferencesState, newStateProps);
}

export function instantiatePreferencesSubject(
  initialValue: PreferencesMap,
): PreferencesMap {
  const preferencesSubjects = new Map<
    Preferences,
    BehaviorSubject<PreferenceValue>
  >(initialValue);

  setPreferencesState({ preferencesSubjects });

  return preferencesSubjects;
}

export async function getPreferencesSubjects(
  initialValue?: PreferencesMap,
): Promise<PreferencesMap> {
  let { preferencesSubjects } = preferencesState;
  if (preferencesSubjects) return preferencesSubjects;

  const initial = initialValue ?? (await getDefaultPreferences());

  preferencesSubjects = instantiatePreferencesSubject(initial);

  return preferencesSubjects;
}

export async function setPreferenceValue(
  id: Preferences,
  value: ValueOf<typeof defaultPreferences>,
): Promise<void> {
  const preferenceSubject$ = await getPreferencesSubjectById(id);

  if (!preferenceSubject$) {
    throw new Error(`Preference subject with id ${id} not found`);
  }

  preferenceSubject$.next(value);
}

export async function getPreferencesSubjectById<T extends Preferences>(
  id: T,
): Promise<PreferenceSubjectById<T>>;
export async function getPreferencesSubjectById(
  id: Preferences,
): Promise<PreferenceSubjectById<Preferences> | undefined> {
  const preferencesSubjects = await getPreferencesSubjects();

  return preferencesSubjects.get(id);
}

export function restorePreferencesSubject(): void {
  Object.values(defaultPreferences).forEach((value, index) => {
    const preferenceId = Object.keys(defaultPreferences)[index] as Preferences;
    setPreferenceValue(preferenceId, value);
  });
}

export function createPreferencesSubject<
  P extends BehaviorSubject<ValueOf<typeof defaultPreferences>>,
>(id: Preferences, preference$: P, preferencesSubjects: PreferencesMap): P {
  preferencesSubjects.set(id, preference$);

  preference$.subscribe((value) => {
    set(id, value);
  });

  return preference$;
}

async function getDefaultPreferences(): Promise<PreferencesMap> {
  const preferencesSubjects = new Map<
    Preferences,
    BehaviorSubject<PreferenceValue>
  >();

  const defaultPreferencesKeys = Object.keys(defaultPreferences);
  const defaultPreferencesValues = Object.values(defaultPreferences);

  const preferredValues: ValueOf<typeof defaultPreferences>[] = await getMany(
    defaultPreferencesKeys,
  );

  preferredValues.forEach((value, index) => {
    const preferenceId = defaultPreferencesKeys[index] as Preferences;
    const subject = new BehaviorSubject<PreferenceValue>(
      value ?? defaultPreferencesValues[index],
    );
    createPreferencesSubject(preferenceId, subject, preferencesSubjects);
  });

  return preferencesSubjects;
}

import {
  CodeEditorText,
  REVERTIBLE_INJECT_ID_SUFFIX,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { uniqueId } from 'lodash';
import {
  BehaviorSubject,
  debounce,
  filter,
  finalize,
  interval,
  map,
  NEVER,
  Observable,
  pairwise,
  scan,
  shareReplay,
  startWith,
  Subject,
} from 'rxjs';

import { addToSet, removeFromSet } from '../utils';
import {
  ArduinoAppFile,
  ArduinoAppFilesService,
  BaseCodeChange,
  CodeChange,
  CodeChangeWithCtx,
  CodeSubjectById,
  CodeSubjectIdParam,
  CodeSubjectInjection,
  FileId,
  isCodeChangeWithCtx,
  isEffectualEmission,
  SaveCode,
  SetUnsavedFileTuple,
  valueHasChanged,
} from './arduinoAppFilesService.type';

interface AppFilesState {
  codeSubjects?: Map<FileId, BehaviorSubject<CodeChange>>;
  unsavedFiles$?: Subject<SetUnsavedFileTuple> | Subject<Set<FileId>>;
  codeSubjectInjections$?: Subject<CodeSubjectInjection>;
}

let appFilesState: AppFilesState = {};

export function resetAppFilesState(): void {
  appFilesState = {};
}

function createAppFilesState(
  currentState: AppFilesState,
  newStateProps: Partial<AppFilesState>,
): AppFilesState {
  return {
    ...currentState,
    ...newStateProps,
  };
}

function setAppFilesState(newStateProps: Partial<AppFilesState>): void {
  appFilesState = createAppFilesState(appFilesState, newStateProps);
}

const defaultCodeSubject: Map<FileId, BehaviorSubject<CodeChange>> = new Map<
  FileId,
  BehaviorSubject<CodeChange>
>();
export function instantiateCodeSubject(
  initialValue: Map<FileId, BehaviorSubject<CodeChange>>,
): Map<FileId, BehaviorSubject<CodeChange>> {
  const codeSubjects = new Map<FileId, BehaviorSubject<CodeChange>>(
    initialValue,
  );
  setAppFilesState({ codeSubjects });

  return codeSubjects;
}

function instantiateUnsavedFilesSubject():
  | Subject<SetUnsavedFileTuple>
  | Subject<Set<FileId>> {
  const unsavedFiles$ = new Subject<SetUnsavedFileTuple>().pipe(
    scan<SetUnsavedFileTuple, Set<FileId>>(
      (unsavedFilesIds, [fileId, loading]) => {
        return loading
          ? addToSet(unsavedFilesIds, fileId)
          : removeFromSet(unsavedFilesIds, fileId);
      },
      new Set(),
    ),
    shareReplay(1),
  ) as Subject<SetUnsavedFileTuple> | Subject<Set<FileId>>;

  setAppFilesState({ unsavedFiles$ });

  return unsavedFiles$;
}

function instantiateCodeInjectionsSubject(): Subject<CodeSubjectInjection> {
  const codeSubjectInjections$ = new Subject<CodeSubjectInjection>().pipe(
    finalize(() => {
      codeSubjectInjectionsSub.unsubscribe();
    }),
    shareReplay(1),
  ) as Subject<CodeSubjectInjection>;

  const codeSubjectInjectionsSub = codeSubjectInjections$.subscribe(
    ({
      fileId,
      value,
      initialContext,
      isLibrary,
      lineToScroll,
      fromAssist,
    }) => {
      const subjectValue = getCodeSubjectById(fileId).getValue();

      const injectedValue = isLibrary
        ? `${value}\n` + subjectValue.value
        : value;

      const codeSubjectValue = getCodeSubjectById(fileId).getValue();

      codeSubjectNext(
        fileId,
        injectedValue,
        isCodeChangeWithCtx(codeSubjectValue)
          ? codeSubjectValue.context.saveCode
          : initialContext.saveCode,
        undefined,
        true,
        undefined,
        lineToScroll,
        fromAssist,
      );
    },
  );

  setAppFilesState({ codeSubjectInjections$ });

  return codeSubjectInjections$;
}

export function getCodeSubjects(
  initialValue: Map<FileId, BehaviorSubject<CodeChange>> = defaultCodeSubject,
): Map<FileId, BehaviorSubject<CodeChange>> {
  let { codeSubjects } = appFilesState;
  if (codeSubjects) return codeSubjects;

  codeSubjects = instantiateCodeSubject(initialValue);

  return codeSubjects;
}

export function getCodeSubjectById<T>(id: T): CodeSubjectById<T>;
export function getCodeSubjectById(
  id: CodeSubjectIdParam,
): CodeSubjectById<CodeSubjectIdParam> {
  const codeSubjects = getCodeSubjects();
  const subject$ = typeof id === 'string' ? codeSubjects.get(id) : NEVER;

  if (subject$ === undefined) {
    throw new Error(`Code subject with id ${id} not found`);
  }
  return subject$;
}

export const codeSubjectDebounceInterval = 1000;
export function getUnsavedFilesSubject<
  T extends Subject<SetUnsavedFileTuple> | Subject<Set<FileId>>,
>(): T {
  let { unsavedFiles$ } = appFilesState;
  if (unsavedFiles$) return unsavedFiles$ as unknown as T;

  unsavedFiles$ = instantiateUnsavedFilesSubject();

  return unsavedFiles$ as unknown as T;
}

export function getUnsavedFilesSubjectNext(
  fileId: string,
  value: boolean,
): void {
  const unsavedFiles$ = getUnsavedFilesSubject<Subject<SetUnsavedFileTuple>>();

  unsavedFiles$.next([fileId, value]);
}

export function getCodeInjectionsSubject(): Subject<CodeSubjectInjection> {
  let { codeSubjectInjections$ } = appFilesState;
  if (codeSubjectInjections$) return codeSubjectInjections$;

  codeSubjectInjections$ = instantiateCodeInjectionsSubject();

  return codeSubjectInjections$;
}

export function codeInjectionsSubjectNext(
  fileId: CodeSubjectInjection['fileId'],
  value: CodeSubjectInjection['value'],
  initialContext: CodeSubjectInjection['initialContext'],
  isLibrary: boolean,
  lineToScroll?: number,
  fromAssist?: boolean,
): boolean {
  const subjectValue = getCodeSubjectById(fileId).getValue();

  if (subjectValue.value.indexOf(value) !== -1) {
    return false;
  }

  const subject$ = getCodeInjectionsSubject();

  subject$.next({
    fileId,
    value,
    initialContext,
    isLibrary,
    lineToScroll,
    fromAssist,
  });

  return true;
}

function lastChangeInTimeFrame(duration: number) {
  return function <T extends CodeChange>(
    source: Observable<T>,
  ): BehaviorSubject<CodeChangeWithCtx> {
    return source.pipe(
      // when codeChange$ is subscribed, it will emit its code value along with an initialChange flag,
      // meaning that a file code has just been selected and considered active
      // when don't need to do anything, just filter the change and skip it.
      filter<CodeChange, CodeChangeWithCtx>(isCodeChangeWithCtx),
      // start handling a code update time frame of 1s.
      debounce(() => interval(duration)),
    ) as BehaviorSubject<CodeChangeWithCtx>;
    // We need to type assert the result because BehaviorSubject.pipe
    // is not typed from rxjs by design.
  };
}

export function createCodeSubject(
  data: ArduinoAppFile,
  debounceInterval = codeSubjectDebounceInterval,
): BehaviorSubject<CodeChange> {
  const fileId = data.path;
  const initialCode = data.content;

  const initialValue: BaseCodeChange = {
    fileId,
    meta: {
      initialChange: true,
      instanceId: uniqueId(),
      ext: data.extension,
      hash: data.hash,
    },
    value: initialCode,
  };
  const codeChange$ = new BehaviorSubject<CodeChange>(initialValue);

  const lastCodeUpdate$ = codeChange$.pipe(
    lastChangeInTimeFrame(debounceInterval),
    // `startWith(initialValue)` needed to fill buffer for pairwise,
    // this is to avoid a save call when the first change results in no
    // actual change in code value
    startWith(initialValue),
    pairwise(),
    // emits `CodeChange`s only when code value changes
    filter(isEffectualEmission),
    map(([, curr]) => curr),
    finalize(() => {
      lastCodeUpdateSub.unsubscribe();
    }),
  ) as BehaviorSubject<CodeChangeWithCtx>;

  const unsavedFiles$ = getUnsavedFilesSubject<Subject<SetUnsavedFileTuple>>();

  // subscribe to a not-initial code change in a time frame of 1s,
  // save it if is different from the previous one.
  const lastCodeUpdateSub = lastCodeUpdate$.subscribe(
    async ({ context, value, meta }) => {
      unsavedFiles$.next([fileId, true]);

      try {
        const result = await context.saveCode(fileId, value, meta.hash);

        if (result && 'isUnsaved' in result && result?.isUnsaved) return;
        unsavedFiles$.next([fileId, false]);

        if (result && 'newHash' in result) {
          codeSubjectNext(
            fileId,
            value,
            context.saveCode,
            undefined,
            false,
            result?.newHash,
          );
        }
      } catch (error) {
        console.error(error);
      }
    },
  );

  const lastIneffectualCodeChange$ = codeChange$.pipe(
    lastChangeInTimeFrame(debounceInterval),
    scan(
      (prev, curr) => ({
        isSameCode: !valueHasChanged(prev, curr),
        value: curr.value,
        meta: { doc: curr.meta.doc },
      }),
      {
        isSameCode: false,
        value: initialCode,
        meta: {},
      },
    ),
    filter(({ isSameCode }) => isSameCode),
    finalize(() => {
      lastIneffectualCodeChangeSub.unsubscribe();
    }),
  );

  const lastIneffectualCodeChangeSub = lastIneffectualCodeChange$.subscribe(
    () => {
      unsavedFiles$.next([fileId, false]);
    },
  );

  return codeChange$;
}

export function setCodeSubjects(
  data: ArduinoAppFile,
  debounceInterval = codeSubjectDebounceInterval,
): void {
  const codeSubjects = getCodeSubjects();
  const subject = createCodeSubject(data, debounceInterval);
  codeSubjects.set(data.path, subject);
}

export function removeCodeSubjectBySketchPath(sketchPath: string): void {
  const codeSubjects = getCodeSubjects();

  codeSubjects.forEach((subject) => {
    const filePath = subject.getValue().fileId;

    // Check if filePath starts with the exact sketchPath followed by a '/'
    const regex = new RegExp(`^${sketchPath}/`);
    if (regex.test(filePath)) {
      removeCodeSubject(filePath);
    }
  });
}

export function removeCodeSubject(path: string): void {
  const codeSubject$ = getCodeSubjectById(path);
  codeSubject$.complete();

  const codeSubjects = getCodeSubjects();
  codeSubjects.delete(path);
}

export function codeSubjectNext(
  fileId: FileId,
  value: string,
  saveCode: SaveCode,
  doc?: CodeEditorText,
  shouldUpdate = false,
  newHash?: string,
  lineToScroll?: number,
  fromAssist?: boolean,
): void {
  const codeSubject$ = getCodeSubjectById(fileId);
  const unsavedFiles$ = getUnsavedFilesSubject<Subject<SetUnsavedFileTuple>>();

  unsavedFiles$.next([fileId, true]);

  const currInstanceId = codeSubject$.getValue().meta.instanceId;

  const wasManualChangeAfterAssistApply =
    !shouldUpdate && currInstanceId.includes(REVERTIBLE_INJECT_ID_SUFFIX);

  const shouldCreateUid =
    (shouldUpdate || wasManualChangeAfterAssistApply) && !fromAssist;

  const shouldSuffixId =
    (shouldUpdate || wasManualChangeAfterAssistApply) && fromAssist;

  let instanceId = currInstanceId;

  const idAlreadyHasSuffix = instanceId.includes(REVERTIBLE_INJECT_ID_SUFFIX);
  if (shouldCreateUid) {
    instanceId =
      idAlreadyHasSuffix && wasManualChangeAfterAssistApply
        ? instanceId.split(REVERTIBLE_INJECT_ID_SUFFIX)[0]
        : uniqueId();
  } else if (shouldSuffixId) {
    instanceId = `${
      idAlreadyHasSuffix ? uniqueId() : instanceId
    }${REVERTIBLE_INJECT_ID_SUFFIX}`;
  }

  const ext = codeSubject$.getValue().meta.ext;
  const hash = newHash || codeSubject$.getValue().meta.hash;
  codeSubject$.next({
    fileId,
    value,
    meta: {
      initialChange: false,
      instanceId,
      doc,
      ext,
      hash,
      lineToScroll,
    },
    context: {
      saveCode,
    },
  });
}

export let getAppFileTree: ArduinoAppFilesService['getAppFileTree'] =
  async function () {
    throw new Error('getAppFileTree method not implemented');
  };

export let getAppFiles: ArduinoAppFilesService['getAppFiles'] =
  async function () {
    throw new Error('getAppFiles method not implemented');
  };

export let getAppFileContent: ArduinoAppFilesService['getAppFileContent'] =
  async function () {
    throw new Error('getFileContent method not implemented');
  };

export let saveAppFile: ArduinoAppFilesService['saveAppFile'] =
  async function () {
    throw new Error('saveSketchFile method not implemented');
  };

export let createAppFile: ArduinoAppFilesService['createAppFile'] =
  async function () {
    throw new Error('createSketchFile method not implemented');
  };

export let renameAppFile: ArduinoAppFilesService['renameAppFile'] =
  async function () {
    throw new Error('renameSketch method not implemented');
  };

export let removeAppFile: ArduinoAppFilesService['removeAppFile'] =
  async function () {
    throw new Error('deleteSketchFile method not implemented');
  };

export let createAppFolder: ArduinoAppFilesService['createAppFolder'] =
  async function () {
    throw new Error('createAppFolder method not implemented');
  };

export const setArduinoAppFilesService = (
  service: ArduinoAppFilesService,
): void => {
  getAppFileTree = service.getAppFileTree;
  getAppFiles = service.getAppFiles;
  getAppFileContent = service.getAppFileContent;
  saveAppFile = service.saveAppFile;
  createAppFile = service.createAppFile;
  renameAppFile = service.renameAppFile;
  removeAppFile = service.removeAppFile;
  createAppFolder = service.createAppFolder;
};

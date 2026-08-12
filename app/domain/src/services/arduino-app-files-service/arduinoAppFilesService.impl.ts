import {
  CodeEditorText,
  REVERTIBLE_INJECT_ID_SUFFIX,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { uniqueId } from 'lodash-es';
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
import { eventsOn } from '../wails-service/wailsService.impl';
import {
  ArduinoAppFilesService,
  BaseCodeChange,
  CodeChange,
  CodeChangeWithCtx,
  CodeReloadCause,
  CodeReloadEvent,
  CodeSubjectById,
  CodeSubjectIdParam,
  CodeSubjectInjection,
  CodeSubjectSeed,
  FileId,
  isCodeChangeWithCtx,
  isEffectualEmission,
  REFRESH_EVENT,
  RefreshEvent,
  SaveCode,
  SetUnsavedFileTuple,
  valueHasChanged,
} from './arduinoAppFilesService.type';

interface AppFilesState {
  codeSubjects?: Map<FileId, BehaviorSubject<CodeChange>>;
  unsavedFiles$?: Subject<SetUnsavedFileTuple> | Subject<Set<FileId>>;
  codeSubjectInjections$?: Subject<CodeSubjectInjection>;
  // Emits once per in-place buffer reload; the editor observes it to re-render
  // so CodeMirror can reconcile the new instanceId, and other consumers can
  // react to the reload cause.
  codeReload$?: BehaviorSubject<CodeReloadEvent | undefined>;
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

// A stable, always-present signal the editor subscribes to (see
// `useCodeReloadEvent`). It emits once per in-place buffer reload so the editor
// re-renders and CodeMirror reconciles the file's new instanceId; the payload
// also lets other consumers react to the reload cause. Being a dedicated
// subject (not the per-file code subject) means the editor can observe it with
// no retry/lifecycle handling.
export function getCodeReloadSubject(): BehaviorSubject<
  CodeReloadEvent | undefined
> {
  let { codeReload$ } = appFilesState;
  if (codeReload$) return codeReload$;

  codeReload$ = new BehaviorSubject<CodeReloadEvent | undefined>(undefined);
  setAppFilesState({ codeReload$ });

  return codeReload$;
}

export function codeInjectionsSubjectNext(
  fileId: CodeSubjectInjection['fileId'],
  value: CodeSubjectInjection['value'],
  initialContext: CodeSubjectInjection['initialContext'],
  isLibrary: boolean,
  lineToScroll?: number,
  fromAssist?: boolean,
): boolean {
  const codeSubjects = getCodeSubjects();
  const subject$ = codeSubjects.get(fileId);
  if (!subject$) {
    console.warn(
      `codeInjectionsSubjectNext: no code subject for ${fileId}; skipping injection`,
    );
    return false;
  }

  if (subject$.getValue().value.indexOf(value) !== -1) {
    return false;
  }

  const injectionsSubject$ = getCodeInjectionsSubject();

  injectionsSubject$.next({
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
  data: CodeSubjectSeed,
  debounceInterval = codeSubjectDebounceInterval,
): BehaviorSubject<CodeChange> {
  const fileId = data.path;
  const initialCode = data.content;
  const dotIdx = fileId.lastIndexOf('.');
  const ext = dotIdx === -1 ? '' : fileId.slice(dotIdx + 1);

  const initialValue: BaseCodeChange = {
    fileId,
    meta: {
      initialChange: true,
      instanceId: uniqueId(),
      ext,
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
  // Read the fileId from the emission rather than the closure so a renamed
  // buffer (see `renameCodeSubject`) saves to its new path, not the old one.
  const lastCodeUpdateSub = lastCodeUpdate$.subscribe(
    async ({ context, value, meta, fileId: currentFileId }) => {
      unsavedFiles$.next([currentFileId, true]);

      try {
        const result = await context.saveCode(currentFileId, value, meta.hash);

        if (result && 'isUnsaved' in result && result?.isUnsaved) return;
        unsavedFiles$.next([currentFileId, false]);

        if (result && 'newHash' in result) {
          codeSubjectNext(
            currentFileId,
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
        fileId: curr.fileId,
        meta: { doc: curr.meta.doc },
      }),
      {
        isSameCode: false,
        value: initialCode,
        fileId,
        meta: {},
      },
    ),
    filter(({ isSameCode }) => isSameCode),
    finalize(() => {
      lastIneffectualCodeChangeSub.unsubscribe();
    }),
  );

  const lastIneffectualCodeChangeSub = lastIneffectualCodeChange$.subscribe(
    ({ fileId: currentFileId }) => {
      unsavedFiles$.next([currentFileId, false]);
    },
  );

  return codeChange$;
}

export function setCodeSubjects(
  data: CodeSubjectSeed,
  debounceInterval = codeSubjectDebounceInterval,
): void {
  const codeSubjects = getCodeSubjects();
  const subject = createCodeSubject(data, debounceInterval);
  codeSubjects.set(data.path, subject);
}

// reloadCodeSubject overrides an already-open file's buffer with freshly fetched
// content, in place on its existing subject. It mints a new instanceId so
// CodeMirror reloads its doc (the editor observes the subject and reconciles on
// instanceId change), and marks the emission as an initial change so the save
// pipeline ignores it — no save-back, no unsaved flag. Use when content changed
// underneath us (external change / refetch), never for user edits. No-op if the
// file isn't currently open, or if the fetched content matches the buffer.
export function reloadCodeSubject(
  path: string,
  content: string,
  cause: CodeReloadCause,
): void {
  const codeSubjects = getCodeSubjects();
  const subject$ = codeSubjects.get(path);
  if (!subject$) return;

  const prev = subject$.getValue();
  // Identical content needs no reload, and the new instanceId is not free:
  // it makes CodeMirror rebuild the editor state, resetting cursor and
  // scroll. Every file selection triggers a refetch, so that rebuild races
  // whatever positioned the cursor after the switch — the LSP reference
  // panel's selection dispatch loses that race on slow disks and lands the
  // user at the top of the file.
  if (prev.value === content) return;

  subject$.next({
    fileId: path,
    value: content,
    meta: {
      initialChange: true,
      instanceId: uniqueId(),
      ext: prev.meta.ext,
      hash: prev.meta.hash,
    },
  });

  // Signal the editor to re-render so CodeMirror reconciles the new instanceId,
  // and let other consumers react to why the reload happened.
  getCodeReloadSubject().next({ id: uniqueId(), fileId: path, cause });
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
  const codeSubjects = getCodeSubjects();
  const codeSubject$ = codeSubjects.get(path);
  // Idempotent: removing a path with no open buffer (a folder, an
  // already-removed file) is a no-op, not an error — mirrors renameCodeSubject.
  if (!codeSubject$) return;

  codeSubject$.complete();
  codeSubjects.delete(path);
}

export function renameCodeSubject(oldPath: string, newPath: string): void {
  if (oldPath === newPath) return;
  const codeSubjects = getCodeSubjects();
  const subject = codeSubjects.get(oldPath);
  if (!subject) return;
  codeSubjects.set(newPath, subject);
  codeSubjects.delete(oldPath);
  const current = subject.getValue();
  subject.next({ ...current, fileId: newPath });
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
  const codeSubjects = getCodeSubjects();
  const codeSubject$ = codeSubjects.get(fileId);
  if (!codeSubject$) {
    console.warn(
      `codeSubjectNext: no code subject for ${fileId}; skipping update`,
    );
    return;
  }
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
  async function (
    _path: string,
    _newName: string,
    _nodeType?: 'file' | 'folder',
  ) {
    throw new Error('renameSketch method not implemented');
  };

export let removeAppFile: ArduinoAppFilesService['removeAppFile'] =
  async function () {
    throw new Error('deleteSketchFile method not implemented');
  };

export let moveAppFile: ArduinoAppFilesService['moveAppFile'] =
  async function () {
    throw new Error('moveAppFile method not implemented');
  };

export let createAppFolder: ArduinoAppFilesService['createAppFolder'] =
  async function () {
    throw new Error('createAppFolder method not implemented');
  };

export let selectResourcePathToImport: ArduinoAppFilesService['selectResourcePathToImport'] =
  async function () {
    throw new Error('selectResourcePathToImport method not implemented');
  };

export let importResourceToAppFromPath: ArduinoAppFilesService['importResourceToAppFromPath'] =
  async function () {
    throw new Error('importResourceToAppFromPath method not implemented');
  };

export let importDroppedResourceToApp: ArduinoAppFilesService['importDroppedResourceToApp'] =
  function () {
    // The real service isn't bound yet. In production this never happens
    // (dependencies are injected before render), but during dev hot-reload the
    // service singletons can reset before `injectDependencies()` re-runs. Warn
    // and return a no-op unsubscribe — throwing here would blow up the React
    // effect cleanup that calls it. A full reload re-injects the real impl.
    console.warn('importDroppedResourceToApp called before service injection');
    return () => {};
  };

// Filesystem watch controls. Default to no-ops so non-desktop platforms (and
// dev hot-reload before injection) simply don't watch.
const noopWatch = async (): Promise<void> => {};

export let watchApp: ArduinoAppFilesService['watchApp'] = noopWatch;
export let unwatchApp: ArduinoAppFilesService['unwatchApp'] = noopWatch;
export let watchAppsDir: ArduinoAppFilesService['watchAppsDir'] = noopWatch;
export let unwatchAppsDir: ArduinoAppFilesService['unwatchAppsDir'] = noopWatch;
export let unwatchAll: ArduinoAppFilesService['unwatchAll'] = noopWatch;

// Typed subscription to the backend `refresh` event: normalizes the raw
// transport callback into a `RefreshEvent` and drops empty payloads, so
// consumers don't re-declare the event shape. Returns an unsubscribe fn.
export function onWatcherRefresh(
  callback: (event: RefreshEvent) => void,
): () => void {
  return eventsOn(REFRESH_EVENT, (payload?: RefreshEvent) => {
    if (!payload) return;
    callback(payload);
  });
}

export const setArduinoAppFilesService = (
  service: ArduinoAppFilesService,
): void => {
  getAppFileTree = service.getAppFileTree;
  getAppFiles = service.getAppFiles;
  getAppFileContent = service.getAppFileContent;
  saveAppFile = service.saveAppFile;
  createAppFile = service.createAppFile;
  renameAppFile = service.renameAppFile;
  moveAppFile = service.moveAppFile;
  removeAppFile = service.removeAppFile;
  createAppFolder = service.createAppFolder;
  selectResourcePathToImport = service.selectResourcePathToImport;
  importResourceToAppFromPath = service.importResourceToAppFromPath;
  importDroppedResourceToApp = service.importDroppedResourceToApp;
  watchApp = service.watchApp;
  unwatchApp = service.unwatchApp;
  watchAppsDir = service.watchAppsDir;
  unwatchAppsDir = service.unwatchAppsDir;
  unwatchAll = service.unwatchAll;
};

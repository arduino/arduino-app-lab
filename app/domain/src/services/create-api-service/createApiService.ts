import { FileLineScope, trimFileExtension } from '@cloud-editor-mono/common';
import {
  createAliveRequest,
  CreateUser_Response,
  deleteLibraryRequest,
  DeleteSketchFile_Response,
  deleteSketchFileRequest,
  deleteSketchRequest,
  FileChange_Params,
  getCustomLibraries,
  getCustomLibraryCode,
  getFileContentsRequest,
  getFileHash,
  GetFileHash_Params,
  GetFileHash_Response,
  getFilesListRequest,
  GetLibrary_Response,
  GetLibraryCode_Params,
  GetLibraryCode_Response,
  getReleaseLibraryFilesRequest,
  getSketchesRequest,
  getSketchRequest,
  getUserRequest,
  moveSketchRequest,
  PostSketchFile_Response,
  postSketchFileRequest,
  postSketchRequest,
  putSketchRequest,
  saveLibraryRequest,
  SketchSecrets,
} from '@cloud-editor-mono/infrastructure';
import {
  CodeEditorText,
  REVERTIBLE_INJECT_ID_SUFFIX,
  SUPPORTED_IMAGE_TYPES,
} from '@cloud-editor-mono/ui-components';
import dotenv from 'dotenv';
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
import { WretchError } from 'wretch/resolver';

import {
  getAccessToken,
  NO_AUTH_TOKEN_PLACEHOLDER,
  noTokenReject,
} from '../arduino-auth';
import { RetrieveExampleFileContentsResult } from '../builder-api-service';
import {
  createBuilderSecretsFile,
  injectSecretsFileInclude,
} from '../secrets-service';
import { getSpace } from '../space-storage';
import {
  addToSet,
  decodeBase64ToString,
  removeFromSet,
  transformContentToDataByMimeType,
  transformDataToContentByMimeType,
} from '../utils';
import {
  createZipArchive,
  exportZipFolder,
  FileAdapter,
  readZipArchive,
} from '../zip-service';
import {
  AssociateSketchWithDevicePayload,
  AssociateSketchWithLibrariesPayload,
  BaseCodeChange,
  CodeChange,
  CodeChangeWithCtx,
  CodeSubjectById,
  CodeSubjectIdParam,
  CodeSubjectInjection,
  CreateSketchResult,
  FileId,
  GetLibrariesListResult,
  GetSketchesResult,
  GetSketchResult,
  isCodeChangeWithCtx,
  isEffectualEmission,
  MarkSketchVisibilityPayload,
  RetrieveFileContentsResult,
  RetrieveFilesListResult,
  SaveCode,
  SetUnsavedFileTuple,
  SketchUserId,
  valueHasChanged,
} from './createApiService.type';
import { getResourceOwner, SKETCH_META_FILE } from './utils';

export const DEFAULT_SKETCH_NAME = 'EditorBeta_Sketch';

export const DEFAULT_SKETCH_USER_ID: SketchUserId = 'me';

export const defaultSketchInoContent =
  'LyoNDSovDQ12b2lkIHNldHVwKCkgew0gICAgDX0NDXZvaWQgbG9vcCgpIHsNICAgIA19DQ==';

interface CreateApiState {
  codeSubjects?: Map<FileId, BehaviorSubject<CodeChange>>;
  unsavedFiles$?: Subject<SetUnsavedFileTuple> | Subject<Set<FileId>>;
  codeSubjectInjections$?: Subject<CodeSubjectInjection>;
}

let createApiState: CreateApiState = {};

export function resetCreateApiState(): void {
  createApiState = {};
}

function createCreateApiState(
  currentState: CreateApiState,
  newStateProps: Partial<CreateApiState>,
): CreateApiState {
  return {
    ...currentState,
    ...newStateProps,
  };
}

function setCreateApiState(newStateProps: Partial<CreateApiState>): void {
  createApiState = createCreateApiState(createApiState, newStateProps);
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
  setCreateApiState({ codeSubjects });

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

  setCreateApiState({ unsavedFiles$ });

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

  setCreateApiState({ codeSubjectInjections$ });

  return codeSubjectInjections$;
}

export function getCodeSubjects(
  initialValue: Map<FileId, BehaviorSubject<CodeChange>> = defaultCodeSubject,
): Map<FileId, BehaviorSubject<CodeChange>> {
  let { codeSubjects } = createApiState;
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
  let { unsavedFiles$ } = createApiState;
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
  let { codeSubjectInjections$ } = createApiState;
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
  data: RetrieveFileContentsResult,
  debounceInterval = codeSubjectDebounceInterval,
): BehaviorSubject<CodeChange> {
  const fileId = data.path;
  const initialCode = data.scopedContent || data.content;

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
  data: RetrieveFileContentsResult | RetrieveExampleFileContentsResult,
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

export function updateCodeSubjectHash(
  fileId: FileId,
  value: string,
  saveCode: SaveCode,
  newHash?: string,
): void {
  codeSubjectNext(fileId, value, saveCode, undefined, false, newHash);
  getUnsavedFilesSubjectNext(fileId, false);
}

export async function createIsAlive(): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  try {
    const res = await createAliveRequest(token);
    return res?.status == 200;
  } catch (error) {
    return false;
  }
}

export async function retrieveFileHash(
  params: GetFileHash_Params,
): Promise<GetFileHash_Response> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  const response = await getFileHash(params, token, space);

  if (!response) {
    throw new Error('File hash information was not retrieved.');
  }
  return response;
}

export async function createSketch(
  sketchName = DEFAULT_SKETCH_NAME,
  sketchContent = defaultSketchInoContent,
  createUserId = DEFAULT_SKETCH_USER_ID,
  files:
    | RetrieveFileContentsResult[]
    | RetrieveExampleFileContentsResult[] = [],
): Promise<CreateSketchResult> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  const createdSketch = await putSketchRequest(
    { user_id: createUserId, path: sketchName, ino: sketchContent },
    token,
    space,
  );

  if (files.length > 0) {
    await Promise.all(
      files.map((file) =>
        ((): Promise<PostSketchFile_Response> => {
          const data = transformContentToDataByMimeType(
            file.content,
            file.mimetype,
          );
          return postSketchFileRequest(
            {
              path: `${createdSketch.path}/${file.fullName}`,
            },
            { data },
            token,
            space,
          );
        })(),
      ),
    );
  }

  return { owner: getResourceOwner(createdSketch.path), ...createdSketch };
}

export async function updateSketchSecrets(payload: {
  id: string;
  secrets?: SketchSecrets;
}): Promise<GetSketchResult> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  const { id, secrets } = payload;
  const result = await postSketchRequest(
    { id },
    { secrets: { data: secrets } },
    token,
    space,
  );

  return { owner: getResourceOwner(result.path), ...result };
}

export async function associateSketchWithDevice(
  payload: AssociateSketchWithDevicePayload,
): Promise<GetSketchResult> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  const { id, ...rest } = payload;
  const result = await postSketchRequest({ id }, rest, token, space);

  return { owner: getResourceOwner(result.path), ...result };
}

export async function markSketchVisibility(
  payload: MarkSketchVisibilityPayload,
): Promise<GetSketchResult> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  const { id, ...rest } = payload;
  const result = await postSketchRequest({ id }, rest, token, space);

  return { owner: getResourceOwner(result.path), ...result };
}

export async function associateSketchWithLibraries(
  payload: AssociateSketchWithLibrariesPayload,
): Promise<GetSketchResult> {
  // TODO deep dive: endpoint accepts library versions that don't exist...
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  const { id, ...rest } = payload;
  const result = await postSketchRequest({ id }, rest, token, space);

  return { owner: getResourceOwner(result.path), ...result };
}

export async function retrieveSketch(
  sketchID: string,
): Promise<GetSketchResult | null> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  const params = { id: sketchID };

  const sketch = await getSketchRequest(
    params,
    token === NO_AUTH_TOKEN_PLACEHOLDER ? undefined : token,
    space,
  );

  if (!sketch) return null;
  return { owner: getResourceOwner(sketch.path), ...sketch };
}

export async function deleteSketch(id: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  await deleteSketchRequest({ id }, token, space);
}

export async function retrieveSketches(
  search?: string,
): Promise<GetSketchesResult> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  const user = { user_id: 'me', name_like: search };

  const sketches = await getSketchesRequest(user, token, space);

  return sketches.map((sketch) => ({
    owner: getResourceOwner(sketch.path),
    ...sketch,
  }));
}

export async function retrieveFileContents(
  filePath: string,
  fullName: string,
  bypassOrgHeader: boolean,
  scope?: FileLineScope,
  isCustomLibFile?: boolean,
): Promise<RetrieveFileContentsResult> {
  const token = await getAccessToken(undefined, isCustomLibFile);
  if (!token) return noTokenReject();

  const space = bypassOrgHeader ? undefined : getSpace();

  const { data, mimetype, revision, href, modifiedAt } =
    await getFileContentsRequest(
      filePath,
      token === NO_AUTH_TOKEN_PLACEHOLDER ? undefined : token,
      space,
    );

  if (typeof data === 'undefined')
    return Promise.reject(new Error('No data to decode in retrieved file'));

  const extension = filePath.substring(filePath.lastIndexOf('.') + 1);

  const content = transformDataToContentByMimeType(data, mimetype);

  const scopedContent =
    scope &&
    content
      .split('\n')
      .slice(scope.start, scope.end + 1)
      .join('\n');

  return {
    name: trimFileExtension(fullName),
    fullName,
    extension,
    data,
    content,
    scopedContent,
    mimetype,
    path: filePath,
    hash: revision?.hash,
    href,
    modifiedAt,
  };
}

export async function retrieveFilesList(
  path: string,
  bypassOrgHeader: boolean,
  isLibrary?: boolean,
): Promise<RetrieveFilesListResult> {
  const token = await getAccessToken(undefined, isLibrary);
  if (!token) return noTokenReject();

  const space = bypassOrgHeader ? undefined : getSpace();

  return getFilesListRequest(
    path,
    token === NO_AUTH_TOKEN_PLACEHOLDER ? undefined : token,
    space,
  );
}

export async function saveSketchFile(
  file: FileChange_Params,
  code: string,
  hash?: string,
): Promise<PostSketchFile_Response> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  const data = transformContentToDataByMimeType(code);

  const res = await postSketchFileRequest(file, { data, hash }, token, space);

  return res;
}

export async function createSketchFile(
  file: FileChange_Params,
  extension: string,
  code = '',
): Promise<PostSketchFile_Response> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  const data = SUPPORTED_IMAGE_TYPES.includes(`.${extension}`)
    ? code
    : transformContentToDataByMimeType(code);

  return postSketchFileRequest(file, { data }, token, space);
}

export class SketchNameConflict extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SketchNameConflict';
  }
}

export async function renameSketch(from: string, to: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  try {
    await moveSketchRequest({ from, to }, token, space);
  } catch (err) {
    if ((err as WretchError).status === 409) {
      throw new SketchNameConflict('Sketch name already exists');
    }
    throw err;
  }
}

export async function deleteSketchFile(
  file: FileChange_Params,
): Promise<DeleteSketchFile_Response> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  const response = await deleteSketchFileRequest(file, token, space);
  return response;
}

export async function retrieveCustomLibraries(): Promise<GetLibrariesListResult> {
  const token = await getAccessToken(undefined, true);
  if (!token) return noTokenReject();

  const libs = await getCustomLibraries(token);

  return libs.map((lib) => {
    return {
      ...lib,
      owner: lib.path && getResourceOwner(lib.path),
    };
  });
}

export async function retrieveCustomLibraryCode(
  params: GetLibraryCode_Params,
): Promise<GetLibraryCode_Response> {
  const token = await getAccessToken(undefined, true);
  if (!token) return noTokenReject();

  return getCustomLibraryCode(params, token);
}

type SaveCustomLibraryOptions = {
  sourceReleaseId?: string; // es. "lvgl@9.4.0"
};

export async function saveCustomLibrary<
  F extends { fullName: string; content: string },
>(
  name: string,
  files: F[],
  opts?: SaveCustomLibraryOptions,
): Promise<GetLibrary_Response> {
  const token = await getAccessToken(undefined, true);
  if (!token) return noTokenReject();

  let inputFiles: { fullName: string; content: string }[] = files;
  if ((!files || files.length === 0) && opts?.sourceReleaseId) {
    const { files: relFiles } = await getReleaseLibraryFilesRequest({
      id: opts.sourceReleaseId,
    });

    inputFiles = (relFiles ?? []).map((f) => ({
      fullName: f.path,
      content: f.data || '',
    }));
  }

  const filesData = inputFiles.map((file) => {
    const decodedContent = decodeBase64ToString(file.content);
    if (file.fullName === 'library.properties') {
      const properties = dotenv.parse(decodedContent);
      properties.name = name;
      let content = '';
      for (const key in properties) {
        content += `${key}=${properties[key]}\n`;
      }
      return {
        nameWithExt: file.fullName,
        textContent: content,
      };
    }
    return {
      nameWithExt: file.fullName,
      textContent: file.content,
    };
  });

  try {
    const archive = await createZipArchive(filesData);
    const { response } = await saveLibraryRequest(archive, token);
    if (!response) {
      throw new Error(
        'Create API returned no information about the newly created library',
      );
    }
    return response;
  } catch (error) {
    console.error(error);
    return Promise.reject(new Error('Error creating new custom library'));
  }
}
export async function deleteCustomLibrary(id: string): Promise<void> {
  const token = await getAccessToken(undefined, true);
  if (!token) return noTokenReject();

  await deleteLibraryRequest({ id }, token);
}

export class MalformedLibrary extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedLibrary';
  }
}

export async function uploadCustomLibrary(
  archive: File,
): Promise<GetLibrary_Response> {
  const token = await getAccessToken(undefined, true);
  if (!token) return noTokenReject();

  const filesData = await readZipArchive(archive);

  const propertiesFile =
    filesData.find((f) => f.nameWithExt.match(/^\/?library.properties/)) ||
    filesData
      .filter((f) => f.nameWithExt.match(/^\/?[A-Za-z0-9][A-Za-z0-9_.-]*\/$/))
      .map((f) =>
        filesData.find((d) =>
          d.nameWithExt.startsWith(`${f.nameWithExt}library.properties`),
        ),
      )
      .find((f) => f);

  if (
    !propertiesFile ||
    (!propertiesFile.base64Content && !propertiesFile.textContent)
  ) {
    throw new MalformedLibrary(
      'library does not contain a library.properties file',
    );
  }

  const propertiesFileDir = propertiesFile.nameWithExt.replace(
    /\/?library.properties$/,
    '',
  );

  let filteredFilesData = filesData.filter(
    (f) =>
      f.nameWithExt.startsWith(propertiesFileDir) &&
      !f.nameWithExt.match(/^\/?(__MACOSX\/|\.DS_Store|\.git)/),
  );

  if (propertiesFileDir !== '/') {
    filteredFilesData.forEach((f) => {
      f.nameWithExt = f.nameWithExt.replace(propertiesFileDir, '');
    });

    filteredFilesData = filteredFilesData.filter((f) => f.nameWithExt !== '/');
  }

  const normalizedArchive = await createZipArchive(filteredFilesData);

  const { error, response } = await saveLibraryRequest(
    normalizedArchive,
    token,
  );

  if (error) {
    throw new MalformedLibrary(error);
  }

  if (!response) {
    throw new Error(
      'Create API returned no information about the newly created library',
    );
  }

  return response;
}

// export async function manualSave(name: string, files: any[]): Promise<void> {
//   const token = await getAccessToken();
//   if (!token) return noTokenReject();

//   const basePath = '';
//   if (isCustomLibrary) {
//     const customLibraries = await getCustomLibraries(token);
//     const customLibrary = customLibraries.find((l) => l.name === name);
//     if (!customLibrary) throw new Error('Could not find custom library');
//     basePath = ''
//   } else {
//     basePath = ...
//   }

//   const codeChanges = files.map((file) =>
//     getCodeSubjectById<FileId>(file.path).getValue(),
//   );

//   const unsavedFiles$ = getUnsavedFilesSubject<Subject<SetUnsavedFileTuple>>();
//   for (const change of codeChanges) {
//     if (isCodeChangeWithCtx(change) && !change.meta.initialChange) {
//       await change.context.saveCode(
//         basePath + '/' + files.find((f) => (f.path = change.fileId)).name,
//         change.value,
//         false,
//       );

//       unsavedFiles$.next([change.fileId, false]);
//     }
//   }
// }

export async function getUser(params: {
  id: string;
}): Promise<CreateUser_Response> {
  const token = await getAccessToken(undefined, true);
  if (!token) return noTokenReject();

  return getUserRequest(params, token);
}

export async function downloadSketch(
  name: string,
  path: string,
  ino: RetrieveFileContentsResult,
  files: RetrieveFileContentsResult[],
): Promise<void> {
  const metaFile = await retrieveFileContents(
    `${path}/${SKETCH_META_FILE}`,
    SKETCH_META_FILE,
    false,
  );

  const secrets = JSON.parse(metaFile.content).secrets as SketchSecrets;
  const secretsFile = secrets.length
    ? createBuilderSecretsFile(secrets.map(({ name }) => ({ name, value: '' })))
    : undefined;

  let inoContent: string | undefined = getCodeSubjectById<FileId>(ino.path)
    .value.value;
  let inoData = transformContentToDataByMimeType(inoContent, ino.mimetype);
  if (secretsFile) {
    inoData = injectSecretsFileInclude(
      { ...ino, data: inoData },
      inoContent,
      ino.mimetype,
    ).data;
    inoContent = undefined;
  }

  const filesToDownload: FileAdapter[] = files.map((file) => {
    const currContent: string | undefined = getCodeSubjectById<FileId>(
      file.path,
    ).value.value;
    const currData = transformContentToDataByMimeType(
      currContent,
      file.mimetype,
    );

    return {
      nameWithExt: file.fullName,
      base64Content: currData,
      textContent: currContent,
    };
  });

  if (secretsFile) {
    filesToDownload.push({
      nameWithExt: secretsFile.name,
      base64Content: secretsFile.data,
    });
  }
  filesToDownload.push({
    nameWithExt: metaFile.fullName,
    base64Content: transformContentToDataByMimeType(
      metaFile.content,
      metaFile.mimetype,
    ),
  });
  filesToDownload.push({
    nameWithExt: ino.fullName,
    base64Content: inoData,
    textContent: inoContent,
  });

  await exportZipFolder(name, filesToDownload);
}

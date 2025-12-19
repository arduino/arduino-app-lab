import {
  BaseCodeChange,
  CodeChange,
  CodeChangeWithCtx,
  CodeSubjectById,
  CodeSubjectInjection,
  CompileErrors,
  dismissToastNotification,
  FileId,
  GetSketchesResult,
  NotificationMode,
  NotificationType,
  ParsedError,
  RetrieveExampleFileContentsResult,
  RetrieveFileContentsResult,
  SaveCode,
  sendNotification,
} from '@cloud-editor-mono/domain/src/services/services-by-app/shared';
import {
  CodeEditorText,
  OnChangeHandlerSetCode,
  Preferences,
  SelectableFileData,
  ToastSize,
  ToastType,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/shared';
import { applyPatch } from 'diff';
import { uniqueId } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BehaviorSubject, NEVER, Observable, Subject } from 'rxjs';

import { messages } from '../messages';
import { createSelectableFileData } from '../utils';
import { UseCodeChange } from './code.type';
import { useEditExampleNotification } from './notifications';
import { usePreferenceObservable } from './preferences';
import { useCodeFormatter } from './queries/codeFormatter';
import {
  SaveSketchFileMutation,
  UseCreateSketchFromExisting,
} from './queries/create.type';
import { refreshCustomLibraries } from './queries/createUtils';
import { useObservable } from './useObservable';

const FILES_WITH_CODE = new Set(['h', 'hpp', 'c', 'cpp']);

export const useCodeChange: UseCodeChange = function (
  saveSketchFileQuery: SaveSketchFileMutation,
  selectFile: (fileId?: string) => void,
  codeInjectionsSubjectNext: (
    fileId: CodeSubjectInjection['fileId'],
    value: CodeSubjectInjection['value'],
    initialContext: CodeSubjectInjection['initialContext'],
    isLibrary: boolean,
    lineToScroll?: number,
    fromAssist?: boolean,
  ) => boolean | undefined,
  getCodeSubjectById: <T>(id: T) => CodeSubjectById<T>,
  codeSubjectNext: (
    fileId: FileId,
    value: string,
    saveCode: SaveCode,
    doc?: CodeEditorText,
    shouldUpdate?: boolean,
    newHash?: string,
    lineToScroll?: number,
    fromAssist?: boolean,
  ) => void,
  getUnsavedFilesSubject: () => Subject<Set<FileId>>,
  updateCodeSubjectHash: (
    fileId: FileId,
    value: string,
    saveCode: SaveCode,
    newHash?: string,
  ) => void,
  useCreateSketchFromExisting: UseCreateSketchFromExisting,
  retrieveSketches: (search?: string) => Promise<GetSketchesResult>,
  isLibraryRoute: boolean,
  isExampleSketchRoute: boolean,
  isReadOnly: boolean,
  selectedFile?: SelectableFileData,
  mainFile?: SelectableFileData,
  compileErrors?: CompileErrors,
  compileErrorsTimestamp?: React.MutableRefObject<number | undefined>,
  openFiles?: SelectableFileData[],
  exampleInoData?: RetrieveExampleFileContentsResult,
  exampleFilesData?: RetrieveExampleFileContentsResult[],
  customLibraryFiles?: RetrieveFileContentsResult[],
): ReturnType<UseCodeChange> {
  const lastSetCodeTimeStamp = useRef<number>();
  const autoSave = usePreferenceObservable(Preferences.AutoSave);

  const { formatMessage } = useI18n();

  const [libraryIncludeToastId, setLibraryIncludeToastId] = useState<string>();

  const fileWithErrorIsSelected = useRef(false);
  const [errorLineData, setErrorLineData] = useState<ParsedError>();

  const { send: sendCopyExampleNotification } = useEditExampleNotification(
    getCodeSubjectById,
    useCreateSketchFromExisting,
    retrieveSketches,
    exampleInoData,
  );
  const unsavedFileIds = useObservable(getUnsavedFilesSubject());

  const saveCode = useCallback(
    async (
      fileId?: string,
      code?: string,
      hash?: string,
    ): ReturnType<SaveCode> => {
      if (isReadOnly) return;

      if (isExampleSketchRoute) {
        if (exampleInoData)
          sendCopyExampleNotification(exampleInoData, exampleFilesData);

        return { isUnsaved: true };
      }

      if (!autoSave) {
        return { isUnsaved: true };
      }

      // changing library.property could affect include button of a library
      if (fileId?.includes('library.properties')) {
        refreshCustomLibraries();
      }

      const res = await saveSketchFileQuery({ code, fileId, hash });

      if (!res) return;
      if ('errStatus' in res) {
        return res;
      }

      if ('hash' in res && res.hash) {
        return { newHash: res?.hash };
      }
    },
    [
      autoSave,
      exampleFilesData,
      exampleInoData,
      isExampleSketchRoute,
      isReadOnly,
      saveSketchFileQuery,
      sendCopyExampleNotification,
    ],
  );

  const saveFile = useCallback(
    async (fileId: FileId): Promise<void> => {
      if (isReadOnly) return;

      const subjectValue = getSelectedCodeObservableValue(
        getCodeSubjectById,
        fileId,
      );

      const code = subjectValue?.value;
      const hash = subjectValue?.meta.hash;

      if (code === undefined) return;

      try {
        const res = await saveSketchFileQuery({ code, fileId, hash });
        if (!res || 'errStatus' in res) return;

        updateCodeSubjectHash(fileId, code, saveCode, res?.hash);
      } catch (error) {
        console.error(error);
      }
    },
    [
      getCodeSubjectById,
      isReadOnly,
      saveCode,
      saveSketchFileQuery,
      updateCodeSubjectHash,
    ],
  );

  const saveAllFiles = useCallback(() => {
    if (isReadOnly) return;

    if (isExampleSketchRoute) return;

    if (unsavedFileIds) {
      unsavedFileIds.forEach(saveFile);
    }
  }, [isReadOnly, isExampleSketchRoute, unsavedFileIds, saveFile]);

  const {
    formatCode,
    cancelFormat,
    variables,
    isLoading: codeIsFormatting,
  } = useCodeFormatter(saveCode, codeSubjectNext);

  const clearErrorLine = useCallback(() => {
    setErrorLineData(undefined);
  }, []);

  const setCode: OnChangeHandlerSetCode = useCallback(
    (newDoc: CodeEditorText) => {
      if (selectedFile?.fileId && selectedFile.fileId === variables?.fileId) {
        // if the user modifies a file destined to be autoformatted, cancel the autoformat
        cancelFormat();
      }

      if (
        errorLineData?.filefullname &&
        selectedFile?.fileFullName &&
        errorLineData.filefullname === selectedFile.fileFullName
      ) {
        clearErrorLine();
        lastSetCodeTimeStamp.current = Date.now();
      }

      if (selectedFile?.fileId !== undefined) {
        codeSubjectNext(
          selectedFile.fileId,
          newDoc.toString(),
          saveCode,
          newDoc,
          false,
        );
      }
    },
    [
      cancelFormat,
      clearErrorLine,
      codeSubjectNext,
      errorLineData,
      saveCode,
      selectedFile,
      variables?.fileId,
    ],
  );

  const [pendingApply, setPendingApply] = useState<{
    condition: (selectedFile: SelectableFileData) => boolean;
    cb: () => void;
  }>();

  const handleLibraryIncludeCode = useCallback(
    (code: string): void => {
      if (pendingApply) return;

      let fileToUpdate: SelectableFileData | null = null;

      if (mainFile?.fileId) {
        fileToUpdate = mainFile;
      } else if (isLibraryRoute) {
        const firstCodeFile = customLibraryFiles?.find((f) =>
          FILES_WITH_CODE.has(f.extension),
        );
        if (firstCodeFile) {
          fileToUpdate = createSelectableFileData({
            fileData: firstCodeFile,
          });
        }
      }

      if (fileToUpdate) {
        const result = codeInjectionsSubjectNext(
          fileToUpdate.fileId,
          code,
          {
            saveCode,
          },
          true,
        );
        selectFile(fileToUpdate.fileId);

        if (libraryIncludeToastId) return;

        const toastId = uniqueId();
        sendNotification({
          message: formatMessage(
            result
              ? messages.successfulLibraryInclude
              : messages.libraryAlreadyIncluded,
          ),
          type: result ? NotificationType.Success : NotificationType.Change,
          mode: NotificationMode.Toast,
          modeOptions: {
            toastId,
            toastType: ToastType.Passive,
            toastSize: ToastSize.Small,
            onUnmount: (): void => {
              setLibraryIncludeToastId(undefined);
            },
          },
        });

        setLibraryIncludeToastId(toastId);
      }
    },
    [
      codeInjectionsSubjectNext,
      customLibraryFiles,
      formatMessage,
      isLibraryRoute,
      libraryIncludeToastId,
      mainFile,
      pendingApply,
      saveCode,
      selectFile,
    ],
  );

  const handleGenAiApplyCode = useCallback(
    async (code: string): Promise<void> => {
      if (pendingApply) return;

      let fileToUpdate: SelectableFileData | null = null;

      if (mainFile?.fileId) {
        fileToUpdate = mainFile;
      }

      if (fileToUpdate) {
        const pendingApply = {
          condition: (selectedFile: SelectableFileData): boolean => {
            return selectedFile?.fileId === fileToUpdate?.fileId;
          },
          cb: (): void => {
            fileToUpdate &&
              codeInjectionsSubjectNext(
                fileToUpdate.fileId,
                code,
                {
                  saveCode,
                },
                false,
                undefined,
                true,
              );
          },
        };
        setPendingApply(() => pendingApply);

        selectFile(fileToUpdate.fileId);
      }
    },
    [codeInjectionsSubjectNext, mainFile, pendingApply, saveCode, selectFile],
  );

  const handleGenAiApplyFixToCode = useCallback(
    (fileName: string, code?: string, lineToScroll?: number): void => {
      if (pendingApply) return;

      const fileToUpdate = openFiles?.find((f) => f.fileFullName === fileName);

      if (fileToUpdate) {
        const prevCode = getCodeSubjectById(fileToUpdate.fileId)?.getValue()
          ?.value;

        if (!prevCode) return;

        const pendingApply = {
          condition: (selectedFile: SelectableFileData): boolean => {
            return selectedFile?.fileId === fileToUpdate?.fileId;
          },
          cb: (): void => {
            if (fileToUpdate) {
              const result = codeInjectionsSubjectNext(
                fileToUpdate.fileId,
                code ? code : prevCode,
                {
                  saveCode,
                },
                false,
                lineToScroll,
                true,
              );

              if (result) {
                clearErrorLine();
              }

              const toastId = uniqueId();
              sendNotification({
                message: formatMessage(
                  result
                    ? messages.errorFixedInCode
                    : messages.fixAlreadyIncluded,
                ),
                type: result
                  ? NotificationType.Success
                  : NotificationType.Error,
                mode: NotificationMode.Toast,
                modeOptions: {
                  toastSize: ToastSize.Small,
                  toastId,
                  toastType: ToastType.Passive,
                  toastActions: result
                    ? [
                        {
                          id: uniqueId(),
                          label: 'undo',
                          handler: (): void => {
                            codeInjectionsSubjectNext(
                              fileToUpdate.fileId,
                              prevCode,
                              {
                                saveCode,
                              },
                              false,
                              lineToScroll,
                              true,
                            );
                            dismissToastNotification(toastId);
                            setErrorLineData(compileErrors?.[0]);
                          },
                        },
                      ]
                    : undefined,
                },
              });
            }
          },
        };
        setPendingApply(() => pendingApply);

        selectFile(fileToUpdate.fileId);
      }
    },
    [
      clearErrorLine,
      codeInjectionsSubjectNext,
      compileErrors,
      formatMessage,
      getCodeSubjectById,
      openFiles,
      pendingApply,
      saveCode,
      selectFile,
    ],
  );

  useEffect(() => {
    if (pendingApply) {
      const { condition, cb } = pendingApply;
      if (selectedFile && condition(selectedFile)) {
        cb();
        setPendingApply(undefined);
      }
    }
  }, [pendingApply, selectedFile]);

  const handleApplyPatchAvailability = useCallback(
    (fileName: string, diff: string): string | false => {
      const fileToUpdate = openFiles?.find((f) => f.fileFullName === fileName);

      if (fileToUpdate) {
        const prevCode = getCodeSubjectById(fileToUpdate.fileId)?.getValue()
          ?.value;
        try {
          if (!prevCode) return false;
          const code = applyPatch(prevCode, diff, {
            fuzzFactor: 2,
          });
          return code;
        } catch (error) {
          return false;
        }
      }

      return false;
    },
    [getCodeSubjectById, openFiles],
  );

  useEffect(() => {
    if (!selectedFile?.fileFullName) return;

    if (
      lastSetCodeTimeStamp.current &&
      compileErrorsTimestamp?.current &&
      lastSetCodeTimeStamp.current > compileErrorsTimestamp.current
    ) {
      clearErrorLine();
      return;
    }

    const errorData = compileErrors?.[0];

    if (!errorData) {
      clearErrorLine();
      return;
    }

    const fileWithError = openFiles?.find(
      (t) => t.fileFullName === errorData.filefullname,
    );

    if (!fileWithError) {
      clearErrorLine();
      return;
    }

    const errorIsInUnselectedFile =
      errorData.filefullname !== selectedFile.fileFullName;
    if (!fileWithErrorIsSelected.current && errorIsInUnselectedFile) {
      selectFile(fileWithError.fileId);
    }

    fileWithErrorIsSelected.current = true;

    if (!errorIsInUnselectedFile) {
      setErrorLineData(errorData);
      return;
    }

    clearErrorLine();
  }, [
    clearErrorLine,
    compileErrors,
    compileErrorsTimestamp,
    openFiles,
    selectedFile,
    selectFile,
  ]);

  useEffect(() => {
    if (!compileErrors) {
      fileWithErrorIsSelected.current = false;
    }
  }, [compileErrors]);

  return {
    setCode,
    formatCode,
    codeIsFormatting,
    handleLibraryIncludeCode,
    handleGenAiApplyCode,
    handleGenAiApplyFixToCode,
    handleApplyPatchAvailability,
    errorLineData,
    saveAllFiles,
    saveFile,
    saveCode,
  };
};

export function useCodeSelectedObservable(
  getCodeSubjectById: <T>(id: T) => CodeSubjectById<T>,
  selectedFile?: SelectableFileData,
): string | undefined {
  const [selectedCodeSubject$, setSelectedCodeSubject$] = useState<
    BehaviorSubject<CodeChange> | Observable<never>
  >(NEVER);

  useEffect(() => {
    setSelectedCodeSubject$(() => {
      let subject$;
      try {
        subject$ = getCodeSubjectById(selectedFile?.fileId);
      } catch {
        subject$ = getCodeSubjectById(undefined);
      }
      return subject$;
    });
  }, [getCodeSubjectById, selectedFile?.fileId]);

  const codeItem = useObservable(selectedCodeSubject$);

  return selectedCodeSubject$ instanceof BehaviorSubject &&
    codeItem?.fileId === selectedFile?.fileId
    ? codeItem?.value
    : undefined;
}

export function getSelectedCodeObservableValue(
  getCodeSubjectById: <T>(id: T) => CodeSubjectById<T>,
  selectedFile?: string,
): BaseCodeChange | CodeChangeWithCtx | undefined {
  let $selectedCodeSubject: BehaviorSubject<CodeChange> | Observable<never>;
  try {
    $selectedCodeSubject = getCodeSubjectById(selectedFile);
  } catch {
    $selectedCodeSubject = getCodeSubjectById(undefined);
  }

  return $selectedCodeSubject instanceof BehaviorSubject
    ? $selectedCodeSubject.getValue()
    : undefined;
}

export function useCodeInjectionsObservable(
  getCodeInjectionsSubject: () => Subject<CodeSubjectInjection>,
): CodeSubjectInjection | undefined {
  const codeSubjectInjection = useObservable(getCodeInjectionsSubject());

  return codeSubjectInjection;
}

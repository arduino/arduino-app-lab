import { Config } from '@cloud-editor-mono/common';
import {
  CompleteExample,
  exportZipFolder,
  ga4Emitter,
  getNewWindow,
  isPrivateResourceRequestWithOrgIdError,
  RetrieveFileContentsResult,
  retrieveSketches,
  setCodeSubjects,
} from '@cloud-editor-mono/domain';
import { Example, ExamplesMenuItemIds } from '@cloud-editor-mono/ui-components';
import { defaultStringifySearch, useNavigate } from '@tanstack/react-location';
import { QueryKey } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  useGetExamples,
  useGetLibrary,
  useRetrieveExampleFileContents,
  useRetrieveExampleInoContents,
} from '../../../../common/hooks/queries/builder';
import {
  getCustomLibraryExamplesByFolder,
  useCreateSketchFromExisting,
  useRetrieveFilesList,
} from '../../../../common/hooks/queries/create';
import { useGetProposedSketchName } from '../../../../common/utils';
import { EXAMPLES_MATCH_PATH } from '../../../../routing/Router';
import {
  CREATE_EXAMPLE_PARAM,
  CUSTOM_LIBRARY_ID_PARAM,
  EXAMPLE_ID_PARAM,
  SOURCE_LIBRARY_ID_PARAM,
} from '../../../../routing/routing.type';
import { UseGetExamplesQueries } from '../main.type';
import { useNotFound } from './routing';
import { useNavigateToNotFound } from './routingUtils';
import { useSketchParams } from './sketch';
import { useHydrateBuiltinExamples } from './useHydrateBuiltinExamples';

const emptyExampleFiles: CompleteExample['files'] = [];

export const BUILTIN_EXAMPLES_QUERY_KEY = ['examples'];

export const useGetExamplesQueries: UseGetExamplesQueries = function (
  userWasAuthenticated: boolean,
  isExampleSketchRoute: boolean,
): ReturnType<UseGetExamplesQueries> {
  const [bypassOrgHeader, setBypassOrgHeader] = useState(false);
  const [attemptedOrgErrorManagement, setAttemptedOrgErrorManagement] =
    useState(false);

  const {
    sourceLibraryID,
    customLibraryID,
    createExampleParam,
    exampleID,
    sketchID,
    viewMode,
    scope,
  } = useSketchParams();

  const navigate = useNavigate();

  const { navigateToNotFound } = useNavigateToNotFound();

  const {
    create: createSketchFromExample,
    createdSketch,
    isLoading: isCreatingSketchFromExample,
  } = useCreateSketchFromExisting();

  useNotFound(
    userWasAuthenticated &&
      isExampleSketchRoute &&
      !exampleID &&
      !sourceLibraryID &&
      !createdSketch,
    'Example',
  );

  const shouldSearchBuiltinExamples =
    isExampleSketchRoute && !sourceLibraryID && !customLibraryID;
  const {
    examples,
    isLoading: getExamplesIsLoading,
    isError: getExamplesIsError,
  } = useGetExamples(shouldSearchBuiltinExamples);

  const builtInExample = useMemo(
    () => examples?.find((e) => e.path === exampleID),
    [exampleID, examples],
  );

  const shouldSearchExamplesFromLibraries =
    isExampleSketchRoute && Boolean(sourceLibraryID) && !customLibraryID;
  const {
    library: examplesFromLibrary,
    isLoading: getLibraryIsLoading,
    isError: getLibraryIsError,
  } = useGetLibrary(
    {
      id: sourceLibraryID,
    },
    shouldSearchExamplesFromLibraries,
  );

  const exampleFromLibrary = useMemo(
    () => examplesFromLibrary?.examples?.find((e) => e.path === exampleID),
    [exampleID, examplesFromLibrary?.examples],
  );

  const shouldSearchCustomExamplesFromLibraries =
    isExampleSketchRoute && Boolean(customLibraryID);

  const onPrivateResourceRequestError = useCallback(
    (error: unknown): { errorIsManaged: boolean } => {
      if (!isExampleSketchRoute || !error) {
        return { errorIsManaged: false };
      }
      if (isPrivateResourceRequestWithOrgIdError(error)) {
        setBypassOrgHeader(true);
        return { errorIsManaged: true };
      }

      if (bypassOrgHeader) {
        setAttemptedOrgErrorManagement(true);
        setBypassOrgHeader(false);
        return { errorIsManaged: false };
      }

      return { errorIsManaged: false };
    },
    [bypassOrgHeader, isExampleSketchRoute],
  );

  const customLibraryExamplesKey: QueryKey = useMemo(
    () => ['get-custom-library-examples', exampleID, bypassOrgHeader],
    [exampleID, bypassOrgHeader],
  );

  const {
    filesList: customLibraryExamplesList,
    getFilesIsLoading: getCustomLibraryExamplesListIsLoading,
    getFilesIsError: getCustomLibraryExamplesListIsError,
  } = useRetrieveFilesList(
    customLibraryExamplesKey,
    shouldSearchCustomExamplesFromLibraries,
    bypassOrgHeader,
    onPrivateResourceRequestError,
    exampleID,
    true,
  );

  const exampleFromCustomLibrary = useMemo(() => {
    const customLibraryExamplesListByFolder = getCustomLibraryExamplesByFolder(
      customLibraryExamplesList ?? [],
    );

    const customLibExample = customLibraryExamplesListByFolder.find(
      (example) => example.path === exampleID,
    );

    if (customLibExample) {
      const parts = customLibExample.name.split('.');
      const ext = parts.pop();

      if (ext === 'ino') {
        customLibExample.name = parts.join('.');
      }
    }

    return customLibExample;
  }, [customLibraryExamplesList, exampleID]) as Example;

  const example =
    builtInExample ?? exampleFromLibrary ?? exampleFromCustomLibrary;

  const { hydrateByPaths } = useHydrateBuiltinExamples({
    skipIfHasFiles: false,
    setTypesBuiltin: true,
  });
  const hydratedFolderRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      !isExampleSketchRoute ||
      !!sourceLibraryID ||
      !!customLibraryID ||
      !exampleID ||
      !examples ||
      getExamplesIsLoading
    ) {
      return;
    }

    const openedFolder = exampleID.split('/')[0];
    if (!openedFolder) return;
    if (hydratedFolderRef.current === openedFolder) return;
    hydratedFolderRef.current = openedFolder;

    const leaves = examples
      .filter((e) => e.path?.startsWith(`${openedFolder}/`))
      .map((e) => e.path!)
      .filter(Boolean);

    if (!leaves.length) return;

    (async () => {
      try {
        await hydrateByPaths(leaves);
      } catch (e) {
        console.error('Error in example processing', e);
      }
    })();
  }, [
    examples,
    exampleID,
    isExampleSketchRoute,
    sourceLibraryID,
    customLibraryID,
    getExamplesIsLoading,
    hydrateByPaths,
  ]);

  useEffect(() => {
    const exampleNotFoundInBuiltin =
      shouldSearchBuiltinExamples && !getExamplesIsLoading && !builtInExample;

    const exampleNotFoundInLibraryExamples =
      shouldSearchExamplesFromLibraries &&
      !getLibraryIsLoading &&
      !exampleFromLibrary;

    const exampleNotFoundInCustomLibraryExamples =
      shouldSearchCustomExamplesFromLibraries &&
      !getCustomLibraryExamplesListIsLoading &&
      !exampleFromCustomLibrary &&
      !getCustomLibraryExamplesListIsError;

    // No example found with IDs provided, redirect
    if (
      exampleID &&
      isExampleSketchRoute &&
      (exampleNotFoundInBuiltin ||
        exampleNotFoundInLibraryExamples ||
        exampleNotFoundInCustomLibraryExamples ||
        (shouldSearchBuiltinExamples && getExamplesIsError) ||
        (shouldSearchExamplesFromLibraries && getLibraryIsError) ||
        (shouldSearchCustomExamplesFromLibraries &&
          getCustomLibraryExamplesListIsError &&
          attemptedOrgErrorManagement))
    ) {
      navigateToNotFound('Example');
    }
  }, [
    attemptedOrgErrorManagement,
    builtInExample,
    exampleFromCustomLibrary,
    exampleFromLibrary,
    exampleID,
    getCustomLibraryExamplesListIsError,
    getCustomLibraryExamplesListIsLoading,
    getExamplesIsError,
    getExamplesIsLoading,
    getLibraryIsError,
    getLibraryIsLoading,
    isExampleSketchRoute,
    navigateToNotFound,
    shouldSearchBuiltinExamples,
    shouldSearchCustomExamplesFromLibraries,
    shouldSearchExamplesFromLibraries,
  ]);

  const { exampleInoContents, isLoading } = useRetrieveExampleInoContents(
    userWasAuthenticated && Boolean(example),
    example?.ino,
    scope,
  );

  const { exampleFileContents, allContentsRetrieved } =
    useRetrieveExampleFileContents(
      userWasAuthenticated &&
        Boolean(example) &&
        (!viewMode || viewMode !== 'snippet'),
      setCodeSubjects,
      example?.path,
      !example ? undefined : example.files || emptyExampleFiles,
    );

  const { getProposedSketchName } = useGetProposedSketchName(
    retrieveSketches,
    exampleInoContents,
  );

  useEffect(() => {
    const shouldWaitForAllFileContents = example?.files
      ? !allContentsRetrieved
      : false;
    if (
      !isCreatingSketchFromExample &&
      createExampleParam &&
      exampleInoContents &&
      !shouldWaitForAllFileContents
    ) {
      (async (): Promise<void> => {
        const proposedSketchName = await getProposedSketchName();

        createSketchFromExample({
          sketchName: proposedSketchName,
          sketchContent: exampleInoContents.data,
          files: exampleFileContents,
        });
      })();
    }
  }, [
    createExampleParam,
    createSketchFromExample,
    example,
    exampleFileContents,
    exampleInoContents,
    isCreatingSketchFromExample,
    getProposedSketchName,
    allContentsRetrieved,
  ]);

  const examplesMenuHandlers = useMemo(
    () => ({
      [ExamplesMenuItemIds.CopyInYourSketches]: (
        exampleID: string,
        sourceLibraryID?: string,
        customLibraryID?: string,
      ): void => {
        const sketchUrl = `${
          Config.ROUTING_BASE_URL ? `/${Config.ROUTING_BASE_URL}` : ''
        }${EXAMPLES_MATCH_PATH}`;

        const search = {
          [SOURCE_LIBRARY_ID_PARAM]: sourceLibraryID,
          [EXAMPLE_ID_PARAM]: exampleID,
          [CUSTOM_LIBRARY_ID_PARAM]: customLibraryID,
          [CREATE_EXAMPLE_PARAM]: true,
        };

        if (isExampleSketchRoute) {
          navigate({
            to: sketchUrl,
            search,
          });
        } else {
          const result = getNewWindow(
            `${Config.NEW_WINDOW_ORIGIN}${sketchUrl}`,
            defaultStringifySearch(search),
            '_blank',
          );

          if (!result) {
            throw new Error('Example sketch could not be opened');
          }
        }
      },
      [ExamplesMenuItemIds.Download]: (
        examplePath: string,
        exampleFiles: RetrieveFileContentsResult[],
      ): void => {
        const files = exampleFiles.map((file) => ({
          nameWithExt: file.fullName,
          textContent: file.content,
          base64Content: file.data,
        }));

        exportZipFolder(examplePath, files);

        ga4Emitter({
          type: 'EXAMPLE_SELECT',
          payload: {
            action: 'download_code',
            name: examplePath.split('/').pop() || '',
            sketch_id: sketchID || '',
          },
        });
      },
    }),
    [isExampleSketchRoute, navigate, sketchID],
  );

  return {
    example,
    exampleData: exampleInoContents,
    exampleFiles:
      exampleInoContents !== undefined ? exampleFileContents : undefined,
    exampleIsFromLibrary: Boolean(sourceLibraryID),
    exampleIsFromCustomLibrary: Boolean(customLibraryID),
    exampleIsLoading: isLoading || createExampleParam,
    examplesMenuHandlers,
    allContentsRetrieved,
    hydrateByPaths,
  };
};

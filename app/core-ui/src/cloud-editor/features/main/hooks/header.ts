import { assertNonNull, Config } from '@cloud-editor-mono/common';
import {
  downloadSketch,
  exportZipFolder,
  FileAdapter,
  ga4Emitter,
  getNewWindow,
  RetrieveFileContentsResult,
} from '@cloud-editor-mono/domain';
import {
  GetLibrary_Response,
  SketchData,
} from '@cloud-editor-mono/infrastructure';
import { Example } from '@cloud-editor-mono/ui-components';
import { defaultStringifySearch, useNavigate } from '@tanstack/react-location';

import { useDialog } from '../../../../common/providers/dialog/dialogProvider.logic';
import { EXAMPLES_MATCH_PATH } from '../../../../routing/Router';
import {
  CREATE_EXAMPLE_PARAM,
  CUSTOM_LIBRARY_ID_PARAM,
  EXAMPLE_ID_PARAM,
  SOURCE_LIBRARY_ID_PARAM,
} from '../../../../routing/routing.type';
import { DialogId, DialogInfo } from '../../dialog-switch';
import {
  HeaderActions,
  HeaderExampleActions,
  HeaderItemId,
  HeaderLibraryActions,
  HeaderSketchActions,
} from '../../header';
import { useIsExampleRoute, useSketchParams } from './sketch';

export type UseHeaderActions = (data: {
  sketchData?: SketchData;
  customLibrary?: GetLibrary_Response;
  example?: Example;
  inoFile?: RetrieveFileContentsResult;
  files?: RetrieveFileContentsResult[];
}) => HeaderActions;

export const useHeaderActions: UseHeaderActions = ({
  sketchData,
  customLibrary,
  example,
  inoFile,
  files,
}) => {
  const navigate = useNavigate();
  const { setDialogInfo, setIsOpen } = useDialog<DialogInfo>();

  const isExampleSketchRoute = useIsExampleRoute();
  const { sourceLibraryID, customLibraryID } = useSketchParams();

  const openShareSketchDialog = (): void => {
    setIsOpen(true);
    setDialogInfo({
      id: DialogId.ShareSketch,
      data: undefined,
    });
  };

  const openShareToClassroomDialog = (): void => {
    setIsOpen(true);
    setDialogInfo({
      id: DialogId.ShareToClassroom,
      data: undefined,
    });
  };

  const headerSketchActions = {
    [HeaderSketchActions.Rename]: (): void => {
      assertNonNull(sketchData);

      setIsOpen(true);
      setDialogInfo({
        id: DialogId.RenameSketch,
        data: {
          sketchId: sketchData.id,
          sketchName: sketchData.name,
          sketchPath: sketchData.path,
        },
      });
    },
    [HeaderSketchActions.Download]: (): void => {
      assertNonNull(sketchData);
      assertNonNull(inoFile);

      downloadSketch(sketchData.name, sketchData.path, inoFile, files || []);
      ga4Emitter({
        type: 'SKETCH_MOD',
        payload: { action: 'sketch_download', sketch_id: sketchData.id },
      });
    },
    [HeaderSketchActions.Delete]: (): void => {
      assertNonNull(sketchData);

      setIsOpen(true);
      setDialogInfo({
        id: DialogId.DeleteSketch,
        data: {
          sketchId: sketchData.id,
          sketchName: sketchData.name,
        },
      });
    },
    [HeaderSketchActions.Share]: openShareSketchDialog,
    [HeaderSketchActions.ShareToClassroom]: openShareToClassroomDialog,
  };

  const headerLibraryActions = {
    [HeaderExampleActions.Download]: (): void => {
      assertNonNull(customLibrary?.name);
      assertNonNull(files);

      const filesToDownload: FileAdapter[] = files.map((f) => ({
        nameWithExt: f.fullName,
        textContent: f.content,
        base64Content: f.data,
      }));

      exportZipFolder(customLibrary.name, filesToDownload);
    },
    [HeaderLibraryActions.Delete]: (): void => {
      assertNonNull(customLibrary?.id);

      setIsOpen(true);
      setDialogInfo({
        id: DialogId.DeleteLibrary,
        data: {
          libraryId: customLibrary.id,
          libraryName: customLibrary.name,
        },
      });
    },
  };

  const headerExampleActions = {
    [HeaderExampleActions.CopyToSketches]: (): void => {
      assertNonNull(example);

      const sketchUrl = `${
        Config.ROUTING_BASE_URL ? `/${Config.ROUTING_BASE_URL}` : ''
      }${EXAMPLES_MATCH_PATH}`;

      const search = {
        [SOURCE_LIBRARY_ID_PARAM]: sourceLibraryID,
        [EXAMPLE_ID_PARAM]: example.path,
        [CUSTOM_LIBRARY_ID_PARAM]: customLibraryID,
        [CREATE_EXAMPLE_PARAM]: 'true',
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
    [HeaderExampleActions.Download]: (): void => {
      assertNonNull(example);
      assertNonNull(files);
      assertNonNull(inoFile);

      const filesData = [inoFile, ...files].map((file) => ({
        nameWithExt: file.fullName,
        textContent: file.content,
        base64Content: file.data,
      }));

      exportZipFolder(example.name, filesData);
    },
    [HeaderSketchActions.Share]: openShareSketchDialog,
  };

  return {
    [HeaderItemId.Sketch]: headerSketchActions,
    [HeaderItemId.CustomLibrary]: headerLibraryActions,
    [HeaderItemId.Example]: headerExampleActions,
  };
};

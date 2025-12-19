import { Config } from '@cloud-editor-mono/common';
import {
  DeleteFileDialog,
  DeleteFileDialogLogic,
  DeleteLibraryDialog,
  DeleteLibraryDialogLogic,
  DeleteSecretDialog,
  DeleteSecretDialogLogic,
  DeleteSketchDialog,
  DeleteSketchDialogLogic,
  DeviceAssociationDialog,
  DeviceAssociationDialogLogic,
  FlavourConfigDialog,
  FlavourConfigDialogLogic,
  GenAIPolicyTermsDialog,
  GenAIPolicyTermsDialogLogic,
  MobileWarningDialog,
  MobileWarningDialogLogic,
  RenameDialog,
  RenameDialogLogic,
  ShareSketchDialog,
  ShareSketchDialogLogic,
  ShareToClassroomDialog,
  ShareToClassroomDialogLogic,
} from '@cloud-editor-mono/ui-components';
import { Key, useCallback, useContext } from 'react';

import { useDialog } from '../../../common/providers/dialog/dialogProvider.logic';
import { ThemeContext } from '../../../common/providers/theme/themeContext';
import {
  DeviceAssociationPrompts,
  DialogId,
  DialogInfo,
} from './dialogSwitch.type';

interface DialogSwitchProps {
  deviceAssociationDialogKey?: Key;
  deviceAssociationDialogLogic: DeviceAssociationDialogLogic;
  deleteFileDialogLogic: DeleteFileDialogLogic;
  renameSketchDialogLogic: RenameDialogLogic;
  deleteSketchDialogLogic: DeleteSketchDialogLogic;
  deleteLibraryDialogLogic: DeleteLibraryDialogLogic;
  deleteSecretDialogLogic: DeleteSecretDialogLogic;
  flavourConfigDialogLogic: FlavourConfigDialogLogic;
  shareSketchDialogLogic: ShareSketchDialogLogic;
  shareToClassroomDialogLogic: ShareToClassroomDialogLogic;
  genAIPolicyTermsDialogLogic: GenAIPolicyTermsDialogLogic;
}

const DialogSwitch: React.FC<DialogSwitchProps> = (
  props: DialogSwitchProps,
) => {
  const { theme } = useContext(ThemeContext);
  const { dialogInfo, reactModalProps, setIsOpen } = useDialog<DialogInfo>();

  const {
    deviceAssociationDialogKey,
    deviceAssociationDialogLogic,
    deleteFileDialogLogic,
    renameSketchDialogLogic,
    deleteSketchDialogLogic,
    deleteLibraryDialogLogic,
    deleteSecretDialogLogic,
    flavourConfigDialogLogic,
    shareSketchDialogLogic,
    shareToClassroomDialogLogic,
    genAIPolicyTermsDialogLogic,
  } = props;

  const mobileWarningDialogLogic = useCallback(
    (): ReturnType<MobileWarningDialogLogic> => ({
      setIsOpen,
      reactModalProps,
      devicesLinkUrl: `${Config.CLOUD_HOME_URL}/devices`,
    }),
    [reactModalProps, setIsOpen],
  );

  if (!dialogInfo || !reactModalProps.isOpen) {
    return null;
  }

  switch (dialogInfo.id) {
    case DialogId.DeviceAssociation:
      return (
        <DeviceAssociationDialog
          key={
            deviceAssociationDialogKey || 'device-association-dialog-react-key'
          }
          childProps={{
            themeClass: theme,
            uploadPromptData:
              dialogInfo.data?.prompt === DeviceAssociationPrompts.Upload
                ? { fqbn: dialogInfo.data.fqbn }
                : undefined,
            promptUnknownDevice:
              dialogInfo.data?.prompt === DeviceAssociationPrompts.Identify
                ? dialogInfo.data.meta
                : undefined,
            deviceAssociationDialogLogic,
          }}
        />
      );
    case DialogId.DeleteFile:
      return (
        <DeleteFileDialog
          themeClass={theme}
          deleteFileDialogLogic={deleteFileDialogLogic}
        />
      );
    case DialogId.RenameSketch:
      return (
        <RenameDialog
          themeClass={theme}
          renameDialogLogic={renameSketchDialogLogic}
          data={dialogInfo.data}
        />
      );
    case DialogId.DeleteSketch:
      return (
        <DeleteSketchDialog
          themeClass={theme}
          deleteSketchDialogLogic={deleteSketchDialogLogic}
          data={dialogInfo.data}
        />
      );
    case DialogId.DeleteLibrary:
      return (
        <DeleteLibraryDialog
          themeClass={theme}
          deleteLibraryDialogLogic={deleteLibraryDialogLogic}
          data={dialogInfo.data}
        />
      );
    case DialogId.MobileWarning:
      return (
        <MobileWarningDialog
          themeClass={theme}
          mobileWarningDialogLogic={mobileWarningDialogLogic}
          data={dialogInfo.data}
        />
      );
    case DialogId.DeleteSecret:
      return (
        <DeleteSecretDialog
          themeClass={theme}
          deleteSecretDialogLogic={deleteSecretDialogLogic}
          data={dialogInfo.data}
        />
      );
    case DialogId.FlavourConfig:
      return (
        <FlavourConfigDialog
          themeClass={theme}
          flavourConfigDialogLogic={flavourConfigDialogLogic}
        />
      );
    case DialogId.ShareSketch:
      return (
        <ShareSketchDialog
          themeClass={theme}
          shareSketchDialogLogic={shareSketchDialogLogic}
        />
      );
    case DialogId.ShareToClassroom:
      return (
        <ShareToClassroomDialog
          themeClass={theme}
          shareToClassroomDialogLogic={shareToClassroomDialogLogic}
        />
      );
    case DialogId.GenAIPolicyTerms:
      return (
        <GenAIPolicyTermsDialog
          themeClass={theme}
          genAIPolicyTermsDialogLogic={genAIPolicyTermsDialogLogic}
        />
      );
    default:
      return null;
  }
};

export default DialogSwitch;

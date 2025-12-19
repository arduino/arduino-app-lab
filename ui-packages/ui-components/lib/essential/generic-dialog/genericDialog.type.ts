import { UnknownDeviceIdentifiers } from '../../device-association-dialog';
import {
  DeleteLibraryDialogData,
  DeleteSketchDialogData,
  MobileWarningDialogData,
  RenameDialogData,
} from '../../dialogs';
import { DeleteFileDialogData } from '../../editor-tabs-bar';
import { DeleteSecretDialogData } from '../../secrets-editor';
import { ModalLogic } from '../dialog';

export enum DialogId {
  DeviceAssociation,
  DeleteFile,
  RenameSketch,
  DeleteSketch,
  DeleteLibrary,
  MobileWarning,
  DeleteSecret,
  FlavourConfig,
  ShareSketch,
  ShareToClassroom,
  GenAIPolicyTerms,
}

export enum DeviceAssociationPrompts {
  Upload,
  Identify,
}

type DeviceAssociationPromptsData =
  | {
      prompt: DeviceAssociationPrompts.Identify;
      meta: UnknownDeviceIdentifiers;
    }
  | { prompt: DeviceAssociationPrompts.Upload; fqbn: string };

export interface DialogDataDictionary {
  [DialogId.DeleteFile]: DeleteFileDialogData;
  [DialogId.DeviceAssociation]: DeviceAssociationPromptsData;
  [DialogId.RenameSketch]: RenameDialogData;
  [DialogId.DeleteSketch]: DeleteSketchDialogData;
  [DialogId.DeleteLibrary]: DeleteLibraryDialogData;
  [DialogId.MobileWarning]: MobileWarningDialogData;
  [DialogId.DeleteSecret]: DeleteSecretDialogData;
  [DialogId.FlavourConfig]: undefined;
  [DialogId.ShareSketch]: undefined;
  [DialogId.ShareToClassroom]: undefined;
  [DialogId.GenAIPolicyTerms]: undefined;
}

interface DialogInfoProps<K extends DialogId> {
  id: K;
}

export type DialogInfo = {
  [K in DialogId]: K extends DialogId.DeviceAssociation
    ? DialogInfoProps<K> & { data?: DialogDataDictionary[K] }
    : DialogInfoProps<K> & { data: DialogDataDictionary[K] };
}[DialogId];

export type GenericDialogLogic = () => ReturnType<ModalLogic> & {
  setDialogInfo: (value: React.SetStateAction<DialogInfo | undefined>) => void;
  confirmAction: () => void;
  cancelAction: () => void;
};

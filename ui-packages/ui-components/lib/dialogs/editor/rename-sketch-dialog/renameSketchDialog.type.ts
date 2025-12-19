import { ModalLogic } from '../../../essential/dialog';

export interface RenameDialogData {
  sketchId: string;
  sketchName: string;
  sketchPath: string;
}

export type RenameDialogLogic = () => ReturnType<ModalLogic> & {
  renameAction: (value: string) => Promise<void>;
  renameActionLoading: boolean;
  initialValue: string;
  sketchNameValidation: (
    sketchName: string,
  ) => Omit<SketchNameValidationDictionary, 'alreadyExists'>;
  replaceSketchNameInvalidCharacters: (sketchName: string) => string;
};

export enum SketchNameValidation {
  exceedsLimit = 'exceedsLimit',
  alreadyExists = 'alreadyExists',
  hasInvalidCharacters = 'hasInvalidCharacters',
}

export type SketchNameValidationDictionary = {
  [K in SketchNameValidation]: boolean;
};

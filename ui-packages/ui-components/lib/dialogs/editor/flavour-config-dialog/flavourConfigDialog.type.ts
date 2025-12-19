import {
  ArduinoBuilderBoardMenuv3_BuilderApi,
  ArduinoBuilderBoardMenuVariantv3_BuilderApi,
} from '@cloud-editor-mono/infrastructure';

import { ModalLogic } from '../../../essential/dialog';

export type FlavourOptions = (Omit<
  ArduinoBuilderBoardMenuv3_BuilderApi,
  'variants'
> & {
  variants: (ArduinoBuilderBoardMenuVariantv3_BuilderApi & {
    selected?: boolean;
  })[];
})[];

export type FlavourConfigDialogLogic = () => ReturnType<ModalLogic> & {
  handleDismiss: () => void;
  handleClose: () => void;
  flavourOptions?: FlavourOptions;
  setFlavourOptions: (optionId: string, valueId: string) => void;
  top?: number;
  left?: number;
};

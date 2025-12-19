import { UseBoardConfigurationLogic } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { createContext } from 'react';

export type BoardConfigurationContextValue =
  ReturnType<UseBoardConfigurationLogic>;

const BoardConfigurationContextValue: BoardConfigurationContextValue =
  {} as BoardConfigurationContextValue;

export const BoardConfigurationContext =
  createContext<BoardConfigurationContextValue>(BoardConfigurationContextValue);

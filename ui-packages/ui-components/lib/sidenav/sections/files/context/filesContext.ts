import { createContext } from 'react';

import { UseFilesLogic } from '../../../sidenav.type';

export type FilesContextValue = ReturnType<UseFilesLogic>;

const filesContextValue: FilesContextValue = {} as FilesContextValue;

export const FilesContext = createContext<FilesContextValue>(filesContextValue);

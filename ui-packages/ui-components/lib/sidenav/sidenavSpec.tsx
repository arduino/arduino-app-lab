import {
  FileFolderOpen,
  MediaLibraryBooksNormal,
  OperationListOutline,
  Settings as SettingsIcon,
  Sparkle,
  TravelCompassNormal,
} from '@cloud-editor-mono/images/assets/icons';

import { messages } from './messages';
import { ExamplesContext } from './sections/examples/context/examplesContext';
import Examples from './sections/examples/Examples';
import { FilesContext } from './sections/files/context/filesContext';
import { Files } from './sections/files/Files';
import { GenAIContext } from './sections/gen-ai/context/GenAIContext';
import { GenAI } from './sections/gen-ai/GenAI';
import { GenAIHeader } from './sections/gen-ai/GenAIHeader';
import { LibrariesContext } from './sections/libraries/context/librariesContext';
import { Libraries } from './sections/libraries/Libraries';
import { LibrariesHeader } from './sections/libraries/LibrariesHeader';
import { ReferenceContext } from './sections/reference/context/ReferenceContext';
import { Reference } from './sections/reference/Reference';
import { SettingsContext } from './sections/settings/context/settingsContext';
import { Settings } from './sections/settings/Settings';
import styles from './sidenav.module.scss';
import {
  HeaderMap,
  SidenavItemId,
  SidenavItemRecord,
  SidenavItemWithId,
  SidenavSections,
} from './sidenav.type';

const sidenavItemsDictionary: SidenavItemRecord = {
  [SidenavItemId.Files]: {
    Icon: FileFolderOpen,
    label: messages.filesLabel,
  },
  [SidenavItemId.Examples]: {
    Icon: OperationListOutline,
    label: messages.examplesLabel,
  },
  [SidenavItemId.Libraries]: {
    Icon: MediaLibraryBooksNormal,
    label: messages.librariesLabel,
  },
  [SidenavItemId.Reference]: {
    Icon: TravelCompassNormal,
    label: messages.referenceLabel,
  },
  [SidenavItemId.GenAI]: {
    Icon: Sparkle,
    label: messages.genAILabel,
    labelDetails: messages.genAIExperimentalLabel,
  },
  [SidenavItemId.Settings]: {
    Icon: SettingsIcon,
    label: messages.settingsLabel,
    position: 'bottom',
  },
};

export const sidenavItems: SidenavItemWithId[] = Object.entries(
  sidenavItemsDictionary,
).map(([id, item]) => ({
  ...item,
  id: id as SidenavItemId,
}));

export const sections: SidenavSections = {
  [SidenavItemId.Files]: (logic, key) => (
    <FilesContext.Provider value={logic()}>
      <Files key={key} />
    </FilesContext.Provider>
  ),
  [SidenavItemId.Examples]: (logic, key) => (
    <ExamplesContext.Provider value={logic()}>
      <Examples key={key} />
    </ExamplesContext.Provider>
  ),
  [SidenavItemId.Libraries]: (logic, key) => (
    <LibrariesContext.Provider value={logic()}>
      <Libraries key={key} />
    </LibrariesContext.Provider>
  ),
  [SidenavItemId.Reference]: (logic) => (
    <ReferenceContext.Provider value={logic()}>
      <Reference />
    </ReferenceContext.Provider>
  ),
  [SidenavItemId.GenAI]: (logic) => (
    <GenAIContext.Provider value={logic()}>
      <GenAI />
    </GenAIContext.Provider>
  ),
  [SidenavItemId.Settings]: (logic) => (
    <SettingsContext.Provider value={logic()}>
      <Settings />
    </SettingsContext.Provider>
  ),
};

export const header: HeaderMap = {
  [SidenavItemId.Files]: () => null,
  [SidenavItemId.Examples]: () => null,
  [SidenavItemId.Libraries]: (logic) => <LibrariesHeader {...logic()} />,
  [SidenavItemId.Reference]: () => null,
  [SidenavItemId.GenAI]: () => <GenAIHeader />,
  [SidenavItemId.Settings]: () => null,
};

export const icons = {
  [SidenavItemId.Files]: null,
  [SidenavItemId.Examples]: null,
  [SidenavItemId.Libraries]: null,
  [SidenavItemId.Reference]: null,
  [SidenavItemId.GenAI]: <Sparkle className={styles['gen-ai-icon']} />,
  [SidenavItemId.Settings]: null,
};

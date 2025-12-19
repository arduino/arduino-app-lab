import { ArduinoUser } from '@bcmi-labs/art-auth';

export type HeaderLogic = () => {
  user?: ArduinoUser | null;
  isReadOnly: boolean;
  canShareToClassroom?: boolean;
  readOnlyAvatarLink?: string;
  headerItemId: HeaderItemId;
  itemName?: string;
  itemDataIsLoading?: boolean;
  headerActions?: HeaderActions;
};

export enum HeaderItemId {
  Sketch = 'Sketch',
  Example = 'Example',
  CustomLibrary = 'CustomLibrary',
  None = 'None',
}

export enum HeaderSketchActions {
  Rename = 'Rename',
  Download = 'Download',
  Delete = 'Delete',
  Share = 'Share',
  ShareToClassroom = 'ShareToClassroom',
}

export enum HeaderLibraryActions {
  Download = 'Download',
  Delete = 'Delete',
}

export enum HeaderExampleActions {
  CopyToSketches = 'CopyToSketches',
  Download = 'Download',
  Share = 'Share',
}

export type HeaderActions = {
  [HeaderItemId.Sketch]: {
    [key in HeaderSketchActions]: () => void;
  };
  [HeaderItemId.CustomLibrary]: {
    [key in HeaderLibraryActions]: () => void;
  };
  [HeaderItemId.Example]: {
    [key in HeaderExampleActions]: () => void;
  };
};

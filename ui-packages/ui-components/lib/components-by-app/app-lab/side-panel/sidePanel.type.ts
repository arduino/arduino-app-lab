import { Board } from '../setup';

export enum SidePanelItemId {
  MyApps = 'my-apps',
  Examples = 'examples',
  Inspirations = 'inspirations',
  Resources = 'resources',
  Learn = 'learn',
  Bricks = 'bricks',
  Settings = 'settings',
  Account = 'account',
}

export interface SidePanelUser {
  initials: string;
}

export type SidePanelLogic = () => {
  visible: boolean;
  activeItemId?: string;
  board?: Board;
  boards: Board[];
  onSelectBoard: (board: Board) => void;
  onCreateApp: () => void;
  onImportApp: () => void;
  user?: SidePanelUser;
};

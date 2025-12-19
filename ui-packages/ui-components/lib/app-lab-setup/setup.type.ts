import { FooterItem } from '../app-lab-footer-bar';
import {
  UseBoardConfigurationLogic,
  UseLinuxCredentialsLogic,
  UseNetworkLogic,
} from '../app-lab-settings';

export type ConnectionType = 'USB' | 'Network' | 'Local';

export type Board = {
  id: string;
  isSelecting?: boolean;
  checkingStatus?: boolean;
  name: string;
  type: string;
  connectionType: ConnectionType;
  protocol: string;
  serial: string;
  address: string;
};

export type UseSetupLogic = () => {
  isBoard?: boolean;
  boards: Board[];
  selectBoard: (board: Board) => void;
  showBoardSelectionPage: boolean;
  showPostSelectionSetup: boolean;
  currentStep?: AppLabSetupItemId;
  stepIsSkippable?: boolean;
  contentLogicMap?: SetupContentLogicMap;
  showBoardConnPswPrompt: boolean;
  onConnPswCancel: () => void;
  onConnPswSubmit: (password: string) => Promise<void>;
  isBoardConnectingOrChecking: boolean;
  connToBoardError?: string;
  showConfirmButton?: boolean;
  boardItem?: FooterItem;
  onOpenTerminal?: () => Promise<void>;
  terminalError?: string | null;
};

export enum AppLabSetupItemId {
  BoardConfiguration,
  NetworkSetup,
  LinuxCredentials,
}

export interface SetupContentLogicMap {
  [AppLabSetupItemId.BoardConfiguration]: UseBoardConfigurationLogic;
  [AppLabSetupItemId.NetworkSetup]: UseNetworkLogic;
  [AppLabSetupItemId.LinuxCredentials]: UseLinuxCredentialsLogic;
}

export type AppLabSetupItem = {
  id: AppLabSetupItemId;
  enabled: boolean;
};

export type SetupSections = {
  [Property in AppLabSetupItemId]: (
    logic: SetupContentLogicMap[Property],
    ref: React.RefObject<{
      confirm: () => void;
      skip?: () => void;
    }>,
  ) => [boolean, React.ReactNode];
};

export interface SetupSection<T extends AppLabSetupItem> {
  item: T;
  logic: SetupContentLogicMap[T['id']];
  render: SetupSections[T['id']];
}

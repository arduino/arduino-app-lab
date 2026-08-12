import { AppDetailedInfo } from '@cloud-editor-mono/infrastructure';

import { LinuxCredentialsDialogLogic } from '../../../dialogs';
import { LspId, LspState } from '../../shared';
import { BoardItem } from '../board-section';
import { Action, ActionStatus } from '../runtime-actions';
import { Board } from '../setup';

type SystemResourcesId = 'root' | 'user' | 'ram' | 'cpu' | 'npu' | 'network';

export interface SystemResource {
  label?: string;
  icon?: React.ReactNode;
  state?: 'default' | 'inactive' | 'warning';
  value?: { used?: number; total?: number };
  onClick?: () => void;
}

export type SystemResources = Record<SystemResourcesId, SystemResource>;

export type BoardResources = {
  cpuPercentage?: number;
  npuPercentage?: number;
  ram?: {
    used: number;
    total: number;
  };
  homeDisk?: {
    used: number;
    total: number;
  };
  rootDisk?: {
    used: number;
    total: number;
  };
};

export type BoardResourcesValue = {
  resources: BoardResources | undefined;
  ramUsedGB: string;
  ramTotalGB: string;
  homeDiskUsedGB: string;
  homeDiskTotalGB: string;
  rootDiskUsedGB: string;
  rootDiskTotalGB: string;
};

export interface Notification {
  label: string;
  tooltip?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export enum AgentModeTooltipVariant {
  BackToIde = 'backToIde',
  AgentIsHere = 'agentIsHere',
}

export interface AgentModeTooltipLogic {
  // No variant means there is no tooltip left to show.
  variant?: AgentModeTooltipVariant;
  onDismiss: VoidFunction;
}

export interface FooterBarProps {
  footerBarLogic: FooterBarLogic;
}

export type FooterBarLogic = () => {
  runtimeContext: {
    appsStatus: {
      runningApp?: AppDetailedInfo;
    };
    runtimeActions: {
      currentAction: Action | null;
      currentActionStatus: ActionStatus;
      stopAction: (app: AppDetailedInfo) => void;
    };
  };
  notifications: Notification[];
  currentVersion: string;
  newNotifications: number;
  resetNewNotifications: () => void;
  onOpenApp: (app: AppDetailedInfo) => void;
  onOpenAiAssistant: () => void;
  aiAssistantActive: boolean;
  agentModeTooltip: AgentModeTooltipLogic;
  // Keeps the "Agent Mode" entry shining until it has been clicked once.
  agentModeEntryShine: boolean;
  onOpenTerminal: () => Promise<void>;
  terminalError: string | null;
  systemResources: SystemResources;
  boardItem?: BoardItem;
  boardIP?: string | null;
  isBoard: boolean;
  boards: Board[];
  selectedBoard: Board | undefined;
  lspId?: LspId;
  lspState?: LspState;
  bytesToGiB: (bytes: number) => string;
  selectBoard: (board: Board) => Promise<void>;
  autoSelectBoard: (boardId: string) => Promise<void>;
  showBoardConnPswPrompt: boolean;
  onConnPswCancel: () => void;
  onConnPswSubmit: (password: string) => Promise<void>;
  isConnectingToBoard: boolean;
  connToBoardError?: string;
  linuxCredentialsDialog: LinuxCredentialsDialogLogic;
};

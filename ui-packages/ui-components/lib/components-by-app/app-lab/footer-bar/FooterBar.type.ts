import { AppDetailedInfo } from '@cloud-editor-mono/infrastructure';

import { BoardItem } from '../board-section';
import { Action, ActionStatus } from '../runtime-actions';
import { Board } from '../setup';

type SystemResourcesId = 'root' | 'user' | 'ram' | 'cpu' | 'network';

export interface SystemResource {
  label?: string;
  icon?: React.ReactNode;
  state?: 'default' | 'inactive' | 'warning';
  onClick?: () => void;
}

export type SystemResources = Record<SystemResourcesId, SystemResource>;

export type BoardResources = {
  cpuPercentage?: number;
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
  onOpenTerminal: () => Promise<void>;
  terminalError: string | null;
  systemResources: SystemResources;
  boardItem?: BoardItem;
  boardIP?: string;
  isBoard: boolean;
  boards: Board[];
  selectedBoard: Board | undefined;
  autoSelectBoard: (boardId: string) => void;
};

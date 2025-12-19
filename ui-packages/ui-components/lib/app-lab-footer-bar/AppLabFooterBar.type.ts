import { UseCreateAppTitleLogic } from '../app-lab-app-title';
import { UseRuntimeLogic } from '../app-lab-runtime-actions';

export interface FooterItem {
  id: string;
  label?: string;
  icon?: React.ReactNode;
  state?: 'default' | 'inactive' | 'warning';
  onClick?: () => void;
}

export interface Notification {
  label: string;
  tooltip?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export interface AppLabFooterBarProps {
  footerBarLogic: FooterBarLogic;
}

export type FooterBarLogic = () => {
  runtimeContext: ReturnType<UseRuntimeLogic>;
  notifications: Notification[];
  currentVersion: string;
  newNotifications: number;
  resetNewNotifications: () => void;
  items: FooterItem[];
  useCreateAppTitleLogic: UseCreateAppTitleLogic;
  onOpenTerminal?: () => Promise<void>;
  terminalError: string | null;
  isBoard: boolean;
};

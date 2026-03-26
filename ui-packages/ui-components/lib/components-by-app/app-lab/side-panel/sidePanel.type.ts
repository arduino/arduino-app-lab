import { ArduinoUser } from '@bcmi-labs/art-auth';
import { MessageDescriptor } from 'react-intl';

export type SidePanelLogic = () => {
  sidePanelItemsBySection: Record<SidePanelSectionId, SidePanelItemInterface[]>;
  activeItem?: string;
  user?: ArduinoUser | null;
  visible: boolean;
};

export type SidePanelSectionId = 'top' | 'middle' | 'bottom';

export enum SidePanelItemId {
  MyApps = 'my-apps',
  Examples = 'examples',
  Bricks = 'bricks',
  AiModels = 'models',
  Learn = 'learn',
  Settings = 'settings',
  Account = 'account',
}

export interface SidePanelItemInterface {
  Icon: React.FC | string;
  label: MessageDescriptor;
  id: SidePanelItemId;
  sectionId?: SidePanelSectionId;
  active?: boolean;
  enabled?: boolean;
}

export type SidePanelItemRecord = Record<
  SidePanelItemId,
  SidePanelItemInterface
>;

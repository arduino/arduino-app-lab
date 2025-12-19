import BoardUpdate from './sections/board-update/BoardUpdate';
import Documentation from './sections/documentation/Documentation';
import Network from './sections/network/Network';
import { SecurityProtocolSection } from './sections/network/network.type';
import Storage from './sections/storage/Storage';
import {
  AppLabSettingsItem,
  AppLabSettingsItemId,
  SecurityProtocols,
} from './settings.type';
import { SettingsSections } from './settings.type';

export const settings: AppLabSettingsItem[] = [
  {
    id: AppLabSettingsItemId.Storage,
    title: 'Storage',
    subtitle: 'Manage your storage settings',
    icon: '🗄️',
    isEnabled: false,
  },
  {
    id: AppLabSettingsItemId.Network,
    title: 'Wi-Fi',
    subtitle: 'Configure your Wi-Fi settings',
    icon: '📶',
    isEnabled: true,
  },
  {
    id: AppLabSettingsItemId.BoardUpdate,
    title: 'Board update',
    subtitle: 'Update board packages',
    icon: '🔄',
    isEnabled: true,
  },
  {
    id: AppLabSettingsItemId.Documentation,
    title: 'Documentation',
    subtitle: 'Access the documentation',
    icon: '📚',
    isEnabled: false,
  },
];

export const sections: SettingsSections = {
  [AppLabSettingsItemId.Storage]: (logic) => <Storage logic={logic()} />,
  [AppLabSettingsItemId.Network]: (logic) => <Network logic={logic()} />,
  [AppLabSettingsItemId.BoardUpdate]: (logic) => (
    <BoardUpdate logic={logic()} />
  ),
  [AppLabSettingsItemId.Documentation]: (logic) => (
    <Documentation logic={logic()} />
  ),
};

export const securityProtocols: SecurityProtocolSection[] = [
  {
    name: 'Security Protocols',
    items: [
      {
        id: SecurityProtocols.WEP,
        label: 'WEP',
      },
      {
        id: SecurityProtocols.WPA,
        label: 'WPA',
      },
      {
        id: SecurityProtocols.WPA2,
        label: 'WPA2',
      },
      {
        id: SecurityProtocols.WPA3,
        label: 'WPA3',
      },
    ],
  },
];

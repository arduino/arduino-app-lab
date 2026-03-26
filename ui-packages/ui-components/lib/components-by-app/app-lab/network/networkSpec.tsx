import { SecurityProtocols, SecurityProtocolSection } from './network.type';

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

import { MessageDescriptor } from 'react-intl';

export enum DetectedDevicesGroup {
  Online = 'online',
  Offline = 'offline',
}

export interface DetectedDevicesGroupItem {
  id: DetectedDevicesGroup;
  label: MessageDescriptor;
}

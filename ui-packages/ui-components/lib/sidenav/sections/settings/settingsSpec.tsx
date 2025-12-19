import {
  Appearance as AppearanceIcon,
  Device as DeviceIcon,
  Sketch as SketchIcon,
  VerifyAndUpload as VerifyAndUploadIcon,
} from '@cloud-editor-mono/images/assets/icons';

import { messages } from './messages';
import Appearance from './sections/Appearance';
import Device from './sections/Device';
import Sketch from './sections/Sketch';
import VerifyAndUpload from './sections/VerifyAndUpload';
import {
  SettingsItemId,
  SettingsItemRecord,
  SettingsItemWithId,
  SettingsSections,
} from './settings.type';

const settingsItemsDictionary: SettingsItemRecord = {
  [SettingsItemId.Appearance]: {
    Icon: AppearanceIcon,
    label: messages.appearenceLabel,
  },
  [SettingsItemId.Sketch]: {
    Icon: SketchIcon,
    label: messages.sketchLabel,
  },
  [SettingsItemId.Device]: {
    Icon: DeviceIcon,
    label: messages.deviceLabel,
  },
  [SettingsItemId.VerifyAndUpload]: {
    Icon: VerifyAndUploadIcon,
    label: messages.verifyAndUploadLabel,
  },
};

export const settingsItems: SettingsItemWithId[] = Object.entries(
  settingsItemsDictionary,
).map(([id, item]) => ({
  ...item,
  id: id as SettingsItemId,
}));

export const sections: SettingsSections = {
  [SettingsItemId.Appearance]: () => <Appearance />,
  [SettingsItemId.Sketch]: () => <Sketch />,
  [SettingsItemId.Device]: () => <Device />,
  [SettingsItemId.VerifyAndUpload]: () => <VerifyAndUpload />,
};

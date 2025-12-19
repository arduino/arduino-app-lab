import { ShowThingV1Device_Response } from '@cloud-editor-mono/infrastructure';
import { lt as semverLessThan } from 'semver';

export function isNinaUpdated(
  thingDevice: ShowThingV1Device_Response,
): boolean {
  if (!thingDevice.otaCompatible) return true;
  if (!thingDevice.wifiFwVersion || !thingDevice.requiredWifiFwVersion)
    return true;
  if (
    !semverLessThan(
      thingDevice.wifiFwVersion,
      thingDevice.requiredWifiFwVersion,
    )
  )
    return true;

  return false;
}

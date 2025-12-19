import {
  CheckThingCert_Response,
  checkThingCertRequest,
  deviceV2SendRequest,
  listDevicesV2Request,
  ORGANIZATION_HEADER,
  ShowDeviceV2_Response,
  showThingDeviceRequest,
  ShowThingV1Device_Response,
} from '@cloud-editor-mono/infrastructure';
import { DetectedDevicesGroup } from '@cloud-editor-mono/ui-components';

import { getAccessToken, noTokenReject } from '../arduino-auth';
import { getSpace } from '../space-storage';
import {
  GetIotCloudDevices_Result,
  UploadIotSketch_Result,
  UploadIotSketchNotReadyError,
  UploadIotSketchReady_Result,
} from './iotApiService.type';
import { isNinaUpdated } from './utils';

const STATUS_EVENT_NAME = 'r_status';
enum STATUS_EVENT {
  CONNECTED = 'CONNECTED',
}

export async function getIotCloudDevices(
  thingId?: string,
): Promise<GetIotCloudDevices_Result> {
  const onlineDevices: ShowDeviceV2_Response[] = [];
  const offlineDevices: ShowDeviceV2_Response[] = [];

  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  const params = space
    ? {
        header: {
          [ORGANIZATION_HEADER]: space,
        },
      }
    : undefined;

  const result = await listDevicesV2Request(token, params);
  const iotDevices = result.filter((d) =>
    Boolean(
      d.thing && (!thingId || d.thing.id === thingId), // temporary filter to show online devices related to the thing
    ),
  );

  for (const d of iotDevices) {
    const statusEvent = d.events?.find((e) => e.name === STATUS_EVENT_NAME);

    if (statusEvent && statusEvent.value === STATUS_EVENT.CONNECTED) {
      onlineDevices.push(d);
    } else {
      offlineDevices.push(d);
    }
  }

  return {
    [DetectedDevicesGroup.Online]: onlineDevices,
    [DetectedDevicesGroup.Offline]: offlineDevices,
  };
}

export async function iotUploadReady(
  thingId: string,
  deviceId: string,
): Promise<UploadIotSketchReady_Result> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  const thingDevice = await showThingDeviceRequest(token, {
    path: { id: thingId },
    header: space
      ? {
          [ORGANIZATION_HEADER]: space,
        }
      : undefined,
  });

  const shouldUpdateNina = !isNinaUpdated(thingDevice);

  if (shouldUpdateNina) {
    return {
      value: false,
      reason: UploadIotSketchNotReadyError.UpdateRequired,
    };
  }

  if (thingDevice.id !== deviceId) {
    return { value: false, reason: UploadIotSketchNotReadyError.WrongDevice };
  }

  if (!thingDevice.otaCompatible) {
    return {
      value: false,
      reason: UploadIotSketchNotReadyError.OTAIncompatible,
    };
  }

  if (!thingDevice.otaAvailable) {
    return {
      value: false,
      reason: UploadIotSketchNotReadyError.OTAUnavailable,
    };
  }

  return { value: true };
}

export async function uploadIotSketch(
  deviceId: string,
  binaryKey: string,
): Promise<UploadIotSketch_Result> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  return deviceV2SendRequest({ binary_key: binaryKey, async: false }, token, {
    path: { id: deviceId },
    header: space
      ? {
          [ORGANIZATION_HEADER]: space,
        }
      : undefined,
  });
}

export async function getThingDevice(
  thingId: string,
): Promise<ShowThingV1Device_Response> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  return showThingDeviceRequest(token, {
    path: { id: thingId },
    header: space
      ? {
          [ORGANIZATION_HEADER]: space,
        }
      : undefined,
  });
}

export async function checkThingCert(
  thingId: string,
): Promise<CheckThingCert_Response> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  return checkThingCertRequest(token, {
    path: { id: thingId },
    header: space
      ? {
          [ORGANIZATION_HEADER]: space,
        }
      : undefined,
  });
}

import {
  abortPendingOtaV1Request,
  CreateOtaV1_Response,
  createOtaV1Request,
  ListOtaParams_OtaApi,
  ListOtaV1_Response,
  listOtaV1Request,
  ORGANIZATION_HEADER,
  ShowOtaV1_Response,
  showOtaV1Request,
} from '@cloud-editor-mono/infrastructure';

import { getAccessToken, noTokenReject } from '../arduino-auth';
import { getSpace } from '../space-storage';

//Create new OTA Upload
export async function createOtaUpload(
  deviceId: string,
  binaryKey: string,
): Promise<CreateOtaV1_Response | { errStatus: number }> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  const headers = space ? { [ORGANIZATION_HEADER]: space } : undefined;

  const body = {
    device_id: deviceId,
    binary_key: binaryKey,
  };

  return createOtaV1Request(body, token, headers);
}

//List all the OTAs associated to a device
export async function listDeviceOTA(
  deviceId: string,
  filters?: Omit<ListOtaParams_OtaApi['query'], 'device_id'>,
): Promise<ListOtaV1_Response> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  const headers = space ? { [ORGANIZATION_HEADER]: space } : undefined;

  const query = { device_id: deviceId, ...filters };

  return listOtaV1Request(token, headers, query);
}

//List all the OTAs associated to a device
export async function getOtaById(
  otaId: string,
  filters?: { all_progress?: boolean },
): Promise<ShowOtaV1_Response> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  const headers = space ? { [ORGANIZATION_HEADER]: space } : undefined;
  return showOtaV1Request(token, otaId, headers, filters);
}

//List all the OTAs associated to a device
export async function abortPendingOtaById(
  otaId: string,
): Promise<CreateOtaV1_Response> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  const space = getSpace();

  const headers = space ? { [ORGANIZATION_HEADER]: space } : undefined;

  return abortPendingOtaV1Request(token, otaId, headers);
}

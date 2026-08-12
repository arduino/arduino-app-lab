import { Config } from '@cloud-editor-mono/common';

import { httpGet, httpPost } from '../fetch';
import {
  CloudConnectorIdentity,
  CloudConnectorStartProvisioningRequest,
  CloudConnectorStartProvisioningResult,
  CloudConnectorStatus,
} from './cloudConnector.type';

export async function getCloudConnectorStatusV1Request(
  origin: string = Config.CLOUD_CONNECTOR_URL,
): Promise<CloudConnectorStatus> {
  const endpoint = `/v1/status`;

  const response = await httpGet<CloudConnectorStatus>({
    url: origin,
    endpoint,
  });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response;
}

export async function getCloudConnectorIdentityV1Request(
  origin: string = Config.CLOUD_CONNECTOR_URL,
): Promise<CloudConnectorIdentity> {
  const endpoint = `/v1/identity`;

  const response = await httpGet<CloudConnectorIdentity>({
    url: origin,
    endpoint,
  });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response;
}

export async function startCloudConnectorProvisioningV1Request(
  origin: string = Config.CLOUD_CONNECTOR_URL,
  body: CloudConnectorStartProvisioningRequest = {},
): Promise<string | undefined> {
  const endpoint = `/v1/provisioning/start`;

  const response = await httpPost<CloudConnectorStartProvisioningResult>({
    url: origin,
    endpoint,
    body,
  });

  return response?.status;
}

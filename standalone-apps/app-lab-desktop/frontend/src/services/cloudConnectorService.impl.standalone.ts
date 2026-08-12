import { Config } from '@cloud-editor-mono/common';
import {
  CloudConnectorService,
  getAccessToken,
  noTokenReject,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  CloudConnectorIdentity,
  CloudConnectorOrganization,
  CloudConnectorStatus,
  getCloudConnectorIdentityV1Request,
  getCloudConnectorStatusV1Request,
  ORGANIZATION_HEADER,
  startCloudConnectorProvisioningV1Request,
} from '@cloud-editor-mono/infrastructure';
import { Board } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import {
  GetCloudConnectorURL,
  MakeHTTPRequest,
} from '../../wailsjs/go/app/App';

const PRIVATE_ORGANIZATION_ID = 'my-cloud';
const getCloudConnectorURL = async (): Promise<string> => {
  try {
    // Board and desktop use case
    if (Config.FORCE_IS_BOARD) {
      return Config.CLOUD_CONNECTOR_URL;
    }

    return await GetCloudConnectorURL();
  } catch {
    return Config.CLOUD_CONNECTOR_URL;
  }
};

const tryClaimProvisioningDevice = async (
  identity: CloudConnectorIdentity,
  name: string,
  organizationId: string | undefined,
  token: string,
): Promise<boolean> => {
  const response = await MakeHTTPRequest(
    'POST',
    `${Config.PROVISIONING_API_URL}/v1/onboarding/claim`,
    token,
    organizationId
      ? {
          [ORGANIZATION_HEADER]: organizationId,
        }
      : {},
    JSON.stringify({
      board_token: identity.board_token,
      connection_type: 'wifi',
      device_name: name,
    }),
  );

  if (response?.statusCode === 200) return true;

  const parsed = JSON.parse(response.body || '{}') as {
    err_code?: number;
  };

  // Device not yet registered, so we need to register it first
  if (parsed.err_code && [1, 2, 15].includes(parsed.err_code)) {
    return false;
  }

  throw new Error(
    JSON.stringify({
      ...parsed,
      uhwid: identity.uhwid,
    }),
  );
};

const ensureProvisioningDeviceClaimed = async (
  board: Board,
  identity: CloudConnectorIdentity,
  organizationId: string | undefined,
  token: string,
): Promise<boolean> => {
  const isClaimed = await tryClaimProvisioningDevice(
    identity,
    board.name,
    organizationId,
    token,
  );
  if (isClaimed) return true;

  try {
    const response = await MakeHTTPRequest(
      'POST',
      `${Config.PROVISIONING_API_URL}/v1/boards/register`,
      token,
      organizationId
        ? {
            [ORGANIZATION_HEADER]: organizationId,
          }
        : {},
      JSON.stringify({
        pid: board.fqbn === 'arduino:zephyr:ventunoq' ? '0x007A' : '0x0078',
        public_key: identity.public_key_pem,
        serial: board.serial,
        unique_hardware_id: identity.uhwid,
        vid: '0x2341',
      }),
    );
    if (response?.statusCode !== 200) return false;
  } catch {
    return false;
  }

  return tryClaimProvisioningDevice(
    identity,
    board.name,
    organizationId,
    token,
  );
};

export const listCloudConnectorOrganizations: CloudConnectorService['listCloudConnectorOrganizations'] =
  async function () {
    const token = await getAccessToken(undefined, true);
    if (!token) return noTokenReject();

    const response = await MakeHTTPRequest(
      'GET',
      `${Config.CLASSROOM_API_URL}/v1/organizations`,
      token,
      {},
      '',
    );

    if (response?.statusCode !== 200) {
      throw new Error(
        `Call to "/v1/organizations" failed with status ${response?.statusCode}`,
      );
    }

    const parsed = JSON.parse(response.body || '{}') as {
      organizations?: CloudConnectorOrganization[];
    };

    if (!parsed.organizations) {
      throw new Error(
        'Call to "/v1/organizations" did not respond with the expected result',
      );
    }

    return [
      {
        id: PRIVATE_ORGANIZATION_ID,
        logo: undefined,
        name: 'My Cloud',
        type: 'Private space',
      },
      ...(parsed.organizations || []).map((organization) => ({
        id: organization.id,
        logo:
          organization.logo !== ''
            ? `${Config.ORGANIZATIONS_LOGO_URL}/${organization.logo}`
            : undefined,
        name: organization.name,
        type: organization.type,
      })),
    ];
  };

const getCloudConnectorIdentity = async (): Promise<CloudConnectorIdentity> => {
  const origin = await getCloudConnectorURL();
  return getCloudConnectorIdentityV1Request(origin);
};

const startDeviceProvisioning = async (
  organizationId: string | undefined,
): Promise<void> => {
  const origin = await getCloudConnectorURL();

  const response = await startCloudConnectorProvisioningV1Request(origin, {
    organization_id: organizationId,
  });

  if (response !== 'accepted') {
    throw new Error('Failed to start device provisioning');
  }
};

type Device = {
  id: string;
  serial: string;
  organization_id?: string;
};

const lookForDeviceInOrganization = async (
  deviceId: string | undefined,
  organizationId: string | undefined,
  token: string,
): Promise<Device | undefined> => {
  try {
    const response = await MakeHTTPRequest(
      'GET',
      `${Config.IOT_API_URL}/v2/devices`,
      token,
      organizationId
        ? {
            [ORGANIZATION_HEADER]: organizationId,
          }
        : {},
      '',
    );

    if (response?.statusCode !== 200) {
      throw new Error(
        `Call to "/v2/devices" failed with status ${response?.statusCode}`,
      );
    }

    const parsed = JSON.parse(response.body || '[]') as Device[];

    return parsed.find((device) => device.id === deviceId);
  } catch {
    return undefined;
  }
};

export const startCloudConnectorProvisioning: CloudConnectorService['startCloudConnectorProvisioning'] =
  async function (board, organization, status) {
    const token = await getAccessToken(undefined, true);
    if (!token) return noTokenReject();

    const organizationId =
      organization.id === PRIVATE_ORGANIZATION_ID ? undefined : organization.id;

    const device = await lookForDeviceInOrganization(
      status.device_id,
      organizationId,
      token,
    );
    if (device) return;

    const identity = await getCloudConnectorIdentity();

    const isClaimed = await ensureProvisioningDeviceClaimed(
      board,
      identity,
      organizationId,
      token,
    );
    if (!isClaimed) {
      throw new Error(
        `Failed to claim provisioning device for board ${board.serial} in organization ${organizationId}`,
      );
    }

    return startDeviceProvisioning(organizationId);
  };

export const deleteCloudConnectorDevice: CloudConnectorService['deleteCloudConnectorDevice'] =
  async function (status: CloudConnectorStatus) {
    const token = await getAccessToken(undefined, true);
    if (!token) return noTokenReject();

    const response = await MakeHTTPRequest(
      'DELETE',
      `${Config.IOT_API_URL}/v2/devices/${status.device_id}`,
      token,
      status.organization_id
        ? { [ORGANIZATION_HEADER]: status.organization_id }
        : {},
      '',
    );

    if (response?.statusCode !== 200) {
      throw new Error(
        `Failed to delete device with ID ${status.device_id} from organization ${status.organization_id}`,
      );
    }
  };

export const getCloudConnectorStatus: CloudConnectorService['getCloudConnectorStatus'] =
  async function () {
    const origin = await getCloudConnectorURL();

    const status = await getCloudConnectorStatusV1Request(origin);
    if (status.provisioning !== 'provisioned') return status;

    const unprovisionedStatus: CloudConnectorStatus = {
      ...status,
      provisioning: 'unprovisioned',
    };

    try {
      const token = await getAccessToken(undefined, true);
      if (!token) return unprovisionedStatus;

      const device = await lookForDeviceInOrganization(
        status.device_id,
        status.organization_id,
        token,
      );
      if (device) return status;

      return unprovisionedStatus;
    } catch {
      return unprovisionedStatus;
    }
  };

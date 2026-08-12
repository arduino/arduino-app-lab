import { components } from './cloud-connector';

// models
export type CloudConnectorStatus = components['schemas']['StatusResponse'];
export type CloudConnectorIdentity = components['schemas']['IdentityResponse'];
export type CloudConnectorError = components['schemas']['Error'];
export type CloudConnectorStartProvisioningRequest =
  components['schemas']['StartProvisioningRequest'];
export type CloudConnectorStartProvisioningResult =
  components['schemas']['AcceptedResponse'];

export type CloudConnectorOrganization = {
  id: string;
  logo?: string;
  name: string;
  type: string;
};

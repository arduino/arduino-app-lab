import { CloudConnectorService } from './cloud-connector-service.type';

export let getCloudConnectorStatus: CloudConnectorService['getCloudConnectorStatus'] =
  async function () {
    throw new Error('getCloudConnectorStatus service not implemented');
  };

export let listCloudConnectorOrganizations: CloudConnectorService['listCloudConnectorOrganizations'] =
  async function () {
    throw new Error('listCloudConnectorOrganizations service not implemented');
  };

export let startCloudConnectorProvisioning: CloudConnectorService['startCloudConnectorProvisioning'] =
  async function () {
    throw new Error('startCloudConnectorProvisioning service not implemented');
  };

export let deleteCloudConnectorDevice: CloudConnectorService['deleteCloudConnectorDevice'] =
  async function () {
    throw new Error('deleteCloudConnectorDevice service not implemented');
  };

export const setCloudConnectorService = (
  service: CloudConnectorService,
): void => {
  getCloudConnectorStatus = service.getCloudConnectorStatus;
  listCloudConnectorOrganizations = service.listCloudConnectorOrganizations;
  startCloudConnectorProvisioning = service.startCloudConnectorProvisioning;
  deleteCloudConnectorDevice = service.deleteCloudConnectorDevice;
};

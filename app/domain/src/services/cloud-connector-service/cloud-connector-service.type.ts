import {
  CloudConnectorOrganization,
  CloudConnectorStatus,
} from '@cloud-editor-mono/infrastructure';
import { Board } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export interface CloudConnectorService {
  getCloudConnectorStatus(): Promise<CloudConnectorStatus>;
  listCloudConnectorOrganizations(): Promise<CloudConnectorOrganization[]>;
  startCloudConnectorProvisioning(
    board: Board,
    organization: CloudConnectorOrganization,
    status: CloudConnectorStatus,
  ): Promise<void>;
  deleteCloudConnectorDevice(status: CloudConnectorStatus): Promise<void>;
}

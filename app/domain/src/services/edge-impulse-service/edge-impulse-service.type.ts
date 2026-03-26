import { EIProject } from '@cloud-editor-mono/infrastructure';

export interface EdgeImpulseService {
  getEIProjects(): Promise<EIProject[]>;
  getEIProjectAPIKey(projectId: string): Promise<string>;
  setEILatencyDevice(projectId: string): Promise<void>;
  isEIDeploymentOutdated(
    projectId: string,
    deploymentVersion: string,
  ): Promise<boolean>;
}

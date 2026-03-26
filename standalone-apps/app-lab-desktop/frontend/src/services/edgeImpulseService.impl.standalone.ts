import {
  EdgeImpulseService,
  getEIAccessToken,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  EIProject,
  getEIHistoricDeployment,
  getEIProjectAPIKeysV1Request,
  getEIProjectImpulsesV1Request,
  getEIProjectInfoV1Request,
  getEIProjectsV1Request,
  postEIUpdateProjectV1Request,
} from '@cloud-editor-mono/infrastructure';

export const getEIProjects: EdgeImpulseService['getEIProjects'] =
  async function () {
    const token = await getEIAccessToken();
    const response = await getEIProjectsV1Request(token);

    if (response.error) {
      throw response.error;
    }

    const projects: EIProject[] = (
      await Promise.all(
        response.projects.map(async (project) => {
          const [infoResp, impulsesResp] = await Promise.all([
            getEIProjectInfoV1Request(token, project.id.toString()),
            getEIProjectImpulsesV1Request(token, project.id.toString()),
          ]);

          if (infoResp.error || impulsesResp.error) {
            throw infoResp.error || impulsesResp.error;
          }

          const targetConstraints = infoResp.targetConstraints;
          const hasUnoQLatencyDevice = !!targetConstraints?.targetDevices.some(
            (d) => d.latencyDevice === 'arduino-unoq',
          );
          const hasOtherNonDefaultLatencyDevice = !!(
            targetConstraints &&
            targetConstraints.selectedTargetBasedOn !== 'default' &&
            targetConstraints.targetDevices.some(
              (d) => d.latencyDevice !== 'arduino-unoq',
            )
          );

          return {
            ...project,
            category: infoResp.project.category,
            impulses: impulsesResp.impulses,
            hasUnoQLatencyDevice,
            hasOtherNonDefaultLatencyDevice,
          } as EIProject;
        }),
      )
    )
      .filter((p): p is EIProject => p !== null)
      .sort((a, b) => a.name.localeCompare(b.name));

    return projects;
  };

export const getEIProjectAPIKey: EdgeImpulseService['getEIProjectAPIKey'] =
  async function (projectId: string) {
    const token = await getEIAccessToken();
    const response = await getEIProjectAPIKeysV1Request(token, projectId);

    if (response.error) {
      throw response.error;
    }

    const apiKey = response.apiKey;
    if (!apiKey) {
      throw new Error(
        `Development key not found for edge impulse project: ${projectId}`,
      );
    }

    return apiKey;
  };

export const setEILatencyDevice: EdgeImpulseService['setEILatencyDevice'] =
  async function (projectId: string) {
    const token = await getEIAccessToken();
    const body = {
      latencyDevice: 'arduino-unoq',
    };

    const response = await postEIUpdateProjectV1Request(token, projectId, body);

    if (response.error) {
      throw response.error;
    }
  };

export const isEIDeploymentOutdated: EdgeImpulseService['isEIDeploymentOutdated'] =
  async function (projectId: string, deploymentVersion: string) {
    const token = await getEIAccessToken();

    const response = await getEIHistoricDeployment(
      token,
      projectId,
      deploymentVersion,
    );

    if (response.error) {
      throw response.error;
    }

    const isOutdated =
      !response.deployment?.impulseIsDeleted &&
      response.deployment?.impulseHasChangedSinceDeployment;

    return isOutdated;
  };

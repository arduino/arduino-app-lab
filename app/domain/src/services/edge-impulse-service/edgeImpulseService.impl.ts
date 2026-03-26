import { EdgeImpulseService } from './edge-impulse-service.type';

export let getEIProjects: EdgeImpulseService['getEIProjects'] =
  async function () {
    throw new Error('getEIModels service not implemented');
  };

export let getEIProjectAPIKey: EdgeImpulseService['getEIProjectAPIKey'] =
  async function () {
    throw new Error('getEIProjectAPIKey service not implemented');
  };

export let setEILatencyDevice: EdgeImpulseService['setEILatencyDevice'] =
  async function () {
    throw new Error('setEILatencyDevice service not implemented');
  };

export let isEIDeploymentOutdated: EdgeImpulseService['isEIDeploymentOutdated'] =
  async function () {
    throw new Error('isDeplo service not implemented');
  };

export const setEdgeImpulseService = (service: EdgeImpulseService): void => {
  getEIProjects = service.getEIProjects;
  getEIProjectAPIKey = service.getEIProjectAPIKey;
  setEILatencyDevice = service.setEILatencyDevice;
  isEIDeploymentOutdated = service.isEIDeploymentOutdated;
};

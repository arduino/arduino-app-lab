import {
  CoreEndpointsCheckResponse,
  EndpointCheckMethodMap,
} from './endpointsService.type';
import {
  getAgentStatus,
  getBuilderStatus,
  getCreateStatus,
} from './endpointStatus';
import { EndpointStatus } from './endpointStatus.type';

const endpointCheckMethodMap: EndpointCheckMethodMap = {
  create: getCreateStatus,
  builder: getBuilderStatus,
  agent: getAgentStatus,
};

export async function checkCoreEndpoints(): Promise<CoreEndpointsCheckResponse> {
  const result: CoreEndpointsCheckResponse = {
    create: EndpointStatus.Down,
    builder: EndpointStatus.Down,
    agent: EndpointStatus.Down,
  };

  const settledPromises = (
    await Promise.allSettled(
      Object.values(endpointCheckMethodMap).map((method) => method()),
    )
  ).map((p) => {
    return {
      status: p.status,
      value:
        (p as PromiseFulfilledResult<EndpointStatus>).value ||
        EndpointStatus.Down,
    };
  });

  (
    Object.keys(endpointCheckMethodMap) as (keyof EndpointCheckMethodMap)[]
  ).forEach((key, index) => {
    if (settledPromises[index].status === 'fulfilled') {
      result[key] = settledPromises[index].value;
    }
  });

  return result;
}

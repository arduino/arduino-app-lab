import { agentIsAlive } from '@cloud-editor-mono/create-agent-client-ts';

import { builderIsAlive } from '../builder-api-service';
import { createIsAlive } from '../create-api-service';
import { CoreEndpoints, EndpointStatus } from './endpointStatus.type';

async function getEndpointStatus(
  endpoint: CoreEndpoints,
): Promise<EndpointStatus> {
  let result = EndpointStatus.Down;

  switch (endpoint) {
    case CoreEndpoints.Builder: {
      const builderAlive = await builderIsAlive();
      if (builderAlive) {
        result = EndpointStatus.Alive;
      }
      break;
    }
    case CoreEndpoints.Create: {
      const createAlive = await createIsAlive();
      if (createAlive) {
        result = EndpointStatus.Alive;
      }
      break;
    }
    case CoreEndpoints.Agent: {
      const agentAlive = await agentIsAlive();
      if (agentAlive) {
        result = EndpointStatus.Alive;
      }
      break;
    }
  }

  return result;
}

export function getBuilderStatus(): Promise<EndpointStatus> {
  return getEndpointStatus(CoreEndpoints.Builder);
}

export function getCreateStatus(): Promise<EndpointStatus> {
  return getEndpointStatus(CoreEndpoints.Create);
}

export function getAgentStatus(): Promise<EndpointStatus> {
  return getEndpointStatus(CoreEndpoints.Agent);
}

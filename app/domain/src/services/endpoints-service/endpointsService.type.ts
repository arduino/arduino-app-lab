import { EndpointStatus } from './endpointStatus.type';

export interface CoreEndpointsCheckResponse {
  create: EndpointStatus;
  builder: EndpointStatus;
  agent: EndpointStatus;
}

export type EndpointCheckMethodMap = {
  [K in keyof CoreEndpointsCheckResponse]: () => Promise<EndpointStatus>;
};

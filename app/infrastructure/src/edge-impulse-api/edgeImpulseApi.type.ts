import { components } from './edge-impulse-api';

// models
export type EIProjectItem = components['schemas']['Project'];
export type EIImpulse = components['schemas']['Impulse'];

// operations
export type EIListProjectsResponse =
  components['schemas']['ListProjectsResponse'];
export type EIGetAllImpulsesResponse =
  components['schemas']['GetAllImpulsesResponse'];
export type EIProjectInfoResponse =
  components['schemas']['ProjectInfoResponse'];
export type EIDevelopmentKeysResponse =
  components['schemas']['DevelopmentKeysResponse'];
export type EIGenericApiResponse = components['schemas']['GenericApiResponse'];
export type EIUpdateProjectRequest =
  components['schemas']['UpdateProjectRequest'];
export type EIGetDeploymentHistoryResponse =
  components['schemas']['GetDeploymentHistoryResponse'];

// mapped models
export type EIProject = EIProjectItem & {
  impulses?: EIImpulse[];
  target?: string;
  hasUnoQLatencyDevice?: boolean;
  hasOtherNonDefaultLatencyDevice?: boolean;
};

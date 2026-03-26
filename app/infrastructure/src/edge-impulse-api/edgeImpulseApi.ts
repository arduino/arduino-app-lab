import { httpGet, httpPost } from '../fetch/fetch';
import {
  EIDevelopmentKeysResponse,
  EIGenericApiResponse,
  EIGetAllImpulsesResponse,
  EIGetDeploymentHistoryResponse,
  EIListProjectsResponse,
  EIProjectInfoResponse,
  EIUpdateProjectRequest,
} from './edgeImpulseApi.type';

const EDGE_IMPULSE_API_URL = 'https://studio.edgeimpulse.com/v1/api';

export async function getEIProjectsV1Request(
  token: string,
): Promise<EIListProjectsResponse> {
  const endpoint = `/projects`;

  const response = await httpGet<EIListProjectsResponse>({
    url: EDGE_IMPULSE_API_URL,
    endpoint,
    token,
  });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response;
}

export async function getEIProjectInfoV1Request(
  token: string,
  projectId: string,
): Promise<EIProjectInfoResponse> {
  const endpoint = `/${projectId}`;

  const response = await httpGet<EIProjectInfoResponse>({
    url: EDGE_IMPULSE_API_URL,
    endpoint,
    token,
  });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response;
}

export async function getEIProjectImpulsesV1Request(
  token: string,
  projectId: string,
): Promise<EIGetAllImpulsesResponse> {
  const endpoint = `/${projectId}/impulses`;

  const response = await httpGet<EIGetAllImpulsesResponse>({
    url: EDGE_IMPULSE_API_URL,
    endpoint,
    token,
  });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response;
}

export async function getEIProjectAPIKeysV1Request(
  token: string,
  projectId: string,
): Promise<EIDevelopmentKeysResponse> {
  const endpoint = `/${projectId}/devkeys`;

  const response = await httpGet<EIDevelopmentKeysResponse>({
    url: EDGE_IMPULSE_API_URL,
    endpoint,
    token,
  });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response;
}

export async function postEIUpdateProjectV1Request(
  token: string,
  projectId: string,
  body: EIUpdateProjectRequest,
): Promise<EIGenericApiResponse> {
  const endpoint = `/${projectId}`;

  const response = await httpPost<EIGenericApiResponse>({
    url: EDGE_IMPULSE_API_URL,
    endpoint,
    token,
    body,
  });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response;
}

export async function getEIHistoricDeployment(
  token: string,
  projectId: string,
  deploymentVersion: string,
): Promise<EIGetDeploymentHistoryResponse> {
  const endpoint = `/${projectId}/deployment/history/${deploymentVersion}`;

  const response = await httpGet<EIGetDeploymentHistoryResponse>({
    url: EDGE_IMPULSE_API_URL,
    endpoint,
    token,
  });

  if (!response) {
    throw new Error(
      `Call to "${endpoint}" did not respond with the expected result`,
    );
  }

  return response;
}

import { Config, StateSubjectValuePair } from '@cloud-editor-mono/common';
import { httpGetRaw, httpPostRaw } from '@cloud-editor-mono/infrastructure';
import { lt as semverLessThan } from 'semver';

import { V2IsSupported } from '../downloads/downloads';
import { mapAgentInfoResponse } from '../mapper';
import { connectToAgentWebSocket } from '../socket/setup';
import { getInvokedFetchAttempts, LOCALHOST, LOOPBACK_ADDRESS } from '../utils';
import {
  AgentInfoResponse,
  agentOSInfoIsComplete,
  agentSecureProtocolInfoIsComplete,
  agentUnsecureProtocolInfoIsComplete,
} from './agent.type';
import { DaemonProtocols } from './daemon.type';
import { daemonState, setAgentDaemonState } from './state';
import { listenForAgentStateCondition } from './state.reactive';
import { AgentDaemonState, AgentDaemonStateKeys } from './state.type';

export async function agentIsAlive(): Promise<boolean> {
  const { searchedForDaemon } = daemonState;

  if (!searchedForDaemon) return true;

  const agentInfo = getAgentInfo();
  if (agentInfo && agentInfo.endpointUrl) {
    const infoResponse = await httpGetRaw(agentInfo.endpointUrl, '');

    return infoResponse?.status == 200;
  }
  return false;
}

async function establishV2Support(): Promise<void> {
  const v2IsSupported = await V2IsSupported();

  if (v2IsSupported) {
    const { config } = daemonState;

    setAgentDaemonState({
      [AgentDaemonStateKeys.Config]: {
        ...config,
        useV2: true,
      },
    });
  }
}

function setAgentProtocol(agentInfo: AgentInfoResponse): void {
  const isHttps =
    agentInfo.endpointUrl &&
    agentInfo.endpointUrl.indexOf(DaemonProtocols.HTTPS) === 0;
  if (!isHttps) {
    agentInfo[DaemonProtocols.HTTP] = agentInfo[DaemonProtocols.HTTP]?.replace(
      LOCALHOST,
      LOOPBACK_ADDRESS,
    );
    return;
  }

  const { config } = daemonState;

  setAgentDaemonState({
    [AgentDaemonStateKeys.Config]: {
      ...config,
      protocolToUse: DaemonProtocols.HTTPS,
    },
  });
}

function updateAgent(): ReturnType<typeof httpPostRaw> {
  const agentUrl = getAgentUrl();

  return httpPostRaw(agentUrl, Config.AGENT_UPDATE_ENDPOINT);
}

async function attemptUpdateAgent(
  installedVersion: string,
  bucketVersion: string,
): Promise<boolean> {
  const installedIsVenturaVersion = installedVersion.indexOf('ventura') !== -1;
  const installedIsDevVersion = installedVersion.indexOf('dev') !== -1;
  const installedIsRcVersion = installedVersion.indexOf('rc') !== -1;

  if (
    installedIsVenturaVersion ||
    installedIsDevVersion ||
    installedIsRcVersion
  ) {
    return false;
  }

  const installedIsMostRecent = !semverLessThan(
    installedVersion,
    bucketVersion,
  );

  if (installedIsMostRecent) {
    return false;
  }

  const updateResponse = await updateAgent();

  if (!updateResponse) {
    throw Error('Update request failed');
  }

  let updateEndpointResponse: { error?: string } = {};
  try {
    updateEndpointResponse = await updateResponse.json();
  } catch (err) {
    // TODO check if there is a more robust way of waiting for agent reboot
    await new Promise((r) => setTimeout(r, 5000));

    return true;
  }

  const error = updateEndpointResponse.error;

  const isProxyError =
    error &&
    (error.indexOf('proxy') !== -1 || error.indexOf('dial tcp') !== -1);

  if (isProxyError) {
    throw Error('A proxy error occurred when trying to update the agent');
  }

  return true;
}

function validateAgentInfoResponse(
  response: AgentInfoResponse,
): AgentInfoResponse | void {
  const agentInfoResponse = response;

  const isNotOK = agentInfoResponse.status !== 200;
  if (isNotOK) return;

  const agentIsOfficial =
    agentInfoResponse.updateUrl &&
    agentInfoResponse.updateUrl.indexOf(Config.AGENT_UPDATE_URL_SUBSTRING) > -1;
  if (!agentIsOfficial) {
    return;
  }

  return agentInfoResponse;
}

async function searchForAgent(): Promise<AgentInfoResponse | void> {
  const response = await Promise.any(getInvokedFetchAttempts());
  if (!response) return;

  const endpointResponseJson = await response.json();

  const mappedAgentInfo = mapAgentInfoResponse({
    ...endpointResponseJson,
    url: response.url,
    status: response.status,
  });

  const validatedAgentInfoResponse = validateAgentInfoResponse(mappedAgentInfo);

  return validatedAgentInfoResponse;
}

export async function waitForWebSocketConnection(): Promise<boolean> {
  const predicate = ([
    _,
    newValue,
  ]: StateSubjectValuePair<AgentDaemonState>): boolean =>
    Boolean(newValue[AgentDaemonStateKeys.SocketConnected]);

  const socketConnected = await listenForAgentStateCondition(
    AgentDaemonStateKeys.SocketConnected,
    predicate,
    false,
  );

  return socketConnected || false;
}

export async function connectToAgent(
  latestAgentVersion?: string,
): Promise<boolean> {
  let agentInfo: AgentInfoResponse | void;
  try {
    agentInfo = await searchForAgent();
  } finally {
    setAgentDaemonState({ searchedForDaemon: true });
  }

  if (!agentInfo || !agentInfo.ws) return false;

  setAgentProtocol(agentInfo);

  setAgentDaemonState({
    [AgentDaemonStateKeys.AgentInfo]: agentInfo,
  });

  if (latestAgentVersion && agentInfo.version) {
    const updateAttemptResult = await attemptUpdateAgent(
      agentInfo.version,
      latestAgentVersion,
    );

    if (updateAttemptResult) {
      const result = await connectToAgent();
      return result;
    }
  }

  await establishV2Support();

  const wsAddress = getAgentWsConnectionAddress();
  connectToAgentWebSocket(wsAddress);

  return waitForWebSocketConnection();
}

export function getAgentInfo(): AgentInfoResponse {
  const { agentInfo } = daemonState;

  if (!agentInfo) {
    throw Error('Tried to retrieve Agent Info when agent is not connected');
  }

  return agentInfo;
}

export function getAgentUrl(): string {
  const agentInfo = getAgentInfo();
  const { config } = daemonState;

  if (config.protocolToUse === DaemonProtocols.HTTP) {
    if (!agentUnsecureProtocolInfoIsComplete(agentInfo)) {
      throw Error('Agent http url not found');
    }

    return agentInfo.http;
  }

  if (!agentSecureProtocolInfoIsComplete(agentInfo)) {
    throw Error('Agent https url not found');
  }

  return agentInfo.https;
}

export function getAgentOS(): string {
  const agentInfo = getAgentInfo();

  if (!agentOSInfoIsComplete(agentInfo)) {
    throw Error('Agent os info not found');
  }

  return agentInfo.os;
}

export function getAgentWsConnectionAddress(): string {
  const agentInfo = getAgentInfo();
  const { config } = daemonState;
  if (
    config.protocolToUse === DaemonProtocols.HTTPS &&
    agentSecureProtocolInfoIsComplete(agentInfo)
  ) {
    return agentInfo.wss;
  }

  if (
    config.protocolToUse === DaemonProtocols.HTTP &&
    agentUnsecureProtocolInfoIsComplete(agentInfo)
  ) {
    return agentInfo.ws;
  }

  throw new Error('Agent websocket address not found');
}

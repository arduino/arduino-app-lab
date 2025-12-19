import { Config } from '@cloud-editor-mono/common';
import { httpGetRaw } from '@cloud-editor-mono/infrastructure';
import UAParser from 'ua-parser-js';

import {
  AgentInfoFetch,
  DefaultToolNames,
  DefaultToolVersions,
} from './daemon/agent.type';
import { DaemonProtocols } from './daemon/daemon.type';
import { DefaultToolDownload } from './downloads/downloads.type';

export const LOOPBACK_ADDRESS = '127.0.0.1';
export const LOCALHOST = 'localhost';

const HTTP_LOOPBACK_ADDRESS = `${DaemonProtocols.HTTP}://${LOOPBACK_ADDRESS}`;
const HTTPS_LOCALHOST = `${DaemonProtocols.HTTPS}://${LOCALHOST}`;

export const DEFAULT_UPLOAD_EXTENSION = 'bin';

const LAST_POSSIBLE_PORT = Number(Config.AGENT_LAST_POSSIBLE_PORT);
const FIRST_POSSIBLE_PORT = Number(Config.AGENT_FIRST_POSSIBLE_PORT);

export const SOCKET_IO_DOWNLOAD_COMMAND_TIMEOUT = 30000;

const userAgentParser = new UAParser();

const isWindows = userAgentParser.getOS().name?.indexOf('Windows') !== -1;
const browser = userAgentParser.getBrowser();

export const defaultToolDownloads: DefaultToolDownload[] =
  ((): DefaultToolDownload[] => {
    const downloads: DefaultToolDownload[] = isWindows
      ? [
          {
            toolName: 'windows-drivers',
            toolVersion: DefaultToolVersions.Latest,
            packageName: DefaultToolNames.Arduino,
          },
        ]
      : [];

    downloads.push(
      {
        toolName: 'bossac',
        toolVersion: '1.7.0',
        packageName: DefaultToolNames.Arduino,
      },
      {
        toolName: 'fwupdater',
        toolVersion: DefaultToolVersions.Latest,
        packageName: DefaultToolNames.Arduino,
      },
      {
        toolName: 'rp2040tools',
        toolVersion: DefaultToolVersions.Latest,
        packageName: DefaultToolNames.Arduino,
      },
    );

    return downloads;
  })();

function createAgentInfoFetch(
  host: string,
  port: number,
  endpoint: string,
): AgentInfoFetch {
  return async (): ReturnType<typeof httpGetRaw> => {
    const response = await httpGetRaw(`${host}:${port}`, endpoint);
    if (!response) {
      return Promise.reject();
    }

    return response;
  };
}

const portsArray =
  LAST_POSSIBLE_PORT && FIRST_POSSIBLE_PORT
    ? Array(LAST_POSSIBLE_PORT - FIRST_POSSIBLE_PORT + 1)
    : [];
export const fetchAttemptsArray = Array.from(
  portsArray,
  (_: undefined, index: number) => {
    const port = FIRST_POSSIBLE_PORT + index;
    const origin =
      browser.name?.includes('Chrome') ||
      browser.name?.includes('Firefox') ||
      browser.name?.includes('Edge')
        ? HTTP_LOOPBACK_ADDRESS
        : HTTPS_LOCALHOST;

    return createAgentInfoFetch(origin, port, Config.AGENT_INFO_ENDPOINT);
  },
);

export function getInvokedFetchAttempts(): ReturnType<AgentInfoFetch>[] {
  return fetchAttemptsArray.map((fetchCall) => {
    return fetchCall();
  });
}

import { httpPostRaw } from '@cloud-editor-mono/infrastructure';
import { Subject } from 'rxjs';
import { beforeEach } from 'vitest';

import { V2IsSupported } from '../downloads/downloads';
import { mapAgentInfoResponse } from '../mapper';
import { connectToAgentWebSocket } from '../socket/setup';
import { getInvokedFetchAttempts } from '../utils';
import { connectToAgent } from './agent';
import { DaemonProtocols } from './daemon.type';
import {
  daemonState,
  initialState as initialDaemonState,
  setAgentDaemonState,
} from './state';
import { AgentDaemonStateKeys } from './state.type';

export const MOCK_AGENT_INFO = {
  http: 'http://127.0.0.1:8991',
  https: 'https://localhost',
  origins: 'https://local.arduino.cc:8000',
  os: 'darwin:amd64',
  update_url: 'https://downloads.arduino.cc/',
  version: '1.2.7',
  ws: 'ws://127.0.0.1:8991',
  wss: 'wss://localhost',
};

export const MOCK_AGENT_RESPONSE = new Response(null, { status: 200 });
// We need to override the default Response `url` getter
Object.defineProperty(MOCK_AGENT_RESPONSE, 'url', {
  value: 'http://127.0.0.1:8991/info',
});

function buildWretchObj(
  json: () => Promise<Record<string, unknown>>,
  res?: () => Promise<Response>,
): Promise<{
  json: () => Promise<Record<string, unknown>>;
  res?: () => Promise<Response>;
}> {
  return Promise.resolve({
    res,
    json,
    status: 200,
    url: MOCK_AGENT_RESPONSE.url,
  });
}

vi.mock('@cloud-editor-mono/infrastructure', () => ({
  httpPostRaw: vi.fn().mockImplementation((_url: string, endpoint: string) => {
    if (endpoint === '/update') {
      return buildWretchObj(async () => ({ error: null }));
    }
    return Promise.resolve({});
  }),
}));

vi.mock('../utils', () => ({
  LOOPBACK_ADDRESS: '127.0.0.1',
  LOCALHOST: 'localhost',
  getInvokedFetchAttempts: vi.fn(),
}));

vi.mock('../downloads/downloads', () => ({
  V2IsSupported: vi.fn().mockImplementation(() => Promise.resolve(true)),
}));

vi.mock('../socket/setup', () => ({
  connectToAgentWebSocket: vi.fn(),
}));

vi.mock('./state.reactive', () => ({
  listenForAgentStateCondition: vi
    .fn()
    .mockImplementation(() => Promise.resolve(true)),
  getStateSubject: vi.fn().mockImplementation(() => new Subject()),
  stateSubjectNext: () => {},
}));

beforeEach(() => {
  vi.clearAllMocks();

  setAgentDaemonState({
    ...initialDaemonState,
    [AgentDaemonStateKeys.AgentInfo]: undefined,
  });

  vi.mocked(getInvokedFetchAttempts).mockReturnValue([
    // @ts-ignore
    buildWretchObj(
      async () => {
        return MOCK_AGENT_INFO;
      },
      async () => {
        return MOCK_AGENT_RESPONSE;
      },
    ),
  ]);
});

afterAll(() => {
  vi.resetAllMocks();
});

describe('connectToAgent', () => {
  it('should not fail with correct arguments', async () => {
    await expect(connectToAgent()).resolves.not.toThrow();
    await expect(connectToAgent('99.99.99')).resolves.not.toThrow();
    await expect(connectToAgent('invalid-semantic-version')).rejects.toThrow();
  });

  it('should connect to the agent', async () => {
    const connected = await connectToAgent();

    expect(connected).toBe(true);
    expect(getInvokedFetchAttempts).toHaveBeenCalled();
  });

  it('should try to update the agent if the version given is a more recent one and not ventura', async () => {
    await connectToAgent();
    const connected = await connectToAgent('99.99.99');

    expect(connected).toBe(true);
    expect(getInvokedFetchAttempts).toHaveBeenCalled();
    expect(httpPostRaw).toBeCalledWith('http://127.0.0.1:8991', '/update');
  });

  it('should not try to update the agent if the version given is a more recent one but is ventura', async () => {
    vi.mocked(getInvokedFetchAttempts).mockReturnValue([
      // @ts-ignore
      buildWretchObj(
        async () => {
          return {
            ...MOCK_AGENT_INFO,
            version: '1.2.7-ventura',
          };
        },
        async () => {
          return MOCK_AGENT_RESPONSE;
        },
      ),
    ]);

    const connected = await connectToAgent('99.99.99');

    expect(connected).toBe(true);
    expect(getInvokedFetchAttempts).toHaveBeenCalled();
    expect(httpPostRaw).not.toBeCalledWith('http://127.0.0.1:8991', '/update');
  });

  it('should not try to update the agent if the version given is a more recent one but is dev', async () => {
    vi.mocked(getInvokedFetchAttempts).mockReturnValue([
      // @ts-ignore
      buildWretchObj(
        async () => {
          return {
            ...MOCK_AGENT_INFO,
            version: 'x.x.x-dev',
          };
        },
        async () => {
          return MOCK_AGENT_RESPONSE;
        },
      ),
    ]);

    const connected = await connectToAgent('99.99.99');

    expect(connected).toBe(true);
    expect(getInvokedFetchAttempts).toHaveBeenCalled();
    expect(httpPostRaw).not.toBeCalledWith('http://127.0.0.1:8991', '/update');
  });

  it('should not try to update the agent if the version given is a more recent one but is release candidate', async () => {
    vi.mocked(getInvokedFetchAttempts).mockReturnValue([
      // @ts-ignore
      buildWretchObj(
        async () => {
          return {
            ...MOCK_AGENT_INFO,
            version: '1.2.7-rc',
          };
        },
        async () => {
          return MOCK_AGENT_RESPONSE;
        },
      ),
    ]);

    const connected = await connectToAgent('99.99.99');

    expect(connected).toBe(true);
    expect(getInvokedFetchAttempts).toHaveBeenCalled();
    expect(httpPostRaw).not.toBeCalledWith('http://127.0.0.1:8991', '/update');
  });

  it('should set the protocol to be used based on the information returned by the agent', async () => {
    await connectToAgent();

    expect(daemonState[AgentDaemonStateKeys.Config].protocolToUse).toBe(
      DaemonProtocols.HTTP,
    );
  });

  it('should set agent info to daemon state', async () => {
    expect(daemonState[AgentDaemonStateKeys.AgentInfo]).toBeFalsy();

    await connectToAgent();

    expect(daemonState[AgentDaemonStateKeys.AgentInfo]).toEqual(
      mapAgentInfoResponse({
        ...MOCK_AGENT_INFO,
        url: MOCK_AGENT_RESPONSE.url,
        status: MOCK_AGENT_RESPONSE.status,
      }),
    );
  });

  it('should check for v2 support', async () => {
    await connectToAgent();

    expect(V2IsSupported).toHaveBeenCalled();
  });

  it('should start web socket connection with the agent', async () => {
    await connectToAgent();

    expect(connectToAgentWebSocket).toHaveBeenCalledWith('ws://127.0.0.1:8991');
  });
});

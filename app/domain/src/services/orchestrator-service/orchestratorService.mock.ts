import {
  AIModel,
  AIModelItem,
  AppConfig,
  AppDetailedInfo,
  AppInfo,
  AppPort,
  BrickCreateUpdateRequest,
  BrickDetails,
  BrickInstance,
  BrickListItem,
  CloneAppRequest,
  CreateAppRequest,
  EventSourceHandlers,
  LibraryListResponse,
  ListAppParams,
  ListLibrariesParams,
  SystemPropertyValue,
  UpdateAppDetailRequest,
  UpdateCheckResult,
  WebSocketHandlers,
} from '@cloud-editor-mono/infrastructure';
import {
  ImportResourceResult,
  TreeNode,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { OrchestratorService } from './orchestrator-service.type';

const getLatestVersionForLib = (libId: string): string | undefined => {
  const lib = mockLibraries.find((l) => l.id === libId);
  const latestRelease = lib?.releases?.[0]?.version;
  return latestRelease || lib?.version;
};

const getBrickMeta = (brickId: string): BrickListItem | undefined =>
  mockBricks.find((b) => b.id === brickId);
const getBrickDetailsMeta = (brickId: string): BrickDetails | undefined =>
  mockBrickDetailsById[brickId];

export const mockApps: AppInfo[] = [
  {
    id: '1',
    status: 'stopped',
    icon: '🌎',
    name: 'My App',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    example: false,
    default: true,
  },
  {
    id: '2',
    status: 'stopped',
    icon: '🥐',
    name: '[COPY] - My App',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    example: false,
  },
  {
    id: '3',
    status: 'stopped',
    icon: '🌹',
    name: 'Merry go round',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    example: false,
  },
  {
    id: '4',
    status: 'stopped',
    icon: '♻️',
    name: 'Ideas',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    example: false,
  },
  {
    id: '5',
    status: 'stopped',
    icon: '♻️',
    name: '[COPY] - Ideas',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    example: false,
  },
  {
    id: '6',
    status: 'stopped',
    icon: '📚',
    name: 'Smells like a fish',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    example: false,
  },
  {
    id: '7',
    status: 'stopped',
    icon: '📭',
    name: 'Wind speed',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    example: false,
  },
  {
    id: '8',
    status: 'stopped',
    icon: '🇦🇷',
    name: 'Geolocation',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    example: true,
  },
];

const mockFileTree: TreeNode = {
  name: 'myapp',
  path: '/myapp',
  type: 'folder',
  createdAt: '2023-01-01T10:00:00Z',
  modifiedAt: '2024-05-01T12:00:00Z',
  children: [
    {
      name: 'README.md',
      path: '/myapp/README.md',
      type: 'file',
      extension: '.md',
      mimeType: 'text/markdown',
      size: 2048,
      createdAt: '2023-01-02T09:00:00Z',
      modifiedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      name: 'python',
      path: '/myapp/python',
      type: 'folder',
      createdAt: '2023-02-01T11:00:00Z',
      modifiedAt: '2024-03-15T14:00:00Z',
      children: [
        {
          name: 'main.py',
          path: '/myapp/python/main.py',
          type: 'file',
          extension: '.py',
          mimeType: 'text/x-python',
          size: 1024,
          createdAt: '2023-02-02T10:00:00Z',
          modifiedAt: '2024-03-10T16:00:00Z',
        },
        {
          name: 'requirements.txt',
          path: '/myapp/python/requirements.txt',
          type: 'file',
          extension: '.txt',
          mimeType: 'text/plain',
          size: 512,
          createdAt: '2023-02-03T12:00:00Z',
          modifiedAt: '2024-03-12T09:00:00Z',
        },
      ],
    },
    {
      name: 'sketch',
      path: '/myapp/sketch',
      type: 'folder',
      createdAt: '2023-03-01T08:00:00Z',
      modifiedAt: new Date().toISOString(),
      children: [
        {
          name: 'sketch.ino',
          path: '/myapp/sketch/sketch.ino',
          type: 'file',
          extension: '.ino',
          mimeType: 'text/ino',
          size: 3072,
          createdAt: '2023-03-02T07:00:00Z',
          modifiedAt: new Date().toISOString(),
        },
        {
          name: 'utils.h',
          path: '/myapp/sketch/utils.h',
          type: 'file',
          extension: '.h',
          mimeType: 'text/x-chdr',
          size: 768,
          createdAt: '2023-03-03T10:00:00Z',
          modifiedAt: '2024-05-08T11:00:00Z',
        },
      ],
    },
    {
      name: 'data',
      path: '/myapp/data',
      type: 'folder',
      createdAt: '2023-04-01T09:00:00Z',
      modifiedAt: '2024-04-20T10:00:00Z',
      children: [
        {
          name: 'image.png',
          path: '/myapp/data/image.png',
          type: 'file',
          extension: '.png',
          mimeType: 'image/png',
          size: 4096,
          createdAt: '2023-04-02T08:00:00Z',
          modifiedAt: '2025-04-18T13:00:00Z',
        },
        {
          name: 'data.json',
          path: '/myapp/data/data.json',
          type: 'file',
          extension: '.json',
          mimeType: 'application/json',
          size: 1536,
          createdAt: '2023-04-03T11:00:00Z',
          modifiedAt: '2025-04-19T14:00:00Z',
        },
      ],
    },
    {
      name: 'app.yaml',
      path: '/myapp/app.yaml',
      type: 'file',
      extension: '.yaml',
      mimeType: 'text/yaml',
      size: 256,
      createdAt: '2023-01-05T13:00:00Z',
      modifiedAt: '2024-05-01T12:30:00Z',
    },
  ],
};
const mockAppBricksByAppId: Record<string, Record<string, BrickInstance>> = {};

const mockLibraries = [
  {
    id: 'ArduinoBLE',
    name: 'ArduinoBLE',
    author: 'Arduino',
    sentence: 'Enables BLE communication on supported boards.',
    category: 'Communication',
    maintainer: 'Arduino',
    license: 'GPL-3.0',
    architectures: ['mbed', 'mbed_nano'],
    types: ['Arduino'],
    version: '1.3.0',
    code: '',
    examples_number: 5,
    href: 'https://www.arduino.cc/en/Reference/ArduinoBLE',
    url: 'https://github.com/arduino-libraries/ArduinoBLE',
    download_url:
      'https://downloads.arduino.cc/libraries/github.com/arduino-libraries/ArduinoBLE-1.3.0.zip',
    website: 'https://www.arduino.cc/en/Reference/ArduinoBLE',
    releases: [
      { id: 'ArduinoBLE@1.3.0', version: '1.3.0' },
      { id: 'ArduinoBLE@1.2.0', version: '1.2.0' },
    ],
  },
  {
    id: 'WiFiNINA',
    name: 'WiFiNINA',
    author: 'Arduino',
    sentence: 'WiFi library for boards with the NINA module.',
    category: 'Communication',
    maintainer: 'Arduino',
    license: 'GPL-3.0',
    architectures: ['*'],
    types: ['Arduino'],
    version: '1.8.14',
    code: '',
    examples_number: 12,
    href: 'https://www.arduino.cc/en/Reference/WiFiNINA',
    url: 'https://github.com/arduino-libraries/WiFiNINA',
    download_url:
      'https://downloads.arduino.cc/libraries/github.com/arduino-libraries/WiFiNINA-1.8.14.zip',
    website: 'https://www.arduino.cc/en/Reference/WiFiNINA',
    releases: [{ id: 'WiFiNINA@1.8.14', version: '1.8.14' }],
  },
  {
    id: 'Arduino_LSM6DS3',
    name: 'Arduino LSM6DS3',
    author: 'Arduino',
    sentence: 'Read IMU data from LSM6DS3.',
    category: 'Sensors',
    maintainer: 'Arduino',
    license: 'GPL-3.0',
    architectures: ['*'],
    types: ['Arduino'],
    version: '1.1.0',
    code: '',
    examples_number: 3,
    href: 'https://www.arduino.cc/en/Reference/Arduino_LSM6DS3',
    url: 'https://github.com/arduino-libraries/Arduino_LSM6DS3',
    download_url:
      'https://downloads.arduino.cc/libraries/github.com/arduino-libraries/Arduino_LSM6DS3-1.1.0.zip',
    website: 'https://www.arduino.cc/en/Reference/Arduino_LSM6DS3',
    releases: [
      { id: 'Arduino_LSM6DS3@1.1.0', version: '1.1.0' },
      { id: 'Arduino_LSM6DS3@1.0.0', version: '1.0.0' },
    ],
  },
];

const mockAppLibrariesByAppId: Record<string, string[]> = {
  '1': ['ArduinoBLE@1.3.0'],
  '4': ['WiFiNINA@1.8.14', 'Arduino_LSM6DS3@1.1.0'],
};

export const mockBricks: BrickListItem[] = [
  {
    id: 'img-classification',
    name: 'Image classification',
    description: 'Classifies images into predefined categories.',
    author: 'Arduino',
    category: 'Image & Video',
    status: 'stable',
  },
  {
    id: 'object-detection',
    name: 'Object detection',
    description: 'Detects objects within an image.',
    author: 'Arduino',
    category: 'Image & Video',
    status: 'beta',
  },
  {
    id: 'text-generation',
    name: 'Text generation',
    description: 'Generates text from a prompt.',
    author: 'Arduino',
    category: 'Text',
    status: 'experimental',
  },
];

const mockBrickDetailsById: Record<string, BrickDetails> = {
  'img-classification': {
    id: 'img-classification',
    name: 'Image classification',
    description: 'Classifies images into predefined categories.',
    category: 'Image & Video',
    status: 'stable',
    author: 'Arduino',
    readme: `# Image classification

This brick performs image classification using pre-trained models.

- Input: RGB image
- Output: label + confidence score
`,
    api_docs_path: '/myapp/python/main.py',
    code_examples: [{ path: '/myapp/python/main.py' }],
    used_by_apps: [
      { id: '1', name: 'My App', icon: '🌎' },
      { id: '2', name: '[COPY] - My App', icon: '🥐' },
    ],
    variables: {
      threshold: {
        default_value: '0.5',
        description: 'Minimum confidence threshold to accept a class.',
        required: true,
      },
      top_k: {
        default_value: '3',
        description: 'Maximum number of classes to return.',
        required: false,
      },
    },
  },
  'object-detection': {
    id: 'object-detection',
    name: 'Object detection',
    description: 'Detects objects within an image.',
    category: 'Image & Video',
    status: 'beta',
    author: 'Arduino',
    readme: `# Object detection

Brick for object detection on images.`,
    api_docs_path: '/myapp/python/main.py',
    code_examples: [{ path: '/myapp/python/main.py' }],
    used_by_apps: [{ id: '3', name: 'Merry go round', icon: '🌹' }],
    variables: {
      score_threshold: {
        default_value: '0.4',
        description: 'Score threshold to consider a bounding box valid.',
        required: true,
      },
      nms_iou_threshold: {
        default_value: '0.5',
        description: 'IoU for Non-Max Suppression.',
        required: false,
      },
    },
  },
  'text-generation': {
    id: 'text-generation',
    name: 'Text generation',
    description: 'Generates text from a prompt.',
    category: 'Text',
    status: 'experimental',
    author: 'Arduino',
    readme: `# Text generation

Generates natural language text based on a prompt.`,
    api_docs_path: '/myapp/python/main.py',
    code_examples: [{ path: '/myapp/python/main.py' }],
    used_by_apps: [{ id: '4', name: 'Ideas', icon: '♻️' }],
    variables: {
      temperature: {
        default_value: '0.7',
        description: 'Controls the randomness of the generated text.',
        required: false,
      },
      max_tokens: {
        default_value: '128',
        description: 'Maximum output length.',
        required: false,
      },
    },
  },
};

export const mockGetBrickDetails = async (
  id: string,
): Promise<BrickDetails> => {
  const details = mockBrickDetailsById[id];

  if (details) return details;

  return {
    id,
    name: `Mock brick ${id}`,
    description: 'Mock details not defined for this brick.',
    status: 'experimental',
    category: 'Misc',
    readme: `# ${id}

Mock brick detail.`,
    used_by_apps: [],
    variables: {},
  } as BrickDetails;
};

const getMockFileContent = (path: string): string => {
  if (path.endsWith('README.md')) {
    return `# README mock

This is the mock README for the app.`;
  }
  if (path.endsWith('main.py')) {
    return `def main():
    print("hello from mock brick")

if __name__ == "__main__":
    main()`;
  }
  if (path.endsWith('requirements.txt')) {
    return `# requirements mock
numpy
opencv-python`;
  }
  return '# mock file\n';
};

const mockedEIModels: AIModel[] = [
  {
    id: '1',
    name: 'My custom object detection',
    description: 'My custom made edge impulse model',
  },
  {
    id: '2',
    name: 'My custom image classification',
    description: 'My custom made edge impulse model',
  },
];

const mockedInstalledModel: AIModelItem = {
  brick_ids: ['arduino:object-detection'],
  name: 'My custom object detection',
  description: 'My custom made edge impulse model',
  size: 50000,
  id: '1',
  is_builtin: false,
  metadata: {
    'ei-project-id': '1',
    'ei-impulse-id': '2',
  },
  runner: '',
};

export const MockOrchestratorService: OrchestratorService = {
  async getApps(_params: ListAppParams): Promise<AppInfo[]> {
    return mockApps;
  },

  async getAppStatus(
    handlers: EventSourceHandlers,
    abortController?: AbortController,
  ): Promise<void> {
    //  fakestream
    handlers?.onopen?.(new Response('', { status: 200 }) as Response);
    const events = mockApps.map((app) => ({
      id: app.id,
      status: app.status,
    }));

    handlers?.onmessage?.({
      id: 'mock-message',
      data: JSON.stringify(events),
      event: 'apps-status',
    });

    handlers?.onclose?.();
    abortController?.abort();
  },

  async getAppDetail(id: string): Promise<AppDetailedInfo> {
    const app = mockApps.find((a) => a.id === id);
    return {
      id,
      name: app?.name ?? `App ${id}`,
      description: app?.description ?? 'Mock app detail',
      icon: app?.icon ?? '🧪',
      status: app?.status ?? 'stopped',
      example: app?.example ?? false,
      default: app?.default ?? false,
      path: '/myapp',
      bricks: [],
    };
  },

  async updateAppDetail(
    id: string,
    body: UpdateAppDetailRequest,
  ): Promise<string | undefined> {
    const index = mockApps.findIndex((app) => app.id === id);
    if (index === -1) {
      return undefined;
    }

    const current = mockApps[index];

    if (body.default === true) {
      mockApps.forEach((app, i) => {
        mockApps[i] = {
          ...app,
          default: app.id === id,
        };
      });
    } else if (body.default === false) {
      mockApps[index] = {
        ...current,
        default: false,
      };
    }
    mockApps[index] = {
      ...mockApps[index],
      name: body.name ?? mockApps[index].name,
      description: body.description ?? mockApps[index].description,
      icon: body.icon ?? mockApps[index].icon,
      status: mockApps[index].status,
      example: mockApps[index].example,
    };

    return id;
  },

  async createApp(body: CreateAppRequest): Promise<string | undefined> {
    const nextNumericId =
      mockApps
        .map((a) => Number(a.id))
        .filter((n) => !Number.isNaN(n))
        .reduce((max, n) => (n > max ? n : max), 0) + 1;

    const id = String(nextNumericId);

    const newApp: AppInfo = {
      id,
      name: body.name ?? `App ${id}`,
      description: body.description ?? '',
      icon: body.icon ?? '🧪',
      status: 'stopped',
      example: false,
      default: false,
    };

    mockApps.push(newApp);

    return id;
  },

  async cloneApp(
    id: string,
    body?: CloneAppRequest,
  ): Promise<string | undefined> {
    const source = mockApps.find((app) => app.id === id);
    if (!source) {
      return undefined;
    }

    const nextNumericId =
      mockApps
        .map((a) => Number(a.id))
        .filter((n) => !Number.isNaN(n))
        .reduce((max, n) => (n > max ? n : max), 0) + 1;

    const newId = String(nextNumericId);

    const clonedName = body?.name ?? `[COPY] - ${source.name}`;

    const clonedApp: AppInfo = {
      ...source,
      id: newId,
      name: clonedName,
      status: 'stopped',
      example: false,
      default: false,
    };

    mockApps.push(clonedApp);

    return newId;
  },

  async deleteApp(id: string): Promise<boolean> {
    const index = mockApps.findIndex((app) => app.id === id);
    if (index === -1) {
      return false;
    }
    mockApps.splice(index, 1);
    return true;
  },

  async getFiles(_path: string): Promise<TreeNode[]> {
    return [{ ...mockFileTree }];
  },

  async getFileContent(path: string): Promise<string> {
    return getMockFileContent(path);
  },

  async startApp(
    id: string,
    handlers: EventSourceHandlers,
    _abortController?: AbortController,
  ): Promise<void> {
    const app = mockApps.find((a) => a.id === id);
    if (!app) return;
    handlers?.onmessage?.({
      data: JSON.stringify({ id, status: 'starting' }),
      event: 'message',
      id: '',
      retry: 0,
    });

    await new Promise((r) => setTimeout(r, 200));

    app.status = 'running';
    handlers?.onmessage?.({
      data: JSON.stringify({ id, status: 'running' }),
      event: 'message',
      id: '',
      retry: 0,
    });
  },

  async stopApp(
    id: string,
    handlers: EventSourceHandlers,
    _abortController?: AbortController,
  ): Promise<void> {
    const app = mockApps.find((a) => a.id === id);
    if (!app) return;
    handlers?.onmessage?.({
      data: JSON.stringify({ id, status: 'stopping' }),
      event: 'message',
      id: '',
      retry: 0,
    });

    await new Promise((r) => setTimeout(r, 200));

    app.status = 'stopped';
    handlers?.onmessage?.({
      data: JSON.stringify({ id, status: 'stopped' }),
      event: 'message',
      id: '',
      retry: 0,
    });
  },
  async getAppLogs(
    id: string,
    handlers: EventSourceHandlers,
    abortController?: AbortController,
  ): Promise<void> {
    console.info('[MockOrchestratorService] getAppLogs called for app', id);
    handlers?.onopen?.(new Response('', { status: 200 }));

    const now = new Date().toISOString();
    const prefix = `[${now}] [app:${id}]`;

    type MockMessage = {
      stream: 'startup' | 'main';
      message: string;
    };

    const messages: MockMessage[] = [
      {
        stream: 'startup',
        message: `${prefix} Starting app…`,
      },
      {
        stream: 'startup',
        message: `${prefix} Pulling images (mock)…`,
      },
      {
        stream: 'main',
        message: `${prefix} App is now listening on http://localhost:8080`,
      },
      {
        stream: 'main',
        message: `${prefix} Mock log line 1`,
      },
      {
        stream: 'main',
        message: `${prefix} Mock log line 2`,
      },
    ];

    const sleep = (ms: number): Promise<void> =>
      new Promise((resolve) => setTimeout(resolve, ms));

    for (const msg of messages) {
      if (abortController?.signal.aborted) break;

      handlers?.onmessage?.({
        id: '',
        event: 'message',
        data: JSON.stringify(msg),
      });

      await sleep(150);
    }

    if (!abortController?.signal.aborted) {
      handlers?.onclose?.();
      abortController?.abort();
    }
  },

  async getSerialMonitorLogs(handlers: WebSocketHandlers): Promise<WebSocket> {
    console.info(
      '[MockOrchestratorService] getSerialMonitorLogs called (mock websocket)',
    );
    const ws = {
      readyState: WebSocket.OPEN,
      send(message: string) {
        handlers.onmessage?.({
          data: `Echo from mock serial: ${message}`,
        } as MessageEvent);
      },
      close() {
        handlers.onclose?.();
      },
    } as unknown as WebSocket;
    handlers.onopen?.(new Event('open'));

    handlers.onmessage?.({
      data: 'Serial monitor connected (mock). Baud rate 9600.',
    } as MessageEvent);

    return ws;
  },

  async getAppPorts(id: string): Promise<AppPort[]> {
    return [
      {
        source: id,
        serviceName: 'webview',
        port: '8000',
      },
    ];
  },

  async addAppBrick(
    appId: string,
    brickId: string,
    _params: BrickCreateUpdateRequest,
  ): Promise<boolean> {
    if (!mockAppBricksByAppId[appId]) mockAppBricksByAppId[appId] = {};

    const meta = getBrickMeta(brickId);
    const details = getBrickDetailsMeta(brickId);

    mockAppBricksByAppId[appId][brickId] = {
      id: brickId,
      name: meta?.name ?? brickId,
      category: meta?.category ?? 'Misc',
      author: meta?.author ?? 'Arduino',
      status: 'unconfigured',
      model: undefined,
      variables: {},
      config_variables: details
        ? Object.entries(details.variables ?? {}).map(([name, v]) => ({
            name,
            description: v.description,
            required: v.required ?? false,
            value: v.default_value ?? '',
          }))
        : [],
    };

    return true;
  },

  async updateAppBrick(
    appId: string,
    brickId: string,
    params: BrickCreateUpdateRequest,
  ): Promise<boolean> {
    if (!mockAppBricksByAppId[appId]) mockAppBricksByAppId[appId] = {};
    const details = getBrickDetailsMeta(brickId);

    const current =
      mockAppBricksByAppId[appId][brickId] ??
      (await this.getAppBrickInstance(appId, brickId));

    const newVars = params.variables ?? {};
    const newModel = params.model ?? current.model;

    const updatedConfigVars = details
      ? Object.entries(details.variables ?? {}).map(([name, v]) => ({
          name,
          description: v.description,
          required: v.required ?? false,
          value:
            newVars[name] ?? current.variables?.[name] ?? v.default_value ?? '',
        }))
      : current.config_variables;

    mockAppBricksByAppId[appId][brickId] = {
      ...current,
      status: 'configured',
      model: newModel,
      variables: {
        ...current.variables,
        ...newVars,
      },
      config_variables: updatedConfigVars,
    };

    return true;
  },

  async getAppBricks(appId: string): Promise<BrickInstance[]> {
    const map = mockAppBricksByAppId[appId];
    if (!map) return [];
    return Object.values(map);
  },

  async getAppBrickInstance(
    appId: string,
    brickId: string,
  ): Promise<BrickInstance> {
    const map = mockAppBricksByAppId[appId];
    const instance = map?.[brickId];

    if (instance) return instance;
    const brickMeta = mockBricks.find((b) => b.id === brickId);

    return {
      id: brickId,
      name: brickMeta?.name ?? brickId,
      category: brickMeta?.category ?? 'Misc',
      status: 'unconfigured',
      model: undefined,
      config_variables: [],
      variables: {},
      author: brickMeta?.author ?? 'Arduino',
    };
  },

  async deleteAppBrick(appId: string, brickId: string): Promise<boolean> {
    if (!mockAppBricksByAppId[appId]) return false;
    delete mockAppBricksByAppId[appId][brickId];
    return true;
  },

  async addAppCustomBrick(
    appId: string,
    body: { name: string; description?: string },
  ): Promise<{ id: string }> {
    if (!mockAppBricksByAppId[appId]) mockAppBricksByAppId[appId] = {};

    const brickId = `local-${Date.now()}`;

    mockAppBricksByAppId[appId][brickId] = {
      id: brickId,
      name: body.name,
      category: 'Custom',
      author: 'Local',
      status: 'unconfigured',
      model: undefined,
      variables: {},
      config_variables: [],
    };

    return { id: brickId };
  },

  async renameAppCustomBrick(
    appId: string,
    brickId: string,
    params: { name: string },
  ): Promise<boolean> {
    if (!mockAppBricksByAppId[appId]) return false;
    const brick = mockAppBricksByAppId[appId][brickId];
    if (!brick) return false;
    brick.name = params.name;
    return true;
  },

  async getBricks(): Promise<BrickListItem[]> {
    return mockBricks;
  },

  async getBrickDetails(id: string): Promise<BrickDetails> {
    return mockGetBrickDetails(id);
  },

  async getConfig(): Promise<AppConfig> {
    return {};
  },

  async getSystemResources(
    _handlers: EventSourceHandlers,
    _abortController?: AbortController,
  ): Promise<void> {
    return;
  },

  async checkBoardUpdate(_onlyArduino: boolean): Promise<UpdateCheckResult> {
    return {
      updates: [
        {
          name: 'arduino-platform',
          from_version: '1.0.0',
          to_version: '1.1.0',
          type: 'arduino-platform',
        },
      ],
    };
  },

  async getBoardUpdateLogs(
    _handlers: EventSourceHandlers,
    _abortController?: AbortController,
  ): Promise<void> {
    return;
  },

  async applyBoardUpdate(_onlyArduino: boolean): Promise<boolean | null> {
    return true;
  },

  async getVersion(): Promise<string> {
    return '0.0.0-mock';
  },

  async getSystemPropertyKeys(): Promise<string[]> {
    return [];
  },

  async getSystemProperty(key: string): Promise<SystemPropertyValue> {
    return { key, value: '' };
  },

  async upsertSystemProperty(
    key: string,
    value: string,
  ): Promise<SystemPropertyValue> {
    return { key, value };
  },

  async deleteSystemProperty(key: string): Promise<SystemPropertyValue> {
    return { key, value: '' };
  },

  async getSketchLibraries(
    params: ListLibrariesParams,
  ): Promise<LibraryListResponse> {
    const search = params?.query?.search?.toLowerCase().trim() ?? '';

    let filtered = mockLibraries;

    if (search) {
      filtered = mockLibraries.filter((lib) => {
        const haystack = [
          lib.name,
          lib.sentence,
          lib.category,
          lib.maintainer,
          lib.id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(search);
      });
    }

    const page = params?.query?.page ?? 1;
    const perPage = params?.query?.limit ?? filtered.length;

    const start = (page - 1) * perPage;
    const paginated = filtered.slice(start, start + perPage);

    const totalItems = filtered.length;
    const totalPages =
      perPage > 0 ? Math.max(1, Math.ceil(totalItems / perPage)) : 1;

    return {
      libraries: paginated,
      pagination: {
        page,
        per_page: perPage,
        total_pages: totalPages,
        total_items: totalItems,
      },
    };
  },

  async getAppSketchLibraries(appId: string): Promise<{ libraries: string[] }> {
    return {
      libraries: mockAppLibrariesByAppId[appId] ?? [],
    };
  },

  async addAppSketchLibrary(appId: string, libRef: string): Promise<void> {
    const [id, versionFromRef] = libRef.split('@');

    const version = versionFromRef || getLatestVersionForLib(id);
    if (!version) {
      console.warn(
        '[Mock] addAppSketchLibrary: no version resolved for',
        libRef,
      );
      return;
    }

    const normalizedRef = `${id}@${version}`;

    const arr = (mockAppLibrariesByAppId[appId] ??= []);
    if (!arr.includes(normalizedRef)) {
      arr.push(normalizedRef);
    }
  },

  async deleteAppSketchLibrary(appId: string, libRef: string): Promise<void> {
    const arr = mockAppLibrariesByAppId[appId];
    if (!arr) return;

    const [id, versionFromRef] = libRef.split('@');

    if (versionFromRef) {
      mockAppLibrariesByAppId[appId] = arr.filter((ref) => ref !== libRef);
    } else {
      mockAppLibrariesByAppId[appId] = arr.filter(
        (ref) => !ref.startsWith(`${id}@`) && ref !== id,
      );
    }
  },

  selectAppPathToImport(): Promise<string | null> {
    return Promise.resolve(null);
  },

  importAppFromPath(_filePath: string): Promise<ImportResourceResult> {
    return Promise.resolve({ id: '1', name: 'app' });
  },

  exportApp(
    _id: string,
    _appName: string,
    _includeData: boolean,
  ): Promise<boolean> {
    return Promise.resolve(true);
  },

  getAIModels() {
    return Promise.resolve(mockedEIModels);
  },

  installEIModel() {
    return Promise.resolve(mockedInstalledModel);
  },

  deleteAIModel() {
    return Promise.resolve();
  },

  uploadAIModel() {
    return Promise.resolve();
  },
};

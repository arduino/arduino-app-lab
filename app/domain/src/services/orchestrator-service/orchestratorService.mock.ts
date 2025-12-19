import { AppInfo, BrickInstance } from '@cloud-editor-mono/infrastructure';
import { TreeNode } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export const mockApps: AppInfo[] = [
  {
    id: '1',
    status: 'stopped',
    icon: '🌎',
    name: 'My App',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    example: false,
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
    status: 'running',
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

export const mockCategories: unknown[] = [
  {
    icon: '🎞️',
    text: 'Image & Video',
    color: '#15ADDF',
  },
  {
    icon: '🎵',
    text: 'Audio',
    color: '#2AC62B',
  },
  {
    icon: '📝',
    text: 'Text',
    color: '#C1AB15',
  },
  {
    icon: '🧩',
    text: 'Misc',
    color: '#E77F60',
  },
  {
    icon: '🗄️',
    text: 'Storage',
    color: '#EB477E',
  },
  {
    icon: '🎨',
    text: 'User Interface',
    color: '#BC38EB',
  },
  {
    icon: '🧠',
    text: 'AI',
    color: '#FFFFFF',
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

export const mockAppBricks: BrickInstance[] = [
  {
    id: '1',
    name: 'Image classification',
  },
  {
    id: '2',
    name: 'Object detection',
  },
];

export const mockGetFiles = (_appId: string): TreeNode[] => {
  // Not implemented yet, just return mock ones
  return [{ ...mockFileTree }];
};

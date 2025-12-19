import { Board } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

const mockBoards: Board[] = [
  {
    id: '1',
    name: 'Pippo',
    type: 'Arduino Uno Q',
    connectionType: 'USB',
    protocol: 'serial',
    serial: '',
    address: '',
  },
  {
    id: '2',
    name: 'Pluto',
    type: 'Arduino Uno Q',
    connectionType: 'Network',
    protocol: 'serial',
    serial: '',
    address: '',
  },
  {
    id: '3',
    name: 'Paperino',
    type: 'Arduino Uno Q',
    connectionType: 'USB',
    protocol: 'serial',
    serial: '',
    address: '',
  },
];

export const mockGetBoards = (): Board[] => {
  // Not implemented yet, just return an empty array
  return [...mockBoards];
};

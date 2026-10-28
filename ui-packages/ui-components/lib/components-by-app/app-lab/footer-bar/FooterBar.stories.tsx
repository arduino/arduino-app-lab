import { ArduinoLogo, UsbPort } from '@cloud-editor-mono/images/assets/icons';
import { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';

import { ActionStatus } from '../runtime-actions';
import { AppLabFooterBar, FooterBarLogic, FooterBarProps } from './';

const defaultBoardName = 'MyUnoQ';
const defaultBoardType = 'Arduino UNO Q';

// FooterBar is driven entirely by a `footerBarLogic()` hook that returns the
// whole state object. This mock provides realistic, self-contained values so the
// bar renders without any app wiring. Interactive callbacks are no-ops and the
// Linux-credentials dialog stays closed.
const makeFooterBarLogic =
  (isBoard: boolean): FooterBarLogic =>
  () => ({
    runtimeContext: {
      appsStatus: { runningApp: undefined },
      runtimeActions: {
        currentAction: null,
        currentActionStatus: ActionStatus.Idle,
        stopAction: () => undefined,
      },
    },
    notifications: [
      {
        label: 'New notification',
        tooltip: 'This is a notification tooltip.',
        icon: <ArduinoLogo />,
      },
    ],
    currentVersion: '1.0.0',
    newNotifications: 1,
    resetNewNotifications: () => undefined,
    onOpenApp: () => undefined,
    onOpenAiAssistant: () => undefined,
    aiAssistantActive: false,
    agentModeTooltip: { onDismiss: () => undefined },
    agentModeEntryShine: false,
    onOpenTerminal: async () => undefined,
    systemResources: {
      root: { label: '2.1 / 8 GB', state: 'default' },
      user: { label: '1.2 / 16 GB', state: 'default' },
      ram: { label: 'RAM 45%', state: 'default' },
      cpu: { label: 'CPU 12%', state: 'default' },
      npu: { label: 'NPU 3%', state: 'default' },
      network: { label: 'Connected', state: 'default' },
    },
    boardItem: {
      label: `${defaultBoardName} (${defaultBoardType})`,
      state: 'default',
      icon: <UsbPort />,
    },
    boardIP: '192.168.1.42',
    isBoard,
    boards: [
      {
        name: defaultBoardName,
        fqbn: 'string',
        type: defaultBoardType,
        connectionType: 'USB',
        protocol: 'string',
        serial: 'serial1',
        address: 'address1',
        id: 'string1',
      },
      {
        name: 'MyVentunoQ',
        fqbn: 'string',
        type: 'Arduino Ventuno Q',
        connectionType: 'Network',
        protocol: 'string',
        serial: 'serial2',
        address: 'address2',
        id: 'string2',
      },
    ],
    selectedBoard: undefined,
    bytesToGiB: (bytes: number) => (bytes / 1024 ** 3).toFixed(2),
    selectBoard: async () => undefined,
    autoSelectBoard: async () => undefined,
    showBoardConnPswPrompt: false,
    onConnPswCancel: () => undefined,
    onConnPswSubmit: async () => undefined,
    isConnectingToBoard: false,
    connToBoardError: undefined,
    linuxCredentialsDialog: () => ({
      open: false,
      onOpenChange: () => undefined,
      onSubmit: async () => undefined,
      onCancel: () => undefined,
      isLoading: false,
    }),
  });

// `isBoard` lives inside the footerBarLogic state (not a component prop), so it's
// exposed as an extra story arg (on top of the component's own props) with a
// boolean (toggle) control and injected into the mock via the story's `render`.
type FooterBarStoryArgs = FooterBarProps & {
  isBoard: boolean;
  defaultBoardName: string;
  defaultBoardType: string;
};

export default {
  title: 'App Lab/Footer Bar',
  component: AppLabFooterBar,
  args: {
    isBoard: true,
    defaultBoardName: 'MyUnoQ',
    defaultBoardType: 'Arduino UNO Q',
  },
  argTypes: {
    isBoard: { control: 'boolean' },
    defaultBoardName: { control: 'text' },
    defaultBoardType: { control: 'text' },
  },
} as Meta<FooterBarStoryArgs>;

type Story = StoryObj<FooterBarStoryArgs>;

export const FooterBar: Story = {
  render: ({
    isBoard,
    defaultBoardName = 'MyUnoQ',
    defaultBoardType = 'Arduino UNO Q',
  }): React.ReactElement => {
    const footerBarLogic = makeFooterBarLogic(isBoard);
    const massagedFooterBarLogic = () => ({
      ...evaluatedFooterBarLogic,
      boardItem: {
        // ...evaluatedFooterBarLogic.boardItem,
        state: evaluatedFooterBarLogic.boardItem?.state as 'default',
        icon: evaluatedFooterBarLogic.boardItem?.icon,
        label: `${defaultBoardName} (${defaultBoardType})`,
      },
      boards: [
        {
          ...evaluatedFooterBarLogic.boards[0],
          name: defaultBoardName,
          type: defaultBoardType,
        },
        ...evaluatedFooterBarLogic.boards.slice(1),
      ],
    });
    const evaluatedFooterBarLogic = footerBarLogic();

    return <AppLabFooterBar footerBarLogic={massagedFooterBarLogic} />;
  },
};

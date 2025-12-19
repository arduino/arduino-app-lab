import { AgentDaemonState } from '@cloud-editor-mono/create-agent-client-ts';
import { WebSerialState } from '@cloud-editor-mono/web-board-communication';

export { SerialMonitorStatus } from '@cloud-editor-mono/ui-components';

export interface Device {
  portName: string;
  name: string;
}

export interface SerialMonitorConfig {
  initialSelectedPort: string;
  initialSelectedDeviceName: string;
  state: AgentDaemonState | WebSerialState;
  initialDevices: Device[];
}

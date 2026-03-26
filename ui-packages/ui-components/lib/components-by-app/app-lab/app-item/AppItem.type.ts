import { AppStatus } from '@cloud-editor-mono/infrastructure';

export interface AppItemProps {
  variant?: 'default' | 'skeleton';
  name?: string;
  description?: string;
  icon?: string;
  status?: AppStatus;
  byteSize?: number;
  default?: boolean;
}

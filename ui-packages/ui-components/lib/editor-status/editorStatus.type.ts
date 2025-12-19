import { ReactNode } from 'react';

export enum EditorStatusType {
  Warning = 'warning',
  // Info = 'info',
  // Error = 'error',
  // Add more types as needed
}

export interface StatusProps {
  type: EditorStatusType;
  label?: string;
  tooltip?: string;
}

export interface EditorStatusProps {
  editorStatus?: StatusProps;
  children?: ReactNode;
  className?: string;
}

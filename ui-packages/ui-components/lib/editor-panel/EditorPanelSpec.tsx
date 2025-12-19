import { EditorStatusType, StatusProps } from '../editor-status';

export const editorsNotification: StatusProps = {
  type: EditorStatusType.Warning,
  label: 'Another user just modified this sketch.',
  tooltip:
    'Beware, simultaneous changes may be overwritten. Please wait for them to finish before editing the code.',
};

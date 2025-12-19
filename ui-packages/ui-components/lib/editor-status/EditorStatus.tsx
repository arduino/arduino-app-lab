import clsx from 'clsx';
import { ReactNode } from 'react';

import { useTooltip } from '../tooltip';
import { Text, TextSize } from '../typography';
import styles from './editor-status.module.scss';
import { EditorStatusProps } from './editorStatus.type';
import { mapIcon } from './editorStatusSpec';

const EditorStatus: React.FC<EditorStatusProps> = (
  props: EditorStatusProps,
) => {
  const { editorStatus, children, className } = props;
  // const { formatMessage } = useI18n();
  const { props: tooltipProps, renderTooltip } = useTooltip({
    // content: formatMessage(notification.message),
    content: editorStatus?.tooltip,
  });

  const renderStatus = (): ReactNode => {
    return editorStatus ? (
      <div
        className={clsx(styles['editor-notifications-container'])}
        {...tooltipProps}
      >
        <div
          className={clsx(
            styles['editor-notifications'],
            styles[`editor-notifications--${editorStatus.type}`],
          )}
        >
          {mapIcon[editorStatus.type]}
          {editorStatus?.label ? (
            <Text size={TextSize.XSmall}> {editorStatus.label} </Text>
          ) : null}
        </div>
        {editorStatus?.tooltip
          ? renderTooltip(styles['editor-notifications-tooltip'])
          : null}
      </div>
    ) : null;
  };

  return (
    <div
      className={clsx(
        className,
        styles['editor-notifications-wrapper'],
        editorStatus &&
          styles[`editor-notifications-wrapper--${editorStatus.type}`],
      )}
    >
      {children}
      {renderStatus()}
    </div>
  );
};

export default EditorStatus;

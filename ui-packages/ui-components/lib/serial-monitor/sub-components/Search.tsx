import { Search } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { forwardRef, useImperativeHandle } from 'react';

import { IconButton } from '../../essential/icon-button';
import { useI18n } from '../../i18n/useI18n';
import { useTooltip } from '../../tooltip';
import { type ShowTooltipHandle } from '../hooks/useMonitorCodeMirror';
import { messages } from '../messages';
import { SerialMonitorStatus } from '../SerialMonitor.type';
import styles from './serial-monitor-toolbar.module.scss';

interface SearchButtonProps {
  onClick: () => void;
  disabled: boolean;
  status: SerialMonitorStatus;
}

const SearchButton = forwardRef<ShowTooltipHandle, SearchButtonProps>(
  (props: SearchButtonProps, ref) => {
    const { onClick: handleClick, status } = props;

    const { formatMessage } = useI18n();
    const {
      props: tooltipProps,
      renderTooltip,
      setShowTooltip,
    } = useTooltip({ content: formatMessage(messages.searchLogDisabled) });

    useImperativeHandle(ref, () => ({
      showTooltip(value: boolean): void {
        setShowTooltip(value);
      },
    }));

    return (
      <span className={styles['search-button-wrapper']}>
        <IconButton
          onPress={handleClick}
          label={formatMessage(messages.searchLog)}
          title={formatMessage(messages.searchLog)}
          Icon={Search}
          classes={{
            button: clsx(
              styles['search-button'],
              status === SerialMonitorStatus.Active &&
                styles['search-button-inactive'],
            ),
          }}
          {...tooltipProps}
        />
        {status === SerialMonitorStatus.Active && renderTooltip()}
      </span>
    );
  },
);

SearchButton.displayName = 'SearchButton';

export default SearchButton;

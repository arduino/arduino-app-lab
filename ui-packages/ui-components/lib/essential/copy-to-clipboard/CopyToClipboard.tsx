import { Checkmark, FileCopy } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';

import { useTooltip } from '../../tooltip';
import { IconButton } from '../icon-button';
import styles from './copy-to-clipboard.module.scss';

interface CopyToClipboardProps {
  text: string;
  onClick?: (text: string) => void;
  classes?: { container?: string };
  children?: JSX.Element;
}

const CopyToClipboard = ({
  text,
  onClick,
  classes,
  children,
}: CopyToClipboardProps): JSX.Element => {
  const { props: tooltipHoverProps, renderTooltip: renderHoverTooltip } =
    useTooltip({
      content: 'Copy',
      // timeout: 0,
      triggerType: 'hover',
    });
  const {
    props: { onPress: onTriggerPress, ...tooltipClickProps },
    renderTooltip: renderClickTooltip,
    isTooltipVisible: isClickTooltipVisible,
  } = useTooltip({
    content: (
      <span className={styles['tooltip-success-content']}>
        Copied! <Checkmark />
      </span>
    ),
    timeout: 2000,
    triggerType: 'click',
  });

  const copyContent = (): Promise<void> => navigator.clipboard.writeText(text);

  return (
    <div className={clsx(styles['copy-to-clipboard'], classes?.container)}>
      <IconButton
        label="CopyToClipboard"
        Icon={FileCopy}
        classes={{ button: styles['default-trigger'] }}
        onPress={(): void => {
          onClick && onClick(text);
          copyContent();
          onTriggerPress && onTriggerPress();
        }}
        {...tooltipHoverProps}
        {...tooltipClickProps}
      >
        {children}
      </IconButton>
      {renderClickTooltip(clsx(styles['tooltip'], styles['tooltip-success']))}
      {!isClickTooltipVisible && renderHoverTooltip(styles['tooltip'])}
    </div>
  );
};

export default CopyToClipboard;

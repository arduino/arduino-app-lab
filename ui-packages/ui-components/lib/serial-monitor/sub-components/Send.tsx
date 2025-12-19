import { setCSSVariable } from '@cloud-editor-mono/common';
import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '../../essential/button';
import { useI18n } from '../../i18n/useI18n';
import { UseSelectLineEnding } from '../hooks/useSelectLineEnding';
import { messages } from '../messages';
import styles from './serial-monitor-actions.module.scss';

const LINE_ENDINGS_MAP = new Map([
  ['newLine', '\n'],
  ['carriageReturn', '\r'],
  ['bothNLandCR', '\n\r'],
  ['noLineEnding', ''],
]);

interface SendProps {
  onSend: (message: string) => void;
  scrollToBottom: () => void;
  disabled: boolean;
  selectedLineEnding: ReturnType<UseSelectLineEnding>['selectedLineEnding'];
  classes?: { wrapper?: string; input?: string; button?: string };
  placeholder?: string;
}

const Send: React.FC<SendProps> = (props: SendProps) => {
  const [sendEnabled, setSendEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const buttonRef = useRef<any>(null);
  const { formatMessage } = useI18n();

  const {
    onSend,
    scrollToBottom,
    disabled,
    selectedLineEnding,
    classes,
    placeholder,
  } = props;

  useEffect(() => {
    if (buttonRef.current) {
      setCSSVariable(
        styles.serialMonitorSendInputPaddingRight,
        `${
          (buttonRef.current as unknown as { width: number }).width +
          parseInt(styles.serialMonitorSendButtonGutter) * 2
        }px`,
      );
    }
  }, [buttonRef]);

  const handleInputChange = useCallback(
    (event: React.SyntheticEvent<HTMLInputElement>) => {
      const { value } = event.currentTarget;
      setSendEnabled(value.length > 0);
      setMessage(value);
    },
    [],
  );

  const handleSend = useCallback((): void => {
    onSend(message + (LINE_ENDINGS_MAP.get(selectedLineEnding) || ''));
    setMessage('');
    setSendEnabled(false);
    scrollToBottom();
    buttonRef.current.blur();
  }, [message, onSend, scrollToBottom, selectedLineEnding]);

  const handleInputKeyUp = useCallback(
    (event: React.SyntheticEvent<HTMLInputElement, KeyboardEvent>) => {
      if (event.nativeEvent.key === 'Enter') {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className={styles['serial-monitor-send']}>
      <div
        className={clsx(
          styles['serial-monitor-send-input-wrapper'],
          classes?.wrapper,
        )}
      >
        <input
          value={message}
          onChange={handleInputChange}
          onKeyUp={handleInputKeyUp}
          className={clsx(styles['serial-monitor-send-input'], classes?.input)}
          placeholder={placeholder}
        />
        <Button
          ref={buttonRef}
          classes={{
            button: clsx(styles['serial-monitor-send-button'], classes?.button),
          }}
          disabled={!sendEnabled || disabled}
          onClick={handleSend}
        >
          {formatMessage(messages.send)}
        </Button>
      </div>
    </div>
  );
};

export default Send;

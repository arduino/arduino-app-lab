import { Reload } from '@cloud-editor-mono/images/assets/icons';
import { Error, Success } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import {
  forwardRef,
  Key,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { IconButton } from '../../../../essential/icon-button';
import { Input, InputStyle } from '../../../../essential/input';
import { useI18n, XXSmall } from '../../../shared';
import { Select } from '../../essential/select';
import { boardConfigurationMessages } from '../messages';
import setupStyles from '../setup.module.scss';
import { UseBoardConfigurationLogic } from '../setup.type';
import styles from './board-configuration.module.scss';

interface BoardConfigurationProps {
  logic: ReturnType<UseBoardConfigurationLogic>;
  unlockAutoFlow?: () => void;
}

const BoardConfiguration = forwardRef((props: BoardConfigurationProps, ref) => {
  const { logic, unlockAutoFlow } = props;
  const boardNameInputRef = useRef<HTMLInputElement>(null);
  const {
    checkBoardName,
    proposeName,
    setBoardConfiguration,
    skipBoardConfiguration,
    keyboardLayout,
    keyboardLayouts,
    setBoardConfigurationIsLoading,
    setBoardNameIsError,
    setKeyboardLayoutIsError,
    setBoardConfigurationIsSuccess,
    boardName,
    boardNameErrorMsg,
    keyboardLayoutErrorMsg,
  } = logic;

  const [inputBoardName, setInputBoardName] = useState(
    checkBoardName(boardName) ? boardName! : '',
  );
  const [inputKeyboardLayout, setInputKeyboardLayout] = useState(
    keyboardLayout ?? '',
  );

  useEffect(() => {
    setInputKeyboardLayout(keyboardLayout ?? '');
  }, [keyboardLayout]);

  const confirm = useCallback((): void => {
    setBoardConfiguration(inputBoardName, inputKeyboardLayout);
  }, [inputBoardName, inputKeyboardLayout, setBoardConfiguration]);

  useImperativeHandle(ref, () => ({
    confirm,
    skip: (): void => skipBoardConfiguration(),
    canSkip: (): boolean => !setBoardNameIsError,
  }));

  const { formatMessage } = useI18n();

  const handleClick = (): void => {
    const newName = proposeName();
    setInputBoardName(newName);
  };

  const handleChange = (value: string): void => {
    const noSpaces = value.replace(/\s+/g, '');
    setInputBoardName(noSpaces);
  };

  const handleKeyboardLayoutEnter = useCallback((): void => {
    boardNameInputRef.current?.focus();
  }, []);

  const handleBoardNameEnter = useCallback((): void => {
    if (
      inputBoardName &&
      inputKeyboardLayout &&
      !setBoardNameIsError &&
      !setKeyboardLayoutIsError
    ) {
      unlockAutoFlow?.();
      confirm();
    }
  }, [
    confirm,
    inputBoardName,
    inputKeyboardLayout,
    setBoardNameIsError,
    setKeyboardLayoutIsError,
    unlockAutoFlow,
  ]);

  return (
    <form
      className={styles['container']}
      onSubmit={(e): void => e.preventDefault()}
    >
      <div className={setupStyles['input-container']}>
        <Select
          id="keyboard-layout"
          name="keyboard-layout"
          value={
            keyboardLayouts.find((it) => it.id === inputKeyboardLayout)
              ?.label ?? ''
          }
          label={formatMessage(boardConfigurationMessages.keyboardLabel)}
          disabled={setBoardConfigurationIsLoading}
          sections={[
            {
              name: 'Keyboard Layout',
              items: keyboardLayouts,
            },
          ]}
          onChange={(key: Key): void => setInputKeyboardLayout(key as string)}
          onEnter={handleKeyboardLayoutEnter}
        />
        {setKeyboardLayoutIsError && (
          <XXSmall
            bold
            className={clsx(setupStyles['message'], setupStyles['error'])}
          >
            <Error />
            {keyboardLayoutErrorMsg ||
              formatMessage(boardConfigurationMessages.boardConfigurationError)}
          </XXSmall>
        )}
      </div>
      <div className={setupStyles['input-container']}>
        <Input
          inputStyle={InputStyle.AppLab}
          id="board-name"
          ref={boardNameInputRef}
          value={inputBoardName}
          onChange={handleChange}
          onEnter={handleBoardNameEnter}
          disabled={setBoardConfigurationIsLoading}
          label={formatMessage(boardConfigurationMessages.nameLabel)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          classes={{
            input: styles['board-name'],
            inputContainer: styles['board-name-container'],
            inputLabel: styles['board-name-label'],
            focused: styles['focused'],
          }}
        >
          <IconButton
            type="button"
            classes={{ button: styles['reload-button'] }}
            onPress={handleClick}
            Icon={Reload}
            label={'reload-button'}
          />
        </Input>
        {setBoardNameIsError && (
          <XXSmall
            bold
            className={clsx(setupStyles['message'], setupStyles['error'])}
          >
            <Error />
            {boardNameErrorMsg ||
              formatMessage(boardConfigurationMessages.boardConfigurationError)}
          </XXSmall>
        )}
        {setBoardConfigurationIsSuccess && (
          <XXSmall bold className={setupStyles['message']}>
            <Success />
            {formatMessage(
              boardConfigurationMessages.boardConfigurationSuccess,
            )}
          </XXSmall>
        )}
      </div>
    </form>
  );
});

BoardConfiguration.displayName = 'BoardConfiguration';

export default BoardConfiguration;

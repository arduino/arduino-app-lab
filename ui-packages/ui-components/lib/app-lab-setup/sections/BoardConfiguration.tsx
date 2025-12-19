import { CaretDown, Reload } from '@cloud-editor-mono/images/assets/icons';
import { Error, Success } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import {
  forwardRef,
  Key,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';

import { UseBoardConfigurationLogic } from '../../app-lab-settings';
import DropdownMenuButton from '../../essential/dropdown-menu/DropdownMenuButton';
import { IconButton } from '../../essential/icon-button';
import { Input } from '../../essential/input';
import { InputStyle } from '../../essential/input/input.type';
import { useI18n } from '../../i18n/useI18n';
import { XXSmall } from '../../typography';
import { boardConfigurationMessages } from '../messages';
import setupStyles from '../setup.module.scss';
import styles from './board-configuration.module.scss';

interface BoardConfigurationProps {
  logic: ReturnType<UseBoardConfigurationLogic>;
}

const BoardConfiguration = forwardRef((props: BoardConfigurationProps, ref) => {
  const { logic } = props;
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

  useImperativeHandle(ref, () => ({
    confirm: (): void =>
      setBoardConfiguration(inputBoardName, inputKeyboardLayout),
    skip: (): void => skipBoardConfiguration(),
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

  return (
    <div className={styles['container']}>
      <div className={setupStyles['input-container']}>
        <div className={clsx(styles['keyboard-layout'])}>
          <Input
            inputStyle={InputStyle.AppLab}
            id="network-security"
            type="text"
            readOnly
            name={formatMessage(boardConfigurationMessages.keyboardLabel)}
            value={
              keyboardLayouts.find((it) => it.id === inputKeyboardLayout)
                ?.label ?? ''
            }
            disabled={setBoardConfigurationIsLoading}
            onChange={(key: Key): void => setInputKeyboardLayout(key as string)}
            label={formatMessage(boardConfigurationMessages.keyboardLabel)}
            classes={{
              input: styles['input'],
            }}
          />
          {!setBoardConfigurationIsLoading ? (
            <DropdownMenuButton
              sections={[
                {
                  name: 'Keyboard Layout',
                  items: keyboardLayouts,
                },
              ]}
              classes={{
                dropdownMenuButtonWrapper:
                  styles['dropdown-menu-button-wrapper'],
                dropdownMenu: styles['dropdown-menu'],
              }}
              onAction={(key: Key): void =>
                setInputKeyboardLayout(key as string)
              }
              buttonChildren={<CaretDown />}
            />
          ) : null}
        </div>
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
          value={inputBoardName}
          onChange={handleChange}
          disabled={setBoardConfigurationIsLoading}
          label={formatMessage(boardConfigurationMessages.nameLabel)}
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
    </div>
  );
});

BoardConfiguration.displayName = 'BoardConfiguration';

export default BoardConfiguration;

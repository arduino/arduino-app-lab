import {
  Bin,
  CaretDown,
  Duplicate,
  Pencil,
  Spinner,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { AppLabEmojiPicker } from '../app-lab-emoji-picker';
import { CreateAppDialog, DeleteAppDialog } from '../dialogs';
import { DropdownMenuButton } from '../essential/dropdown-menu/DropdownMenuButton';
import { Input } from '../essential/input';
import { InputStyle } from '../essential/input/input.type';
import { useI18n } from '../i18n/useI18n';
import { XSmall, XXSmall } from '../typography';
import styles from './app-title.module.scss';
import { AppAction, AppTitleLogic } from './AppTitle.type';
import { appTitleMessages } from './messages';

interface AppTitleProps {
  appTitleLogic: AppTitleLogic;
  showBadge?: boolean;
  useStaticPosition?: boolean;
  loader?: boolean;
  type?: 'default' | 'footer';
  disabled?: boolean;
}

const AppTitle: React.FC<AppTitleProps> = (props: AppTitleProps) => {
  const {
    appTitleLogic,
    showBadge = true,
    useStaticPosition,
    loader,
    type,
    disabled,
  } = props;
  const inputRef = useRef<HTMLDivElement>(null);
  const [inputWidth, setInputWidth] = useState(0);
  const nameRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const {
    app,
    deleteAppDialogLogic,
    createAppDialogLogic,
    name,
    editing,
    hasError,
    onAppNameChange,
    onAppAction,
    onResetAppName,
    onRenameApp,
    onUpdateAppIcon,
  } = appTitleLogic();
  const { formatMessage } = useI18n();

  const measureWidth = (): void => {
    const width = nameRef.current?.getBoundingClientRect().width ?? 0;
    setInputWidth(Math.min(Math.ceil(width) + 4, 300));
  };

  useLayoutEffect(() => {
    measureWidth();

    const raf = requestAnimationFrame(() => measureWidth());
    return () => cancelAnimationFrame(raf);
  }, [name]);

  useEffect(() => {
    const el = nameRef.current;
    if (!el) return;

    let ro: ResizeObserver | undefined;
    try {
      ro = new ResizeObserver(() => measureWidth());
      ro.observe(el);
    } catch (e) {
      ro = undefined;
    }

    return () => {
      if (ro && el) ro.unobserve(el);
    };
  }, []);

  return (
    <div
      className={clsx(styles['app-title'], {
        [styles['active']]: editing || open,
        [styles['example']]: app?.example,
        [styles['default']]: type === 'default',
        [styles['footer']]: type === 'footer',
        [styles['disabled']]: !!disabled,
      })}
    >
      <DeleteAppDialog logic={deleteAppDialogLogic} />
      <CreateAppDialog logic={createAppDialogLogic} />
      <div className={styles['app-icon']}>
        {app?.example ? (
          app.icon
        ) : (
          <AppLabEmojiPicker
            value={app?.icon}
            onChange={onUpdateAppIcon}
            onOpen={setOpen}
          />
        )}
      </div>
      <div className={styles['app-name']}>
        <div
          className={clsx(styles['app-name-text-container'], {
            [styles['hidden']]: editing,
          })}
          {...(!app?.example && {
            onClick: (): void => onAppAction(AppAction.Rename),
            onKeyUp: (): void => onAppAction(AppAction.Rename),
          })}
        >
          <XSmall ref={nameRef} className={styles['app-name-text']}>
            {name}
          </XSmall>
        </div>
        {editing && (
          <Input
            ref={inputRef}
            inputStyle={InputStyle.AppLab}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            type="text"
            value={name}
            blurOnEnter={false}
            error={
              hasError
                ? new Error(formatMessage(appTitleMessages.appNameInUse))
                : undefined
            }
            onChange={onAppNameChange}
            onBlur={onResetAppName}
            onEnter={onRenameApp}
            onKeyDown={(e): void => {
              if (e.key === 'Escape') {
                onResetAppName();
              }
            }}
            classes={{
              input: styles['app-name-input'],
              inputError: styles['error-message'],
              error: styles['app-name-input-error'],
            }}
            style={{
              width: inputWidth,
            }}
            styles={{
              inputError: {
                left: inputRef.current?.getBoundingClientRect().left,
              },
            }}
          />
        )}
      </div>
      {(!app?.example || type === 'footer') && (
        <DropdownMenuButton
          disabled={disabled}
          sections={[
            {
              name: 'Actions',
              items: [
                ...(!app?.example
                  ? [
                      {
                        id: AppAction.Rename,
                        label: formatMessage(appTitleMessages.actionRename),
                        labelPrefix: <Pencil />,
                      },
                    ]
                  : []),
                {
                  id: AppAction.Duplicate,
                  label: formatMessage(appTitleMessages.actionDuplicate),
                  labelPrefix: <Duplicate />,
                },
                ...(!app?.example
                  ? [
                      {
                        id: AppAction.Delete,
                        itemClassName: styles['danger'],
                        label: formatMessage(appTitleMessages.actionDelete),
                        labelPrefix: <Bin />,
                      },
                    ]
                  : []),
              ],
            },
          ]}
          classes={{
            dropdownMenu: styles['dropdown-menu'],
            dropdownMenuButton: clsx(styles['dropdown-menu-button'], {
              [styles['loading']]: loader,
            }),
            dropdownMenuButtonOpen: styles['dropdown-menu-button-open'],
            dropdownMenuButtonWrapper: clsx(styles['app-actions'], {
              //TODO: Remove this once the dropdown menu is set in the footer
              [styles['dropdown-menu-button-footer']]:
                type === 'footer' && !loader,
            }),
            dropdownMenuItem: styles['dropdown-menu-item'],
          }}
          onAction={(key): void => onAppAction(key as AppAction)}
          onOpen={setOpen}
          buttonChildren={loader ? <Spinner /> : <CaretDown />}
          useStaticPosition={useStaticPosition}
        />
      )}
      {app?.default && showBadge && (
        <div className={styles['default-badge']}>
          <XXSmall>{formatMessage(appTitleMessages.appDefault)}</XXSmall>
        </div>
      )}
    </div>
  );
};

export default AppTitle;

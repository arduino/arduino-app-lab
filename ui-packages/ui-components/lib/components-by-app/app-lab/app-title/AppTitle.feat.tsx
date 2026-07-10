import {
  Bin,
  CaretDown,
  Download,
  Duplicate,
  Pencil,
  Power,
} from '@cloud-editor-mono/images/assets/icons';
import { canRenameApp } from '@cloud-editor-mono/infrastructure';
import clsx from 'clsx';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import {
  CreateAppDialog,
  DeleteAppDialog,
  ExportAppDialog,
} from '../../../dialogs';
import { DropdownMenuButton } from '../../../essential/dropdown-menu/DropdownMenuButton';
import { Input, InputStyle } from '../../../essential/input';
import { useI18n } from '../../../i18n/useI18n';
import { XSmall, XXSmall, XXXSmall } from '../../../typography';
import { EmojiPicker } from '../emoji-picker';
import { Badge, BadgeStyle, BadgeVariant } from '../essential/badge';
import { Toggle } from '../essential/toggle';
import { useTooltip } from '../essential/tooltip';
import styles from './app-title.module.scss';
import { AppAction, AppTitleLogic } from './AppTitle.type';
import { appTitleMessages } from './messages';

interface AppTitleProps {
  appTitleLogic: AppTitleLogic;
}

const AppTitle: React.FC<AppTitleProps> = (props: AppTitleProps) => {
  const { appTitleLogic } = props;

  const inputRef = useRef<HTMLDivElement>(null);
  const [inputWidth, setInputWidth] = useState(0);
  const nameRef = useRef<HTMLDivElement>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const {
    app,
    appStatus,
    deleteAppDialogLogic,
    exportAppDialogLogic,
    createAppDialogLogic,
    name,
    editing,
    hasError,
    defaultApp,
    openApp,
    setAsDefaultApp,
    onAppNameChange,
    onAppAction,
    onResetAppName,
    onRenameApp,
    onUpdateAppIcon,
  } = appTitleLogic();
  const { formatMessage } = useI18n();

  const canRenameAppTitle = canRenameApp(app, appStatus);

  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: name,
    direction: 'down',
    timeout: 0,
    tooltipType: 'title',
  });

  const measureWidth = useCallback((): void => {
    const width = nameRef.current?.getBoundingClientRect().width ?? 0;
    setInputWidth(
      Math.min(Math.ceil(width) + 4, window.innerWidth < 1024 ? 100 : 200),
    );
  }, []);

  useLayoutEffect(() => {
    measureWidth();

    const raf = requestAnimationFrame(() => measureWidth());
    return () => cancelAnimationFrame(raf);
  }, [measureWidth, name]);

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
      if (ro && el) {
        ro.unobserve(el);
        ro.disconnect();
        ro = undefined;
      }
    };
  }, [measureWidth]);

  return (
    <div
      className={clsx(styles['app-title'], {
        [styles['active']]: editing || emojiOpen || actionsOpen,
        [styles['example']]: app?.example,
      })}
    >
      <DeleteAppDialog logic={deleteAppDialogLogic} />
      <ExportAppDialog logic={exportAppDialogLogic} />
      <CreateAppDialog logic={createAppDialogLogic} />
      <div className={styles['app-icon']}>
        {app?.example ? (
          app?.icon
        ) : (
          <EmojiPicker
            value={app?.icon}
            onChange={onUpdateAppIcon}
            onOpen={setEmojiOpen}
            isOpen={emojiOpen}
          />
        )}
      </div>
      <div className={styles['app-name']}>
        <div
          className={clsx(styles['app-name-text-container'], {
            [styles['hidden']]: editing,
          })}
          {...(canRenameAppTitle && {
            onClick: (): void => onAppAction(AppAction.Rename),
            onKeyUp: (): void => onAppAction(AppAction.Rename),
          })}
        >
          <div {...tooltipProps}>
            <XSmall ref={nameRef} className={styles['app-name-text']}>
              {name}
            </XSmall>
            {renderTooltip(styles['tooltip-content'])}
          </div>
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
      {!app?.example && (
        <DropdownMenuButton
          sections={[
            {
              name: 'Actions',
              items: [
                ...(canRenameAppTitle
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
                {
                  id: AppAction.Export,
                  label: formatMessage(appTitleMessages.actionExport),
                  labelPrefix: <Download />,
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
            {
              name: 'Default app',
              items: [
                {
                  id: 'default',
                  node: (
                    <div className={styles['default-app-menu-item']}>
                      <div className={styles['default-app-menu-item-title']}>
                        <Power />
                        <XXSmall>
                          {formatMessage(appTitleMessages.runAtStartup)}
                        </XXSmall>
                        <Toggle
                          className={styles['default-app-menu-item-toggle']}
                          isSelected={defaultApp?.id === app?.id}
                          onChange={setAsDefaultApp}
                        />
                      </div>
                      <XXXSmall
                        className={styles['default-app-menu-item-content']}
                      >
                        {defaultApp && defaultApp.id !== app?.id
                          ? formatMessage(appTitleMessages.overrideAsDefault, {
                              appName: (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  className={styles['default-app-name']}
                                  onClick={(): void => openApp?.(defaultApp)}
                                  onKeyUp={(): void => openApp?.(defaultApp)}
                                >
                                  {defaultApp.name}
                                </span>
                              ),
                              bold: (text: string) => <b>{text}</b>,
                            })
                          : formatMessage(appTitleMessages.setAsDefault, {
                              bold: (text: string) => <b>{text}</b>,
                            })}
                      </XXXSmall>
                    </div>
                  ),
                  label: formatMessage(appTitleMessages.runAtStartup),
                },
              ],
            },
          ]}
          classes={{
            dropdownMenu: styles['dropdown-menu'],
            dropdownMenuButton: styles['dropdown-menu-button'],
            dropdownMenuButtonOpen: styles['dropdown-menu-button-open'],
            dropdownMenuButtonWrapper: clsx(styles['app-actions']),
            dropdownMenuItem: styles['dropdown-menu-item'],
            dropdownMenuList: styles['dropdown-menu-list'],
          }}
          onAction={(key): void => onAppAction(key as AppAction)}
          onOpen={(isOpen): void => {
            if (emojiOpen) {
              setEmojiOpen(false);
            }
            setActionsOpen(isOpen);
          }}
          isOpen={actionsOpen}
          useStaticPosition={false}
          buttonChildren={<CaretDown />}
        />
      )}
      {app?.default && (
        <Badge
          style={BadgeStyle.Light}
          variant={BadgeVariant.Neutral}
          classes={{ container: styles['default-badge'] }}
        >
          {formatMessage(appTitleMessages.appDefault)}
        </Badge>
      )}
    </div>
  );
};

export default AppTitle;

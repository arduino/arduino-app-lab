import { Config } from '@cloud-editor-mono/common';
import {
  ChatStop,
  CloseX,
  CodeIcon,
  GenAISendArrow,
} from '@cloud-editor-mono/images/assets/icons';
import { TransmissionTag } from '@cloud-editor-mono/infrastructure';
import clsx from 'clsx';
import {
  ForwardedRef,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useFilter } from 'react-aria';

import DropdownMenuButton from '../../../../../essential/dropdown-menu/DropdownMenuButton';
import { IconButton } from '../../../../../essential/icon-button';
import useDebouncedSearch from '../../../../../essential/search-field/useDebouncedSearch';
import { useI18n } from '../../../../../i18n/useI18n';
import { Link, XXSmall, XXXSmall } from '../../../../../typography';
import { highlightText } from '../../../../../utils';
import { SidenavContext } from '../../../../context/sidenavContext';
import { GenAIContext } from '../../context/GenAIContext';
import { messages, quickActionMessages } from './messages';
import { QuickActionItemIds, QuickActionSection } from './quickActions.type';
import { quickActionSections } from './quickActionsSpec';
import styles from './send-box.module.scss';

const CHAT_PANEL_SHORTER_MSG_WIDTH = 400;
const TEXTAREA_MAX_ROWS = 4;

interface SendBoxProps {
  hintMessage: string;
  onClearHintMessage: () => void;
  chatPanelWidth: number;
  isAiBannerVisible: boolean;
}

const SendBox = forwardRef(
  (props: SendBoxProps, sendBoxRef: ForwardedRef<HTMLDivElement>) => {
    const {
      hintMessage,
      onClearHintMessage,
      chatPanelWidth,
      isAiBannerVisible,
    } = props;

    const {
      errorLines,
      genAiMessageUsageExceeded,
      linksEnabled,
      onUserInput,
      maxContentLength,
    } = useContext(GenAIContext);

    const { sendMessage, isLoading, isSending, stopGeneration } =
      useContext(SidenavContext);

    const { clearChatConfirm, isClearChatNotificationOpen } =
      useContext(SidenavContext);

    const [isSketchGeneration, setIsSketchGeneration] = useState(false);
    const [isSketchGenerationBoxVisible, setIsSketchGenerationBoxVisible] =
      useState(false);
    const [isSketchGenerationDismissed, setIsSketchGenerationDismissed] =
      useState(false);
    const [inputText, setInputText] = useState('');
    const [currentQuickAction, setCurrentQuickAction] =
      useState<QuickActionItemIds>();

    const inputRef = useRef<HTMLDivElement>(null);

    const { formatMessage } = useI18n();

    const isSketchGenerationDisabled = true;

    const { contains, startsWith } = useFilter({
      sensitivity: 'base',
    });

    const filterQuickActions = useCallback(
      (sections: QuickActionSection[], query: string): QuickActionSection[] =>
        sections.map((section) => {
          return {
            name: section.name,
            items: section.items
              .filter((action) => contains(formatMessage(action.label), query))
              .map((item) => {
                return {
                  id: item.id,
                  label: item.label,
                  node: highlightText(
                    formatMessage(item.label),
                    query,
                    startsWith,
                  ),
                };
              }),
          };
        }),
      [contains, formatMessage, startsWith],
    );

    const { setQuery, filteredItems } = useDebouncedSearch<QuickActionSection>(
      quickActionSections,
      filterQuickActions,
    );

    useEffect(() => {
      if (hintMessage) {
        setInputText(hintMessage);
      }
    }, [hintMessage]);

    const onSendMessage = useCallback(() => {
      if (!inputText && !currentQuickAction) {
        return;
      }

      if (isClearChatNotificationOpen) {
        clearChatConfirm();
      }

      const message = currentQuickAction
        ? inputText
          ? `${currentQuickAction}\nAdditional info: '${inputText}'`
          : currentQuickAction
        : inputText;

      sendMessage(
        message,
        isSketchGeneration && !isSketchGenerationDisabled
          ? TransmissionTag.PlanRequest
          : currentQuickAction === QuickActionItemIds.FixErrors
          ? TransmissionTag.ErrorFixRequest
          : undefined,
      );
      setCurrentQuickAction(undefined);
      setInputText('');
      onClearHintMessage();
    }, [
      inputText,
      currentQuickAction,
      isClearChatNotificationOpen,
      sendMessage,
      isSketchGeneration,
      isSketchGenerationDisabled,
      onClearHintMessage,
      clearChatConfirm,
    ]);

    const setTextAreaHeight = (el: HTMLTextAreaElement): void => {
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
      const maxHeight = lineHeight * TEXTAREA_MAX_ROWS;
      el.style.height = 'auto'; // reset
      el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
    };

    const renderQuickActionList = (): JSX.Element => {
      return (
        <DropdownMenuButton
          isOpened
          onAction={(key): void => {
            setCurrentQuickAction(key as QuickActionItemIds);
            setInputText('');
          }}
          sections={filteredItems}
          disabledKeys={
            !errorLines ? [QuickActionItemIds.FixErrors] : undefined
          }
          classes={{
            dropdownMenuButtonWrapper:
              styles['sketch-generation-dropdown-menu-wrapper'],
            dropdownMenuPopover: styles['sketch-generation-dropdown-popover'],
            dropdownMenu: styles['sketch-generation-dropdown-menu'],
          }}
        />
      );
    };

    const renderSketchGeneration = (): JSX.Element => {
      return (
        <div className={styles['sketch-generation-container']}>
          <div className={styles['sketch-generation-label']}>
            <XXSmall bold>
              {formatMessage(messages.generateSketchNewFeature)}
            </XXSmall>
            <IconButton
              label={formatMessage(
                quickActionMessages[QuickActionItemIds.GenerateSketch],
              )}
              Icon={CodeIcon}
              classes={{ button: styles['sketch-generation-button'] }}
              onPress={(): void => {
                setIsSketchGenerationBoxVisible(false);
                setIsSketchGenerationDismissed(true);
                setIsSketchGeneration(true);
              }}
            >
              <XXSmall bold>
                {formatMessage(
                  quickActionMessages[QuickActionItemIds.GenerateSketch],
                )}
              </XXSmall>
            </IconButton>
            <XXSmall>
              {formatMessage(messages.generateSketchNewFeatureMessage)}
            </XXSmall>
          </div>
          <IconButton
            label="Close"
            Icon={CloseX}
            onPress={(): void => {
              setIsSketchGenerationBoxVisible(false);
              setIsSketchGenerationDismissed(true);
            }}
          />
        </div>
      );
    };

    const renderQuickActionLabel = (
      action: QuickActionItemIds,
    ): JSX.Element => {
      return (
        <div className={styles['quick-action-input-label']}>
          {isSketchGeneration && !isSketchGenerationDisabled && <CodeIcon />}
          <XXXSmall bold>{formatMessage(quickActionMessages[action])}</XXXSmall>
          <IconButton
            label="Close"
            Icon={CloseX}
            onPress={(): void => {
              setCurrentQuickAction(undefined);
            }}
          />
        </div>
      );
    };

    return (
      <div
        ref={sendBoxRef}
        className={clsx(styles['send-box-container'], {
          [styles['is-ai-banner-visible']]: isAiBannerVisible,
        })}
      >
        {inputText.startsWith('/') && renderQuickActionList()}
        {!isSketchGenerationDisabled &&
          !isSending &&
          !isLoading &&
          isSketchGenerationBoxVisible &&
          !isSketchGeneration &&
          !isSketchGenerationDismissed &&
          renderSketchGeneration()}
        <div
          ref={inputRef}
          className={clsx(styles['input-container'], {
            [styles['is-quick-action-enabled']]: !!currentQuickAction,
            [styles['is-sketch-generation-box-visible']]:
              isSketchGenerationBoxVisible &&
              !isSending &&
              !isLoading &&
              !isSketchGenerationDisabled,
            [styles['is-sending']]: isSending,
            [styles['is-loading']]: isLoading,
            [styles['is-disabled']]: genAiMessageUsageExceeded,
          })}
        >
          {genAiMessageUsageExceeded ? (
            <div className={styles['upgrade-plan-input-area']}>
              <XXSmall>
                {formatMessage(
                  chatPanelWidth <= CHAT_PANEL_SHORTER_MSG_WIDTH
                    ? messages.upgradeToUnlockShorter
                    : messages.upgradeToUnlock,
                  {
                    planLimitsReached: (
                      <XXSmall bold>
                        {formatMessage(messages.planLimitsReached)}
                      </XXSmall>
                    ),
                  },
                )}
              </XXSmall>
              {linksEnabled ? (
                <Link
                  href={Config.DIGITAL_STORE_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  <XXSmall bold>{formatMessage(messages.upgradePlan)}</XXSmall>
                </Link>
              ) : null}
            </div>
          ) : (
            <>
              <textarea
                name="input-text-area"
                rows={1}
                maxLength={maxContentLength}
                disabled={isSending || isLoading}
                value={inputText}
                onInput={(e): void => {
                  const el = e.currentTarget as HTMLTextAreaElement;
                  setTextAreaHeight(el);

                  const text = el.value;
                  onUserInput(text);
                  onClearHintMessage();
                  setInputText(text);
                  setQuery(text);
                }}
                placeholder={
                  !currentQuickAction
                    ? formatMessage(
                        isSketchGeneration && !isSketchGenerationDisabled
                          ? messages.generateSketchPlaceholder
                          : messages.placeholderSendBoxNoSketchGeneration,
                      )
                    : undefined
                }
                className={styles['input-text-area']}
                onKeyDown={(e): void => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSendMessage();
                  }
                }}
                onFocus={(): void => {
                  setIsSketchGenerationBoxVisible(!isSketchGenerationDismissed);
                }}
              />
              {currentQuickAction && renderQuickActionLabel(currentQuickAction)}
              {!isSketchGenerationDisabled && isSketchGeneration && (
                <div className={styles['sketch-generation-input-label']}>
                  <CodeIcon />
                  <XXSmall>
                    {formatMessage(
                      quickActionMessages[QuickActionItemIds.GenerateSketch],
                    )}
                  </XXSmall>
                  <IconButton
                    label="Close"
                    Icon={CloseX}
                    onPress={(): void => {
                      setIsSketchGeneration(false);
                      setIsSketchGenerationDismissed(true);
                    }}
                  />
                </div>
              )}
              {isSending ? (
                <IconButton
                  label="Chat Stop"
                  Icon={ChatStop}
                  onPress={stopGeneration}
                  classes={{
                    button: styles['stop-button'],
                  }}
                />
              ) : (
                <IconButton
                  label="ChatSend"
                  onPress={onSendMessage}
                  Icon={GenAISendArrow}
                  isDisabled={!inputText && !currentQuickAction}
                  classes={{
                    button: styles['send-button'],
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    );
  },
);

SendBox.displayName = 'SendBox';
export default SendBox;

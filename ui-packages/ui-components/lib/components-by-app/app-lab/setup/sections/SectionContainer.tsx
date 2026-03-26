import {
  BackArrow,
  InfoIconOutline,
} from '@cloud-editor-mono/images/assets/icons';
import {
  Button,
  ButtonSize,
  ButtonType,
  Large,
  Small,
  useI18n,
  useTooltip,
  XXSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useRef } from 'react';

import {
  sectionActionMessages,
  sectionTitleMessages,
  tooltipMessages,
} from '../messages';
import setupStyles from '../setup.module.scss';
import { SetupItem, SetupItemId, SetupSection } from '../setup.type';
import styles from './section-container.module.scss';

interface SectionContainerProps<T extends SetupItem> {
  currentStep: SetupItemId | null;
  itemsLength: number;
  skippable?: boolean;
  onBack?: () => void;
  sectionLogic: SetupSection<T>['logic'];
  renderSection: SetupSection<T>['render'];
  showConfirmButton?: boolean;
  unlockAutoFlow?: () => void;
}

export function SectionContainer<T extends SetupItem>(
  props: SectionContainerProps<T>,
): JSX.Element {
  const {
    currentStep,
    itemsLength,
    sectionLogic,
    renderSection,
    skippable,
    onBack,
    showConfirmButton = true,
    unlockAutoFlow,
  } = props;

  const stepRef = useRef<{
    confirm: () => void;
    skip?: () => void;
  }>(null);

  const { formatMessage } = useI18n();

  const handleConfirm = (): void => {
    unlockAutoFlow?.();
    stepRef.current?.confirm();
  };

  const handleSkip = (): void => {
    unlockAutoFlow?.();
    stepRef.current?.skip?.();
  };

  const step = currentStep as T['id'];
  const [stepIsLoading, stepContent] = renderSection(
    sectionLogic,
    stepRef,
    unlockAutoFlow,
  );

  const showBack =
    Boolean(onBack) && currentStep !== SetupItemId.BoardConfiguration;

  const isNetworkSetup = currentStep === SetupItemId.NetworkSetup;

  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: formatMessage(tooltipMessages.wifiTooltipContent),
  });

  const { props: accountTooltipProps, renderTooltip: renderAccountTooltip } =
    useTooltip({
      content: formatMessage(tooltipMessages.accountTooltipContent),
    });

  return (
    <div className={styles['section-container']}>
      <div className={styles['content-container']}>
        <div className={styles['section-header']}>
          <div className={styles['section-header-left']}>
            {showBack && (
              <Button
                type={ButtonType.Tertiary}
                size={ButtonSize.XSmall}
                onClick={onBack}
                Icon={BackArrow}
                iconPosition="left"
                classes={{ button: styles['back-button'] }}
                disabled={stepIsLoading}
              >
                Back
              </Button>
            )}
          </div>
        </div>

        <div className={styles['section-content']}>
          <XXSmall>{`STEP ${step + 1}/${itemsLength}`}</XXSmall>

          <div className={styles['title-row']}>
            <Large bold>{formatMessage(sectionTitleMessages[step])}</Large>

            {isNetworkSetup ? (
              <div className={styles['tooltip-trigger']} {...tooltipProps}>
                <span className={styles['info-icon']} aria-hidden="true">
                  <InfoIconOutline />
                </span>

                <Small>
                  {
                    formatMessage(
                      tooltipMessages.wifiTooltipTitle,
                    ) /* "Why we ask for this" */
                  }
                </Small>
              </div>
            ) : null}
            {currentStep === SetupItemId.ArduinoAccount ? (
              <div {...accountTooltipProps}>
                <div className={styles['title-tooltip']}>
                  <div className={styles['info-icon']}>
                    <InfoIconOutline />
                  </div>
                  <XXSmall>
                    {formatMessage(tooltipMessages.accountTooltipTitle)}
                  </XXSmall>
                </div>

                {renderAccountTooltip(setupStyles['tooltip-content'])}
              </div>
            ) : null}
          </div>

          {isNetworkSetup ? (
            <div className={styles['sub-title']}>
              <Small bold>{'Select a network to connect your board'}</Small>
              {renderTooltip(styles['tooltip-content'])}
            </div>
          ) : null}

          {currentStep === SetupItemId.LinuxCredentials ? (
            <div className={styles['sub-title']}>
              <Small bold>{'Please choose a password for your Board '}</Small>
            </div>
          ) : null}

          <div className={styles['content']}>{stepContent}</div>
        </div>
      </div>

      <div className={styles['action-container']}>
        <div className={styles['buttons-wrapper']}>
          {skippable && (
            <Button
              type={ButtonType.Secondary}
              size={ButtonSize.Small}
              onClick={handleSkip}
              disabled={stepIsLoading}
            >
              Skip
            </Button>
          )}
          {showConfirmButton && (
            <Button
              loading={stepIsLoading}
              size={ButtonSize.Small}
              onClick={handleConfirm}
              disabled={stepIsLoading}
            >
              {formatMessage(sectionActionMessages[step])}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SectionContainer;

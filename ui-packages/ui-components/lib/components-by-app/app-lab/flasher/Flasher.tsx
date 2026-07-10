import { Checkmark, Exit } from '@cloud-editor-mono/images/assets/icons';
import { FlashEvent, OSImageRelease } from '@cloud-editor-mono/infrastructure';
import {
  Button,
  ButtonAppearance,
  ButtonVariant,
  useI18n,
  XSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { useCallback, useMemo, useState } from 'react';

import styles from './flasher.module.scss';
import { FlasherLogic } from './flasher.type';
import { messages } from './messages';
import { FlasherConfiguration } from './steps/configuration/FlasherConfiguration';
import { FlasherFlashing } from './steps/flashing/FlasherFlashing';
import { FlasherPreparation } from './steps/preparation/FlasherPreparation';

enum FlashBoardStep {
  Configuration = 1,
  Preparation = 2,
  Flashing = 3,
}
const steps = [
  FlashBoardStep.Configuration,
  FlashBoardStep.Preparation,
  FlashBoardStep.Flashing,
];

interface FlasherProps {
  flasherLogic: FlasherLogic;
}

export const Flasher: React.FC<FlasherProps> = ({
  flasherLogic,
}: FlasherProps) => {
  const { formatMessage } = useI18n();
  const [flashEvent, setFlashEvent] = useState<FlashEvent | null>(null);

  const step = useMemo(() => {
    if (flashEvent?.step !== 'flashing') return FlashBoardStep.Configuration;
    return flashEvent.progress || flashEvent.log === 'completed'
      ? FlashBoardStep.Flashing
      : FlashBoardStep.Preparation;
  }, [flashEvent]);
  const disabled = useMemo(() => step === FlashBoardStep.Flashing, [step]);

  const {
    loading,
    succeeded,
    setFlashing,
    setSucceeded,
    close,
    listAvailableImages,
    getAvailableFreeSpace,
    getUserPartitionPreservationSupported,
    flashBoard,
    openArduinoSupport,
    clearBoardAsUsed,
    flashingBoard,
  } = flasherLogic();

  const handleFlash = useCallback(
    async (image: OSImageRelease, preserveData: boolean): Promise<void> => {
      setFlashing(true);
      try {
        await flashBoard(image, preserveData, (event) => {
          setFlashEvent(event);
          if (event.step === 'flashing' && event.log === 'completed') {
            setSucceeded(true);
            // Clear the board as used when flash is completed successfully
            // Note: flashingBoard comes from useFlasherLogic and contains the current board info
            clearBoardAsUsed(flashingBoard.serial);
          }
        });
        setSucceeded(true);
      } catch (error) {
        setFlashEvent({
          step: 'flashing',
          log:
            typeof error === 'string' ? error : formatMessage(messages.error),
          progress: 1,
        });
        setSucceeded(false);
      } finally {
        setFlashing(false);
      }
    },
    [
      setFlashing,
      flashBoard,
      setSucceeded,
      clearBoardAsUsed,
      flashingBoard.serial,
      formatMessage,
    ],
  );

  const handleRetry = useCallback((): void => {
    setFlashEvent(null);
    setSucceeded(null);
  }, [setSucceeded]);

  const handleClose = useCallback((): void => {
    setFlashEvent(null);
    close();
  }, [close]);

  const getTitle = (step: FlashBoardStep): string => {
    switch (step) {
      case FlashBoardStep.Configuration:
        return formatMessage(messages.configurationStepTitle);
      case FlashBoardStep.Preparation:
        return formatMessage(messages.preparationStepTitle);
      case FlashBoardStep.Flashing:
        return formatMessage(messages.flashingStepTitle);
    }
  };

  const getContent = (step: FlashBoardStep): React.ReactNode => {
    switch (step) {
      case FlashBoardStep.Configuration:
        return (
          <FlasherConfiguration
            flashEvent={flashEvent}
            loading={loading}
            listAvailableImages={listAvailableImages}
            getAvailableFreeSpace={getAvailableFreeSpace}
            getUserPartitionPreservationSupported={
              getUserPartitionPreservationSupported
            }
            onConfirm={handleFlash}
          />
        );
      case FlashBoardStep.Preparation:
        return <FlasherPreparation />;
      case FlashBoardStep.Flashing:
        return (
          flashEvent && (
            <FlasherFlashing
              flashEvent={flashEvent}
              succeeded={succeeded}
              onConfirm={close}
              onRetry={handleRetry}
              openArduinoSupport={openArduinoSupport}
            />
          )
        );
    }
  };

  return (
    <section className={styles['main']}>
      <div className={styles['header']}>
        <Button
          variant={ButtonVariant.Secondary}
          appearance={ButtonAppearance.LowContrast}
          Icon={Exit}
          disabled={disabled}
          onClick={handleClose}
        >
          {formatMessage(messages.exitButton)}
        </Button>
      </div>
      <div className={styles['body']}>
        <div className={styles['stepper']}>
          <div className={styles['stepper-header']}>
            <XSmall className={styles['stepper-header-title']}>
              {formatMessage(messages.title)}
            </XSmall>
          </div>
          <div className={styles['stepper-body']}>
            {steps.map((value, index) => (
              <div key={value} className={styles['step-item']}>
                <div className={styles['step-item-header']}>
                  <div
                    className={clsx(styles['step-indicator'], {
                      [styles['step-indicator--active']]: value === step,
                      [styles['step-indicator--completed']]: value < step,
                    })}
                  >
                    {value < step ? (
                      <Checkmark />
                    ) : (
                      <XSmall className={styles['step-indicator-counter']}>
                        {value}
                      </XSmall>
                    )}
                  </div>
                  <XSmall className={styles['step-item-title']}>
                    {getTitle(value)}
                  </XSmall>
                </div>
                <div className={styles['step-item-content']}>
                  <div
                    className={clsx(styles['step-item-border'], {
                      [styles['step-item-border--visible']]:
                        index !== steps.length - 1,
                    })}
                  />

                  {value === step && getContent(value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={styles['footer']} />
    </section>
  );
};

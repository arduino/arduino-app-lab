import clsx from 'clsx';
import { useState } from 'react';
import Joyride from 'react-joyride';

import { Button, ButtonType } from '../essential/button';
import { useI18n } from '../i18n/useI18n';
import { Small, XXSmall } from '../typography';
import { useOnboarding } from './hooks/useOnboarding';
import { onboardingMessages, onboardingStepsMessages } from './messages';
import styles from './onboarding.module.scss';
import Tooltip from './Tooltip';

export type OnboardingLogic = () => {
  setOnboardingDone: (status: boolean) => void;
  onboardingDone: boolean;
  sketchName?: string;
};

interface OnboardingProps {
  onboardingLogic: OnboardingLogic;
}

const Onboarding: React.FC<OnboardingProps> = (props: OnboardingProps) => {
  const { onboardingLogic } = props;
  const { onboardingDone, setOnboardingDone, sketchName } = onboardingLogic();

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const { formatMessage } = useI18n();

  const { steps } = useOnboarding();

  const handleClickStart = (): void => {
    setOnboardingDone(true);
    setIsRunning(true);
  };

  const handleClickStop = (): void => {
    setOnboardingDone(true);
    setIsRunning(false);
  };

  return (
    <>
      <Joyride
        tooltipComponent={Tooltip}
        disableOverlayClose
        disableCloseOnEsc
        continuous
        hideCloseButton
        run={isRunning}
        scrollToFirstStep
        showSkipButton
        steps={steps}
        locale={{
          skip: formatMessage(onboardingStepsMessages.skipAll),
        }}
        styles={{
          options: {
            zIndex: 10000,
            arrowColor: '#374146',
          },
        }}
      />
      {!onboardingDone ? (
        <div className={styles['onboarding-window']}>
          <div className={styles['onboarding-content']}>
            <div className={styles['onboarding-text']}>
              <Small bold>
                {formatMessage(onboardingMessages.onboardingTitle)}
              </Small>
              <XXSmall>
                {formatMessage(onboardingMessages.onboardingDescription, {
                  sketchName,
                })}
              </XXSmall>
            </div>
            <div className={styles['onboarding-buttons']}>
              <Button
                type={ButtonType.Tertiary}
                onClick={handleClickStop}
                classes={{
                  button: clsx(
                    styles['onboarding-button'],
                    styles['onboarding-button-hide'],
                  ),
                }}
              >
                {formatMessage(onboardingMessages.onboardingHideButton)}
              </Button>
              <Button
                type={ButtonType.Tertiary}
                onClick={handleClickStart}
                classes={{
                  button: styles['onboarding-button'],
                }}
              >
                {formatMessage(onboardingMessages.onboardingStartButton)}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default Onboarding;

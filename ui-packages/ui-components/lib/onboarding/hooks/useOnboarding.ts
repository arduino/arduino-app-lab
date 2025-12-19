import { Step } from 'react-joyride';

import { useI18n } from '../../i18n/useI18n';
import { onboardingStepsMessages } from '../messages';

type UseOnboarding = () => {
  steps: Step[];
};

export const useOnboarding: UseOnboarding =
  function (): ReturnType<UseOnboarding> {
    const { formatMessage } = useI18n();

    const steps: Step[] = [
      {
        disableBeacon: true,
        title: formatMessage(onboardingStepsMessages.connectDeviceTitle),
        content: formatMessage(onboardingStepsMessages.connectDeviceContent),
        placement: 'right',
        target: '#association-node',
        offset: 0,
        spotlightPadding: 0,
      },
      {
        disableBeacon: true,
        title: formatMessage(onboardingStepsMessages.verifyAndUploadTitle),
        content: formatMessage(onboardingStepsMessages.verifyAndUploadContent),
        placement: 'right',
        target: '#verify-and-upload',
        offset: 0,
        spotlightPadding: 6,
      },
      {
        disableBeacon: true,
        title: formatMessage(onboardingStepsMessages.deviceInteractionTitle),
        content: formatMessage(
          onboardingStepsMessages.deviceInteractionContent,
        ),
        placement: 'left',
        target: '#serial-monitor',
        offset: 0,
        spotlightPadding: 5,
      },
      {
        disableBeacon: true,
        title: formatMessage(onboardingStepsMessages.examplesTitle),
        content: formatMessage(onboardingStepsMessages.examplesContent),
        placement: 'right',
        target: '#Examples',
        offset: 0,
        spotlightPadding: -4,
      },
      {
        disableBeacon: true,
        title: formatMessage(onboardingStepsMessages.librariesAndLanguageTitle),
        content: formatMessage(
          onboardingStepsMessages.librariesAndLanguageContent,
        ),
        placement: 'right',
        target: '#libraries-and-reference',
        offset: 0,
        spotlightPadding: -4,
      },
      {
        disableBeacon: true,
        title: formatMessage(onboardingStepsMessages.sketchCollectionTitle),
        content: formatMessage(onboardingStepsMessages.sketchCollectionContent),
        placement: 'right',
        target: '#cs-sidebarroot-trigger',
        offset: 0,
        spotlightPadding: -4,
        locale: {
          skip: formatMessage(onboardingStepsMessages.finishTour),
        },
      },
    ];

    return { steps };
  };

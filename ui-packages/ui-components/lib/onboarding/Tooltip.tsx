import {
  OnboardingBack,
  OnboardingNext,
} from '@cloud-editor-mono/images/assets/icons';
import { ElementType } from 'react';
import { TooltipRenderProps } from 'react-joyride';

import { Button } from '../essential/button';
import { IconButton } from '../essential/icon-button';
import { Small, XSmall } from '../typography';
import styles from './onboarding.module.scss';

const Tooltip: ElementType<TooltipRenderProps> = (
  props: TooltipRenderProps,
) => {
  const {
    index,
    step,
    isLastStep,
    skipProps,
    backProps,
    primaryProps,
    tooltipProps,
    size,
  } = props;

  return (
    <div {...tooltipProps} className={styles['tooltip']}>
      <div className={styles['tooltip-content']}>
        <div className={styles['tooltip-header']}>
          <Small bold>{step.title}</Small>
          <XSmall>{step.content}</XSmall>
        </div>
        <div className={styles['tooltip-footer']}>
          <Button
            {...skipProps}
            classes={{
              button: styles['tooltip-skip'],
            }}
          >
            <Small>{skipProps.title}</Small>
          </Button>
          <div className={styles['tooltip-actions']}>
            <XSmall>
              {index + 1} / {size}
            </XSmall>
            <div className={styles['tooltip-buttons']}>
              <IconButton
                label={'back'}
                Icon={OnboardingBack}
                isDisabled={index === 0}
                // {...backProps}
              />
              <IconButton
                label={'next'}
                Icon={OnboardingNext}
                isDisabled={isLastStep}
                // {...primaryProps}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tooltip;

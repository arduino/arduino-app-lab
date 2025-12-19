import { useRef } from 'react';

import {
  Button,
  ButtonSize,
  ButtonType,
} from '../../components-by-app/app-lab';
import { useI18n } from '../../i18n/useI18n';
import { Large, XXSmall } from '../../typography';
import { sectionActionMessages, sectionTitleMessages } from '../messages';
import {
  AppLabSetupItem,
  AppLabSetupItemId,
  SetupSection,
} from '../setup.type';
import styles from './section-container.module.scss';

interface SectionContainerProps<T extends AppLabSetupItem> {
  currentStep: AppLabSetupItemId | null;
  itemsLength: number;
  skippable?: boolean;
  sectionLogic: SetupSection<T>['logic'];
  renderSection: SetupSection<T>['render'];
  children?: React.ReactNode;
  showConfirmButton?: boolean;
}

export function SectionContainer<T extends AppLabSetupItem>(
  props: SectionContainerProps<T>,
): JSX.Element {
  const {
    currentStep,
    itemsLength,
    sectionLogic,
    renderSection,
    skippable,
    showConfirmButton = true,
  } = props;

  const stepRef = useRef<{
    confirm: () => void;
    skip?: () => void;
  }>(null);

  const { formatMessage } = useI18n();

  const handleConfirm = (): void => {
    if (!stepRef.current) return;
    stepRef.current.confirm();
  };

  const handleSkip = (): void => {
    if (!stepRef.current || !stepRef.current.skip) return;
    stepRef.current.skip();
  };

  const step = currentStep as T['id'];
  const [stepIsLoading, stepContent] = renderSection(sectionLogic, stepRef);

  return (
    <div className={styles['section-container']}>
      <div className={styles['content-container']}>
        <div className={styles['section-header']}>
          {skippable && (
            <Button
              type={ButtonType.Tertiary}
              size={ButtonSize.XSmall}
              onClick={handleSkip}
              disabled={stepIsLoading}
            >
              Skip
            </Button>
          )}
        </div>
        <div className={styles['section-content']}>
          <XXSmall>{`STEP ${step + 1}/${itemsLength}`}</XXSmall>
          <div className={styles['title']}>
            <Large bold>{formatMessage(sectionTitleMessages[step])}</Large>
          </div>
          <div className={styles['content']}>{stepContent}</div>
        </div>
      </div>
      {showConfirmButton ? (
        <div className={styles['action-container']}>
          <Button
            loading={stepIsLoading}
            size={ButtonSize.Small}
            classes={{ button: styles['connect-button'] }}
            onClick={handleConfirm}
            disabled={stepIsLoading}
          >
            {formatMessage(sectionActionMessages[step])}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default SectionContainer;

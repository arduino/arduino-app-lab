import {
  Board,
  CloseX,
  MediaLibraryBooksNormal,
  Reset,
} from '@cloud-editor-mono/images/assets/icons';

import { Button } from '../../../../../essential/button';
import { Checkbox } from '../../../../../essential/checkbox';
import { IconButton } from '../../../../../essential/icon-button';
import { useI18n } from '../../../../../i18n/useI18n';
import { Skeleton } from '../../../../../skeleton';
import { TextSize, XXSmall } from '../../../../../typography';
import { sketchPlanMessages } from '../../messages';
import styles from './sketch-plan.module.scss';
import skeletonStyles from './sketch-plan-skeleton.module.scss';

const SketchPlanSkeleton: React.FC = () => {
  const { formatMessage } = useI18n();

  return (
    <div className={styles['sketch-plan-container']}>
      <div className={styles['sketch-plan-body']}>
        <div className={styles['sketch-plan-components']}>
          <div className={styles['sketch-plan-board']}>
            <Board height={12} width={12} />
            <div className={skeletonStyles['message-skeleton-container']}>
              <Skeleton variant="rounded" />
            </div>
          </div>
        </div>

        <div className={styles['sketch-plan-libraries']}>
          <MediaLibraryBooksNormal height={16} width={16} />
          <div className={skeletonStyles['message-skeleton-container']}>
            <Skeleton variant="rounded" />
          </div>
        </div>

        <div className={styles['sketch-plan-instructions']}>
          <XXSmall bold>
            {formatMessage(sketchPlanMessages.instructionsTitle)}
          </XXSmall>
          <XXSmall>
            <ul className={skeletonStyles['thread-skeleton-container']}>
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className={skeletonStyles['message-skeleton-container']}
                >
                  <Skeleton variant="rounded" />
                </div>
              ))}
            </ul>
          </XXSmall>
        </div>

        <Checkbox classes={{ label: styles['hidden'] }}>
          <Skeleton variant="rounded" />
        </Checkbox>
      </div>
      <div className={styles['sketch-plan-actions']}>
        <IconButton
          label={formatMessage(sketchPlanMessages.regenerateButton)}
          Icon={Reset}
          classes={{ button: styles['sketch-plan-icon-button'] }}
          isDisabled
        />
        <IconButton
          label={formatMessage(sketchPlanMessages.cancelButton)}
          Icon={CloseX}
          classes={{ button: styles['sketch-plan-icon-button'] }}
          isDisabled
        />
        <Button
          size={TextSize.XSmall}
          classes={{
            button: styles['sketch-plan-main-button'],
          }}
          disabled
        >
          {formatMessage(sketchPlanMessages.confirmButton)}
        </Button>
      </div>
    </div>
  );
};

export default SketchPlanSkeleton;

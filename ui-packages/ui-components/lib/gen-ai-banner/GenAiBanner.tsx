import {
  genAiBanner,
  genAiBannerBg,
} from '@cloud-editor-mono/images/assets/images';
import { AiUserPlan, Plans } from '@cloud-editor-mono/infrastructure';
import clsx from 'clsx';

import { Button, ButtonType } from '../essential/button';
import { useI18n } from '../i18n/useI18n';
import { Small, XXSmall } from '../typography';
import styles from './gen-ai-banner.module.scss';
import { genAiBannerMessages } from './messages';

export type GenAiBannerLogic = () => {
  dismissGenAiBanner: (tryGenAi?: boolean) => void;
  isGenAiBannerDismissed: boolean;
  aiUserPlan?: AiUserPlan;
};

interface GenAiBannerProps {
  genAiBannerLogic: GenAiBannerLogic;
}

const GenAiBanner: React.FC<GenAiBannerProps> = (props: GenAiBannerProps) => {
  const { genAiBannerLogic } = props;
  const { dismissGenAiBanner, isGenAiBannerDismissed, aiUserPlan } =
    genAiBannerLogic();
  const { formatMessage } = useI18n();

  return !isGenAiBannerDismissed ? (
    <div className={styles['gen-ai-banner-container']}>
      <div className={styles['gen-ai-banner-image-bg']}>
        {genAiBannerBg}
        <div className={styles['gen-ai-banner-image']}>{genAiBanner}</div>
      </div>
      <div className={styles['gen-ai-banner-text']}>
        <Small bold>
          {formatMessage(genAiBannerMessages.genAiBannerTitle)}
        </Small>
        <XXSmall>
          {formatMessage(
            aiUserPlan === Plans.ENTERPRISE
              ? genAiBannerMessages.genAiBannerProDescription
              : aiUserPlan === Plans.MAKER
              ? genAiBannerMessages.genAiBannerMakerDescription
              : genAiBannerMessages.genAiBannerFreeDescription,
            {
              limit: (
                <XXSmall bold>
                  {formatMessage(
                    aiUserPlan === Plans.ENTERPRISE
                      ? genAiBannerMessages.genAiBannerProLimit
                      : aiUserPlan === Plans.MAKER
                      ? genAiBannerMessages.genAiBannerMakerLimit
                      : genAiBannerMessages.genAiBannerFreeLimit,
                  )}
                </XXSmall>
              ),
            },
          )}
        </XXSmall>
      </div>
      <div className={styles['gen-ai-banner-buttons']}>
        <Button
          type={ButtonType.Tertiary}
          onClick={(): void => dismissGenAiBanner()}
          classes={{
            button: clsx(
              styles['gen-ai-banner-button'],
              styles['gen-ai-banner-button-hide'],
            ),
          }}
        >
          {formatMessage(genAiBannerMessages.genAiBannerMaybeLaterButton)}
        </Button>
        <Button
          type={ButtonType.Tertiary}
          onClick={(): void => dismissGenAiBanner(true)}
          classes={{
            button: styles['gen-ai-banner-button'],
          }}
        >
          {formatMessage(genAiBannerMessages.genAiBannerTryItNowButton)}
        </Button>
      </div>
    </div>
  ) : null;
};

export default GenAiBanner;

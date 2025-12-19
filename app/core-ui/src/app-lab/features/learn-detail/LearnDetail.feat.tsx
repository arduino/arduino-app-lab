import {
  AppLabMarkdownReader,
  AppLabTopBar,
  AppLabTopBarBack,
  TutorialIcon,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { Skeleton } from '../../../../../../ui-packages/ui-components/lib/skeleton';
import styles from './learn-detail.module.scss';
import { useLearnDetailLogic } from './learnDetail.logic';

interface LearnDetailProps {
  resourceId: string;
}

const LearnDetail: React.FC<LearnDetailProps> = (props: LearnDetailProps) => {
  const { resourceId } = props;
  const {
    resource,
    isLoading,
    contentRef,
    goBack,
    openExternalLink,
    openInternalLink,
  } = useLearnDetailLogic(resourceId);

  return (
    <section className={styles['main']}>
      {isLoading ? (
        <div className={styles['loading-container']}>
          <Skeleton variant="rounded" count={50} />
        </div>
      ) : (
        <>
          <AppLabTopBar
            pathItems={[
              <AppLabTopBarBack label="Learn" onClick={goBack} key={0} />,
              resource?.title,
            ]}
          />
          <div className={styles['resource-container']} ref={contentRef}>
            <div className={styles['resource-header']}>
              <div className={styles['resource-title']}>
                <TutorialIcon icon={resource?.icon} variant="self-aligned" />
                <h1>{resource?.title}</h1>
              </div>
              <div className={styles['resource-description']}>
                <div className={styles['description']}>
                  {resource?.description}
                </div>
                <div className={styles['last-revision']}>
                  {resource?.lastRevision &&
                    `Last revision ${resource.lastRevision.toLocaleDateString()}`}
                </div>
              </div>
            </div>
            <AppLabMarkdownReader
              classes={{ reader: styles['markdown-reader'] }}
              content={resource?.content || ''}
              onOpenExternalLink={openExternalLink}
              onOpenInternalLink={openInternalLink}
            />
          </div>
        </>
      )}
    </section>
  );
};

export default LearnDetail;

import { NavigationGroup } from '@cloud-editor-mono/images/assets/icons';
import {
  EmptyState,
  LearnItem as Card,
  PageLayout,
  TopBar,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { Link } from '@tanstack/react-router';

import styles from './learn-list.module.scss';
import { useLearnListLogic } from './learnList.logic';
import { messages } from './messages';

const LearnList: React.FC = () => {
  const { learnList, isLoading: learnListLoading } = useLearnListLogic();

  const { formatMessage } = useI18n();

  return (
    <PageLayout header={<TopBar pathItems={['learn']} />}>
      {!learnListLoading && learnList.length === 0 ? (
        <EmptyState
          icon={<NavigationGroup />}
          title={formatMessage(messages.emptyTitle)}
          description={formatMessage(messages.emptyDescription)}
        />
      ) : null}
      <div className={styles['learn-list']}>
        {/* Loading state */}
        {learnListLoading ? <Card variant="skeleton" /> : null}
        {/* Learn cards */}
        {!learnListLoading && learnList.length > 0
          ? learnList.map((item) => (
              <Link
                key={item.id}
                className={styles['learn-resource-link']}
                to="/learn/$resourceId"
                params={{ resourceId: item.id || '' }}
              >
                <Card
                  key={item.id}
                  name={item.title}
                  description={item.description}
                  category={item.tags}
                  icon={item.icon}
                  date={item.lastRevision}
                />
              </Link>
            ))
          : null}
      </div>
    </PageLayout>
  );
};

export default LearnList;

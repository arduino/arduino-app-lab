import { NavigationGroup, Plus } from '@cloud-editor-mono/images/assets/icons';
import {
  AppItem as Card,
  AppLabTopBar,
  Button,
  ButtonType,
  CreateAppDialog,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { Link } from '@tanstack/react-router';

import { AppsSection } from '../../routes/__root';
import styles from './app-list.module.scss';
import { useAppListLogic } from './appList.logic';
import {
  appListMessages as messages,
  AppListSections,
  emptyDescriptionMessages,
  emptyTitleMessages,
} from './messages';

interface AppListProps {
  section: AppsSection;
}

const AppList: React.FC<AppListProps> = (props: AppListProps) => {
  const { section } = props as AppListProps & { section: AppListSections };
  const {
    apps,
    isLoading: appsLoading,
    createAppDialogLogic,
    openCreateAppDialog,
  } = useAppListLogic(section);

  const { formatMessage } = useI18n();

  return (
    <section className={styles['main']}>
      <CreateAppDialog logic={createAppDialogLogic} />
      <AppLabTopBar pathItems={[section]}>
        <div className={styles['top-bar-container']}>
          {section === 'my-apps' && (
            <Button
              type={ButtonType.Primary}
              onClick={openCreateAppDialog}
              Icon={Plus}
              iconPosition="right"
            >
              {formatMessage(messages.actionCreate)}
            </Button>
          )}
        </div>
      </AppLabTopBar>
      {!appsLoading && apps.length === 0 ? (
        <div className={styles['empty-apps']}>
          <div className={styles['empty-apps-icon']}>
            <NavigationGroup />
          </div>
          <span>{formatMessage(emptyTitleMessages[section])}</span>
          <p>{formatMessage(emptyDescriptionMessages[section])}</p>
        </div>
      ) : null}
      {/* My apps grid*/}
      <div className={styles['my-apps']}>
        {/* Loading state */}
        {appsLoading ? <Card variant="skeleton" /> : null}
        {/* App cards */}
        {!appsLoading && apps.length > 0
          ? apps.map((app, i) => (
              <Link
                key={i}
                className={styles['app-link']}
                to={`/${section}/$appId`}
                params={{ appId: app.id || '' }}
              >
                <Card {...app} />
              </Link>
            ))
          : null}
      </div>
    </section>
  );
};

export default AppList;

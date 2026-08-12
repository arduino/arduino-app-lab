import {
  IconAccountSettingsNormal,
  IconMediaLibraryBooksNormal,
  IconNavigationDashboardNormal,
} from '@arduino/react-icons';
import {
  ArrowDown,
  Brick,
  NavigationTable,
  UserProfileOutline,
} from '@cloud-editor-mono/images/assets/icons';
import { Link } from '@tanstack/react-router';
import { clsx } from 'clsx';
import { Fragment } from 'react';

import {
  BreadcrumbItem,
  Breadcrumbs,
  BreadcrumbSeparator,
} from '../../../essential/breadcrumb';
import { useI18n } from '../../../i18n/useI18n';
import { XSmall } from '../../../typography';
import styles from './top-bar.module.scss';
import { topBarItems } from './topBarSpec';

interface BackProps {
  label: string;
  onClick: () => void;
}

export const Back: React.FC<BackProps> = (props: BackProps) => {
  const { onClick, label } = props;
  return (
    <BreadcrumbItem className={clsx(styles['item'])}>
      <div
        className={styles['label']}
        onClick={onClick}
        onKeyUp={onClick}
        role="button"
        tabIndex={0}
      >
        <ArrowDown className={styles['back-button']} title="Back" />
        <XSmall className={styles['item-label']}>{label}</XSmall>
      </div>
    </BreadcrumbItem>
  );
};

interface TopBarProps {
  pathItems: React.ReactNode[];
  children?: React.ReactNode;
}

const getBackIcon = (
  pathItem: React.ReactNode,
  styles: Record<string, string>,
): JSX.Element | null => {
  if (typeof pathItem === 'string') {
    if (pathItem === 'my-apps') {
      return (
        <IconNavigationDashboardNormal
          className={styles['back-app-button']}
          title="My Apps"
        />
      );
    }
    if (pathItem === 'examples') {
      return (
        <NavigationTable
          className={styles['back-app-button']}
          title="Examples"
        />
      );
    }
    if (pathItem === 'inspirations') {
      return (
        <NavigationTable
          className={styles['back-app-button']}
          title="Inspirations"
        />
      );
    }
    if (pathItem === 'learn' || pathItem === 'resources') {
      return (
        <IconMediaLibraryBooksNormal
          className={styles['back-app-button']}
          title="Learn"
        />
      );
    }
    return <ArrowDown className={styles['back-button']} title="Back" />;
  }
  return null;
};

const getSectionIcon = (
  pathItem: React.ReactNode,
  styles: Record<string, string>,
): JSX.Element | null => {
  if (typeof pathItem !== 'string') {
    return null;
  }

  const sectionIconMap: Record<string, React.ReactNode> = {
    'my-apps': (
      <IconNavigationDashboardNormal className={styles['section-icon']} />
    ),
    examples: <NavigationTable className={styles['section-icon']} />,
    inspirations: <NavigationTable className={styles['section-icon']} />,
    learn: <IconMediaLibraryBooksNormal className={styles['section-icon']} />,
    bricks: <Brick className={styles['section-icon']} />,
    settings: <IconAccountSettingsNormal className={styles['section-icon']} />,
    account: <UserProfileOutline className={styles['section-icon']} />,
  };

  return (sectionIconMap[pathItem] as JSX.Element) ?? null;
};

const TopBar: React.FC<TopBarProps> = (props: TopBarProps) => {
  const { pathItems, children } = props;

  const { formatMessage } = useI18n();

  const currentItem =
    pathItems.length > 0 && typeof pathItems[0] === 'string'
      ? topBarItems.find((item) => item.id === pathItems[0])
      : null;

  return (
    <div className={clsx(styles['top-bar'])}>
      <Breadcrumbs size="md" className={clsx(styles['breadcrumbs'])}>
        {pathItems.map((item, index) => {
          const BackIcon = getBackIcon(item, styles);
          const SectionIcon = getSectionIcon(item, styles);
          const showBackIcon = index === 0 && pathItems.length > 1 && BackIcon;
          const showSectionIcon = index === 0 && !showBackIcon && SectionIcon;
          const isCurrentItem = index === pathItems.length - 1;
          return (
            <Fragment key={index}>
              <div
                className={clsx(styles['wrapper'], {
                  [styles['wrapper-active']]: isCurrentItem,
                })}
              >
                {typeof item === 'string' ? (
                  <BreadcrumbItem
                    className={clsx(
                      styles['item'],
                      isCurrentItem ? styles['item-active'] : '',
                    )}
                  >
                    <Link
                      className={clsx(styles['label'])}
                      to={`/${pathItems
                        .slice(0, index + 1)
                        .reduce<string[]>(
                          (acc, it) =>
                            typeof it === 'string' ? [...acc, it] : acc,
                          [],
                        )
                        .join('/')}`}
                      disabled={isCurrentItem}
                    >
                      {showBackIcon && BackIcon}
                      {showSectionIcon && SectionIcon}
                      {index === 0 && currentItem ? (
                        <XSmall className={styles['item-label']}>
                          {formatMessage(currentItem.label)}
                        </XSmall>
                      ) : (
                        <XSmall className={styles['item-label']}>{item}</XSmall>
                      )}
                    </Link>
                  </BreadcrumbItem>
                ) : (
                  item
                )}
              </div>
              {index !== pathItems.length - 1 && (
                <BreadcrumbSeparator className={styles['breadcrumb-separator']}>
                  <XSmall>/</XSmall>
                </BreadcrumbSeparator>
              )}
            </Fragment>
          );
        })}
      </Breadcrumbs>
      {children}
    </div>
  );
};
export default TopBar;

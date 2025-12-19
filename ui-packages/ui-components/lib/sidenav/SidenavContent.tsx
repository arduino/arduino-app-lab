import { CloseX } from '@cloud-editor-mono/images/assets/icons';
import { useSearch } from '@tanstack/react-location';
import clsx from 'clsx';
import { memo, useContext } from 'react';

import { useI18n } from '../i18n/useI18n';
import { useTooltip } from '../tooltip';
import { Link, Small, XXSmall } from '../typography';
import { SidenavContext } from './context/sidenavContext';
import { messages } from './messages';
import styles from './sidenav.module.scss';
import { Section, SidenavItemId, SidenavItemWithId } from './sidenav.type';
import { updateSearch } from './utils';

interface SidenavContentProps<T extends SidenavItemWithId> {
  sectionItem: Section<T>['item'];
  sectionLogic: Section<T>['logic'];
  renderSection: Section<T>['render'];
  headerLogic: Section<T>['headerLogic'];
  renderHeader: Section<T>['renderHeader'];
  Icon: React.ReactNode;
  sectionKey?: string;
}

export function SidenavContent<T extends SidenavItemWithId>({
  sectionItem,
  sectionLogic,
  renderSection,
  sectionKey,
  headerLogic,
  renderHeader,
  Icon,
}: SidenavContentProps<T>): JSX.Element {
  const search = useSearch();
  const { formatMessage } = useI18n();

  const { isLegalDisclaimerAccepted } = useContext(SidenavContext);

  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: formatMessage(messages.sidenavContentClose),
    timeout: 0,
    renderDelay: 1000,
    tooltipType: 'title',
  });

  return (
    <div className={clsx(styles['sidenav-content'])}>
      <div
        className={clsx(styles['sidenav-content-header'], {
          [styles['gen-ai-legal-disclaimer-visible']]:
            !isLegalDisclaimerAccepted &&
            sectionItem.id === SidenavItemId.GenAI,
        })}
      >
        {(isLegalDisclaimerAccepted &&
          sectionItem.id === SidenavItemId.GenAI) ||
        sectionItem.id !== SidenavItemId.GenAI ? (
          <>
            <div className={styles['sidenav-content-title']}>
              {Icon}
              <div className={styles['labels']}>
                <Small className={styles['title-label']} bold>
                  {formatMessage(sectionItem.label)}
                </Small>
                {sectionItem.labelDetails ? (
                  <XXSmall className={styles['details-label']}>
                    {formatMessage(sectionItem.labelDetails)}
                  </XXSmall>
                ) : null}
              </div>
            </div>
            {renderHeader(headerLogic, sectionKey)}
          </>
        ) : null}
        <Link
          to="."
          search={updateSearch(search, { nav: undefined })}
          className={styles['sidenav-content-close']}
          {...tooltipProps}
        >
          <CloseX aria-hidden="true" focusable="false" />
          <span className="visually-hidden">
            {formatMessage(messages.hideSidenavContentButton)}
          </span>
          {renderTooltip(styles['tooltip'])}
        </Link>
      </div>
      {renderSection(sectionLogic, sectionKey)}
    </div>
  );
}

export default memo(SidenavContent);

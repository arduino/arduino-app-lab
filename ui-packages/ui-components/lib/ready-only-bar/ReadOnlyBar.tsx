import {
  ArduinoLoop,
  Download,
  InfoIconI,
  Resource,
} from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import { MessageDescriptor } from 'react-intl';
import { useMedia } from 'react-use';

import { Button } from '../essential/button';
import { IconButton } from '../essential/icon-button';
import { useI18n } from '../i18n/useI18n';
import { Skeleton } from '../skeleton';
import { Link, Medium, Small, XSmall } from '../typography';
import { messages } from './messages';
import styles from './read-only-bar.module.scss';

export interface ReadOnlyActionButtonsProps {
  primary?: {
    onClick: () => void;
    label: MessageDescriptor;
  };
  secondary?: {
    onClick: () => void;
    label: MessageDescriptor;
  };
}

export type ReadOnlyBarLogic = () => {
  ownerName?: string;
  ownerLink?: string;
  sketchStats?: {
    size?: string;
    created: string;
    modified: string;
  };
  actionButtons?: ReadOnlyActionButtonsProps;
  showLogo?: boolean;
  itemName?: string;
  itemSubtitle?: string;
};

interface ReadOnlyBarProps {
  readOnlyBarLogic: ReadOnlyBarLogic;
}

const ReadOnlyBar: React.FC<ReadOnlyBarProps> = (props: ReadOnlyBarProps) => {
  const { readOnlyBarLogic } = props;

  const { formatMessage } = useI18n();

  const isSmallWidth = useMedia('(max-width: 768px)');

  const {
    ownerName,
    ownerLink,
    sketchStats,
    actionButtons,
    showLogo,
    itemName,
    itemSubtitle,
  } = readOnlyBarLogic();

  return (
    <div className={styles['container']}>
      <div className={styles['item-info-container']}>
        <div className={styles['item-icon-container']}>
          <Resource />
        </div>
        <div className={styles['item-info']}>
          <div className={styles['item-data-container']}>
            {itemName ? (
              !ownerName ? (
                <Medium bold>{itemName}</Medium>
              ) : (
                <div className={styles['item-name-owner-info-container']}>
                  <div className={styles['item-name-and-owner-container']}>
                    <Medium bold>{itemName}</Medium>
                    <Link
                      href={ownerLink}
                      target="_blank"
                      rel="noreferrer"
                      flavour={clsx(styles['owner-link'], {
                        [styles['owner-link-disabled']]: !ownerLink,
                      })}
                    >
                      {formatMessage(messages.byOwner, { owner: ownerName })}
                    </Link>
                  </div>
                  {sketchStats && !isSmallWidth ? (
                    <div className={styles['attr-container']}>
                      <div className={styles['info-icon-container']}>
                        <InfoIconI />
                      </div>
                      <div className={styles['sketch-attr']}>
                        {sketchStats.size ? (
                          <div className={styles['sketch-attr-label']}>
                            <XSmall bold>
                              {formatMessage(messages.sizeLabel)}
                            </XSmall>
                            <XSmall>{sketchStats.size}</XSmall>
                          </div>
                        ) : null}
                        <div className={styles['sketch-attr-label']}>
                          <XSmall bold>
                            {formatMessage(messages.createdLabel)}
                          </XSmall>
                          <XSmall>{sketchStats.created}</XSmall>
                        </div>
                        <div className={styles['sketch-attr-label']}>
                          <XSmall bold>
                            {formatMessage(messages.modifiedLabel)}
                          </XSmall>
                          <XSmall>{sketchStats.modified}</XSmall>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            ) : (
              <div className={styles['name-skeleton']}>
                <Skeleton variant="rect" />
              </div>
            )}
          </div>
          {itemSubtitle ? (
            <div className={styles['item-subtitle-container']}>
              <Small>{itemSubtitle}</Small>
            </div>
          ) : null}
        </div>
      </div>
      {showLogo ? (
        <div className={styles['logo-container']}>
          <ArduinoLoop />
        </div>
      ) : null}
      <div className={styles['action-buttons-container']}>
        {actionButtons?.primary ? (
          <Button
            classes={{ button: styles['primary-action-button'] }}
            onClick={actionButtons?.primary.onClick}
          >
            {isSmallWidth
              ? formatMessage(actionButtons?.primary.label).split(' ')[0]
              : formatMessage(actionButtons?.primary.label)}
          </Button>
        ) : actionButtons ? (
          <div className={styles['primary-button-skeleton']}>
            <Skeleton variant="rounded" />
          </div>
        ) : null}
        {actionButtons?.secondary ? (
          <IconButton
            classes={{ button: styles['secondary-action-button'] }}
            onPress={actionButtons?.secondary.onClick}
            Icon={Download}
            title={formatMessage(actionButtons?.secondary.label)}
            label={formatMessage(actionButtons?.secondary.label)}
          />
        ) : actionButtons ? (
          <div className={styles['secondary-button-skeleton']}>
            <Skeleton variant="rounded" />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ReadOnlyBar;

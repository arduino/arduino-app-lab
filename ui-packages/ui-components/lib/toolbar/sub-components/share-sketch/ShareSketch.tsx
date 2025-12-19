import {
  GoogleClassroom,
  OpenInNewTab,
} from '@cloud-editor-mono/images/assets/icons';

import { CopyToClipboard } from '../../../essential/copy-to-clipboard';
import { Input } from '../../../essential/input';
import { ToggleButton } from '../../../essential/toggle-button';
import { useI18n } from '../../../i18n/useI18n';
import { Link, XSmall, XXSmall } from '../../../typography';
import { shareSketchMessages as messages } from '../../messages';
import { ShareSketchLogic, ShareToClassroomLogic } from '../../Toolbar.type';
import styles from './share-sketch.module.scss';

interface ShareSketchProps {
  shareSketchLogic: ShareSketchLogic;
  shareToClassroomLogic: ShareToClassroomLogic;
}

export function ShareSketch(props: ShareSketchProps): JSX.Element {
  const { shareSketchLogic, shareToClassroomLogic } = props;

  const { onToggleVisibility, targetUrl, embedMarkup, ...rest } =
    shareSketchLogic();
  const { shareToClassroom, canShareToClassroom } = shareToClassroomLogic();

  const { formatMessage } = useI18n();

  return (
    <div className={styles['share-sketch-panel']}>
      <div className={styles['share-sketch-header']}>
        <XSmall bold>
          {formatMessage(
            rest.organizationId !== undefined
              ? messages.titleOrganization
              : messages.titlePersonal,
          )}
        </XSmall>
        <div className={styles['share-sketch-toggle-button-container']}>
          <XSmall>
            {formatMessage(
              rest.isPublic ? messages.publicEnabled : messages.publicDisabled,
            )}
          </XSmall>
          <ToggleButton
            classes={{
              button: styles['share-sketch-toggle-button'],
            }}
            onChange={onToggleVisibility}
            isSelected={rest.isPublic}
          />
        </div>
      </div>
      {
        <>
          <XXSmall>
            {formatMessage(
              rest.isPublic
                ? messages.publicLabel
                : rest.organizationId !== undefined
                ? messages.organizationLabel
                : messages.personalLabel,
            )}
          </XXSmall>
          {rest.isPublic ? (
            <>
              <div className={styles['url-item-container']}>
                <XSmall>{`${formatMessage(messages.urlLabel)}:`}</XSmall>
                <Input
                  small
                  value={targetUrl}
                  className={styles['url-input']}
                  onChange={(): void => {
                    return;
                  }}
                >
                  <CopyToClipboard
                    classes={{
                      container: styles['copy-button-container'],
                    }}
                    text={targetUrl}
                  />
                </Input>
              </div>
              <div className={styles['url-item-container']}>
                <XSmall>{`${formatMessage(messages.embedLabel)}:`}</XSmall>
                <Input
                  small
                  className={styles['url-input']}
                  value={embedMarkup}
                  onChange={(): void => {
                    return;
                  }}
                >
                  <CopyToClipboard
                    classes={{
                      container: styles['copy-button-container'],
                    }}
                    text={embedMarkup}
                  />
                </Input>
              </div>
              {canShareToClassroom ? (
                <button
                  onClick={shareToClassroom}
                  className={styles['share-to-classroom']}
                >
                  <GoogleClassroom
                    className={styles['google-classroom-icon']}
                  />
                  <Link>
                    <XXSmall>
                      {formatMessage(messages.shareToClassroom)}
                    </XXSmall>
                  </Link>
                  <OpenInNewTab className={styles['open-in-new-tab']} />
                </button>
              ) : null}
            </>
          ) : rest.organizationId !== undefined ? (
            <div className={styles['url-item-container']}>
              <XXSmall>{`${formatMessage(messages.membersUrlLabel)}:`}</XXSmall>
              <Input
                small
                value={targetUrl}
                className={styles['url-input']}
                onChange={(): void => {
                  return;
                }}
              >
                <CopyToClipboard
                  classes={{
                    container: styles['copy-button-container'],
                  }}
                  text={targetUrl}
                />
              </Input>
            </div>
          ) : null}
        </>
      }
    </div>
  );
}

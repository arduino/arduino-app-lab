import { OpenInNewTab } from '@cloud-editor-mono/images/assets/icons';
import { SketchLibrary } from '@cloud-editor-mono/infrastructure';
import {
  Board,
  Button,
  ButtonSize,
  ButtonVariant,
  useI18n,
  useTooltip,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import React, { useCallback, useState } from 'react';

import { XSmall, XXSmall, XXXSmall } from '../../../typography';
import { sketchLibraryCardMessages } from './messages';
import styles from './sketch-library-card.module.scss';

interface SketchLibraryCardProps {
  board?: Board;
  library: SketchLibrary;
  onInstall: (libRef: string) => void;
  isInstalling?: boolean;
  installedPackage: string | undefined;
  onDelete: (libRef: string) => void;
  isDeleting?: boolean;
  openExternalLink: (url: string) => void;
  isBoard?: boolean;
  isCoreLibrary?: boolean;
}

const SketchLibraryCard = (
  props: SketchLibraryCardProps,
): React.ReactElement => {
  const {
    board,
    library,
    onInstall,
    isInstalling,
    installedPackage,
    onDelete,
    isDeleting,
    openExternalLink,
    isBoard,
    isCoreLibrary,
  } = props;

  const [selectedVersion, setSelectedVersion] = useState(installedPackage);

  const { formatMessage } = useI18n();

  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: (
      <XXSmall>
        {formatMessage(sketchLibraryCardMessages.coreLibraryTooltip, {
          coreLibraryLabel: (
            <XXSmall bold>
              {formatMessage(sketchLibraryCardMessages.coreLibraryLabel)}
            </XXSmall>
          ),
          boardModel: board?.type.toUpperCase(),
        })}
      </XXSmall>
    ),
    variant: 'card',
  });

  const onClick = useCallback((): void => {
    if (isInstalling || isDeleting) {
      return;
    }

    if (installedPackage && selectedVersion === installedPackage) {
      return onDelete(`${library.id}@${installedPackage}`);
    }

    const libRef = selectedVersion
      ? `${library.id}@${selectedVersion}`
      : library.id;
    libRef && onInstall(libRef);
    if (!selectedVersion) {
      setSelectedVersion(library.releases?.[0]?.version);
    }
  }, [
    installedPackage,
    isDeleting,
    isInstalling,
    library.id,
    library.releases,
    onDelete,
    onInstall,
    selectedVersion,
  ]);

  return (
    <div className={styles['lib-container']}>
      <div className={styles['lib-header']}>
        <div className={styles['lib-name']}>
          <XSmall bold>{library.name}</XSmall>
          {isCoreLibrary || installedPackage ? (
            <div className={styles['lib-version-wrapper']} {...tooltipProps}>
              <XXXSmall className={styles['lib-version']}>
                {`${isCoreLibrary ? '' : installedPackage} ${formatMessage(
                  sketchLibraryCardMessages.libraryInstalledLabel,
                )}`}
              </XXXSmall>
              {isCoreLibrary ? renderTooltip() : null}
            </div>
          ) : null}
        </div>
        <XXXSmall>{library.author}</XXXSmall>
      </div>
      <p className={styles['lib-sentence']}>{library.sentence}</p>
      <div className={styles['lib-actions']}>
        {!isCoreLibrary ? (
          <>
            <select
              value={selectedVersion}
              onChange={(e): void => {
                setSelectedVersion(e.target.value);
              }}
              className={styles['lib-select']}
            >
              {library.releases?.map((r) => (
                <option key={r.id} value={r.version}>
                  {r.version || ''}
                </option>
              ))}
            </select>
            <Button
              onClick={onClick}
              variant={
                installedPackage && selectedVersion === installedPackage
                  ? ButtonVariant.Secondary
                  : ButtonVariant.Primary
              }
              size={ButtonSize.XSmall}
              loading={isInstalling || isDeleting}
            >
              {formatMessage(
                installedPackage && selectedVersion === installedPackage
                  ? sketchLibraryCardMessages.removeButton
                  : sketchLibraryCardMessages.installButton,
              )}
            </Button>
          </>
        ) : null}
        {!isBoard ? (
          <Button
            onClick={(): void => {
              openExternalLink(library.website || '');
            }}
            variant={ButtonVariant.Tertiary}
            size={ButtonSize.XSmall}
            Icon={OpenInNewTab}
            classes={{
              button: styles['lib-button'],
            }}
          >
            {formatMessage(sketchLibraryCardMessages.moreInfoButton)}
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default SketchLibraryCard;

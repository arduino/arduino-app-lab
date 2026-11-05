import {
  AppLabInfo,
  TriangleSharp,
} from '@cloud-editor-mono/images/assets/icons';
import { FlashEvent, OSImageRelease } from '@cloud-editor-mono/infrastructure';
import {
  Button,
  ButtonVariant,
  Checkbox,
  Select,
  Skeleton,
  useI18n,
  useTooltip,
  XXSmall,
  XXXSmall,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';
import { Key, useEffect, useState } from 'react';

import styles from '../../flasher.module.scss';
import { messages } from '../../messages';
import stepStyles from './flasher-configuration.module.scss';

interface FlasherConfigurationProps {
  flashEvent: FlashEvent | null;
  loading: boolean;
  getCurrentImage: () => Promise<OSImageRelease>;
  listAvailableImages: () => Promise<OSImageRelease[]>;
  getAvailableFreeSpace: () => Promise<number>;
  getUserPartitionPreservationSupported: (id: string) => Promise<boolean>;
  // False when the board has no user partition to keep: the option is not
  // offered and the per-image support check is skipped.
  preserveDataSupported: boolean;
  onConfirm: (imageVersion: OSImageRelease, preserveData: boolean) => void;
}

const REQUIRED_FREE_SPACE_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB

// The backend reports the installed version as a plain string and an empty one
// when it could not read it, so an empty label means "unknown", not an image.
const knownImage = (image?: OSImageRelease): OSImageRelease | undefined =>
  image?.version_label ? image : undefined;

const imageVersionId = (version: OSImageRelease): string => version.id || '';

export const FlasherConfiguration: React.FC<FlasherConfigurationProps> = ({
  flashEvent,
  loading,
  getCurrentImage,
  listAvailableImages,
  getAvailableFreeSpace,
  getUserPartitionPreservationSupported,
  preserveDataSupported,
  onConfirm,
}: FlasherConfigurationProps) => {
  const { formatMessage } = useI18n();
  const [disabled, setDisabled] = useState(true);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [imagesUnavailable, setImagesUnavailable] = useState(false);
  const [imageVersions, setImageVersions] = useState<OSImageRelease[]>([]);
  const [imageVersion, setImageVersion] = useState<OSImageRelease>();
  const [preserve, setPreserve] = useState(true);
  const [preserveSupported, setPreserveSupported] = useState(true);
  const [hasEnoughSpace, setHasEnoughSpace] = useState(true);

  const imageVersionLabel = (version: OSImageRelease): string =>
    version.latest
      ? formatMessage(messages.imageVersionLatest, {
          version: version.version_label,
        })
      : version.version_label || '';

  useEffect(() => {
    const loadResources = async (): Promise<void> => {
      // The installed version comes from the board and the list from the
      // network; either can be slow, so both requests start at once.
      const currentImage = getCurrentImage().then(knownImage, () => undefined);
      const available = Promise.all([
        listAvailableImages(),
        getAvailableFreeSpace(),
      ]);

      // Show the installed version as soon as it resolves, so the field is
      // never empty while the list loads. Once the list has picked a version
      // it wins, whichever request finished first. While the list loads the
      // "Change" button stays hidden and the flash action stays disabled (see
      // `imagesLoaded`).
      let listed = false;
      currentImage.then((image) => {
        if (!listed && image) setImageVersion(image);
      });

      try {
        const [availableImages, freeSpace] = await available;
        listed = true;
        setImageVersions(availableImages);
        setHasEnoughSpace(freeSpace > REQUIRED_FREE_SPACE_BYTES);
        // The flash action becomes available only when the fetch succeeds and
        // there is at least one image to flash. Otherwise flag it so the flash
        // button can explain why it stays disabled.
        setImagesLoaded(availableImages.length > 0);
        setImagesUnavailable(availableImages.length === 0);
        // Default to the latest available image, then to the only one offered.
        // With nothing to flash, show the installed one.
        const preferred =
          availableImages.find((v) => v.latest) ?? availableImages[0];
        setImageVersion(preferred ?? (await currentImage));
      } catch {
        listed = true;
        setImageVersions([]);
        setImagesUnavailable(true);
        setImageVersion(await currentImage);
      }
    };

    // Only load while still configuring. Once flashing has started, progress
    // events re-render this component; reloading here would reset the user's
    // selected image back to the currently installed one on every tick.
    if (!loading && flashEvent === null) {
      loadResources();
    }
  }, [
    getCurrentImage,
    getAvailableFreeSpace,
    listAvailableImages,
    loading,
    flashEvent,
  ]);

  useEffect(() => {
    const checkPreserveSupported = async (): Promise<void> => {
      if (!preserveDataSupported) return;
      if (!imageVersion?.version_label) return;
      try {
        const isPreserveSupported = await getUserPartitionPreservationSupported(
          imageVersion.version_label,
        );
        setPreserveSupported(isPreserveSupported);
        setPreserve(isPreserveSupported);
      } catch {
        setPreserveSupported(false);
        setPreserve(false);
      }
    };
    checkPreserveSupported();
  }, [
    getUserPartitionPreservationSupported,
    preserveDataSupported,
    imageVersion,
  ]);

  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: formatMessage(messages.configurationStepPreserveDataTooltip, {
      bold: (text: string) => <b>{text}</b>,
    }),
    direction: 'up-right',
    variant: 'card',
  });

  const { props: noImagesTooltipProps, renderTooltip: renderNoImagesTooltip } =
    useTooltip({
      content: formatMessage(messages.configurationStepNoImagesTooltip),
      variant: 'card',
    });

  const handleConfirm = (): void => {
    if (imageVersion) {
      onConfirm(imageVersion, preserveDataSupported && preserve);
    }
  };

  const progress = flashEvent?.total
    ? Math.floor(((flashEvent?.progress ?? 0) / flashEvent.total) * 100)
    : 0;

  return (
    <div className={styles['step-container']}>
      <div className={styles['step-card']}>
        {loading ? (
          <>
            <div className={stepStyles['skeleton-container']}>
              <div className={stepStyles['skeleton']}>
                <Skeleton variant="rounded" count={1} />
              </div>
              <div
                className={clsx(
                  stepStyles['skeleton-container'],
                  stepStyles['skeleton-container--horizontal'],
                )}
              >
                <div
                  className={clsx(
                    stepStyles['skeleton'],
                    stepStyles['skeleton--small'],
                  )}
                >
                  <Skeleton variant="rounded" count={1} />
                </div>
                <div className={stepStyles['skeleton-button']} />
              </div>
            </div>
            <div className={stepStyles['skeleton-container']}>
              <div className={stepStyles['skeleton']}>
                <Skeleton variant="rounded" count={1} />
              </div>
              <div
                className={clsx(
                  stepStyles['skeleton'],
                  stepStyles['skeleton--medium'],
                )}
              >
                <Skeleton variant="rounded" count={1} />
              </div>
            </div>
          </>
        ) : flashEvent === null ? (
          <>
            <div className={stepStyles['image-version-container']}>
              <Select
                id="image-version"
                name="image-version"
                disabled={disabled}
                displayValue={
                  imageVersion ? imageVersionLabel(imageVersion) : ''
                }
                selectedId={imageVersion && imageVersionId(imageVersion)}
                label={formatMessage(
                  messages.configurationStepImageVersionLabel,
                )}
                sections={[
                  {
                    name: 'Image Versions',
                    // Only populate the dropdown when there is an actual choice
                    // to make (more than one available image).
                    items:
                      imageVersions.length > 1
                        ? imageVersions.map((version) => ({
                            id: imageVersionId(version),
                            label: imageVersionLabel(version),
                          }))
                        : [],
                  },
                ]}
                onChange={(key: Key): void =>
                  setImageVersion(
                    imageVersions.find((v) => imageVersionId(v) === key),
                  )
                }
              />
              {disabled && imageVersions.length > 1 && (
                <button
                  className={stepStyles['input-button']}
                  onClick={(): void => setDisabled(false)}
                >
                  <XXSmall className={stepStyles['input-button-label']}>
                    {formatMessage(
                      messages.configurationStepImageVersionAction,
                    )}
                  </XXSmall>
                </button>
              )}
            </div>
            {preserveDataSupported &&
              (preserveSupported ? (
                <div className={stepStyles['preserve-data-container']}>
                  <XXXSmall className={stepStyles['preserve-data-label']}>
                    {formatMessage(messages.configurationStepPreserveDataTitle)}
                  </XXXSmall>
                  <div className={stepStyles['preserve-data']}>
                    <Checkbox
                      isSelected={preserve}
                      onChange={(value): void => setPreserve(value)}
                      classes={{
                        input: stepStyles['preserve-data-input'],
                        inputChecked:
                          stepStyles['preserve-data-input--checked'],
                      }}
                    >
                      {formatMessage(
                        messages.configurationStepPreserveDataLabel,
                      )}
                    </Checkbox>
                    <div {...tooltipProps}>
                      <div className={stepStyles['info-icon']}>
                        <AppLabInfo />
                      </div>
                      {renderTooltip()}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={stepStyles['preserve-data-warning']}>
                  <TriangleSharp />
                  <XXSmall>
                    {formatMessage(
                      messages.configurationStepPreserveDataWarning,
                      {
                        bold: (text: string) => <b>{text}</b>,
                      },
                    )}
                  </XXSmall>
                </div>
              ))}
          </>
        ) : (
          <div className={stepStyles['flash-event-container']}>
            <XXSmall className={stepStyles['flash-event-title']}>
              {[
                formatMessage(messages.configurationStepImageVersionLabel),
                imageVersion && imageVersionLabel(imageVersion),
              ]
                .filter((it) => !!it)
                .join(' ')}
            </XXSmall>
            <XXXSmall className={stepStyles['flash-event-subtitle']}>
              {flashEvent.step === 'downloading'
                ? formatMessage(messages.flashingStepDownloadingLabel, {
                    progress,
                  })
                : formatMessage(messages.flashingStepExtractingLabel)}
            </XXXSmall>
            {flashEvent.step === 'downloading' ? (
              <div className={styles['progress-bar']}>
                <div
                  className={clsx(styles['progress'], styles[`p${progress}`])}
                />
              </div>
            ) : (
              <div className={styles['waiting-indicator']}>
                <div className={styles['indicator']} />
              </div>
            )}
          </div>
        )}
      </div>
      {flashEvent === null && (
        <div className={stepStyles['step-footer']}>
          {loading ? (
            <div className={stepStyles['skeleton-button']} />
          ) : (
            <>
              {hasEnoughSpace ? (
                <XXSmall>
                  {formatMessage(messages.configurationStepActionInfo)}
                </XXSmall>
              ) : (
                <div className={stepStyles['warning']}>
                  <TriangleSharp />
                  <XXSmall>
                    {formatMessage(messages.configurationStepActionWarning)}
                  </XXSmall>
                </div>
              )}
              {/* The wrapper carries the tooltip so it still triggers on hover
                  even while the button itself is disabled. */}
              <div
                {...(imagesUnavailable ? noImagesTooltipProps : {})}
                className={stepStyles['flash-button-wrapper']}
              >
                <Button
                  disabled={!imagesLoaded || !hasEnoughSpace}
                  loading={flashEvent !== null}
                  variant={ButtonVariant.Primary}
                  onClick={handleConfirm}
                  classes={{
                    textButtonText: stepStyles['flash-button'],
                  }}
                >
                  {formatMessage(messages.configurationStepAction)}
                </Button>
                {imagesUnavailable && renderNoImagesTooltip()}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

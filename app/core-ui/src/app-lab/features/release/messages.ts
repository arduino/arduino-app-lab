import { defineMessages } from 'react-intl';

export const releaseMessages = defineMessages({
  buildCompleted: {
    id: 'release.buildCompleted',
    defaultMessage: '{releaseName} successfully downloaded',
    description: 'Notification shown when a release has been saved',
  },
  buildFailed: {
    id: 'release.buildFailed',
    defaultMessage: 'Couldn’t create {releaseName}',
    description: 'Notification shown when a release build failed',
  },
  viewLog: {
    id: 'release.viewLog',
    defaultMessage: 'View log',
    description: 'Action of the failed build notification that opens its log',
  },
  buildStopped: {
    id: 'release.buildStopped',
    defaultMessage: 'Stopped creating {releaseName}',
    description: 'Notification shown when the user stops a release build',
  },
  createReleaseBusy: {
    id: 'release.createReleaseBusy',
    defaultMessage:
      'A new release is already being created for this app. Please wait for it to finish.',
    description:
      'Why Create release is disabled while a release of the same App is built',
  },
  bannerCreatingTitle: {
    id: 'release.bannerCreatingTitle',
    defaultMessage:
      '{count, plural, one {Saving release} other {Saving releases}}',
    description: 'Title of the background card that follows release builds',
  },
  bannerCreatingDescription: {
    id: 'release.bannerCreatingDescription',
    defaultMessage:
      "This takes few moments, we will update you when it's done.",
    description: 'Text under the release build card title',
  },
  bannerPreparingTitle: {
    id: 'release.bannerPreparingTitle',
    defaultMessage:
      '{count, plural, one {Getting {appName} ready} other {Getting # Apps ready}}',
    description:
      'Title of the background card that follows the dependency downloads',
  },
  bannerPreparingDescription: {
    id: 'release.bannerPreparingDescription',
    defaultMessage: "We will update you when it's done.",
    description: 'Text under the dependency download card title',
  },
  stepBuilding: {
    id: 'release.stepBuilding',
    defaultMessage: 'Building “{releaseName}”',
    description: 'Progress label while the release is being built',
  },
  stepDownloading: {
    id: 'release.stepDownloading',
    defaultMessage: 'Downloading “{releaseName}”',
    description: 'Progress label while the release archive is saved',
  },
  stepPreparing: {
    id: 'release.stepPreparing',
    defaultMessage: 'Downloading Bricks and models…',
    description: 'Progress label while the dependencies of a release download',
  },
  actionStop: {
    id: 'release.actionStop',
    defaultMessage: 'Stop {releaseName}',
    description: 'Card action that aborts the running job',
  },
  actionHide: {
    id: 'release.actionHide',
    defaultMessage: 'Hide in notifications',
    description:
      'Card action that dismisses the card but keeps the job running',
  },
  notificationSaving: {
    id: 'release.notificationSaving',
    defaultMessage: 'Saving {releaseName}',
    description:
      'Notifications panel entry for a release build whose card was hidden',
  },
  importCompleted: {
    id: 'release.importCompleted',
    defaultMessage: '{appName} correctly imported',
    description: 'Notification shown when a release has been installed',
  },
  importReleaseAlone: {
    id: 'release.importReleaseAlone',
    defaultMessage:
      'An App release is imported on its own. Only {fileName} was opened.',
    description:
      'Notification shown when an App release is dropped or picked together with other files',
  },
  prepareCompleted: {
    id: 'release.prepareCompleted',
    defaultMessage: 'App dependencies installed successfully',
    description: 'Notification shown when the dependencies of a release are in',
  },
  prepareFailed: {
    id: 'release.prepareFailed',
    defaultMessage: 'Couldn’t install the dependencies of {appName}',
    description: 'Notification shown when the dependency download failed',
  },
});

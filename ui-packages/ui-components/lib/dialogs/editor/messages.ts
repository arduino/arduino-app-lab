import { defineMessages } from 'react-intl';

import { SketchNameValidation } from './rename-sketch-dialog/renameSketchDialog.type';

export const renameSketchDialogMessages = defineMessages({
  dialogTitle: {
    id: 'renameDialog.title',
    defaultMessage: 'Rename sketch',
    description: 'Title of rename sketch dialog',
  },
  actionTitle: {
    id: 'renameDialog.actionTitle',
    defaultMessage: 'Rename sketch',
    description: 'Title of the form in rename dialog',
  },
  inputLabel: {
    id: 'renameDialog.inputLabel',
    defaultMessage: 'Name',
    description: 'Input label for sketch name in the rename dialog',
  },
  renameButtonLabel: {
    id: 'renameDialog.renameButton',
    defaultMessage: 'Rename',
    description: 'Label for rename button in rename dialog',
  },
  cancelButtonLabel: {
    id: 'renameDialog.cancelButton',
    defaultMessage: 'Cancel',
    description: 'Label for cancel button in rename dialog',
  },
});

export const renameSketchDialogValidationMessages =
  defineMessages<SketchNameValidation>({
    [SketchNameValidation.exceedsLimit]: {
      id: 'renameDialog.sketchNameExceedsLimit',
      defaultMessage: 'Character limit reached.',
      description: 'Character limit reached.',
    },
    [SketchNameValidation.hasInvalidCharacters]: {
      id: 'renameDialog.sketchNameContainsInvalidCharacters',
      defaultMessage:
        'Spaces, punctuations and special characters are not allowed.',
      description:
        'Spaces, punctuations and special characters are not allowed.',
    },
    [SketchNameValidation.alreadyExists]: {
      id: 'renameDialog.sketchNameAlreadyExists',
      defaultMessage: 'Name already in use, please choose another one.',
      description: 'Name already in use, please choose another one.',
    },
  });

export const deleteSketchDialogMessages = defineMessages({
  dialogTitle: {
    id: 'deleteSketchDialog.title',
    defaultMessage: 'Delete sketch',
    description: 'Title shown in the delete sketch dialog',
  },
  cancelButton: {
    id: 'deleteSketchDialog.cancelButton',
    defaultMessage: 'Cancel',
    description: 'Label for the cancel button',
  },
  confirmButton: {
    id: 'deleteSketchDialog.confirmButton',
    defaultMessage: 'Yes, Delete',
    description: 'Label for the confirm button',
  },
  actionText: {
    id: 'deleteSketchDialog.message',
    defaultMessage: 'Delete ',
    description: 'Message shown in the delete sketch dialog',
  },
  confirmText: {
    id: 'deleteSketchDialog.confirmMessage',
    defaultMessage:
      'This action is irreversible. Are you sure you want to delete this sketch?',
    description: 'Message to confirm the deletion of a sketch',
  },
});

export const deleteLibraryDialogMessages = defineMessages({
  dialogTitle: {
    id: 'deleteLibraryDialog.title',
    defaultMessage: 'Delete custom library',
    description: 'Title shown in the delete library dialog',
  },
  cancelButton: {
    id: 'deleteLibraryDialog.cancelButton',
    defaultMessage: 'Cancel',
    description: 'Label for the cancel button',
  },
  confirmButton: {
    id: 'deleteLibraryDialog.confirmButton',
    defaultMessage: 'Yes, Delete',
    description: 'Label for the confirm button',
  },
  actionText: {
    id: 'deleteLibraryDialog.message',
    defaultMessage: 'Delete ',
    description: 'Message shown in the delete library dialog',
  },
  confirmText: {
    id: 'deleteLibraryDialog.confirmMessage',
    defaultMessage:
      'This action is irreversible. Are you sure you want to delete this custom library?',
    description: 'Message to confirm the deletion of a custom library',
  },
});

export const mobileWarningDialog = defineMessages({
  header: {
    id: 'mobileWarningDialog.header',
    defaultMessage: 'Mobile Cloud Editor',
    description: 'Header shown in the mobile warning dialog',
  },
  title: {
    id: 'mobileWarningDialog.title',
    defaultMessage: 'Discover the editor on the go! ',
    description: 'Title in the body of the mobile warning dialog',
  },
  description: {
    id: 'mobileWarningDialog.description',
    defaultMessage:
      'Currently, our mobile version is a work in progress, so <bold>you might encounter some limitations and something might not be working properly</bold>.',
    description: 'Description of the mobile warning dialog',
  },
  otaDescription: {
    id: 'mobileWarningDialog.otaDescription',
    defaultMessage:
      'Keep in mind, uploading is only possible for IoT sketches already associated to an online <link>OTA (Over-the-Air) device</link>.',
    description: 'Note regarding ota upload on mobile devices',
  },
  continueButton: {
    id: 'mobileWarningDialog.continueButton',
    defaultMessage: 'Continue',
    description: 'Label for the continue button',
  },
});

export const flavourConfigDialogMessages = defineMessages({
  header: {
    id: 'flavourConfigDialog.header',
    defaultMessage: 'Flavours',
    description: 'Header shown in the flavour config popover',
  },
});

export const shareSketchDialogMessages = defineMessages({
  title: {
    id: 'shareSketchDialog.title',
    defaultMessage: 'Share Sketch',
    description: 'Title shown in the share sketch dialog header',
  },
  bodyTitle: {
    id: 'shareSketchDialog.body-title',
    defaultMessage: 'Choose the visibility of your sketch',
    description: 'Title shown in the body of the share sketch dialog',
  },
  publicLabel: {
    id: 'shareSketchDialog.public-label',
    defaultMessage: 'Public, anyone with the link can view the sketch',
    description: 'Label for the public visibility option',
  },
  privateLabel: {
    id: 'shareSketchDialog.private-label',
    defaultMessage: 'Private, only you can view the sketch',
    description: 'Label for the private visibility option',
  },
  urlLabel: {
    id: 'shareSketchDialog.url-label',
    defaultMessage: 'Link',
    description: 'Label for the shareable link',
  },
  embedLabel: {
    id: 'shareSketchDialog.embed-label',
    defaultMessage: 'Embed',
    description: 'Label for the embed string',
  },
});

export const shareToClassroomDialogMessages = defineMessages({
  title: {
    id: 'shareSketchToClassroomDialog.title',
    defaultMessage: 'Share Sketch to Google Classroom',
    description: 'Title shown in the share to classroom sketch dialog header',
  },
  body: {
    id: 'shareSketchToClassroomDialog.body',
    defaultMessage:
      'By proceeding, the sketch visibility will be automatically set as Public, everyone with the link can view the sketch.',
    description: 'Text shown in the body of the share sketch dialog',
  },
  shareToClassroomButton: {
    id: 'shareSketchToClassroomDialog.shareToClassroomButton',
    defaultMessage: 'Share to Google Classroom',
    description: 'Label for the share to classroom button',
  },
});

export const genAIPolicyTermsDialogMessages = defineMessages({
  title: {
    id: 'genAIPolicyTermsDialog.title',
    defaultMessage: 'Arduino Assistant Policy Terms',
    description: 'Title shown in the GenAI Policy Terms dialog',
  },
  firstPart: {
    id: 'genAIPolicyTermsDialog.firstPart',
    defaultMessage: `The Arduino AI Assistant is an experimental feature to assist the user in creating code for their sketch. It uses Generative AI to answer prompt-based questions from the user to understand the need and generate the code`,
    description: 'Content shown in the GenAI Policy Terms dialog',
  },
  secondPart: {
    id: 'genAIPolicyTermsDialog.secondPart',
    defaultMessage: `Arduino will not use the information uploaded/content/prompt into Arduino AI Assistant to enrich the algorithm of the AI Assistant; in order to provide this service, Arduino is sending the prompt and user sketch to third parties in order to provide user with the requested result, however no user personal information or identity is shared with third parties.
The user undertakes not to upload any personal data and any information related to physical persons as part of the prompt or sketch.`,
    description: 'Content shown in the GenAI Policy Terms dialog',
  },
  thirdPart: {
    id: 'genAIPolicyTermsDialog.thirdPart',
    defaultMessage: `The code generated by Arduino assistant is provided “as is” and we make no express or implied warranties whatsoever with respect to its functionality, operability, or use, fitness for a particular purpose, or infringement of third party rights. `,
    description: 'Content shown in the GenAI Policy Terms dialog',
  },
  fourthPart: {
    id: 'genAIPolicyTermsDialog.fourthPart',
    defaultMessage: `It is a responsibility of the user to: `,
    description: 'Content shown in the GenAI Policy Terms dialog',
  },
  fourthPartListItem1: {
    id: 'genAIPolicyTermsDialog.fourthPartListItem1',
    defaultMessage: `properly assess and verify the accuracy of the results provided`,
    description: 'Content shown in the GenAI Policy Terms dialog',
  },
  fourthPartListItem2: {
    id: 'genAIPolicyTermsDialog.fourthPartListItem2',
    defaultMessage: `verify that the code provided does not infringe any third party rights`,
    description: 'Content shown in the GenAI Policy Terms dialog',
  },
  fourthPartListItem3: {
    id: 'genAIPolicyTermsDialog.fourthPartListItem3',
    defaultMessage: `not to spread viruses, malware or any other technology designed to harm the Arduino AI Assistant, to breach Arduino’s rights or the rights of other users`,
    description: 'Content shown in the GenAI Policy Terms dialog',
  },
  fifthPart: {
    id: 'genAIPolicyTermsDialog.fifthPart',
    defaultMessage: `Moreover, the user undertakes not to upload to the Arduino AI Assistant content (text or graphic or any other type)/prompt/information which:`,
    description: 'Content shown in the GenAI Policy Terms dialog',
  },
  fifthPartListItem1: {
    id: 'genAIPolicyTermsDialog.fifthPartListItem1',
    defaultMessage: `is offensive, vulgar, violent, false, harmful to Arduino’s image or contrary to law, or in breach of third parties’ rights, illegal, misleading, defamatory, slanderous, intimidating, offensive or in any other way contrary to law and public morality;`,
    description: 'Content shown in the GenAI Policy Terms dialog',
  },
  fifthPartListItem2: {
    id: 'genAIPolicyTermsDialog.fifthPartListItem2',
    defaultMessage: `may constitute, encourage, promote or incite unlawful conduct;`,
    description: 'Content shown in the GenAI Policy Terms dialog',
  },
  fifthPartListItem3: {
    id: 'genAIPolicyTermsDialog.fifthPartListItem3',
    defaultMessage: `is in breach of any patent, trademark, trade secret, copyright or any other intellectual or industrial property right, or of any other applicable law;`,
    description: 'Content shown in the GenAI Policy Terms dialog',
  },
  fifthPartListItem4: {
    id: 'genAIPolicyTermsDialog.fifthPartListItem4',
    defaultMessage: `includes without lawful basis private or confidential information of third parties, such as addresses, phone numbers, email addresses or personal data.`,
    description: 'Content shown in the GenAI Policy Terms dialog',
  },
  sixthPart: {
    id: 'genAIPolicyTermsDialog.sixthPart',
    defaultMessage: `By using Arduino AI Assistant, you understand and agree to these terms. For more information please contact Arduino at support@arduino.cc`,
    description: 'Content shown in the GenAI Policy Terms dialog',
  },
});

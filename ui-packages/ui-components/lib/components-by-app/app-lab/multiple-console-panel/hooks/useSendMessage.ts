import {
  Board,
  useI18n,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { messages } from '../messages';

export const useSendMessage = (selectedBoard?: Board): string => {
  const { formatMessage } = useI18n();

  const buildAddress = (selectedBoard?: Board): string => {
    if (!selectedBoard) {
      return '';
    }

    if (selectedBoard.serial) {
      return `usb(${selectedBoard.serial})`;
    }
    if (selectedBoard.address) {
      return `network(${selectedBoard.address})`;
    }
    return 'local device';
  };

  if (!selectedBoard) {
    return formatMessage(messages.sendMessageNoBoardPlaceholder);
  }

  const name = selectedBoard.name;
  const address = buildAddress(selectedBoard);

  return formatMessage(messages.sendMessagePlaceholder, {
    name,
    address,
  });
};

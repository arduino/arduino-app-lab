import { ClipboardService } from './clipboard-service.type';
import * as webClipboard from './clipboardService.web.impl';

export let readText: ClipboardService['readText'] = webClipboard.readText;

export let writeText: ClipboardService['writeText'] = webClipboard.writeText;

export const setClipboardService = (service: ClipboardService): void => {
  readText = service.readText;
  writeText = service.writeText;
};

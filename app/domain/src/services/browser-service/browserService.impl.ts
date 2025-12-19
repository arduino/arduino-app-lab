import { BrowserService } from './browser-service.type';

export let openLinkExternal: (path: string) => void;

export const setBrowserService = (service: BrowserService): void => {
  openLinkExternal = service.openLinkExternal;
};

import { WailsService } from './wails-service.type';

export let eventsOn: WailsService['eventsOn'] = function () {
  throw new Error('eventOn service not implemented');
};

export let eventsOff: WailsService['eventsOff'] = function () {
  throw new Error('eventOn service not implemented');
};

export let eventsEmit: WailsService['eventsEmit'] = function () {
  throw new Error('eventOn service not implemented');
};

export let reloadApp: WailsService['reloadApp'] = function () {
  throw new Error('reloadApp method not implemented');
};

export const setWailsService = (service: WailsService): void => {
  eventsOn = service.eventsOn;
  eventsOff = service.eventsOff;
  eventsEmit = service.eventsEmit;
  reloadApp = service.reloadApp;
};

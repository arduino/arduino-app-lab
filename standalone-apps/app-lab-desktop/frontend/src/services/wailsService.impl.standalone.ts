import { WailsService } from '@cloud-editor-mono/domain/src/services/wails-service';

import {
  EventsEmit,
  EventsOff,
  EventsOn,
  WindowReloadApp,
} from '../../wailsjs/runtime/runtime';

export const eventsOn: WailsService['eventsOn'] = EventsOn;
export const eventsOff: WailsService['eventsOff'] = EventsOff;
export const eventsEmit: WailsService['eventsEmit'] = EventsEmit;

export const reloadApp: WailsService['reloadApp'] = WindowReloadApp;

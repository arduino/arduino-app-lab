export interface WailsService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventsOn: (eventName: string, callback: (...data: any) => void) => () => void;
  eventsOff: (eventName: string, ...additionalEventNames: string[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventsEmit: (eventName: string, ...data: any) => void;
  reloadApp: () => void;
}

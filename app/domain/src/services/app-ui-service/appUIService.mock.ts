import { AppUIService, ForwardPort } from './app-ui-service.type';

export const MockAppUIService: AppUIService = {
  findPorts: async (appId: string): Promise<ForwardPort[]> => {
    console.info('[MockAppUIService] findPorts called', { appId });
    return [
      {
        port: 3000,
        type: 'webview',
      },
    ];
  },

  openUIWhenReady: async (port: number): Promise<void> => {
    console.info('[MockAppUIService] openUIWhenReady called', { port });
    if (typeof window !== 'undefined') {
      const url = `http://localhost:${port}`;
      try {
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch {
        // something
      }
    }
  },

  forwardNonUIPort: async (port: number): Promise<void> => {
    console.info('[MockAppUIService] forwardNonUIPort called', { port });
    return;
  },

  onAgentStartedApp: () => () => undefined,
};

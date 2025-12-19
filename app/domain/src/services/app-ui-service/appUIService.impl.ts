import { AppUIService } from './app-ui-service.type';

export let findUIPort: AppUIService['findUIPort'] = async function () {
  throw new Error('findUIPort not implemented');
};

export let openUIWhenReady: AppUIService['openUIWhenReady'] =
  async function () {
    throw new Error('openUIWhenReady not implemented');
  };

export const setAppUIService = (service: AppUIService): void => {
  findUIPort = service.findUIPort;
  openUIWhenReady = service.openUIWhenReady;
};

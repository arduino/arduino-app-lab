import { LearnService } from './learn-service.type';

export let getLearnList: LearnService['getLearnList'] = async function () {
  throw new Error('getLearnList service not implemented');
};

export let getLearnResource: LearnService['getLearnResource'] =
  async function () {
    throw new Error('getLearnResource service not implemented');
  };

export let getLearnTags: LearnService['getLearnTags'] = async function () {
  throw new Error('getLearnTags service not implemented');
};

export const setLearnService = (service: LearnService): void => {
  getLearnList = service.getLearnList;
  getLearnResource = service.getLearnResource;
  getLearnTags = service.getLearnTags;
};

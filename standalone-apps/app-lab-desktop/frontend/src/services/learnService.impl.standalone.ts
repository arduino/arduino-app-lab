import { LearnService } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  LearnListItem,
  LearnResource,
} from '@cloud-editor-mono/ui-components/lib/app-lab-learn';

import {
  GetLearnResource,
  GetLearnResourceList,
  GetTags,
} from '../../wailsjs/go/app/App';

export const getLearnList: LearnService['getLearnList'] = async function () {
  const learnList = await GetLearnResourceList();
  return learnList.map((item) => ({
    ...item,
    icon: item.icon as LearnListItem['icon'],
    category: item.category as LearnListItem['category'],
    lastRevision: new Date(item.lastRevision),
  }));
};

export const getLearnResource: LearnService['getLearnResource'] =
  async function (resourceId: string) {
    const learnResource = await GetLearnResource(resourceId);
    return {
      ...learnResource,
      icon: learnResource.icon as LearnResource['icon'],
      lastRevision: new Date(learnResource.lastRevision),
    };
  };

export const getLearnTags: LearnService['getLearnTags'] = async function () {
  const tags = await GetTags();
  return tags;
};

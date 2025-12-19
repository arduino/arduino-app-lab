import {
  getLearnList,
  getLearnTags,
} from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import {
  LearnListItemWithColors,
  LearnTagColor,
  LearnTagPill,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useQueries } from '@tanstack/react-query';

import { UseLearnListLogic } from './learnList.type';

const PILLS_COLORS = [
  [193, 171, 21],
  [17, 138, 178],
  [42, 198, 43],
  [188, 56, 235],
  [224, 90, 0],
  [235, 71, 126],
  [37, 194, 199],
];

export const useLearnListLogic = function (): UseLearnListLogic {
  const tagsColor: Record<string, LearnTagColor> = {};
  const [learnList, tags] = useQueries({
    queries: [
      {
        queryKey: ['list-learn-items'],
        queryFn: () => getLearnList(),
        refetchOnWindowFocus: false,
      },
      {
        queryKey: ['list-learn-tags'],
        queryFn: () => getLearnTags(),
        refetchOnWindowFocus: false,
      },
    ],
  });

  if (tags.data && tags.data.length > 0) {
    tags.data.forEach((tag, index) => {
      const color = PILLS_COLORS[index % PILLS_COLORS.length];
      tagsColor[tag.id] = {
        color: `rgba(${color[0]}, ${color[1]}, ${color[2]}, 1)`,
        bgColor: `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.2)`,
      };
    });
  }

  // enrich tags with colors
  const taggedLearnList: LearnListItemWithColors[] =
    learnList.data?.map((item) => ({
      ...item,
      tags: item.tags.map((tag) => ({
        ...tag,
        ...tagsColor[tag.id],
      })),
    })) || [];

  const tagsWithColors: LearnTagPill[] =
    tags.data?.map((tag) => ({
      ...tag,
      ...tagsColor[tag.id],
    })) || [];

  return {
    learnList: taggedLearnList || [],
    isLoading: learnList.isLoading,
    tags: tagsWithColors || [],
    tagsColor,
  };
};

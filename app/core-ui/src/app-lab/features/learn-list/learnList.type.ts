import {
  LearnListItemWithColors,
  LearnTag,
  LearnTagColor,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export interface UseLearnListLogic {
  learnList: LearnListItemWithColors[];
  tags: LearnTag[];
  isLoading: boolean;
  tagsColor: Record<string, LearnTagColor>;
}

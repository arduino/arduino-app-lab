import {
  LearnListItem,
  LearnResource,
  LearnTag,
} from '@cloud-editor-mono/ui-components/lib/app-lab-learn';

export interface LearnService {
  getLearnList(): Promise<LearnListItem[]>;
  getLearnResource(resourceId: string): Promise<LearnResource>;
  getLearnTags(): Promise<LearnTag[]>;
}

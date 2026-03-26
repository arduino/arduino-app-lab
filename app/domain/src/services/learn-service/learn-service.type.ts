import {
  LearnListItem,
  LearnResource,
  LearnTag,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export interface LearnService {
  getLearnList(): Promise<LearnListItem[]>;
  getLearnResource(resourceId: string): Promise<LearnResource>;
  getLearnTags(): Promise<LearnTag[]>;
}

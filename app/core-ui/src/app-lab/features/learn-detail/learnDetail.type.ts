import { LearnResource } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export interface UseLearnDetailLogic {
  resource?: LearnResource;
  isLoading: boolean;
  contentRef: React.RefObject<HTMLDivElement>;
  goBack: () => void;
  openExternalLink: (url: string) => void;
  openInternalLink: (url: string) => void;
}

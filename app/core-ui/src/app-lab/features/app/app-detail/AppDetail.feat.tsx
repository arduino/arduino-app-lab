import {
  AppLabAppDetail,
  AppsSection,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { memo } from 'react';

import { useAppDetailLogic } from './appDetail.logic';

interface AppDetailProps {
  appId: string;
  section: AppsSection;
  breadcrumbId?: string;
}

const AppDetailFeat: React.FC<AppDetailProps> = (props: AppDetailProps) => {
  const { appId, section, breadcrumbId } = props;

  return (
    <AppLabAppDetail
      appId={appId}
      section={section}
      breadcrumbId={breadcrumbId}
      appLabAppDetailLogic={useAppDetailLogic}
    />
  );
};

export default memo(AppDetailFeat);

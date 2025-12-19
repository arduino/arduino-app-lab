import { AppLabFooterBar } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

import { useFooterBarLogic } from './footerBar.logic';

const FooterBar: React.FC = () => {
  return <AppLabFooterBar footerBarLogic={useFooterBarLogic} />;
};

export default FooterBar;

import { AppLabFooterBar } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useCallback } from 'react';

import { UseBoards } from '../../hooks/useBoards';
import { createUseFooterBarLogic } from './footerBar.logic';

interface FooterBarProps {
  boardsProps: ReturnType<UseBoards>;
}

const FooterBar: React.FC<FooterBarProps> = ({
  boardsProps,
}: FooterBarProps) => {
  const footerBarLogic = useCallback(
    () => createUseFooterBarLogic(boardsProps)(),
    [boardsProps],
  );
  return <AppLabFooterBar footerBarLogic={footerBarLogic} />;
};

export default FooterBar;

import { Flasher } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useMemo } from 'react';

import { createFlasherLogic } from './flasher.logic';

interface FlasherFeatProps {
  selectBoard: (boardId: string) => Promise<void>;
}

export const FlasherFeat: React.FC<FlasherFeatProps> = ({
  selectBoard,
}: FlasherFeatProps) => {
  const flasherLogic = useMemo(
    () => createFlasherLogic(selectBoard),
    [selectBoard],
  );
  return <Flasher flasherLogic={flasherLogic} />;
};

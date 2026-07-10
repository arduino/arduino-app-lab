import {
  BrickDetail,
  BrickListItem,
  BricksList,
  TopBar,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useSearch } from '@tanstack/react-router';
import clsx from 'clsx';

import styles from './brick-list.module.scss';
import { useBrickListLogic } from './brickList.logic';

const BrickList: React.FC = () => {
  const { brickId, tab } = useSearch({ from: '/bricks' });

  const {
    bricks,
    isLoading: bricksLoading,
    selectedBrick,
    brickDetailLogic,
    setSelectedBrick,
    selectedTab,
    setSelectedTab,
  } = useBrickListLogic({ brickId, tab });

  return (
    <section className={styles['main']}>
      <TopBar pathItems={['Bricks']} />
      <div className={styles['container']}>
        {/* Loading state */}
        {bricksLoading ? <BrickListItem variant="skeleton" /> : null}
        {!bricksLoading && selectedBrick && (
          <div className={styles['split']}>
            <div className={(styles['split-item'], styles['split-item-left'])}>
              <BricksList
                bricks={bricks}
                selectedBrick={selectedBrick}
                onClick={setSelectedBrick}
              />
            </div>

            <div
              className={clsx(styles['split-item'], styles['split-item-right'])}
            >
              <BrickDetail
                brickId={selectedBrick?.id ?? ''}
                brickDetailLogic={brickDetailLogic}
                selectedTab={selectedTab}
                onSelectedTabChange={setSelectedTab}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default BrickList;

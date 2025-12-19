import {
  AppLabBrickDetail,
  AppLabBrickListItem,
  AppLabBricksList,
  AppLabTopBar,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import clsx from 'clsx';

import styles from './brick-list.module.scss';
import { useBrickListLogic } from './brickList.logic';

const BrickList: React.FC = () => {
  const {
    bricks,
    isLoading: bricksLoading,
    selectedBrick,
    brickDetailLogic,
    setSelectedBrick,
  } = useBrickListLogic();

  return (
    <section className={styles['main']}>
      <AppLabTopBar pathItems={['Bricks']} />
      <div className={styles['container']}>
        {/* Loading state */}
        {bricksLoading ? <AppLabBrickListItem variant="skeleton" /> : null}
        {!bricksLoading && selectedBrick && (
          <div className={styles['split']}>
            <div className={(styles['split-item'], styles['split-item-left'])}>
              <AppLabBricksList
                bricks={bricks}
                selectedBrick={selectedBrick}
                onClick={setSelectedBrick}
              />
            </div>

            <div
              className={clsx(styles['split-item'], styles['split-item-right'])}
            >
              <AppLabBrickDetail
                brickId={selectedBrick?.id ?? ''}
                brickDetailLogic={brickDetailLogic}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default BrickList;

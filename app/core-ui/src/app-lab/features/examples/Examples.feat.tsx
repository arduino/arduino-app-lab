import {
  AppLabExamples,
  TopBar,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useCallback } from 'react';

import { createUseExamplesLogic } from './examples.logic';
import styles from './examples.module.scss';

const Examples: React.FC = () => {
  const examplesLogic = useCallback(() => createUseExamplesLogic()(), []);

  return (
    <section className={styles['main']}>
      <div className={styles['header']}>
        <TopBar pathItems={['examples']} />
      </div>
      <div className={styles['body']}>
        <div className={styles['content']}>
          <AppLabExamples examplesLogic={examplesLogic} />
        </div>
      </div>
    </section>
  );
};
export default Examples;

import { useState } from 'react';

import { Details } from '../essential/details';
import { XXSmall } from '../typography';
import styles from './details-wrapper.module.scss';

interface DetailsWrapperPros {
  children: React.ReactNode;
  summaryNode: React.ReactNode;
  introduction?: string;
}

const DetailsWrapper: React.FC<DetailsWrapperPros> = (
  props: DetailsWrapperPros,
) => {
  const { summaryNode, introduction, children } = props;

  const [isDetailsExpanded, setIsDetailsExpanded] = useState(true);

  const toggleDetailsExpanded = (): void => {
    setIsDetailsExpanded((prev) => !prev);
  };

  return (
    <div className={styles['foldable-node']}>
      <XXSmall>{introduction}</XXSmall>
      <div className={styles['details-wrapper']}>
        <Details
          isOpen={isDetailsExpanded}
          onToggle={toggleDetailsExpanded}
          summaryNode={summaryNode}
          classes={{
            chevron: styles['details-chevron'],
            summary: styles['details-summary'],
          }}
        >
          {children}
        </Details>
      </div>
    </div>
  );
};

export default DetailsWrapper;

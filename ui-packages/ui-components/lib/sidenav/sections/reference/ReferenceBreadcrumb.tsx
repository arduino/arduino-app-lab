import { ArrowSquaredLeft } from '@cloud-editor-mono/images/assets/icons';

import styles from './reference.module.scss';
import { CategoryTree, ReferencePath } from './reference.type';

type ReferenceBreadcrumbProps = {
  categoryTree: CategoryTree;
  referencePath: ReferencePath;
  onCategorySelect: () => void;
};

export const ReferenceBreadcrumb: React.FC<ReferenceBreadcrumbProps> = ({
  categoryTree,
  referencePath,
  onCategorySelect,
}: ReferenceBreadcrumbProps) => {
  if (!referencePath.itemPath) {
    return null;
  }

  const { category, itemPath } = referencePath;
  const subcategory = categoryTree[category].get(itemPath[0]);

  return (
    <div className={styles['reference-breadcrumb']}>
      <button onClick={onCategorySelect}>{category}</button>
      <ArrowSquaredLeft style={{ width: '22px' }} />
      {subcategory?.label}
    </div>
  );
};

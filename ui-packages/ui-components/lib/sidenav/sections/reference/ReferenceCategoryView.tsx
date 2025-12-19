import { useI18n } from '../../../i18n/useI18n';
import { referenceCategoryMessages } from './messages';
import styles from './reference.module.scss';
import { CategoryTree, ReferencePath } from './reference.type';
import { referencePathFromString } from './utils';

type ReferenceCategoryView = {
  categoryTree: CategoryTree;
  referencePath: ReferencePath;
  onPathChange: (path: ReferencePath) => void;
};

export const ReferenceCategoryView: React.FC<ReferenceCategoryView> = ({
  referencePath,
  categoryTree,
  onPathChange,
}: ReferenceCategoryView) => {
  const { formatMessage } = useI18n();

  const handleLinkSelect = (href: string): void => {
    // On categories page, href contains full url
    const pathPrefix = '/language-reference/en/';
    const pathSuffix = '/raw';
    const path = href.replace(pathPrefix, '').replace(pathSuffix, '');
    onPathChange(referencePathFromString(path));
  };

  return (
    <div className={styles['reference-category-view']}>
      <p className={styles['reference-category-view-description']}>
        {formatMessage(referenceCategoryMessages[referencePath.category])}
      </p>
      {[...categoryTree[referencePath.category].entries()].map(
        ([key, subcategory]) => (
          <div key={key}>
            <h4>{subcategory.label}</h4>
            <ul>
              {[...subcategory.entries.entries()].map(([_, item]) => (
                <li key={item.href}>
                  <button onClick={(): void => handleLinkSelect(item.href)}>
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ),
      )}
    </div>
  );
};

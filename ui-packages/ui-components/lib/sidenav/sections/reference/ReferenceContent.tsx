import { useContext } from 'react';

import { ReferenceContext } from './context/ReferenceContext';
import { ReferencePath } from './reference.type';
import { ReferenceBreadcrumb } from './ReferenceBreadcrumb';
import { ReferenceCategoryView } from './ReferenceCategoryView';
import ReferenceRenderer from './ReferenceRenderer';
import { ReferenceSkeleton } from './ReferenceSkeleton';

type ReferenceContentProps = {
  referencePath: ReferencePath;
  onPathChange: (path: ReferencePath) => void;
};

export const ReferenceContent: React.FC<ReferenceContentProps> = ({
  referencePath,
  onPathChange,
}: ReferenceContentProps) => {
  const { getReferenceCategories, getReferenceItem } =
    useContext(ReferenceContext);

  const {
    categoryTree,
    allEntries,
    isLoading: isLoadingCategories,
  } = getReferenceCategories();
  const { referenceItem, isLoading: isLoadingItem } = getReferenceItem(
    { path: referencePath },
    !!referencePath.itemPath,
  );

  return (
    <>
      {!referencePath.itemPath && (
        <>
          {isLoadingCategories && <ReferenceSkeleton />}
          {categoryTree && (
            <ReferenceCategoryView
              categoryTree={categoryTree}
              referencePath={referencePath}
              onPathChange={onPathChange}
            />
          )}
        </>
      )}
      {referencePath.itemPath && (
        <>
          {isLoadingItem && <ReferenceSkeleton />}
          {referenceItem && categoryTree && allEntries && (
            <>
              <ReferenceBreadcrumb
                referencePath={referencePath}
                categoryTree={categoryTree}
                onCategorySelect={(): void =>
                  onPathChange({
                    category: referencePath.category,
                    itemPath: null,
                  })
                }
              ></ReferenceBreadcrumb>
              <ReferenceRenderer
                entries={allEntries}
                referencePath={referencePath}
                onPathChange={onPathChange}
                template={referenceItem.template}
              ></ReferenceRenderer>
            </>
          )}
        </>
      )}
    </>
  );
};

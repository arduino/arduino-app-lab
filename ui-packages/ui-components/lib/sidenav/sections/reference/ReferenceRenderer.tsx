import parse, { domToReact, Element } from 'html-react-parser';
import { memo, useMemo } from 'react';

import { ReferenceEntry, ReferencePath } from './reference.type';
import styles from './reference-renderer.module.scss';
import {
  calculateAbsolutePath,
  referencePathFromString,
  referencePathToString,
} from './utils';

interface ReferenceRendererProps {
  template: string | null;
  referencePath: ReferencePath;
  entries: Map<string, ReferenceEntry>;
  onPathChange: (path: ReferencePath) => void;
}

const ReferenceRenderer: React.FC<ReferenceRendererProps> = ({
  template,
  referencePath,
  entries,
  onPathChange,
}: ReferenceRendererProps) => {
  const handleLinkSelect = (href: string): void => {
    const referencePathStr = referencePathToString(referencePath);
    const path = calculateAbsolutePath(referencePathStr, href);
    onPathChange(referencePathFromString(path));
  };

  const itemLabel = useMemo(() => {
    if (referencePath.itemPath) {
      return entries.get(
        [referencePath.category, ...referencePath.itemPath].join('/'),
      )?.label;
    }
  }, [entries, referencePath.category, referencePath.itemPath]);

  const jsx = parse(template || '', {
    replace: (domNode) => {
      if (!(domNode instanceof Element)) {
        return domNode;
      }

      if (domNode.tagName === 'a') {
        const href = domNode.attribs['href'];

        // Replace all links to handle navigation internally
        return (
          <button onClick={(): void => handleLinkSelect(href)}>
            {domToReact(domNode.children)}
          </button>
        );
      }

      if (domNode.attribs.class) {
        // Add prefix to reference class names to avoid global rules
        domNode.attribs.class = domNode.attribs.class
          .split(' ')
          .map((c) => 'ar-' + c)
          .join(' ');
      }

      return domNode;
    },
  });

  return (
    <div className={styles['renderer']}>
      <h1>{itemLabel}</h1>
      {jsx}
    </div>
  );
};

export default memo(ReferenceRenderer);

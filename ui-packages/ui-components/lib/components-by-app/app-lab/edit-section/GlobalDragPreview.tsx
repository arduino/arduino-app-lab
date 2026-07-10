import type { TreeNode } from '../../../file-tree';
import styles from './app-lab-edit-section.module.scss';

interface GlobalDragPreviewProps {
  nodes: TreeNode[];
  x: number;
  y: number;
  renderIcon?: (node: TreeNode) => React.ReactNode;
}

const MAX_CHIPS = 10;

export const GlobalDragPreview = ({
  nodes,
  x,
  y,
  renderIcon,
}: GlobalDragPreviewProps): JSX.Element => {
  const visibleNodes = nodes.slice(0, MAX_CHIPS);
  const remainingCount = nodes.length - MAX_CHIPS;
  const isMultiple = nodes.length > 1;

  return (
    <div className={styles['drag-preview']}>
      {isMultiple ? (
        <div
          style={{
            transform: `translate(${x}px, ${y}px)`,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {visibleNodes.map((node) => (
            <div
              key={node.path}
              className={styles['drag-preview-chip']}
              style={{
                width: 'fit-content',
                maxWidth: '200px',
              }}
            >
              <span className={styles['drag-preview-icon']}>
                {renderIcon ? renderIcon(node) : '📄'}
              </span>
              <span>{node.name}</span>
            </div>
          ))}
          {remainingCount > 0 && (
            <div
              className={styles['drag-preview-chip']}
              style={{
                width: 'fit-content',
              }}
            >
              <span>+{remainingCount} more</span>
            </div>
          )}
        </div>
      ) : (
        <div
          className={styles['drag-preview-chip']}
          style={{
            transform: `translate(${x}px, ${y}px)`,
          }}
        >
          <span className={styles['drag-preview-icon']}>
            {renderIcon && nodes[0] ? renderIcon(nodes[0]) : '📄'}
          </span>
          <span>{nodes[0]?.name || ''}</span>
        </div>
      )}
    </div>
  );
};

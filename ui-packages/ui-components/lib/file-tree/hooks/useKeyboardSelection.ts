import { useCallback } from 'react';
import { NodeApi } from 'react-arborist';

interface UseKeyboardSelectionProps {
  node: NodeApi;
  lastSelectedNodeId?: string;
  onLastSelectedNodeChange?: (nodeId: string) => void;
  multiSelectedIds?: Set<string>;
  onMultiSelectedIdsChange?: (ids: Set<string>) => void;
}

export const useKeyboardSelection = ({
  node,
  lastSelectedNodeId,
  onLastSelectedNodeChange,
  multiSelectedIds,
  onMultiSelectedIdsChange,
}: UseKeyboardSelectionProps) => {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const isShift = e.shiftKey;

      if (isShift && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        e.stopPropagation();

        if (!multiSelectedIds || !onMultiSelectedIdsChange) {
          return;
        }

        const treeApi = node.tree;
        const allNodes = treeApi.visibleNodes;
        const currentNodeIndex = allNodes.findIndex((n) => n.id === node.id);

        if (currentNodeIndex === -1) {
          return;
        }

        let targetIndex: number;
        if (e.key === 'ArrowUp') {
          targetIndex = currentNodeIndex - 1;
        } else {
          targetIndex = currentNodeIndex + 1;
        }

        // Check bounds
        if (targetIndex < 0 || targetIndex >= allNodes.length) {
          return;
        }

        const targetNode = allNodes[targetIndex];

        // Select range from last selected to target
        const newSelectedIds = new Set<string>();

        if (lastSelectedNodeId) {
          const lastNodeIndex = allNodes.findIndex(
            (n) => n.id === lastSelectedNodeId,
          );

          if (lastNodeIndex !== -1) {
            const startIndex = Math.min(lastNodeIndex, targetIndex);
            const endIndex = Math.max(lastNodeIndex, targetIndex);

            for (let i = startIndex; i <= endIndex; i++) {
              newSelectedIds.add(allNodes[i].id);
            }
          }
        } else {
          // If no last selected node, select from current to target
          const startIndex = Math.min(currentNodeIndex, targetIndex);
          const endIndex = Math.max(currentNodeIndex, targetIndex);

          for (let i = startIndex; i <= endIndex; i++) {
            newSelectedIds.add(allNodes[i].id);
          }
        }

        onMultiSelectedIdsChange(newSelectedIds);

        if (onLastSelectedNodeChange) {
          onLastSelectedNodeChange(targetNode.id);
        }

        // Focus the target node
        targetNode.focus();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        // Normal arrow navigation - clear multi-selection
        if (
          multiSelectedIds &&
          multiSelectedIds.size > 0 &&
          onMultiSelectedIdsChange
        ) {
          onMultiSelectedIdsChange(new Set());
        }
      }
    },
    [
      node,
      lastSelectedNodeId,
      onLastSelectedNodeChange,
      multiSelectedIds,
      onMultiSelectedIdsChange,
    ],
  );

  return { handleKeyDown };
};

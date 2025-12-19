import {
  isFolderNode,
  TreeNode,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export const checkIfHasPython = (node: TreeNode): boolean => {
  if (isFolderNode(node)) {
    if (node.name === 'python') {
      return node.children.some(
        (child) => child.type === 'file' && child.name === 'main.py',
      );
    }
    return node.children.some(checkIfHasPython);
  }
  return false;
};

export const checkIfHasIno = (node: TreeNode): boolean => {
  if (isFolderNode(node)) {
    if (node.name === 'sketch') {
      return node.children.some(
        (child) => child.type === 'file' && child.name === 'sketch.ino',
      );
    }
    return node.children.some(checkIfHasIno);
  }
  return false;
};

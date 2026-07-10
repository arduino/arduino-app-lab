import { useCallback } from 'react';

import { Tabs } from '../../components-by-app/app-lab';

interface MarkdownEditorToolbarProps {
  isRendered: boolean;
  onToggleRender?: (rendered: boolean) => void;
  readOnly?: boolean;
}

const tabs = ['Write', 'Preview'] as const;

const MarkdownEditorToolbar: React.FC<MarkdownEditorToolbarProps> = (
  props: MarkdownEditorToolbarProps,
) => {
  const { isRendered, onToggleRender, readOnly } = props;
  // Controlled: derive directly from props so per-file mode changes
  // (eg. switching tabs in a pane) keep the toolbar in sync.
  const activeTab: typeof tabs[number] = isRendered ? 'Preview' : 'Write';

  const setTab = useCallback(
    (tab: typeof tabs[number]): void => {
      onToggleRender?.(tab === 'Preview');
    },
    [onToggleRender],
  );

  const tabsLogic = useCallback(
    () => ({
      tabs,
      setTab,
      activeTab,
    }),
    [activeTab, setTab],
  );

  return <div>{!readOnly && <Tabs tabsLogic={tabsLogic} />}</div>;
};

export default MarkdownEditorToolbar;

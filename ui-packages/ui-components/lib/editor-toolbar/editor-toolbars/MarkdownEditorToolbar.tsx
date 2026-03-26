import { useCallback, useState } from 'react';

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
  const [activeTab, setTab] = useState<typeof tabs[number]>(
    isRendered ? 'Preview' : 'Write',
  );

  const setTabAndToggleRender = useCallback(
    (tab: typeof tabs[number]): void => {
      setTab(tab);
      onToggleRender?.(tab === 'Preview');
    },
    [onToggleRender],
  );

  const tabsLogic = useCallback(
    () => ({
      tabs,
      setTab: setTabAndToggleRender,
      activeTab,
    }),
    [activeTab, setTabAndToggleRender],
  );

  return <div>{!readOnly && <Tabs tabsLogic={tabsLogic} />}</div>;
};

export default MarkdownEditorToolbar;

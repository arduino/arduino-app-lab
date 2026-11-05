import { UseCodeEditorParams } from '@cloud-editor-mono/ide-workbench/lib/code-mirror/codeMirror.type';
import { useCodeMirrorInstanceCleanup } from '@cloud-editor-mono/ide-workbench/lib/code-mirror/codeMirrorViewInstances';
import clsx from 'clsx';

import { useConsole } from '../hooks/useConsole';

type ConsoleElementProps = UseCodeEditorParams & {
  classes?: { container: string };
};

const ConsoleElement: React.FC<ConsoleElementProps> = (
  props: ConsoleElementProps,
) => {
  const { classes, ...useCodeEditorParams } = props;
  const ref = useConsole(useCodeEditorParams);
  useCodeMirrorInstanceCleanup(useCodeEditorParams.viewInstanceId);

  return <div className={clsx(classes?.container)} ref={ref} />;
};

export default ConsoleElement;

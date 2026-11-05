import { createUseCodeMirrorHook } from '@cloud-editor-mono/ide-workbench/lib/code-mirror/createUseCodeMirrorHook';

import { consoleSetup } from '../codeMirrorConsoleSetup';

export const useConsole = createUseCodeMirrorHook(consoleSetup);

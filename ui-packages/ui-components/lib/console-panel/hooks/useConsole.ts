import { createUseCodeMirrorHook } from '../../code-mirror/createUseCodeMirrorHook';
import { consoleSetup } from '../codeMirrorConsoleSetup';

export const useConsole = createUseCodeMirrorHook(consoleSetup);

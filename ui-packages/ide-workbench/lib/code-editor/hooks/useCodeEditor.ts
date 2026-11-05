import { createUseCodeMirrorHook } from '../../code-mirror/createUseCodeMirrorHook';
import { setup } from '../setup/codeMirrorSetup';

export const useCodeEditor = createUseCodeMirrorHook(setup);

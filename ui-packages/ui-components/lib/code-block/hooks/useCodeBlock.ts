import { codeBlockSetup } from '../codeMirrorCodeBlockSetup';
import { createUseCodeBlockHook } from './createUseCodeBlockHook';

export const useCodeBlock = createUseCodeBlockHook(codeBlockSetup);

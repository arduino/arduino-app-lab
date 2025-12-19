import { codeDiffBlockSetup } from '../codeMirrorCodeDiffBlockSetup';
import { createUseCodeDiffBlockHook } from './createUseCodeDiffBlockHook';

export const useCodeDiffBlock = createUseCodeDiffBlockHook(codeDiffBlockSetup);

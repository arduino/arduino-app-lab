import {
  RbacCapability,
  RbacValue,
} from '@cloud-editor-mono/ui-components/lib/rbac/rbac.type';
import { createContext } from 'react';

// Without a provider nothing is granted.
const rbacContextValue = Object.fromEntries(
  Object.values(RbacCapability).map((capability) => [capability, false]),
) as RbacValue;

export const RbacContext = createContext<RbacValue>(rbacContextValue);

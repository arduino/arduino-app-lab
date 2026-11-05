import { RbacCapability, RbacValue } from './rbac.type';

interface RbacProps {
  permissions: RbacCapability[];
  rbac?: RbacValue;
  children?: React.ReactNode;
}

// Apps without roles, like App Lab, pass no rbac: nothing is restricted.
export function hasPermissions(
  permissions: RbacCapability[],
  rbac?: RbacValue,
): boolean {
  return !rbac || permissions.every((permission) => rbac[permission]);
}

export const Rbac: React.FC<RbacProps> = ({
  permissions,
  rbac,
  children,
}: RbacProps) => (hasPermissions(permissions, rbac) ? <>{children}</> : null);

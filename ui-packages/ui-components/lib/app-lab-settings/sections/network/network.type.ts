import { DropdownMenuSectionType } from '../../../essential/dropdown-menu';
import { SecurityProtocols } from '../../settings.type';

export type SecurityProtocolSection = DropdownMenuSectionType<
  SecurityProtocols,
  string
>;

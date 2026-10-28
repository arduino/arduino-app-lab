import { TerminalInfo } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';

export type { TerminalInfo };

export type TerminalCatalog = {
  // supported is false on the platforms where the terminal emulators are not
  // detected from the system, in that case the user cannot pick one.
  supported: boolean;
  // terminals are the known terminal emulators, in the order they are tried.
  // The ones that are not installed are reported with available set to false.
  terminals: TerminalInfo[];
};

export interface TerminalService {
  // listTerminals returns the terminal emulators available on the system.
  listTerminals(): Promise<TerminalCatalog>;
  // getTerminalPreference returns the terminal selected by the user, an empty
  // value means that the terminal is detected automatically.
  getTerminalPreference(): Promise<string>;
  // setTerminalPreference persists the terminal selected by the user, an empty
  // value restores the automatic detection.
  setTerminalPreference(value: string): Promise<void>;
}

export interface FileOpenerService {
  openFileExternal: (path: string) => Promise<void>;
}

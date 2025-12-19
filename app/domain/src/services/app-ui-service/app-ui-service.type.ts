export interface AppUIService {
  findUIPort: (appId: string) => Promise<number>;
  openUIWhenReady: (port: number) => Promise<void>;
}

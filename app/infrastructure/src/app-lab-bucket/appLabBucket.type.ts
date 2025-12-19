interface MandatoryUpdate {
  pkgName: string;
  version: string;
}

export type MandatoryUpdateList = MandatoryUpdate[];

export interface MandatoryUpdateJson {
  packages: MandatoryUpdateList;
}

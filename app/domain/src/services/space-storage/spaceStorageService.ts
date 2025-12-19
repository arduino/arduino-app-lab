import { SpaceStorage } from '@bcmi-labs/cloud-sidebar';
import { Config } from '@cloud-editor-mono/common';
import { deploymentPath } from '@cloud-editor-mono/infrastructure';

let spaceStorageInstance: SpaceStorage | null = null;

export function getSpaceStorageInstance(): SpaceStorage {
  if (!spaceStorageInstance) {
    spaceStorageInstance = new SpaceStorage(
      Config.COOKIES_DOMAIN,
      deploymentPath.customKey
        ? `${deploymentPath.customKey}-arduino`
        : undefined,
    );
  }
  return spaceStorageInstance;
}

export function getSpace(): string | undefined {
  let space: string | undefined = undefined;

  space = getSpaceStorageInstance().getSpace();

  if (space === 'my-cloud') {
    space = undefined;
  }

  return space;
}

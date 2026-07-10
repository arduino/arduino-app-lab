import { OSImageRelease } from '@cloud-editor-mono/infrastructure';

import { flasher } from '../../wailsjs/go/models';

function mapImage(image: flasher.OSImageRelease): OSImageRelease {
  return {
    id: image.ID,
    latest: image.Latest,
    version_label: image.VersionLabel,
  };
}

export function mapListAvailableOSImages(
  images: flasher.OSImageRelease[],
): OSImageRelease[] {
  return images.map(mapImage);
}

export function mapOSImageRelease(
  image: OSImageRelease,
): flasher.OSImageRelease {
  return {
    ID: image.id || '',
    Latest: image.latest || false,
    VersionLabel: image.version_label || '',
  };
}

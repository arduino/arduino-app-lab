import { BOARD_FQBN } from '@cloud-editor-mono/common';
import { PROJECT_HUB_BOARD_SKU } from '@cloud-editor-mono/infrastructure';
import { describe, expect, it } from 'vitest';

import { projectHubBoardSku } from './publishContextProvider.logic';

const GiB = 1024 ** 3;

describe('projectHubBoardSku', () => {
  it('tags an UNO Q with 2 GB of RAM as the 2 GB SKU', () => {
    expect(projectHubBoardSku(BOARD_FQBN.UNO_Q, 2 * GiB)).toBe(
      PROJECT_HUB_BOARD_SKU.UNO_Q_2GB,
    );
  });

  it('tags an UNO Q with 4 GB of RAM as the 4 GB SKU', () => {
    expect(projectHubBoardSku(BOARD_FQBN.UNO_Q, 4 * GiB)).toBe(
      PROJECT_HUB_BOARD_SKU.UNO_Q_4GB,
    );
  });

  it('tags a VENTUNO Q as the VENTUNO Q SKU', () => {
    expect(projectHubBoardSku(BOARD_FQBN.VENTUNO_Q, 16 * GiB)).toBe(
      PROJECT_HUB_BOARD_SKU.VENTUNO_Q,
    );
  });

  it('tags a VENTUNO Q as the VENTUNO Q SKU with no RAM data', () => {
    expect(projectHubBoardSku(BOARD_FQBN.VENTUNO_Q)).toBe(
      PROJECT_HUB_BOARD_SKU.VENTUNO_Q,
    );
  });

  it('sends no SKU for an UNO Q with no RAM data', () => {
    expect(projectHubBoardSku(BOARD_FQBN.UNO_Q)).toBeUndefined();
  });
});

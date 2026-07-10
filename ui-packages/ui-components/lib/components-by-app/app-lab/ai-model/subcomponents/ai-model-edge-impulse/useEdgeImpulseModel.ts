import {
  BrickDetailModel,
  BrickDetailModelImpulse,
} from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { useEffect, useMemo, useState } from 'react';

export interface EdgeImpulseModelState {
  /** All impulses for the model (empty array for non-EI models). */
  impulses: BrickDetailModelImpulse[];
  selectedImpulseId: string | undefined;
  setSelectedImpulseId: (impulseId: string | undefined) => void;
  /** Impulse matching `selectedImpulseId`, if any. */
  selectedImpulse: BrickDetailModelImpulse | undefined;
  /** Impulse whose installed model is the one currently in use, if any. */
  impulseInUse: BrickDetailModelImpulse | undefined;
}

/**
 * Encapsulates the Edge Impulse impulse selection state: derives the available
 * impulses, tracks the selected one and keeps it initialized to the in-use /
 * installed / first impulse.
 */
export function useEdgeImpulseModel(
  model: BrickDetailModel,
  inUseModelId: string | undefined,
  readOnly: boolean | undefined,
): EdgeImpulseModelState {
  const impulses = useMemo(
    () => model.edgeImpulseProps?.impulses || [],
    [model.edgeImpulseProps?.impulses],
  );

  const [selectedImpulseId, setSelectedImpulseId] = useState<
    string | undefined
  >();
  const selectedImpulse = impulses.find((i) => i.id === selectedImpulseId);

  const impulseInUse = useMemo(
    () => impulses.find((i) => i.installedModelId === inUseModelId),
    [impulses, inUseModelId],
  );

  useEffect(() => {
    if (!selectedImpulseId) {
      setSelectedImpulseId(
        impulseInUse?.id ||
          impulses.find((i) => i.isInstalled)?.id ||
          impulses[0]?.id,
      );
    }
  }, [impulseInUse, impulseInUse?.id, impulses, readOnly, selectedImpulseId]);

  return {
    impulses,
    selectedImpulseId,
    setSelectedImpulseId,
    selectedImpulse,
    impulseInUse,
  };
}

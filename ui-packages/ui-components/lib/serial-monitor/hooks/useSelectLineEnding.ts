import { useState } from 'react';

import { LINE_ENDINGS } from '../SerialMonitor.type';

export type UseSelectLineEnding = <T extends typeof LINE_ENDINGS>() => {
  lineEndings: T;
  onLineEndingSelected: (lineEnding: T[number]) => void;
  selectedLineEnding: T[number];
};

function useSelectLineEnding(): ReturnType<UseSelectLineEnding> {
  const [selectedLineEnding, setSelectedLineEnding] = useState<
    typeof LINE_ENDINGS[number]
  >(LINE_ENDINGS[0]);

  return {
    lineEndings: LINE_ENDINGS,
    selectedLineEnding,
    onLineEndingSelected: setSelectedLineEnding,
  };
}

export default useSelectLineEnding;

import { useState } from 'react';

export type UseSetup = () => {
  setupCompleted: boolean;
  setSetupCompleted: (completed: boolean) => void;
};

export const useSetup: UseSetup = function (): ReturnType<UseSetup> {
  const [setupCompleted, setSetupCompleted] = useState(false);

  return {
    setupCompleted,
    setSetupCompleted,
  };
};

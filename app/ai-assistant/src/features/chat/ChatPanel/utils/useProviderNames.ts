import { useEffect, useState } from 'react';

import {
  AgentDescriptor,
  AgentId,
  AgentModel,
  listProviderCredentials,
} from '../../../../services';

// The last names read per agent: a panel that mounts again shows them at once instead of the provider ids.
const namesByAgent: Partial<Record<AgentId, Record<string, string>>> = {};

// The connected providers' names by provider id, for an agent with one key per provider; undefined
// for the others, whose model menu is not grouped.
export const useProviderNames = (
  agent: AgentDescriptor | undefined,
  models: AgentModel[],
): Record<string, string> | undefined => {
  const agentId = agent?.perProviderKeys ? agent.id : undefined;
  // A new provider brings new models, so the names are read again when the list changes.
  const modelIds = models.map((model) => model.id).join('\n');

  const [names, setNames] = useState<Record<string, string>>(
    () => (agentId && namesByAgent[agentId]) || {},
  );

  useEffect(() => {
    if (!agentId) {
      return;
    }
    const cached = namesByAgent[agentId];
    if (cached) {
      setNames(cached);
    }

    let cancelled = false;
    listProviderCredentials(agentId).then(
      (credentials) => {
        const read = Object.fromEntries(
          credentials.map((c) => [c.providerId, c.name]),
        );
        namesByAgent[agentId] = read;
        if (!cancelled) {
          setNames(read);
        }
      },
      // Without the names the groups are labelled from the model names.
      () => undefined,
    );
    return (): void => {
      cancelled = true;
    };
  }, [agentId, modelIds]);

  return agentId ? names : undefined;
};

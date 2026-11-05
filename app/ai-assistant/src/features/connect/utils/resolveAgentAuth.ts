import {
  AgentId,
  AuthStatus,
  currentAgent,
  getAuthStatus,
  listAgents,
} from '../../../services';
import { useAiAssistantStore } from '../../../store';

// Records every agent's answer, and reflects the host's own on which is in use — reading, not choosing.
export const probeAgentAuth = async (): Promise<AuthStatus[]> => {
  const ids = listAgents()
    .filter((agent) => !agent.comingSoon)
    .map((agent) => agent.id);

  // allSettled: a keychain can be absent (headless Linux), and one rejection used to sink the bootstrap.
  const settled = await Promise.allSettled(
    ids.map(
      async (id): Promise<[AgentId, AuthStatus]> => [
        id,
        await getAuthStatus(id),
      ],
    ),
  );

  const { setAuth, setSelectedAgent } = useAiAssistantStore.getState();
  const current = await currentAgent().catch(() => undefined);
  if (current) {
    setSelectedAgent(current);
  }
  const signedIn: AuthStatus[] = [];
  for (const result of settled) {
    if (result.status !== 'fulfilled') {
      continue; // an agent that could not answer is not signed in as far as this decision goes
    }
    const [id, status] = result.value;
    setAuth(id, status); // recorded for all of them, so Settings renders every card without re-probing
    if (status.authenticated) {
      signedIn.push(status);
    }
  }
  return signedIn;
};

// Which signed-in agent to open with: the one the host says is in use, then the default, then any.
export const resolveAgentAuth = async (): Promise<AuthStatus | undefined> => {
  const signedIn = await probeAgentAuth();
  const current = useAiAssistantStore.getState().selectedAgentId;
  const chosen =
    signedIn.find((s) => s.authenticated && s.agentId === current) ??
    signedIn.find((s) => s.authenticated && s.isDefault) ??
    signedIn[0];
  if (chosen?.authenticated) {
    useAiAssistantStore.getState().setSelectedAgent(chosen.agentId);
  }
  return chosen;
};

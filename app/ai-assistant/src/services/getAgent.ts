import { listAgents } from './coding-agent-service/codingAgentService.impl';
import {
  AgentDescriptor,
  AgentId,
} from './coding-agent-service/codingAgentService.type';

// Resolve an agent's descriptor by id from the (static) agent list. Undefined
// for a missing id or an unknown agent — the single place callers turn an
// AgentId into its display metadata, so nobody has to re-`listAgents().find(…)`.
export const getAgent = (agentId?: AgentId): AgentDescriptor | undefined =>
  agentId === undefined
    ? undefined
    : listAgents().find((agent) => agent.id === agentId);

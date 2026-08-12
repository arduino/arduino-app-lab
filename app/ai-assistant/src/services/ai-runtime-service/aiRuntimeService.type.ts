import { AgentId } from '../coding-agent-service/codingAgentService.type';
import { Unsubscribe } from '../common';

export type RuntimePhase =
  | 'idle'
  | 'download'
  | 'verify'
  | 'extract'
  | 'npm'
  // Uninstall progress: tearing down the installed runtime + packages.
  | 'remove'
  | 'done'
  | 'error';

export interface RuntimeProgress {
  phase: RuntimePhase;
  pct?: number;
  message?: string;
}

export interface RuntimeStatus {
  installed: boolean;
  version?: string;
  diskUsageBytes?: number;
}

// Result of a "check for updates": is there a newer runtime than the installed one?
export interface RuntimeUpdateCheck {
  // A newer runtime than the installed one is available.
  updateAvailable: boolean;
  // The latest version on offer (present even when up to date).
  latestVersion?: string;
}

// On-demand AI runtime (pinned Node + agent npm packages). Backed by the Go
// runtime manager behind Wails, injected via setAiRuntimeService.
export interface AiRuntimeService {
  status: (agentId: AgentId) => Promise<RuntimeStatus>;
  // Query the channel for a newer version without installing it.
  checkForUpdate: (agentId: AgentId) => Promise<RuntimeUpdateCheck>;
  // Install (or update/reinstall) the runtime; emits progress via onProgress.
  install: (agentId: AgentId) => Promise<void>;
  // Remove the installed runtime + packages; emits progress via onProgress.
  uninstall: (agentId: AgentId) => Promise<void>;
  // Abort an in-flight install/update/uninstall for the agent.
  cancel: (agentId: AgentId) => Promise<void>;
  onProgress: (handler: (progress: RuntimeProgress) => void) => Unsubscribe;
}

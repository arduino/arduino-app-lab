import { isFFEnabled } from '@cloud-editor-mono/domain/src/services/services-by-app/app-lab';
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/ai-assistant')({
  // Gated behind the AI_ASSISTANT feature flag: block direct navigation when off.
  beforeLoad: () => {
    if (!isFFEnabled('AI_ASSISTANT')) {
      throw redirect({ to: '/' });
    }
  },
  // Renders nothing: the chat panel is mounted persistently by AppLabMain and kept alive across the
  // Editor<->Agent toggle (so its stream subscription survives and switching is a show/hide, not a
  // remount). This route only puts /ai-assistant in the URL, which the layout reads to reveal the panel.
  component: () => null,
});

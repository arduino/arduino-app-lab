import { useEffect, useId } from 'react';

import { chatDriver, useChatStore } from '../../../../store';

// Two ChatPanels can be mounted at once (the editor's docked panel and full-screen Agent Mode), and
// only one may drive the session lifecycle: the workspace rebind, bootstrap/resume, and consuming a
// sessionRequest. The stream is not theirs — subscribeAgentStream owns it. `onScreen` is false while
// the host keeps this panel mounted but hidden; see chatDriver for how it settles ties.
export const useChatOwnership = (onScreen: boolean): boolean => {
  const ownerId = useId();
  const claimChat = useChatStore((s) => s.claimChat);
  const releaseChat = useChatStore((s) => s.releaseChat);
  const isActive = useChatStore((s) => chatDriver(s.chatOwners) === ownerId);

  useEffect(() => {
    claimChat(ownerId, onScreen);
    return () => releaseChat(ownerId);
  }, [ownerId, onScreen, claimChat, releaseChat]);

  return isActive;
};

import { stashAppFileToOpen } from './openAppFile';
import router from './router';

// Imperative "open this file in the app editor", used from outside the router tree (e.g. the AI
// assistant). This is the only half of the feature that touches the router, which is why it is split
// from ./openAppFile: nothing reachable from the route tree may import this module, or the import
// cycle described there closes again. Reached from lib/app-components/app-lab/AppLab.tsx, which is
// also what @cloud-editor-mono/core-ui/app-lab resolves to for the AI package's dynamic import.
export const openAppFileInEditor = async (
  appId: string,
  file: string,
): Promise<void> => {
  stashAppFileToOpen(appId, file);
  await router.navigate({ to: '/my-apps/$appId', params: { appId } });
};

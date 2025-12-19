import { Config } from '@cloud-editor-mono/common';

import { CloudEditorWindow, isCloudEditorWindow } from './windowService.type';

export const REQUEST_ID_KEY = 'request_cloud_editor_instance_id';
export const SEND_ID_KEY = 'send_cloud_editor_instance_id';

let cloudEditorInstanceId: string;

function instantiateCloudEditorInstanceId(): string {
  if (isCloudEditorWindow(window)) {
    cloudEditorInstanceId = window._CLOUD_EDITOR_INSTANCE_ID;
    return cloudEditorInstanceId;
  }

  cloudEditorInstanceId =
    'crypto' in window && 'randomUUID' in window.crypto
      ? window.crypto.randomUUID()
      : Date.now().toString();
  return cloudEditorInstanceId;
}

export function getCloudEditorInstanceId(): string {
  let cih = cloudEditorInstanceId;
  if (cih) return cih;

  cih = instantiateCloudEditorInstanceId();

  return cih;
}

export function sendIdRequest(sender: Window, target: string): void {
  if (!sender.opener) {
    throw new Error(
      'inactive notification can only be sent from a child window',
    );
  }

  setTimeout(() => {
    sender.opener.postMessage(REQUEST_ID_KEY, target);
  });
}

export function createOnIdReceived(receiver: Window, origin: string) {
  return function onIdReceived(
    event: MessageEvent<{
      type: typeof SEND_ID_KEY;
      id: string;
    }>,
  ): void {
    if (event.origin === origin && event.data?.id) {
      (receiver as CloudEditorWindow)._CLOUD_EDITOR_INSTANCE_ID =
        event.data?.id;
    }
  };
}

function appendParams(params: Set<[string, string]>, url?: string): URL {
  const newUrl = new URL(url || '', document.URL);
  for (const [name, value] of params) {
    newUrl.searchParams.append(name, value);
  }

  return newUrl;
}

export function getNewWindow(
  url?: string,
  search?: string,
  target?: string,
  features?: string,
): Window | null {
  const newWindow = window.open(`${url}${search || ''}`, target, features);
  if (!newWindow) return null;

  return newWindow;
}

export function getNewMonitorWindow(
  url?: string | undefined,
  params: Set<[string, string]> = new Set(),
  target?: string | undefined,
  features?: string | undefined,
): Window | null {
  const newUrl = appendParams(params, url);

  let newWindow: Window | null = null;
  window.addEventListener('message', (ev: MessageEvent<string>) => {
    if (ev.origin !== Config.NEW_WINDOW_ORIGIN) return;
    if (newWindow && ev.data === REQUEST_ID_KEY) {
      newWindow.postMessage(
        { type: SEND_ID_KEY, id: getCloudEditorInstanceId() },
        Config.NEW_WINDOW_ORIGIN,
      );
    }
  });

  newWindow = window.open(newUrl, target, features);
  if (!newWindow) return null;

  return newWindow;
}

export function isCurrentCloudEditor(id: string): boolean {
  return id === getCloudEditorInstanceId();
}

export const POPUP_WINDOW_FEATURES = `scrollbars=no,
resizable=no,
status=no,
location=no,
toolbar=no,
menubar=no,
width=640,
height=400,
left=100,
top=100`;

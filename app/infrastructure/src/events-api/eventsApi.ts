import { Config } from '@cloud-editor-mono/common';

import { httpPost } from '../fetch/fetch';
import { createUUID } from '../utils';
import { Body_Events } from './eventsApi.type';

export async function sendEvent(
  payload: Body_Events,
  token: string,
  user_id: string,
  browser?: string,
  os?: string,
): Promise<void> {
  const endpoint = '/beacon';
  const session = createUUID();

  const type = payload.subtype
    ? `${Config.EVENTS_BASE_TYPE}.${payload.subtype}`
    : Config.EVENTS_BASE_TYPE;

  const data = Object.assign(payload.data, {
    user_id,
    user_agent_data: {
      browser,
      os,
      user_agent: navigator.userAgent,
      language: navigator.language,
    },
    session,
  });

  const beaconData = JSON.stringify([
    {
      specversion: '0.2',
      type,
      source: window.location.href,
      data,
    },
  ]);

  if ('sendBeacon' in navigator) {
    navigator.sendBeacon(`${Config.EVENTS_API_URL}${endpoint}`, beaconData);
  } else {
    await httpPost(
      Config.EVENTS_API_URL,
      undefined,
      endpoint,
      beaconData,
      token,
      undefined,
      { 'Content-Type': 'text/plain;charset=UTF-8' },
    );
  }
}

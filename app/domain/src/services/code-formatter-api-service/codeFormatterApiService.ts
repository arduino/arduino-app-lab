import {
  CodeFormatterPrettify_Body,
  postPrettifyCodeRequest,
} from '@cloud-editor-mono/infrastructure';

import { getAccessToken, noTokenReject } from '../arduino-auth';

export async function prettifyCode(
  body: CodeFormatterPrettify_Body,
  abortController?: AbortController,
): ReturnType<typeof postPrettifyCodeRequest> {
  const token = await getAccessToken();
  if (!token) return noTokenReject();

  return postPrettifyCodeRequest(body, token, abortController);
}

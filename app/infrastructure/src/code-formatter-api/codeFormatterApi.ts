import { Config } from '@cloud-editor-mono/common';

import { httpPost } from '../fetch/fetch';
import {
  CodeFormatterPrettify_Body,
  CodeFormatterPrettify_CodeFormatterApi,
  CodeFormatterPrettify_Response,
} from './codeFormatterApi.type';
import { mapPostPrettifyCodeResponse } from './mapper';

export async function postPrettifyCodeRequest(
  payload: CodeFormatterPrettify_Body,
  token: string,
  abortController?: AbortController,
): Promise<CodeFormatterPrettify_Response | void> {
  const endpoint = '/prettify';
  const response = await httpPost<CodeFormatterPrettify_CodeFormatterApi>(
    Config.CODE_FORMATTER_API_URL,
    undefined,
    endpoint,
    payload,
    token,
    abortController,
  );

  if (response) {
    return mapPostPrettifyCodeResponse(response);
  }
}

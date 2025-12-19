import {
  CodeFormatterPrettify_CodeFormatterApi,
  CodeFormatterPrettify_Response,
} from './codeFormatterApi.type';

export function mapPostPrettifyCodeResponse(
  data: CodeFormatterPrettify_CodeFormatterApi,
): CodeFormatterPrettify_Response {
  return {
    formattedCode: data.code,
    codeHasChanged: data.is_change,
    optionString: data.options,
  };
}

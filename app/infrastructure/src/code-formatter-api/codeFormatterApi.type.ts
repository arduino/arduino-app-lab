export interface CodeFormatterPrettify_CodeFormatterApi {
  code: string;
  is_change: boolean;
  options: string;
}

export interface CodeFormatterPrettify_Response {
  formattedCode: string;
  codeHasChanged: boolean;
  optionString: string;
}

export interface CodeFormatterPrettify_Body {
  code: string;
}

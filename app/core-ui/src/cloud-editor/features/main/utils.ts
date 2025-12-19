import { ArduinoUser } from '@bcmi-labs/art-auth';
import { Config } from '@cloud-editor-mono/common';
import {
  createBuilderSecretsFile,
  DEFAULT_SKETCH_NAME,
  getCodeSubjectById,
  GetSketchResult,
  injectSecretsFileInclude,
  RetrieveFileContentsResult,
  RetrieveFileContentsResultWithData,
  transformContentToDataByMimeType,
  validateFileNameFormat,
  validateFileNameLimit,
  WretchErrorWithMessage,
} from '@cloud-editor-mono/domain';
import {
  AiUserPlan,
  filefull_BuilderApi,
  Plans,
  SketchData,
  USER_CLAIM_USERNAME,
} from '@cloud-editor-mono/infrastructure';
import { SketchNameValidationDictionary } from '@cloud-editor-mono/ui-components';

import { CompilePayload } from '../../../common/hooks/queries/builder.type';
import { updateFileData } from '../../../common/utils';

const MAKER_PLAN_LIMITS = [3, 10, 25];

export function getDefaultSketch(
  sketchesData?: GetSketchResult[],
): GetSketchResult | undefined {
  return sketchesData?.find((sketch) => sketch.name === DEFAULT_SKETCH_NAME);
}

// ** implementation copied from web-ide: `isPrimaryFile` in `src/app/js/utilities/sketchUtils.js` **
export function isMainInoFile<T extends { href?: string }>(file: T): boolean {
  const { href } = file;
  if (!href) {
    return false;
  }

  const hrefTokens = href.split('/');
  return hrefTokens.pop() === `${hrefTokens.pop()}.ino`;
}

export function getMainInoFile<T extends { href?: string }>(
  files?: T[],
): T | undefined {
  return files?.find(isMainInoFile);
}

function createSketchFilePayload<T extends RetrieveFileContentsResultWithData>(
  file: T,
): filefull_BuilderApi {
  return {
    data: file.data,
    name: file.fullName,
  };
}

interface CreateUpdatedCompilePayloadArgs {
  fqbn: string;
  sketchData: SketchData;
  mainInoData: RetrieveFileContentsResult;
  isVerboseOutput: boolean;
  filesData?: RetrieveFileContentsResult[];
  isIot?: boolean;
}
export function createUpdatedCompilePayload({
  fqbn,
  sketchData,
  mainInoData,
  isVerboseOutput,
  filesData,
  isIot = false,
}: CreateUpdatedCompilePayloadArgs): CompilePayload {
  let payloadWillHaveSecretsFile = false;

  const currMainInoContent = getCodeSubjectById(mainInoData.path).value.value;
  const mainInoCodeData = transformContentToDataByMimeType(
    getCodeSubjectById(mainInoData.path).value.value,
    mainInoData.mimetype,
  );

  const updatedFiles = filesData
    ? filesData
        .filter(
          (f): f is RetrieveFileContentsResultWithData =>
            typeof f.data !== 'undefined',
        )
        .map((f) => updateFileData(f, getCodeSubjectById))
        .map(createSketchFilePayload)
    : [];

  if (sketchData.secrets) {
    updatedFiles.push(createBuilderSecretsFile(sketchData.secrets));
    payloadWillHaveSecretsFile = true;
  }

  const ino = createSketchFilePayload({
    ...mainInoData,
    data: mainInoCodeData,
  });

  const includedLibs = { included_libs: sketchData.libraries || [] };

  const payload: CompilePayload = {
    fqbn,
    sketch: {
      name: sketchData.name,
      files: updatedFiles,
      ...includedLibs,
      ino: payloadWillHaveSecretsFile
        ? injectSecretsFileInclude(
            ino,
            currMainInoContent,
            mainInoData.mimetype,
          )
        : ino,
    },
    hasSecretsIncludeInjected: payloadWillHaveSecretsFile,
    verbose: isVerboseOutput,
  };

  if (isIot) {
    payload.ota = true;
  }

  return payload;
}

enum SketchNameValidation {
  exceedsLimit = 'exceedsLimit',
  hasInvalidCharacters = 'hasInvalidCharacters',
  alreadyExists = 'alreadyExists',
  emptyName = 'emptyName',
}

export function sketchNameValidation(
  sketchName: string,
): Omit<SketchNameValidationDictionary, 'alreadyExists'> {
  return {
    [SketchNameValidation.exceedsLimit]: validateFileNameLimit(sketchName),
    [SketchNameValidation.hasInvalidCharacters]:
      validateFileNameFormat(sketchName),
  };
}

export async function handleOptedOut(
  sketchId?: string,
  username?: string,
  optOut?: () => Promise<boolean>,
): Promise<void> {
  if (optOut) {
    await optOut();
  }

  const path =
    sketchId && username ? `/editor/${username}/${sketchId}` : '/editor';

  window.location.replace(Config.WEB_IDE_URL + path);
}

export function getDeviceSetupLink(thingId?: string): string {
  return `${Config.CLOUD_HOME_URL}/things/${thingId}/setup`;
}

export function isCustomLibAccessedFromSharedSpaceError(
  errCause: WretchErrorWithMessage,
  user?: ArduinoUser | null,
): boolean {
  const CUSTOM_LIB_PATH = '/libraries_v2';
  return !!(
    user &&
    errCause.path?.includes(`${user[USER_CLAIM_USERNAME]}${CUSTOM_LIB_PATH}`)
  );
}

export function shouldDisplayAiLimitBanner(
  aiUserPlan: AiUserPlan,
  genAiMessageRemaining: number,
): boolean | undefined {
  return (
    aiUserPlan === Plans.FREE ||
    (aiUserPlan === Plans.MAKER &&
      MAKER_PLAN_LIMITS.includes(genAiMessageRemaining))
  );
}

import { AIModelItem, BrickDetails } from '@cloud-editor-mono/infrastructure';
import { BrickDetailModel } from '@cloud-editor-mono/ui-components/lib/components-by-app/app-lab';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BoardScopedQuery } from '../boardScopedQuery';
import {
  AiModelsContext,
  AiModelsContextValue,
} from '../providers/ai-models/aiModelsContext';
import { plainModelId } from '../utils/modelId';
import { useBrickDetailLogic } from './useBrickDetail';

vi.mock(
  '@cloud-editor-mono/domain/src/services/services-by-app/app-lab',
  async () => {
    const actual = await vi.importActual<
      typeof import('@cloud-editor-mono/domain/src/services/services-by-app/app-lab')
    >('@cloud-editor-mono/domain/src/services/services-by-app/app-lab');

    return {
      ...actual,
      getBrickDetails: vi.fn(),
      getAppDetail: vi.fn(),
      getAppBrickInstance: vi.fn(),
      getAppBricks: vi.fn(),
      updateAppBrick: vi.fn(),
      deleteAIModel: vi.fn(),
    };
  },
);

const domainServices = vi.mocked(
  await import(
    '@cloud-editor-mono/domain/src/services/services-by-app/app-lab'
  ),
);

const BRICK_ID = 'arduino:image_classification';

const makeModel = (model: Partial<AIModelItem>): AIModelItem => ({
  id: 'model',
  id_decoded: 'model',
  name: 'model',
  description: '',
  runner: 'brick',
  brick_ids: [BRICK_ID],
  is_builtin: false,
  origin: 'curated',
  status: 'not-installed',
  ...model,
});

// The board's list declares Edge Impulse models too: they carry the same
// `ei-project-id` metadata as a user's own training, and stay `curated`.
const CURATED_EI_MODEL = makeModel({
  id: 'ei:efficientnet-b4',
  id_decoded: 'ei:efficientnet-b4',
  name: 'General purpose object classification - EfficientNet-B4',
  origin: 'curated',
  metadata: {
    source: 'edgeimpulse',
    'ei-project-id': '948887',
    'ei-impulse-id': '10',
  },
});

const USER_EI_MODEL = makeModel({
  id: 'ei-model-717280-1',
  id_decoded: 'ei-model-717280-1',
  name: 'My own project',
  origin: 'edge-impulse-user-project',
  status: 'installed',
  metadata: {
    source: 'edgeimpulse',
    'ei-project-id': '717280',
    'ei-impulse-id': '1',
    'ei-impulse-name': 'My impulse',
  },
});

const CURATED_MODEL = makeModel({
  id: 'llamacpp:Qwen3.5-2B-Q4_K_M',
  id_decoded: 'llamacpp:Qwen3.5-2B-Q4_K_M',
  name: 'Qwen3.5 2B',
});

// A daemon older than the one-endpoint API sends no `origin`, so the Edge
// Impulse metadata is all that names a model as the user's own deployment.
const NO_ORIGIN_USER_EI_MODEL = makeModel({
  ...USER_EI_MODEL,
  origin: undefined,
});

const NO_ORIGIN_MODEL = makeModel({
  ...CURATED_MODEL,
  origin: undefined,
  status: 'installed',
});

const brick = (models: AIModelItem[]): BrickDetails => ({
  id: BRICK_ID,
  name: 'Image classification',
  author: 'Arduino',
  compatible_models: models.map((m) => ({ id: m.id, name: m.name })),
});

let queryClient: QueryClient;
let installedModels: AIModelItem[];

const aiModelsValue = (): AiModelsContextValue =>
  ({
    currentDownloads: {},
    clearDownload: vi.fn(),
    installedModels,
    // Answers to either spelling, the way useInstalledAIModels keys its lookup.
    getInstalledModel: (modelId: string) =>
      installedModels.find(
        (m) => m.id === modelId || plainModelId(m) === modelId,
      ),
    getEIProjectsByBrickType: () => [],
    downloadImpulse: vi.fn(),
    enabledEIAutoRefresh: vi.fn(),
    openAndAssociateToDevice: vi.fn(),
    isModelOutdated: () => false,
    installAIModelSSE: vi.fn(),
    downloadAIModelSSE: vi.fn(),
  } as unknown as AiModelsContextValue);

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
  <QueryClientProvider client={queryClient}>
    <AiModelsContext.Provider value={aiModelsValue()}>
      {children}
    </AiModelsContext.Provider>
  </QueryClientProvider>
);

const renderLogic = (
  appId?: string,
): ReturnType<
  typeof renderHook<ReturnType<typeof useBrickDetailLogic>, void>
> => renderHook(() => useBrickDetailLogic(BRICK_ID, appId), { wrapper });

const renderModels = async (): Promise<BrickDetailModel[]> => {
  const { result } = renderLogic();
  await waitFor(() => expect(result.current.models?.length).toBeGreaterThan(0));
  return result.current.models ?? [];
};

describe('useBrickDetailLogic models', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    installedModels = [];
  });

  it('lists a curated Edge Impulse model as a plain model, not a project card', async () => {
    installedModels = [CURATED_EI_MODEL];
    domainServices.getBrickDetails.mockResolvedValue(brick([CURATED_EI_MODEL]));

    const models = await renderModels();

    const listed = models.filter((m) => m.id === CURATED_EI_MODEL.id);
    expect(listed).toHaveLength(1);
    expect(listed[0].edgeImpulseProps).toBeUndefined();
    expect(listed[0].origin).toBe('curated');
    // Never regrouped under the project its metadata names.
    expect(models.some((m) => m.id === '948887')).toBe(false);
  });

  it('groups a model trained on the user own Edge Impulse account by project', async () => {
    installedModels = [USER_EI_MODEL];
    domainServices.getBrickDetails.mockResolvedValue(brick([]));

    const models = await renderModels();

    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('717280');
    expect(models[0].origin).toBe('edge-impulse-user-project');
    expect(models[0].edgeImpulseProps?.impulses).toHaveLength(1);
  });

  it('keeps every compatible model, whatever its origin', async () => {
    installedModels = [CURATED_MODEL, CURATED_EI_MODEL, USER_EI_MODEL];
    domainServices.getBrickDetails.mockResolvedValue(
      brick([CURATED_MODEL, CURATED_EI_MODEL]),
    );

    const models = await renderModels();

    expect(models.map((m) => m.id).sort()).toEqual(
      ['717280', CURATED_EI_MODEL.id, CURATED_MODEL.id].sort(),
    );
  });

  it('groups a user Edge Impulse model by project when the daemon sends no origin', async () => {
    installedModels = [NO_ORIGIN_USER_EI_MODEL];
    domainServices.getBrickDetails.mockResolvedValue(
      brick([NO_ORIGIN_USER_EI_MODEL]),
    );

    const models = await renderModels();

    // One card, the project one: never also listed flat beside it.
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('717280');
    expect(models[0].edgeImpulseProps?.impulses).toHaveLength(1);
  });

  it('lists a model with no origin and no Edge Impulse metadata as a plain model', async () => {
    installedModels = [NO_ORIGIN_MODEL];
    domainServices.getBrickDetails.mockResolvedValue(brick([NO_ORIGIN_MODEL]));

    const models = await renderModels();

    expect(models).toHaveLength(1);
    expect(models[0].id).toBe(NO_ORIGIN_MODEL.id);
    expect(models[0].edgeImpulseProps).toBeUndefined();
  });
});

// A linked Hugging Face model: its id holds slashes, so a current daemon reports
// `id` base64url encoded — one path segment — and the plain form beside it as
// `id_decoded`. An older daemon reports one plain id and no `id_decoded`.
const LINKED_PLAIN_ID =
  'llamacpp:unsloth/SmolLM2-135M-Instruct-GGUF/SmolLM2-135M-Instruct-Q4_K_M';
const LINKED_ENCODED_ID =
  'bGxhbWFjcHA6dW5zbG90aC9TbW9sTE0yLTEzNU0tSW5zdHJ1Y3QtR0dVRi9TbW9sTE0yLTEzNU0tSW5zdHJ1Y3QtUTRfS19N';

const LINKED_MODEL = makeModel({
  id: LINKED_ENCODED_ID,
  id_decoded: LINKED_PLAIN_ID,
  name: 'SmolLM2-135M-Instruct',
  origin: 'user',
  status: 'installed',
});

const OLDER_DAEMON_MODEL = makeModel({
  id: 'llamacpp:Qwen3.5-2B-Q4_K_M',
  id_decoded: undefined,
  name: 'Qwen3.5 2B',
  status: 'installed',
});

describe('useBrickDetailLogic model ids', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    installedModels = [];
  });

  it('keys a model row by the id the daemon reports', async () => {
    installedModels = [LINKED_MODEL];
    domainServices.getBrickDetails.mockResolvedValue(brick([LINKED_MODEL]));

    const models = await renderModels();

    // Never the plain spelling: that is what the row would have to be keyed by
    // for a comparison against `brickInstance.model` to miss.
    expect(models.map((m) => m.id)).toEqual([LINKED_ENCODED_ID]);
  });

  it('names an uninstall with the id it was given, untouched', async () => {
    installedModels = [LINKED_MODEL];
    domainServices.getBrickDetails.mockResolvedValue(brick([LINKED_MODEL]));

    const { result } = renderLogic();
    await waitFor(() =>
      expect(result.current.models?.length).toBeGreaterThan(0),
    );
    await result.current.removeModel?.(LINKED_ENCODED_ID);

    expect(domainServices.deleteAIModel).toHaveBeenCalledWith(
      LINKED_ENCODED_ID,
      undefined,
    );
  });

  it('names the model a brick update carries with the id it was given', async () => {
    installedModels = [LINKED_MODEL];
    domainServices.getBrickDetails.mockResolvedValue(brick([LINKED_MODEL]));
    domainServices.updateAppBrick.mockResolvedValue(true);

    const { result } = renderLogic('app-1');
    await waitFor(() =>
      expect(result.current.models?.length).toBeGreaterThan(0),
    );
    await result.current.updateModelInUse?.(LINKED_ENCODED_ID);

    expect(domainServices.updateAppBrick).toHaveBeenCalledWith(
      'app-1',
      BRICK_ID,
      { model: LINKED_ENCODED_ID },
    );
  });

  // An older daemon reports a single plain id, so that same id is both what the
  // row is keyed by and what a request names the model with.
  it('sends back the one id an older daemon reports', async () => {
    installedModels = [OLDER_DAEMON_MODEL];
    domainServices.getBrickDetails.mockResolvedValue(
      brick([OLDER_DAEMON_MODEL]),
    );

    const { result } = renderLogic();
    await waitFor(() =>
      expect(result.current.models?.length).toBeGreaterThan(0),
    );

    expect(result.current.models?.map((m) => m.id)).toEqual([
      OLDER_DAEMON_MODEL.id,
    ]);

    await result.current.removeModel?.(OLDER_DAEMON_MODEL.id);

    expect(domainServices.deleteAIModel).toHaveBeenCalledWith(
      OLDER_DAEMON_MODEL.id,
      undefined,
    );
  });
});

describe('useBrickDetailLogic brick details cache', () => {
  const LLM_BRICK_ID = 'arduino:llm';
  const LINK_URL = 'https://huggingface.co/org/repo/resolve/main/model.gguf';
  const BRICK_DETAILS_KEY = [BoardScopedQuery.GET_BRICK_DETAILS, LLM_BRICK_ID];

  const LINKED_USER_MODEL = makeModel({
    id: 'bGxhbWFjcHA6b3JnL3JlcG8vbW9kZWw',
    id_decoded: 'llamacpp:org/repo/model',
    name: 'org/repo/model',
    origin: 'user',
    status: 'installed',
    brick_ids: [LLM_BRICK_ID],
  });

  const LLM_BRICK: BrickDetails = {
    id: LLM_BRICK_ID,
    name: 'LLM',
    author: 'Arduino',
    compatible_models: [],
  };

  let resolveStream: (model: AIModelItem | undefined) => void;
  let downloadAIModelSSE: AiModelsContextValue['downloadAIModelSSE'];
  let installAIModelSSE: AiModelsContextValue['installAIModelSSE'];

  const linkWrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <QueryClientProvider client={queryClient}>
      <AiModelsContext.Provider
        value={{ ...aiModelsValue(), downloadAIModelSSE, installAIModelSSE }}
      >
        {children}
      </AiModelsContext.Provider>
    </QueryClientProvider>
  );

  // An appId and the brick being in the app make the brick writable, so the
  // download runs its `updateModelInUse` tail: that call is the signal the
  // cache write is done.
  const renderLinkLogic = async (
    brickInApp = true,
    onModelInstalled?: (modelId: string) => void,
  ): Promise<
    ReturnType<typeof renderHook<ReturnType<typeof useBrickDetailLogic>, void>>
  > => {
    const appBricks = brickInApp ? [{ id: LLM_BRICK_ID }] : [];
    domainServices.getAppBricks.mockResolvedValue(appBricks);
    queryClient.setQueryData([BoardScopedQuery.APP_BRICKS, 'app-1'], appBricks);
    const rendered = renderHook(
      () => useBrickDetailLogic(LLM_BRICK_ID, 'app-1', onModelInstalled),
      { wrapper: linkWrapper },
    );
    await waitFor(() =>
      expect(
        rendered.result.current.addHuggingFaceModelDialogProps?.downloadModel,
      ).toBeDefined(),
    );
    return rendered;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    installedModels = [];
    downloadAIModelSSE = vi.fn((_source, options) => {
      options?.onStarted?.();
      return new Promise<AIModelItem | undefined>((resolve) => {
        resolveStream = resolve;
      });
    });
    installAIModelSSE = vi.fn().mockResolvedValue(LINKED_USER_MODEL);
    domainServices.getBrickDetails.mockResolvedValue(LLM_BRICK);
    domainServices.updateAppBrick.mockResolvedValue(true);
  });

  it('appends a linked model to the cached brick', async () => {
    const { result } = await renderLinkLogic();

    await result.current.addHuggingFaceModelDialogProps?.downloadModel(
      LINK_URL,
    );
    resolveStream(LINKED_USER_MODEL);

    await waitFor(() =>
      expect(
        queryClient.getQueryData<BrickDetails>(BRICK_DETAILS_KEY)
          ?.compatible_models,
      ).toEqual([LINKED_USER_MODEL]),
    );
  });

  // The download outlives the brick-details entry: a board switch resets it,
  // and garbage collection drops it once nothing observes it. Writing into
  // nothing would store a brick with no id, name or author.
  it('leaves a reset cache empty instead of writing a brick with no id', async () => {
    const { result, unmount } = await renderLinkLogic();
    const downloadModel =
      result.current.addHuggingFaceModelDialogProps?.downloadModel;

    unmount();
    queryClient.removeQueries({ queryKey: BRICK_DETAILS_KEY });

    await downloadModel?.(LINK_URL);
    resolveStream(LINKED_USER_MODEL);
    await waitFor(() =>
      expect(domainServices.updateAppBrick).toHaveBeenCalled(),
    );

    expect(queryClient.getQueryData(BRICK_DETAILS_KEY)).toBeUndefined();
  });

  // In the Add Brick dialog the brick is added to the app only on "Add", and
  // the daemon answers 500 to a model update for a brick the app does not have.
  it('selects the model in the dialog instead of updating a brick not in the app yet', async () => {
    const onModelInstalled = vi.fn();
    const { result } = await renderLinkLogic(false, onModelInstalled);

    await result.current.addHuggingFaceModelDialogProps?.downloadModel(
      LINK_URL,
    );
    resolveStream(LINKED_USER_MODEL);

    await waitFor(() =>
      expect(onModelInstalled).toHaveBeenCalledWith(LINKED_USER_MODEL.id),
    );
    expect(domainServices.updateAppBrick).not.toHaveBeenCalled();
  });

  it('sets the model in use on a brick already in the app', async () => {
    const onModelInstalled = vi.fn();
    const { result } = await renderLinkLogic(true, onModelInstalled);

    await result.current.addHuggingFaceModelDialogProps?.downloadModel(
      LINK_URL,
    );
    resolveStream(LINKED_USER_MODEL);

    await waitFor(() =>
      expect(domainServices.updateAppBrick).toHaveBeenCalledWith(
        'app-1',
        LLM_BRICK_ID,
        { model: LINKED_USER_MODEL.id },
      ),
    );
    expect(onModelInstalled).not.toHaveBeenCalled();
  });

  it('selects a catalog model in the dialog instead of updating a brick not in the app yet', async () => {
    const onModelInstalled = vi.fn();
    const { result } = await renderLinkLogic(false, onModelInstalled);

    await result.current.downloadGenericModel?.(LINKED_USER_MODEL.id);

    expect(onModelInstalled).toHaveBeenCalledWith(LINKED_USER_MODEL.id);
    expect(domainServices.updateAppBrick).not.toHaveBeenCalled();
  });

  it('sets the model in use when the brick is added while the download runs', async () => {
    const onModelInstalled = vi.fn();
    const { result } = await renderLinkLogic(false, onModelInstalled);

    await result.current.addHuggingFaceModelDialogProps?.downloadModel(
      LINK_URL,
    );
    queryClient.setQueryData(
      [BoardScopedQuery.APP_BRICKS, 'app-1'],
      [{ id: LLM_BRICK_ID }],
    );
    resolveStream(LINKED_USER_MODEL);

    await waitFor(() =>
      expect(domainServices.updateAppBrick).toHaveBeenCalledWith(
        'app-1',
        LLM_BRICK_ID,
        { model: LINKED_USER_MODEL.id },
      ),
    );
    expect(onModelInstalled).not.toHaveBeenCalled();
  });
});

describe('useBrickDetailLogic Hugging Face model already installed', () => {
  const LLM_BRICK_ID = 'arduino:llm';
  const REPO_URL = 'https://huggingface.co/org/repo';
  const LINK_URL = `${REPO_URL}/resolve/main/model-Q4_0.gguf`;

  const INSTALLED_LINKED_MODEL = makeModel({
    id: 'bGxhbWFjcHA6b3JnL3JlcG8vbW9kZWwtUTRfMA',
    id_decoded: 'llamacpp:org/repo/model-Q4_0',
    name: 'org/repo/model-Q4_0',
    origin: 'user',
    status: 'installed',
    brick_ids: [LLM_BRICK_ID],
    metadata: { source: 'huggingface', 'source-model-url': LINK_URL },
  });

  const isSourceInstalled = async (
    url: string,
    model: AIModelItem,
  ): Promise<boolean> => {
    installedModels = [model];
    domainServices.getBrickDetails.mockResolvedValue({
      id: LLM_BRICK_ID,
      name: 'LLM',
      author: 'Arduino',
      compatible_models: [{ id: model.id, name: model.name }],
    });

    const { result } = renderHook(() => useBrickDetailLogic(LLM_BRICK_ID), {
      wrapper,
    });
    await waitFor(() =>
      expect(result.current.models?.length).toBeGreaterThan(0),
    );

    return !!result.current.addHuggingFaceModelDialogProps?.isSourceInstalled?.(
      url,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    installedModels = [];
  });

  it('reports the url the model was downloaded from', async () => {
    expect(await isSourceInstalled(LINK_URL, INSTALLED_LINKED_MODEL)).toBe(
      true,
    );
  });

  it('does not report a model installed for another brick', async () => {
    installedModels = [INSTALLED_LINKED_MODEL];
    domainServices.getBrickDetails.mockResolvedValue({
      id: LLM_BRICK_ID,
      name: 'LLM',
      author: 'Arduino',
      compatible_models: [],
    });

    const { result } = renderHook(() => useBrickDetailLogic(LLM_BRICK_ID), {
      wrapper,
    });
    await waitFor(() =>
      expect(
        result.current.addHuggingFaceModelDialogProps?.isSourceInstalled,
      ).toBeDefined(),
    );

    expect(
      result.current.addHuggingFaceModelDialogProps?.isSourceInstalled?.(
        LINK_URL,
      ),
    ).toBe(false);
  });

  it('does not report another quantization of the same repository', async () => {
    expect(
      await isSourceInstalled(
        `${REPO_URL}/resolve/main/model-Q8_0.gguf`,
        INSTALLED_LINKED_MODEL,
      ),
    ).toBe(false);
  });

  it('does not report a model the brick lists but has not installed', async () => {
    expect(
      await isSourceInstalled(
        LINK_URL,
        makeModel({ ...INSTALLED_LINKED_MODEL, status: 'not-installed' }),
      ),
    ).toBe(false);
  });
});

describe('useBrickDetailLogic train new model visibility', () => {
  const renderBrick = async (
    brickId: string,
    details: BrickDetails,
    appId?: string,
  ): Promise<ReturnType<typeof useBrickDetailLogic>> => {
    domainServices.getBrickDetails.mockResolvedValue(details);
    const { result } = renderHook(() => useBrickDetailLogic(brickId, appId), {
      wrapper,
    });
    await waitFor(() => {
      expect(result.current.brick).toBeDefined();
      if (appId) {
        expect(
          queryClient.getQueryState([BoardScopedQuery.LIST_MY_APPS, appId])
            ?.status,
        ).toBe('success');
      }
    });
    return result.current;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    installedModels = [];
  });

  it('enables train new model when ai_frameworks_compatibility lists edgeimpulse', async () => {
    const logic = await renderBrick(BRICK_ID, {
      ...brick([]),
      ai_frameworks_compatibility: ['edgeimpulse'],
    });

    expect(logic.trainNewModelEnabled).toBe(true);
  });

  it('disables train new model when ai_frameworks_compatibility omits edgeimpulse', async () => {
    const logic = await renderBrick(BRICK_ID, {
      ...brick([]),
      ai_frameworks_compatibility: ['qnn'],
    });

    expect(logic.trainNewModelEnabled).toBe(false);
  });

  // An arduino-app-cli without the field sends nothing, so the brick id list
  // has to keep deciding.
  it('falls back to the brick id list when the field is absent', async () => {
    const compatible = await renderBrick(BRICK_ID, brick([]));
    expect(compatible.trainNewModelEnabled).toBe(true);

    const incompatible = await renderBrick('arduino:llm', {
      id: 'arduino:llm',
      name: 'LLM',
      author: 'Arduino',
      compatible_models: [],
    });
    expect(incompatible.trainNewModelEnabled).toBe(false);
  });

  it('disables train new model for an example, whatever the brick declares', async () => {
    domainServices.getAppDetail.mockResolvedValue({
      id: 'app-1',
      name: 'Example app',
      status: 'stopped',
      example: true,
    });

    const logic = await renderBrick(
      BRICK_ID,
      { ...brick([]), ai_frameworks_compatibility: ['edgeimpulse'] },
      'app-1',
    );

    expect(logic.isReadOnlyApp).toBe(true);
    expect(logic.trainNewModelEnabled).toBe(false);
  });

  it('fixes the model of an installed release like an example', async () => {
    domainServices.getAppDetail.mockResolvedValue({
      id: 'app-1',
      name: 'Release app',
      status: 'stopped',
      example: false,
      release: true,
    });

    const logic = await renderBrick(
      BRICK_ID,
      { ...brick([]), ai_frameworks_compatibility: ['edgeimpulse'] },
      'app-1',
    );

    expect(logic.isReadOnlyApp).toBe(true);
    expect(logic.trainNewModelEnabled).toBe(false);
  });

  it('disables add Hugging Face model for an installed release', async () => {
    const llmBrick: BrickDetails = {
      id: 'arduino:llm',
      name: 'LLM',
      author: 'Arduino',
      compatible_models: [],
    };

    domainServices.getAppDetail.mockResolvedValue({
      id: 'app-1',
      name: 'My app',
      status: 'stopped',
      example: false,
      release: false,
    });
    const regular = await renderBrick('arduino:llm', llmBrick, 'app-1');
    expect(regular.isReadOnlyApp).toBe(false);
    expect(regular.addHuggingFaceModelEnabled).toBe(true);

    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    domainServices.getAppDetail.mockResolvedValue({
      id: 'app-1',
      name: 'Release app',
      status: 'stopped',
      example: false,
      release: true,
    });
    const release = await renderBrick('arduino:llm', llmBrick, 'app-1');
    expect(release.isReadOnlyApp).toBe(true);
    expect(release.addHuggingFaceModelEnabled).toBe(false);
  });
});

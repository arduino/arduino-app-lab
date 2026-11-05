import { AddHuggingFaceModelDialogProps } from '../../../../../../dialogs/app-lab/add-hugging-face-model-dialog/AddHuggingFaceModelDialog';
import { TrainNewModelDialogProps } from '../../../../../../dialogs/app-lab/train-new-model-dialog/TrainNewModelDialog';
import { useI18n } from '../../../../../../i18n/useI18n';
import { XXSmall } from '../../../../../../typography';
import { AiModel } from '../../../../ai-model';
import { BrickDetailModel } from '../../../../ai-model/AiModel.type';
import { isEdgeImpulseModel } from '../../../../ai-model/helpers';
import { messages } from '../../../messages';
import styles from './ai-models-tab.module.scss';
import { BrickModelActions } from './AiModelsTab.type';
import { TrainNewModelSection } from './sections/train-new-model-section/TrainNewModelSection';
import { UserModelSection } from './sections/user-model-section/UserModelSection';

export interface AiModelsTabProps {
  models: BrickDetailModel[];
  modelActions: BrickModelActions;
  inUseModelId?: string;
  selectedModelId?: string;
  onModelSelect?: (modelId: string) => void;
  readOnly?: boolean;
  isReadOnlyApp?: boolean;
  trainNewModelEnabled: boolean;
  addHuggingFaceModelEnabled?: boolean;
  addHuggingFaceModelDialogProps?: AddHuggingFaceModelDialogProps;
  trainNewModelDialogProps?: TrainNewModelDialogProps;
  onTrainNewModelClick: () => void;
}

export const AiModelsTab: React.FC<AiModelsTabProps> = ({
  models,
  modelActions,
  inUseModelId,
  selectedModelId,
  onModelSelect,
  readOnly = false,
  isReadOnlyApp = false,
  trainNewModelEnabled,
  addHuggingFaceModelEnabled = false,
  addHuggingFaceModelDialogProps,
  trainNewModelDialogProps,
  onTrainNewModelClick,
}: AiModelsTabProps) => {
  const { formatMessage } = useI18n();
  const {
    diskUsageWarning,
    downloadEIModel,
    downloadGenericModel,
    getDownloadInfo,
    removeModel,
    openModelPage,
    isModelUninstalling,
    isModelInstalledInApp,
  } = modelActions;

  const renderModel = (model: BrickDetailModel): JSX.Element => (
    <AiModel
      key={model.id}
      model={model}
      inUseModelId={inUseModelId}
      selectedModelId={selectedModelId}
      onModelSelect={onModelSelect}
      readOnly={readOnly}
      isReadOnlyApp={isReadOnlyApp}
      diskUsageWarning={diskUsageWarning(model.id)}
      downloadEIModel={downloadEIModel}
      downloadGenericModel={downloadGenericModel}
      modelDownloadInfo={getDownloadInfo(
        isEdgeImpulseModel(model) ? model.edgeImpulseProps.projectId : model.id,
      )}
      removeModel={removeModel}
      openModelPage={openModelPage}
      isInstalledInApp={isModelInstalledInApp?.(model)}
      isUninstalling={isModelUninstalling}
    />
  );

  const edgeImpulseUserProjectModels: BrickDetailModel[] = [];
  const suggestedModels: BrickDetailModel[] = [];
  const userModels: BrickDetailModel[] = [];

  models.forEach((model) => {
    switch (model.origin) {
      case undefined:
      case 'curated':
        suggestedModels.push(model);
        break;
      case 'user':
        userModels.push(model);
        break;
      case 'edge-impulse-user-project':
        edgeImpulseUserProjectModels.push(model);
        break;
      default: {
        const unhandled: never = model.origin;
        return unhandled;
      }
    }
  });

  const showTrainNewModelSection =
    trainNewModelEnabled || edgeImpulseUserProjectModels.length > 0;
  const showUserModelSection =
    addHuggingFaceModelEnabled || userModels.length > 0;

  return (
    <div className={styles['ai-models-container']}>
      {suggestedModels.length > 0 && (
        <XXSmall bold className={styles['suggested-models-title']}>
          {formatMessage(messages.suggestedModelsSectionTitle)}
        </XXSmall>
      )}
      {suggestedModels.map(renderModel)}

      {showUserModelSection ? (
        <UserModelSection
          addHuggingFaceModelDialogProps={addHuggingFaceModelDialogProps}
          hideAction={!addHuggingFaceModelEnabled}
        >
          {userModels.map(renderModel)}
        </UserModelSection>
      ) : null}

      {showTrainNewModelSection ? (
        <TrainNewModelSection
          onTrainNewModelClick={onTrainNewModelClick}
          trainNewModelDialogProps={trainNewModelDialogProps}
          hideAction={!trainNewModelEnabled}
        >
          {edgeImpulseUserProjectModels.map(renderModel)}
        </TrainNewModelSection>
      ) : null}
    </div>
  );
};

import {
  AIModel,
  EIImpulse,
  EIProject,
} from '@cloud-editor-mono/infrastructure';

export const isCompatibleEICategory = (
  brickType: string,
  category: string | undefined,
  impulses: EIImpulse[] | undefined = [],
): boolean => {
  if (!category) {
    return false;
  }

  switch (category.toLocaleLowerCase()) {
    case 'other':
      // Always show empty projects
      // They're included in the "other" category but we still need to check the lack of presence of learningBlocks
      return (
        impulses.length === 0 ||
        impulses.every((i) => i.learnBlocks.length === 0)
      );
    case 'object detection':
      return [
        'arduino:object_detection',
        'arduino:video_object_detection',
      ].includes(brickType);
    case 'images': {
      const isVisualAnomaly = !!impulses.find((i) =>
        i.learnBlocks.find((lb) => lb.type === 'keras-visual-anomaly'),
      );
      if (isVisualAnomaly) {
        return brickType === 'arduino:visual_anomaly_detection';
      }

      return [
        'arduino:image_classification',
        'arduino:video_image_classification',
      ].includes(brickType);
    }
    case 'audio':
      return brickType === 'arduino:audio_classification';
    case 'keyword spotting':
      return [
        'arduino:audio_classification',
        'arduino:keyword_spotting',
      ].includes(brickType);
    case 'accelerometer':
      return [
        'arduino:motion_detection',
        'arduino:vibration_anomaly_detection',
      ].includes(brickType);
    default:
      return false;
  }
};

export const mapProjectToModel = (project: EIProject): AIModel => {
  return {
    ...project,
    id: project.id.toString(),
    impulses: project.impulses?.map((i) => ({ ...i, id: i.id.toString() })),
  };
};

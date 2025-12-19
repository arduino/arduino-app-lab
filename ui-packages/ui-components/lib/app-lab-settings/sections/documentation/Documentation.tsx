import { UseDocumentationLogic } from '../../settings.type';

interface DocumentationProps {
  logic: ReturnType<UseDocumentationLogic>;
}

const Documentation: React.FC<DocumentationProps> = (
  props: DocumentationProps,
) => {
  const { logic } = props;
  const { documentationInfo } = logic;
  return (
    <div>
      <h2>Documentation Information</h2>
      <div>{documentationInfo}</div>
    </div>
  );
};

export default Documentation;

import { UseStorageLogic } from '../../settings.type';

interface StorageProps {
  logic: ReturnType<UseStorageLogic>;
}

const Storage: React.FC<StorageProps> = (props: StorageProps) => {
  const { logic } = props;

  const { storageInfo } = logic;

  return (
    <div>
      <h2>Storage Information</h2>
      <div>{storageInfo}</div>
    </div>
  );
};

export default Storage;

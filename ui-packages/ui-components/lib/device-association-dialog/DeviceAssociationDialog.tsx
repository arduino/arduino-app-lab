import DeviceAssociationContextProvider, {
  DeviceAssociationContextProviderProps,
} from './context/deviceAssociationContextProvider';
import DeviceAssociationDialogContainer from './DeviceAssociationDialogContainer';

interface DeviceAssociationDialogProps {
  childProps: DeviceAssociationContextProviderProps['childProps'];
}

const DeviceAssociationDialog: React.FC<DeviceAssociationDialogProps> = ({
  childProps,
}: DeviceAssociationDialogProps) => {
  return (
    <DeviceAssociationContextProvider childProps={childProps}>
      <DeviceAssociationDialogContainer />
    </DeviceAssociationContextProvider>
  );
};

export default DeviceAssociationDialog;

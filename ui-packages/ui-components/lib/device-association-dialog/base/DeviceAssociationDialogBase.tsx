import { setCSSVariable } from '@cloud-editor-mono/common';
import clsx from 'clsx';
import { useContext, useEffect, useRef } from 'react';

import { Dialog } from '../../essential/dialog';
import { DeviceAssociationSteps } from '../content/steps';
import { DeviceAssociationContext } from '../context/deviceAssociationContext';
import styles from './device-association-dialog-base.module.scss';

interface DeviceAssociationDialogBaseProps {
  appDomElementId?: string;
  step: DeviceAssociationSteps;
  children: React.ReactNode;
}

const DeviceAssociationDialogBase: React.FC<
  DeviceAssociationDialogBaseProps
> = (props: DeviceAssociationDialogBaseProps) => {
  const { appDomElementId = 'root', step, children } = props;
  const { themeClass, reactModalProps, setIsOpen } = useContext(
    DeviceAssociationContext,
  );

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      step === DeviceAssociationSteps.ManualSelection ||
      step === DeviceAssociationSteps.IdentifyUnknown
    ) {
      setCSSVariable(styles.dialogHeight, styles.dialogMaxHeight);
      return;
    }

    if (step === DeviceAssociationSteps.Over10Detected && dialogRef.current) {
      if (dialogRef.current.clientHeight)
        setCSSVariable(
          styles.dialogHeight,
          `${dialogRef.current.clientHeight}px`,
        );
      return;
    }

    setCSSVariable(styles.dialogHeight, 'unset');
  }, [step]);

  return (
    <Dialog
      ref={dialogRef}
      appDomElementId={appDomElementId}
      reactModalProps={reactModalProps}
      setIsOpen={setIsOpen}
      classes={{
        portal: clsx(styles.container, themeClass),
        overlay: styles.overlay,
      }}
    >
      {children}
    </Dialog>
  );
};

export default DeviceAssociationDialogBase;

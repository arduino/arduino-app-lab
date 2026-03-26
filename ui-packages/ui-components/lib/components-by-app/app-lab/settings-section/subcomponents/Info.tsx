import { InfoIconI } from '@cloud-editor-mono/images/assets/icons';
import clsx from 'clsx';
import React from 'react';

import { useTooltip } from '../../../../tooltip';
import styles from '../settings-section.module.scss';

export interface InfoProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export const Info = ({
  children,
  className,
  title,
}: InfoProps): JSX.Element => {
  const { props: tooltipProps, renderTooltip } = useTooltip({
    content: children,
    direction: 'up-right',
    timeout: 0,
    title,
  });

  return (
    <div
      {...tooltipProps}
      className={clsx(styles['settings-section-info'], className)}
    >
      <InfoIconI />
      {renderTooltip(styles['tooltip-content'])}
    </div>
  );
};

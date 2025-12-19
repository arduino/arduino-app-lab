import {
  AccountStarEmpty,
  AccountStarFilled,
} from '@cloud-editor-mono/images/assets/icons';
import { memo } from 'react';

import { IconButton } from '../icon-button';

interface FavoriteButtonProps {
  isFilled?: boolean;
  onClick: () => void;
  removeLabel?: string;
  addLabel?: string;
  classes?: {
    button?: string;
    icon?: string;
  };
}

const FavoriteButton: React.FC<FavoriteButtonProps> = (
  props: FavoriteButtonProps,
) => {
  const {
    isFilled,
    classes,
    onClick,
    removeLabel = 'Remove item from favorites',
    addLabel = 'Add item to favorites',
  } = props;

  return (
    <IconButton
      Icon={isFilled ? AccountStarFilled : AccountStarEmpty}
      onPress={onClick}
      classes={{ button: classes?.button, icon: classes?.icon }}
      label={isFilled ? removeLabel : addLabel}
    />
  );
};

FavoriteButton.displayName = 'FavoriteButton';
export default memo(FavoriteButton);

import clsx from 'clsx';

import styles from './app-tag.module.scss';
import { AppTagProps, ColorValueHex } from './AppTag.type';

const AppTag: React.FC<AppTagProps> = (props: AppTagProps) => {
  const { Icon, text, color, className, onClick, selected } = props;

  const setStyles = (
    color?: ColorValueHex,
    opacity: string = '20',
    hasBorder: boolean = false,
  ): {
    backgroundColor: string;
    border?: string;
  } => {
    const fallbackColor = '#AEB8B8';
    const border = `1px solid ${color ? color : fallbackColor}`;

    return {
      //The 26 is for 15% opacity on a #RRGGBB color
      backgroundColor: `${color ? color : fallbackColor}${opacity}`,
      border: hasBorder ? border : undefined,
    };
  };

  return (
    <button
      className={clsx(styles.container, className?.container, {
        [styles['selected']]: selected,
      })}
      style={selected ? setStyles(color, '50', true) : undefined}
      onClick={onClick}
    >
      {Icon && (
        <div
          className={clsx(
            styles['icon-container'],
            className?.['icon-container'],
          )}
          style={setStyles(color)}
        >
          {typeof Icon === 'string' ? (
            Icon
          ) : (
            <Icon
              className={clsx(
                styles['icon'],
                className?.['icon'],
                !color ? styles['default'] : undefined,
              )}
            />
          )}
        </div>
      )}
      <span className={clsx(styles.text, className?.text)}>{text}</span>
    </button>
  );
};

export default AppTag;

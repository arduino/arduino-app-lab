import clsx from 'clsx';
import { useRef, useState } from 'react';
import { useButton } from 'react-aria';

import { Loader } from '../essential/loader';
import styles from './editor-image.module.scss';

interface EditorImageProps {
  data?: string;
  extension: string;
  classes?: {
    container?: string;
    image?: string;
    loaderContainer?: string;
  };
}

const EditorImage: React.FC<EditorImageProps> = (props: EditorImageProps) => {
  const { data, extension, classes } = props;

  const [isZoomed, setIsZoomed] = useState(false);

  const ref = useRef<HTMLImageElement>(null);

  const { buttonProps } = useButton(
    { onPress: () => setIsZoomed(!isZoomed) },
    ref,
  );

  return (
    <div
      className={clsx(styles.container, classes?.container, {
        [styles['container-scaled']]: !isZoomed,
      })}
    >
      {data ? (
        <img
          src={`data:image/${extension};base64, ${data.split(',')[1]}`}
          alt="sketch file"
          className={clsx(styles.image, classes?.image, {
            [styles['image-scaled']]: !isZoomed,
            [styles['image-zoomed']]: isZoomed,
          })}
          {...buttonProps}
        />
      ) : (
        <div className={clsx(styles.loaderContainer, classes?.loaderContainer)}>
          <Loader />
        </div>
      )}
    </div>
  );
};

export default EditorImage;

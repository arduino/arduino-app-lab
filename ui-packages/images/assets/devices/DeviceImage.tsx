import { useEffect, useState } from 'react';

import GenericEsp from './device-esp.svg?react';
import Generic from './device-generic.svg?react';
import GenericArduino from './device-generic-arduino.svg?react';

type IconProps = React.SVGProps<SVGSVGElement> & {
  title?: string | undefined;
};

interface DeviceImageProps extends IconProps {
  deviceImageKey: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const imageCache: { [key: string]: any } = {};

const DeviceImage: React.FC<DeviceImageProps> = (props: DeviceImageProps) => {
  const { deviceImageKey, ...rest } = props;

  const [image, setImage] = useState();
  const [_, setError] = useState(false);

  useEffect(() => {
    if (imageCache[deviceImageKey]) return;

    import(`./device-${deviceImageKey.replaceAll(':', '_')}.png`)
      .then((i) => {
        setImage(i);
        imageCache[deviceImageKey] = i;
      })
      .catch(() => setError(true));
  }, [deviceImageKey]);

  const imageToRender = imageCache[deviceImageKey] || image;

  return imageToRender ? (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <img src={(imageToRender as any).default} alt={rest.title} />
  ) : deviceImageKey.toLowerCase().indexOf('arduino') !== -1 ? (
    <GenericArduino {...rest} />
  ) : deviceImageKey.toLowerCase().indexOf('esp') !== -1 ? (
    <GenericEsp />
  ) : (
    <Generic {...rest} />
  );
};

export default DeviceImage;

import {
  ManagedOtaErrors,
  OtaV1_Errors,
} from '@cloud-editor-mono/infrastructure';
const base =
  'https://support.arduino.cc/hc/en-us/articles/15122161765916-If-you-see-an-error-when-performing-an-Over-the-Air-OTA-upload';

const getErrorLink = (anchor: string): JSX.Element => {
  return (
    <a target="_blank" rel="noreferrer" href={`${base}#${anchor}`}>
      Error during upload: {anchor}
    </a>
  );
};

const errorPanels = {
  [OtaV1_Errors.Sha256Unknown]: (
    <div>
      {getErrorLink('sha256unknown')}
      <p>
        The device restarted with a new firmware identifier (SHA) that does not
        match the target or original firmware. Another firmware was likely
        flashed using a different method (e.g., cable) during the OTA process.
      </p>
      <p>
        Please repeat the OTA upload without using a cable or any other external
        intervention.
      </p>
    </div>
  ),
  [OtaV1_Errors.Sha256Mismatch]: (
    <div>
      {getErrorLink('sha256mismatch')}
      <p>
        The device restarted with a firmware identifier (SHA) different from the
        target and matching the one at the start of the OTA process. This
        usually happens when the device restarts during the OTA process.
      </p>
      <p>
        Please check if the current sketch running on the device is unstable and
        causes frequent restarts.
      </p>
    </div>
  ),
  [OtaV1_Errors.OtaStorageInitFail]: (
    <div>
      {getErrorLink('otastorageinitfail')}
      <p>The device’s memory partition table is improperly formatted.</p>
      <ul>
        <li>
          <p>
            If you’re using <strong>Arduino GIGA R1 WiFi</strong> or{' '}
            <strong> Portenta H7</strong>:
          </p>
          <ol>
            <li>
              Reinitialize the storage using the{' '}
              <a href="https://github.com/arduino/ArduinoCore-mbed/blob/main/libraries/STM32H747_System/examples/QSPIFormat/QSPIFormat.ino">
                QSPIFormat.ino
              </a>{' '}
              sketch.
            </li>
            <li>
              Reinstall the SSL certificates using the{' '}
              <a href="https://github.com/arduino/ArduinoCore-mbed/tree/main/libraries/STM32H747_System/examples/WiFiFirmwareUpdater">
                WiFiFirmwareUpdater
              </a>{' '}
              sketch
            </li>
          </ol>
        </li>
        <li>
          <p>
            If you’re using <strong>Arduino Opta</strong>: Follow{' '}
            <a href="https://docs.arduino.cc/tutorials/opta/memory-partitioning/#partitioning-the-memory-of-an-opta">
              these instructions
            </a>
            .
          </p>
        </li>
        <li>
          <p>
            If you’re using <strong>Portenta Machine Control</strong>: Follow{' '}
            <a href="https://docs.arduino.cc/tutorials/opta/memory-partitioning/#partitioning-the-memory-of-a-portenta-machine-control">
              these instructions
            </a>
            .
          </p>
        </li>
      </ul>
    </div>
  ),
  [OtaV1_Errors.ErrorWriteUpdateFileFail]: (
    <div>
      {getErrorLink('errorwriteupdatefilefail')}
      <p>The device’s memory partition table is improperly formatted.</p>
      <ul>
        <li>
          <p>
            If you’re using <strong>Arduino GIGA R1 WiFi</strong> or{' '}
            <strong>Portenta H7</strong>:
          </p>
          <ol>
            <li>
              Reinitialize the storage using the{' '}
              <a href="https://github.com/arduino/ArduinoCore-mbed/blob/main/libraries/STM32H747_System/examples/QSPIFormat/QSPIFormat.ino">
                QSPIFormat.ino
              </a>{' '}
              sketch.
            </li>
            <li>
              Reinstall the SSL certificates using the{' '}
              <a href="https://github.com/arduino/ArduinoCore-mbed/tree/main/libraries/STM32H747_System/examples/WiFiFirmwareUpdater">
                WiFiFirmwareUpdater
              </a>{' '}
              sketch
            </li>
          </ol>
        </li>
        <li>
          <p>
            If you’re using <strong>Arduino Opta</strong>: Follow{' '}
            <a href="https://docs.arduino.cc/tutorials/opta/memory-partitioning/#partitioning-the-memory-of-an-opta">
              these instructions
            </a>
            .
          </p>
        </li>
        <li>
          <p>
            If you’re using <strong>Portenta Machine Control</strong>: Follow{' '}
            <a href="https://docs.arduino.cc/tutorials/opta/memory-partitioning/#partitioning-the-memory-of-a-portenta-machine-control">
              these instructions
            </a>
            .
          </p>
        </li>
      </ul>
    </div>
  ),
  [OtaV1_Errors.ServerConnectErrorFail]: (
    <div>
      {getErrorLink('serverconnecterrorfail')}
      <p>
        The device could not connect to the firmware storage endpoint. Please
        ensure your internet connection is stable and try again.
      </p>
    </div>
  ),
  [OtaV1_Errors.OtaHeaderCrcFail]: (
    <div>
      {getErrorLink('otaheadercrcfail')}
      <p>
        The header of the uploaded file does not match the expected one,
        indicating possible corruption during the upload. Please try again.
      </p>
    </div>
  ),
  [OtaV1_Errors.OtaDownloadFail]: (
    <div>
      <a target="_blank" rel="noreferrer" href={`${base}#otadownloadfail`}>
        Error during upload: otauploadfail
      </a>
      <p>The OTA update failed during the upload of the firmware.</p>
      <p>
        Please ensure your internet connection is stable. Also, check that there
        is no blocking code or long delays in the main loop of your sketch,
        caused by a delay command or intensive workload.
      </p>
    </div>
  ),
  [OtaV1_Errors.HttpResponseFail]: (
    <div>
      {getErrorLink('httpresponsefail')}
      <p>The OTA update failed during the upload of the firmware.</p>
      <p>
        Please ensure your internet connection is stable. Also, check that there
        is no blocking code or long delays in the main loop of your sketch,
        caused by a delay command or intensive workload.
      </p>
    </div>
  ),
};

export const getErrorPanel = (key: ManagedOtaErrors): JSX.Element => {
  return errorPanels[key];
};

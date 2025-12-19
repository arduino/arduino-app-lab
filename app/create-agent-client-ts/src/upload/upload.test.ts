import { UploadStatus } from '@cloud-editor-mono/board-communication-tools';

import { MOCK_AGENT_INFO, MOCK_AGENT_RESPONSE } from '../daemon/agent.test';
import { setAgentDaemonState } from '../daemon/state';
import { listenForAgentStateCondition } from '../daemon/state.reactive';
import { AgentDaemonStateKeys } from '../daemon/state.type';
import { mapAgentInfoResponse } from '../mapper';
import { UploadToAgentPortPayload } from './upload.type';

vi.mock('@cloud-editor-mono/infrastructure', () => ({
  httpPostRaw: vi.fn().mockImplementation((_url: string, endpoint: string) => {
    if (endpoint === '/upload') {
      return Promise.resolve(null);
    }
    return Promise.resolve({});
  }),
}));

vi.doUnmock('../utils');
vi.doUnmock('../downloads/downloads');

const MOCK_PAYLOAD: UploadToAgentPortPayload = {
  sketchId: 'mock',
  boardType: 'serial',
  fqbn: 'arduino:samd:mkrwifi1010',
  port: '/dev/cu.usbmodem21401',
  sketchName: 'EditorBeta_Sketch',
  compileData: {
    bin: 'mock',
    binUrl: '/v1/compile/EditorBeta_Sketch.bin',
    elf: 'mock',
    elfUrl: '/v1/compile/EditorBeta_Sketch.elf',
    hex: 'mock',
    hexUrl: '/v1/compile/EditorBeta_Sketch.hex',
    stderr: '',
    stdout:
      '/usr/local/bin/arduino-cli compile --fqbn arduino:samd:mkrwifi1010 --libraries /home/builder/opt/libraries/latest --build-cache-path /tmp --output-dir /tmp/009533488/build --build-path /tmp/arduino-build-A03FD365CA27D29C3CDAE99DBB6DE31A  /tmp/009533488/EditorBeta_Sketch\n[info] Sketch uses 12244 bytes (4%) of program storage space. Maximum is 262144 bytes.\n[info] Global variables use 2996 bytes (9%) of dynamic memory, leaving 29772 bytes for local variables. Maximum is 32768 bytes.\n',
  },
  computeUploadInfo: {
    commandline:
      '"{runtime.tools.bossac-1.7.0-arduino3.path}/bossac" -i -d --port={serial.port.file} -U true -i -e -w -v "{build.path}/{build.project_name}.bin" -R',
    options: {
      use_1200bps_touch: true,
      wait_for_upload_port: true,
    },
    signature: 'mock',
    files: [
      {
        filename: 'mock',
        hex: 'mock',
      },
    ],
    tools: [],
  },
};

describe('uploadToSerialPort', () => {
  beforeEach(() => {
    setAgentDaemonState({
      [AgentDaemonStateKeys.AgentInfo]: mapAgentInfoResponse({
        ...MOCK_AGENT_INFO,
        url: MOCK_AGENT_RESPONSE.url,
        status: MOCK_AGENT_RESPONSE.status,
      }),
    });

    vi.mocked(listenForAgentStateCondition).mockReturnValue(
      Promise.resolve(UploadStatus.DONE),
    );
  });

  afterAll(() => {
    vi.resetAllMocks();
  });

  it('should not fail with correct payload', async () => {
    const { uploadToAgentPort: uploadToSerialPort } = await import('./upload');

    await expect(uploadToSerialPort(MOCK_PAYLOAD)).resolves.not.toThrow();
  });

  it('should upload successfully to serial port', async () => {
    const { uploadToAgentPort: uploadToSerialPort } = await import('./upload');

    const uploadStatus = await uploadToSerialPort(MOCK_PAYLOAD);
    expect(uploadStatus).toEqual(UploadStatus.DONE);
  });

  it('should not download tools if they are not required in the upload payload information', async () => {
    const { uploadToAgentPort: uploadToSerialPort } = await import('./upload');
    const downloads = await import('../downloads/downloads');
    const downloadTools = vi.spyOn(downloads, 'downloadTools');

    const uploadStatus = await uploadToSerialPort(MOCK_PAYLOAD);
    expect(uploadStatus).toEqual(UploadStatus.DONE);
    expect(downloadTools).not.toHaveBeenCalled();
  });

  it('should download tools if they are required in the upload payload information', async () => {
    const { uploadToAgentPort: uploadToSerialPort } = await import('./upload');
    const downloads = await import('../downloads/downloads');
    const downloadTools = vi.spyOn(downloads, 'downloadTools');

    const uploadStatus = await uploadToSerialPort({
      ...MOCK_PAYLOAD,
      computeUploadInfo: {
        ...MOCK_PAYLOAD.computeUploadInfo,
        tools: [
          {
            checksum: 'SHA-256:mock',
            name: 'bossac',
            packager: 'arduino',
            signature: 'mock',
            url: 'http://downloads.arduino.cc/tools/bossac-1.7.0-arduino3-osx.tar.gz',
            version: '1.7.0-arduino3',
          },
        ],
      },
    });
    expect(uploadStatus).toEqual(UploadStatus.DONE);
    expect(downloadTools).toHaveBeenCalled();
  });
});

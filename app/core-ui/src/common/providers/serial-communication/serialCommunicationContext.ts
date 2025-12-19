import {
  AgentInfoResponse,
  AgentPort,
} from '@cloud-editor-mono/create-agent-client-ts';
import { CompileErrors, MappedPort } from '@cloud-editor-mono/domain';
import { ArduinoBuilderV2CompilationsResponse_BuilderApi } from '@cloud-editor-mono/infrastructure';
import {
  WebSerialBoard,
  WebSerialPort,
} from '@cloud-editor-mono/web-board-communication';
import { createContext, Dispatch, SetStateAction } from 'react';
import { Observable } from 'rxjs';

import { CompilePayload } from '../../../common/hooks/queries/builder.type';
import { Progression } from '../../../common/hooks/queries/iot.type';

export type AgentInfo = void | AgentInfoResponse | undefined;

export type MappedPorts = MappedPort[];

export type UseSerialCommunication = () => SerialCommunicationContextValue;

export type UseAgent = (agentEnabled: boolean) => {
  agentPorts?: AgentPort[];
};

export type UseWebSerial = (agentEnabled: boolean) => {
  webSerialPorts?: WebSerialPort[];
};

export type SerialCommunicationContextValue = {
  mappedPorts?: MappedPorts;
  upload: (
    fqbn: string,
    sketchId: string,
    boardType: string,
    port: string,
    sketchName: string,
    compilePayload: CompilePayload,
    existingCompilation?: ArduinoBuilderV2CompilationsResponse_BuilderApi,
  ) => void;
  uploadStream: Observable<string>;
  clearUploadStream: () => void;
  uploadIsCompiling: boolean;
  uploadIsComputing: boolean;
  uploadIsUploading: boolean;
  uploadCompilingProgress?: Progression;
  compileErrors?: CompileErrors;
  compileHasFailed: boolean;
  compileWarnLineStart?: number;
  compileWarnLineEnd?: number;
  uploadHasError: boolean;
  uploadOutputLineStart?: number;
  updatePortInfo: (portBoardId: string, props: Partial<MappedPort>) => void;
  clearUpdatedPortInfo: (portName: string) => void;
  busyPorts: AgentPort[] | WebSerialPort[];
  detectBoards: () => Promise<WebSerialBoard>;
  forceUpdate: Dispatch<SetStateAction<Record<string, unknown>>>;
  compileResultMessages?: string;
  errorFiles?: string[];
  updatedPorts: {
    portBoardId: string;
    props: Partial<MappedPort>;
  }[];
};

const SerialCommunicationContextValue: SerialCommunicationContextValue =
  {} as SerialCommunicationContextValue;

export const SerialCommunicationContext =
  createContext<SerialCommunicationContextValue>(
    SerialCommunicationContextValue,
  );

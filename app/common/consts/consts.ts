export const BOARD_FQBN = {
  UNO_Q: 'arduino:zephyr:unoq',
  VENTUNO_Q: 'arduino:zephyr:ventunoq',
} as const;

export const EI_LATENCY_DEVICE = {
  UNO_Q: 'arduino-unoq',
  VENTUNO_Q: 'arduino-ventuno-q',
} as const;

export type EILatencyDevice =
  typeof EI_LATENCY_DEVICE[keyof typeof EI_LATENCY_DEVICE];

export const Q_BOARD_LATENCY_DEVICES = Object.values(
  EI_LATENCY_DEVICE,
) as EILatencyDevice[];

export const isQBoardLatencyDevice = (
  latencyDevice?: string,
): latencyDevice is EILatencyDevice =>
  Q_BOARD_LATENCY_DEVICES.includes(latencyDevice as EILatencyDevice);

export const EI_LATENCY_DEVICE_BY_FQBN: Record<string, EILatencyDevice> = {
  [BOARD_FQBN.UNO_Q]: EI_LATENCY_DEVICE.UNO_Q,
  [BOARD_FQBN.VENTUNO_Q]: EI_LATENCY_DEVICE.VENTUNO_Q,
};

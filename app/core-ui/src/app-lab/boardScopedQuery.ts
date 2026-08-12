export enum BoardScopedQuery {
  // apps
  LIST_MY_APPS = 'list-my-apps',
  GET_DEFAULT_APP = 'get-default-app',
  CHECK_APPS_TO_REDIRECT = 'check-apps-to-redirect',
  // bricks
  LIST_BRICKS = 'list-bricks',
  GET_BRICK_DETAILS = 'get-brick-details',
  GET_BRICK_API_DOCS = 'get-brick-api-docs',
  GET_BRICK_EXAMPLES = 'get-brick-examples',
  GET_BRICK_INSTANCE = 'get-brick-instance',
  APP_BRICKS = 'app-bricks',
  // files / libraries living on the board
  APP_FILES = 'app-files',
  APP_SKETCH_LIBRARIES = 'app-sketch-libraries',
  LIST_SKETCH_LIBRARIES = 'list-sketch-libraries',
  // board identity / config / system
  APP_CONFIG = 'app-config',
  SYSTEM_PROPERTIES = 'system-properties',
  GET_BOARD_NAME = 'get-board-name',
  GET_KEYBOARD_LAYOUT = 'get-keyboard-layout',
  LIST_KEYBOARD_LAYOUTS = 'list-keyboard-layouts',
  // hardware / carriers
  CARRIERS = 'carriers',
  CARRIERS_STATUS = 'carriers-status',
  // OS / network settings reported by the board
  NETWORK_MODE_ENABLED = 'network-mode-enabled',
  CONNECTION_NAME = 'connection-name',
  IP_ADDRESS = 'ip-address',
  OS_IMAGE_VERSION = 'os-image-version',
  KERNEL_VERSION = 'kernel-version',
  LINUX_DISTRIBUTION = 'linux-distribution',
  WIFI_STATUS = 'wifi-status',
  ETHERNET_STATUS = 'ethernet-status',
  INTERNET_STATUS = 'internet-status',
  NETWORK_LIST = 'networkList',
  // board firmware / image update state
  BOARD_UPDATE_CHECK = 'board-update-check',
  // installed AI models
  GET_INSTALLED_MODELS = 'get-installed-models',
}

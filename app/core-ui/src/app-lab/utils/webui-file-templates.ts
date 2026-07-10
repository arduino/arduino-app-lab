// SPDX-FileCopyrightText: Copyright (C) Arduino s.r.l. and/or its affiliated companies
//
// SPDX-License-Identifier: MPL-2.0

/**
 * File templates for the WebUI brick automatic file creation
 *
 * IMPLEMENTATION NOTE - Future Migration Path:
 * ============================================
 * This file contains hardcoded templates for the WebUI brick (arduino:web_ui).
 * The current implementation checks the brick ID in the frontend and creates files
 * with these templates when the brick is added to a project.
 *
 * RECOMMENDED FUTURE APPROACH:
 * The backend (orchestrator service) should provide scaffold files through the
 * BrickDetailsResult API response. This would allow:
 *
 * 1. Backend-driven file creation: Add a 'scaffold_files' field to BrickDetailsResult
 *    containing an array of {path, filename, extension, content, is_folder}
 *
 * 2. Generic frontend logic: Replace brick-specific checks with a generic function
 *    that reads scaffold_files from getBrickDetails() and creates them dynamically
 *
 * 3. Template management: Store templates in the backend/orchestrator, allowing
 *    updates without frontend deployments
 *
 * 4. Extensibility: Any brick can provide scaffold files, not just WebUI
 *
 * Migration steps:
 * - Add 'scaffold_files' field to orchestrator API (BrickDetailsResult schema)
 * - Implement generic createBrickScaffoldFiles() utility function
 * - Update appDetail.logic.tsx to use getBrickDetails() instead of hardcoded checks
 * - Deprecate this file and create-webui-files.ts once backend migration is complete
 *
 * See conversation history or git blame for detailed implementation proposal.
 */

/**
 * Generates the index.html content with the provided app name
 * @param appName - The name of the application from app.yaml
 * @returns The complete HTML content
 */
export function generateIndexHTML(appName: string): string {
  return `<!--
SPDX-FileCopyrightText: Copyright (C) Arduino s.r.l. and/or its affiliated companies

SPDX-License-Identifier: MPL-2.0
-->

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${appName}</title>
    <link rel="stylesheet" type="text/css" href="style.css" />
  </head>
  <body>
    <!-- Add your HTML here -->

    <script src="libs/socket.io.min.js"></script>
    <script src="libs/arduino.js"></script>
    <script src="app.js"></script>
  </body>
</html>
`;
}

/**
 * Template for app.js - Pre-instantiated WebUI application entry point
 */
export const WEBUI_APP_JS_TEMPLATE = `// Initialize UI
const ui = new WebUI();
ui.on_connect(onUIConnected);

// Called when the websocket connection is established.
function onUIConnected() {
  // Write your logic here
}
`;

/**
 * Template for style.css - Empty stylesheet for user customization
 */
export const WEBUI_STYLE_CSS_TEMPLATE = `/* Add your custom styles here */

`;

/**
 * Template for arduino.js - WebUI library class
 */
export const ARDUINO_JS_TEMPLATE = `// SPDX-FileCopyrightText: Copyright (C) Arduino s.r.l. and/or its affiliated companies
//
// SPDX-License-Identifier: MPL-2.0

class WebUI {
  #socket;

  constructor(options = {}) {
    this.#socket = io(\`http://\${window.location.host}\`, options);
  }

  /**
   * Called when the websocket connects to the server.
   * @param {() => void} callback - Called once when the connection is established.
   */
  on_connect(callback) {
    this.#socket.on('connect', callback);
  }

  /**
   * Called when the websocket disconnects from the server.
   * @param {() => void} callback - Called once when the connection is lost.
   */
  on_disconnect(callback) {
    this.#socket.on('disconnect', callback);
  }

  /**
   * Registers a callback for a specific event message from the board.
   * @param {string} eventName - The name of the event to listen for (e.g., 'led_status_update').
   * @param {(data: any) => void} callback - Callback invoked when the event is received.
   */
  on_message(eventName, callback) {
    this.#socket.on(eventName, callback);
  }

  /**
   * Sends a message to the board for a specific event.
   * @param {string} eventName - The name of the event to send (e.g., 'toggle_led').
   * @param {*} [data] - The data to send with the event. If omitted, an empty object is sent.
   */
  send_message(eventName, data) {
    this.#socket.emit(eventName, data ?? {});
  }
}
`;

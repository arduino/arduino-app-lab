// SPDX-FileCopyrightText: Copyright (C) Arduino s.r.l. and/or its affiliated companies
//
// SPDX-License-Identifier: MPL-2.0

import {
  ARDUINO_JS_TEMPLATE,
  generateIndexHTML,
  WEBUI_APP_JS_TEMPLATE,
  WEBUI_STYLE_CSS_TEMPLATE,
} from './webui-file-templates';

/**
 * Creates the required files for the WebUI brick
 * @param appName - The app name for the HTML title
 * @param createAppFolder - Function to create app folders (from useAppDetailFiles hook)
 * @param addAppFile - Function to add app files (from useAppDetailFiles hook)
 * @throws Error if file creation fails
 */
export async function createWebUIFiles(
  appName: string,
  createAppFolder: (path: string) => Promise<void>,
  addAppFile: (
    fileId: string,
    fileName: string,
    fileExtension: string,
    content?: string,
  ) => Promise<void>,
): Promise<void> {
  try {
    // Lazy-load the Socket.IO UMD bundle so the ~46 KB minified string stays
    // out of the main core-ui chunk and is only fetched when the WebUI brick
    // is actually added. Mirrors the pattern used in `common/hooks/keywords.ts`.
    const { default: socketIoBundle } = await import('./socket-io-bundle');

    // Create folder structure
    await createAppFolder('assets');
    await createAppFolder('assets/libs');

    // Create files with templates
    await Promise.all([
      addAppFile(
        'assets/index.html',
        'index',
        'html',
        generateIndexHTML(appName),
      ),
      addAppFile('assets/app.js', 'app', 'js', WEBUI_APP_JS_TEMPLATE),
      addAppFile('assets/style.css', 'style', 'css', WEBUI_STYLE_CSS_TEMPLATE),
      addAppFile(
        'assets/libs/arduino.js',
        'arduino',
        'js',
        ARDUINO_JS_TEMPLATE,
      ),
      addAppFile(
        'assets/libs/socket.io.min.js',
        'socket.io.min',
        'js',
        socketIoBundle,
      ),
    ]);
  } catch (error) {
    console.error('Failed to create WebUI files:', error);
    throw error;
  }
}

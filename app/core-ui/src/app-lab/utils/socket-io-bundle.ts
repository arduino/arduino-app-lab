// SPDX-FileCopyrightText: Copyright (C) Arduino s.r.l. and/or its affiliated companies
//
// SPDX-License-Identifier: MPL-2.0

/**
 * Raw text of the minified Socket.IO browser UMD bundle, embedded into
 * user-generated WebUI projects.
 *
 * The bundle file (`../assets/socket.io.min.js`) is **not** committed to git.
 * It is fetched at build time by `dev-utils/dev-config/scripts/download_socket_io.sh`
 * from jsDelivr, pinned by exact version + SHA-256 for reproducibility and
 * supply-chain integrity. The script is wired into the Wails frontend
 * `download.sh` orchestrator (parallel pre-download for app-lab-desktop) and
 * exposed as the `download:socket-io` yarn script in the
 * `@bcmi-labs/cloud-editor-dev-config` workspace for manual/CI invocation.
 *
 * Vite's `?raw` import inlines the file contents as a string at compile time.
 * The `/*! Socket.IO MIT *\/` license banner is preserved inline in the
 * minified bundle, so attribution is carried into every generated user
 * project automatically.
 *
 * This module is intentionally minimal so that it is loaded as its own
 * code-split chunk when imported dynamically. See `create-webui-files.ts`,
 * which uses `await import('./socket-io-bundle')` to defer loading of the
 * bundle string until the WebUI brick is actually added.
 */
import socketIoBundle from '../assets/socket.io.min.js?raw';

export default socketIoBundle;

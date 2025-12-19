#!/usr/bin/env node

/******************************************************************
 * Script to push the create a new branch for upcoming PR
 ******************************************************************/

import { execSync } from 'node:child_process';
import { exit } from 'node:process';

function run(gitHash, newVersion) {
  try {
    const subfix = ''; // gitHash ? `-${gitHash.substring(0, 7)}` : '';

    const command = `git checkout -b release-v${newVersion}${subfix}`;
    console.log(`Launching command: ${command}`);

    execSync(command);

    console.log(`Release branch for "${newVersion}" successfully created`);
  } catch (error) {
    console.error('Error occurred: ', error);
    exit(error.status);
  }
}
run(process.argv[2] || '', process.argv[3]);

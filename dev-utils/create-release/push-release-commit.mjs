#!/usr/bin/env node

/******************************************************************
 * Script to push and create a new PR
 ******************************************************************/

import { execSync } from 'node:child_process';
import { exit } from 'node:process';

function run(gitHash, newVersion) {
  try {
    const subfix = ''; // gitHash ? `-${gitHash.substring(0, 7)}` : '';

    const command = `git push origin release-v${newVersion}${subfix}`;
    console.log(`Launching command: ${command}`);

    execSync(command);

    console.log(`Commit "${newVersion}" successfully created`);
  } catch (error) {
    console.error('Error occurred: ', error);
    exit(error.status);
  }
}
run(process.argv[2] || '', process.argv[3]);

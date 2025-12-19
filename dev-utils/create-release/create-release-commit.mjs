#!/usr/bin/env node

/******************************************************************
 * Script to create a new branch, and a new commit on it,
 * which will be used as starting point for subsequent PR
 ******************************************************************/

import { execSync } from 'node:child_process';
import { exit } from 'node:process';

function run(commitMessage) {
  try {
    if (!commitMessage) {
      console.error(`Invalid version [${commitMessage}]`);
    }
    const command = `git commit -a -m "${commitMessage}"`;
    console.log(`Launching command: ${command}`);

    execSync(command);

    console.log(`Commit "${commitMessage}" successfully created`);
  } catch (error) {
    console.error('Error occurred: ', error);
    exit(error.status);
  }
}
run(process.argv[2]);

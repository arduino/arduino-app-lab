#!/usr/bin/env node

/******************************************************************
 * Script to invoke lerna version
 ******************************************************************/

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { exit } from 'node:process';

function run(versionType) {
  try {
    let lernaFile = fs.readFileSync(path.join(process.cwd(), './lerna.json'));
    let lerna = JSON.parse(lernaFile);
    const previousVersion = lerna.version;

    console.log(`Bumping '${versionType}' from version '${previousVersion}'`);

    const command = `lerna version ${versionType} -y --no-push --no-git-tag-version --force-publish='*'`;
    console.log(`Launching command: ${command}`);

    execSync(command);

    lernaFile = fs.readFileSync(path.join(process.cwd(), './lerna.json'));
    lerna = JSON.parse(lernaFile);
    const newVersion = lerna.version;

    console.log(
      `Version "${previousVersion}" successfully bumped to ${newVersion}`,
    );
  } catch (error) {
    console.error('Error occurred: ', error);
    exit(error.status);
  }
}
run(process.argv[2] || 'patch');

#!/usr/bin/env node

/******************************************************************
 * Script to bump the version of Cloud Editor component in
 * iot-cloud app
 ******************************************************************/
import * as fs from 'node:fs';
import * as path from 'node:path';
import { exit } from 'node:process';

const TMP_IOT_CLOUD_FOLDER = 'temp-iot-cloud-dir/';

function run(newVersion) {
  try {
    if (!newVersion) {
      console.info(`No versions specified [${newVersion}]`);
      exit(-1);
    }

    console.log(`Upgrading cloud-editor-component to ${newVersion}`);

    const packageFile = fs.readFileSync(
      path.join(process.cwd(), `./${TMP_IOT_CLOUD_FOLDER}package.json`),
    );
    const packageContent = JSON.parse(packageFile);
    packageContent.dependencies['@bcmi-labs/cloud-editor-component'] =
      newVersion;
    savePackageFile(packageContent);

    console.log('Custom version replacement succeded');
  } catch (error) {
    console.error('Error occurred: ', error);
    exit(error.status);
  }
}

function savePackageFile(packageContent) {
  fs.writeFileSync(
    path.join(process.cwd(), `./${TMP_IOT_CLOUD_FOLDER}package.json`),
    JSON.stringify(packageContent, null, 2) + '\n',
  );
}

run(process.argv[2]);

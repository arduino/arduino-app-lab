#!/usr/bin/env node

/******************************************************************
 * Script to bump the version of Cloud Editor (standalone)
 * and component
 ******************************************************************/
import * as fs from 'node:fs';
import * as path from 'node:path';
import { exit } from 'node:process';

import glob from 'glob';
import { replaceInFileSync } from 'replace-in-file';

function run(prevVersion, newVersion) {
  try {
    if (!prevVersion || !newVersion) {
      console.log(
        `Invalid versions: previous[${prevVersion}] new[${newVersion}]`,
      );
      exit(-1);
    }
    // trying to see if the previous version is the same than the current, we just quit the script
    // this is useful if user choose 'no' from lerna version
    if (prevVersion === newVersion) {
      console.log(
        `No upgrade needed: previous[${prevVersion}] new[${newVersion}]`,
      );
      exit(-1);
    }

    console.log(`Custom replacement from ${prevVersion} to ${newVersion}`);

    const packageFile = fs.readFileSync(
      path.join(process.cwd(), './package.json'),
    );
    const packageContent = JSON.parse(packageFile);
    const deps = packageContent.dependencies;
    const devDeps = packageContent.devDependencies;

    packageContent.dependencies = replaceAliasesInPackage(deps, newVersion);
    packageContent.devDependencies = replaceAliasesInPackage(
      devDeps,
      newVersion,
    );

    savePackageFile(packageContent);

    const files = findEnvFiles();
    replaceVersionInEnvFiles(files, newVersion);
    console.log('Custom version replacement succeded');
  } catch (error) {
    console.error('Error occurred: ', error);
  }
}

/**
 *
 * E.g. "@cloud-editor-mono/common": "npm:@bcmi-labs/cloud-editor-common@^1.3.18",
 * @param {*} deps
 */
function replaceAliasesInPackage(deps, newVersion) {
  const newDeps = deps;
  for (const dep in deps) {
    const currentDep = deps[dep];
    if (currentDep.startsWith('npm:@bcmi-labs')) {
      const updatedVersion = currentDep.replace(/\^.*$/, `^${newVersion}`);
      newDeps[dep] = updatedVersion;
    }
  }
  return newDeps;
}

function savePackageFile(packageContent) {
  fs.writeFileSync(
    path.join(process.cwd(), './package.json'),
    JSON.stringify(packageContent, null, 2) + '\n',
  );
}

function findEnvFiles() {
  return glob.sync('./**/.env.{development,production,test}', {
    ignore: [
      './node_modules/**',
      'build/**',
      '.yarn/**',
      'dist/**',
      '__engines__/**',
    ],
  });
}
function replaceVersionInEnvFiles(envFiles, newVersion) {
  const options = {
    files: envFiles,
    from: /VITE_APP_VERSION='\d+\.\d+.\d+'/g,
    to: `VITE_APP_VERSION='${newVersion}'`,
  };
  replaceInFileSync(options);
}

run(process.argv[2], process.argv[3]);

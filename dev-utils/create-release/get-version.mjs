#!/usr/bin/env node

/******************************************************************
 * Script to store the previous version of Cloud Editor (standalone)
 * and component, useful for comparing versions
 ******************************************************************/
import * as fs from 'node:fs';
import * as path from 'node:path';
import { exit } from 'node:process';

try {
  const lernaFile = fs.readFileSync(path.join(process.cwd(), './lerna.json'));
  const lerna = JSON.parse(lernaFile);
  const newVersion = lerna.version;
  console.log(newVersion);
} catch (error) {
  console.error('Error occurred: ', error);
  exit(-1);
}

#!/usr/bin/env node
// Build app/ with the given build sha stamped into index.html and app.js (meta + footer).
import { readFileSync, writeFileSync } from 'node:fs';

const sha = process.argv[2] || process.env.BUILD_SHA || 'dev';
const file = 'app/index.html';
const src = readFileSync(file, 'utf8');
writeFileSync(file, src.replaceAll('__BUILD_SHA__', sha));
console.log('stamped build', sha);

/* eslint-env node */
/* global console */

// Minimal, dependency-free generator that mirrors @zern/tsls behavior.
// Scans for declarative specs and writes module augmentations to
// generated/zern-augmentations.d.ts so IntelliSense works without the LS plugin.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve relative to repository root (script lives in scripts/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function posixPath(p) {
  return p.replace(/\\/g, '/');
}

function walk(startDir) {
  /** @type {string[]} */
  const files = [];
  /** @type {string[]} */
  const stack = [startDir];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        // Skip node_modules and dist to be safe
        if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
        stack.push(full);
      } else if (e.isFile()) {
        files.push(full);
      }
    }
  }
  return files;
}

/** @param {string} src */
function collectKeys(src) {
  /** @type {{events: Record<string, string[]>, alerts: Record<string, string[]>, hooks: Record<string, string[]>}} */
  const acc = { events: {}, alerts: {}, hooks: {} };

  const evRe = /createEvents\(\s*['"]([A-Za-z0-9_.-]+)['"]\s*,\s*\{([\s\S]*?)\}\s*\)/g;
  const alRe = /createAlerts\(\s*['"]([A-Za-z0-9_.-]+)['"]\s*,\s*\{([\s\S]*?)\}\s*\)/g;
  const hkRe = /createHooks\(\s*['"]([A-Za-z0-9_.-]+)['"]\s*,\s*\{([\s\S]*?)\}\s*\)/g;
  const keyRe = /([A-Za-z0-9_]+)\s*:/g;

  let m;
  while ((m = evRe.exec(src))) {
    const ns = m[1];
    const body = m[2];
    const keys = [];
    let km;
    while ((km = keyRe.exec(body))) keys.push(km[1]);
    acc.events[ns] = [...(acc.events[ns] ?? []), ...keys];
  }
  while ((m = alRe.exec(src))) {
    const ns = m[1];
    const body = m[2];
    const keys = [];
    let km;
    while ((km = keyRe.exec(body))) keys.push(km[1]);
    acc.alerts[ns] = [...(acc.alerts[ns] ?? []), ...keys];
  }
  while ((m = hkRe.exec(src))) {
    const ns = m[1];
    const body = m[2];
    const keys = [];
    let km;
    while ((km = keyRe.exec(body))) keys.push(km[1]);
    acc.hooks[ns] = [...(acc.hooks[ns] ?? []), ...keys];
  }
  return acc;
}

function mergeMaps(target, src) {
  for (const [ns, keys] of Object.entries(src)) {
    target[ns] = [...new Set([...(target[ns] ?? []), ...keys])];
  }
}

function buildAugmentationSource(nsToKeys) {
  const escapeKey = k => k.replace(/[^A-Za-z0-9_]/g, '_');
  const toRecord = (keys, kind) =>
    keys.map(k => `    ${escapeKey(k)}: { __type: '${kind}-def' }`).join('\n');
  const blocks = [];
  const evBody = Object.entries(nsToKeys.events)
    .map(([ns, keys]) => `  ${ns}: {\n${toRecord(keys, 'event')}\n  }`)
    .join('\n');
  const alBody = Object.entries(nsToKeys.alerts)
    .map(([ns, keys]) => `  ${ns}: {\n${toRecord(keys, 'alert')}\n  }`)
    .join('\n');
  const hkBody = Object.entries(nsToKeys.hooks)
    .map(([ns, keys]) => `  ${ns}: {\n${toRecord(keys, 'hook')}\n  }`)
    .join('\n');
  if (evBody)
    blocks.push(`declare module '@events/types' {\n  interface ZernEvents {\n${evBody}\n  }\n}`);
  if (alBody)
    blocks.push(`declare module '@alerts/types' {\n  interface ZernAlerts {\n${alBody}\n  }\n}`);
  if (hkBody)
    blocks.push(`declare module '@hooks/types' {\n  interface ZernHooks {\n${hkBody}\n  }\n}`);
  return blocks.join('\n\n');
}

function main() {
  const repoRoot = projectRoot; // scripts/
  const srcRoot = repoRoot;
  const allFiles = walk(srcRoot);
  // Filters similar to the plugin defaults
  const isSpecLike = p =>
    /\.plugin\.ts$/.test(p) ||
    // eslint-disable-next-line no-useless-escape
    /[\\\/]specs[\\\/].*\.ts$/.test(p) ||
    // eslint-disable-next-line no-useless-escape
    /[\\\/]examples[\\\/].*\.(ts|tsx)$/.test(p);

  const aggregate = { events: {}, alerts: {}, hooks: {} };
  for (const f of allFiles) {
    const rel = posixPath(path.relative(repoRoot, f));
    if (!isSpecLike(rel)) continue;
    let src = '';
    try {
      src = fs.readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    const partial = collectKeys(src);
    mergeMaps(aggregate.events, partial.events);
    mergeMaps(aggregate.alerts, partial.alerts);
    mergeMaps(aggregate.hooks, partial.hooks);
  }

  const outDir = path.join(repoRoot, 'generated');
  const outFile = path.join(outDir, 'zern-augmentations.d.ts');
  fs.mkdirSync(outDir, { recursive: true });
  const content = buildAugmentationSource(aggregate);
  fs.writeFileSync(outFile, content + (content ? '\n' : ''), 'utf8');
  const evCount = Object.values(aggregate.events).reduce((a, b) => a + b.length, 0);
  const alCount = Object.values(aggregate.alerts).reduce((a, b) => a + b.length, 0);
  const hkCount = Object.values(aggregate.hooks).reduce((a, b) => a + b.length, 0);
  console.log(
    `[gen] wrote ${outFile} (events=${evCount} alerts=${alCount} hooks=${hkCount}, bytes=${content.length})`
  );
}

main();

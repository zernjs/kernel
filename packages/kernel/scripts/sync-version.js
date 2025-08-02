#!/usr/bin/env node

/**
 * Script to synchronize package.json version with centralized version
 */

const fs = require('fs');
const path = require('path');

// Read the centralized version
const versionPath = path.join(__dirname, '../src/version.ts');
const versionContent = fs.readFileSync(versionPath, 'utf8');

// Extract KERNEL_VERSION
const kernelVersionMatch = versionContent.match(/export const KERNEL_VERSION = '([^']+)'/);
if (!kernelVersionMatch) {
  console.error('Could not find KERNEL_VERSION in version.ts');
  process.exit(1);
}

const kernelVersion = kernelVersionMatch[1];

// Read package.json
const packagePath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Update version if different
if (packageJson.version !== kernelVersion) {
  console.log(`Updating package.json version from ${packageJson.version} to ${kernelVersion}`);
  packageJson.version = kernelVersion;

  // Write back to package.json
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log('Version synchronized successfully');
} else {
  console.log('Version is already synchronized');
}

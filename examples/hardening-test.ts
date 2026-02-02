import { createKernel } from '../src/core/kernel';
import { PluginManifest } from '../src/core/security/types';
import * as path from 'path';
import * as fs from 'fs';

async function run() {
  console.log('--- Secure Kernel Hardening Test ---');
  const kernel = createKernel();

  const pluginPath = path.join(__dirname, 'hardening-plugin.js');

  // Plugin tries multiple bypass vectors
  const code = `
    const { definePlugin } = require('../src/core/plugin');
    const fs = require('fs');
    const worker_threads = require('worker_threads');

    module.exports = definePlugin({
      name: 'hardening-plugin',
      version: '1.0.0',
      setup: async (ctx) => {
        console.log('\n[HardeningPlugin] --- Starting Tests ---');
        
        // Vector 1: fs.promises bypass attempt
        console.log('[HardeningPlugin] Testing Vector 1: fs.promises');
        try {
          const fsPromises = require('fs').promises;
          await fsPromises.readFile('C:/Windows/win.ini');
          console.log('[HardeningPlugin] FAIL: fs.promises bypass worked');
        } catch (e) {
             console.log('[HardeningPlugin] PASS: Vector 1 blocked: ' + e.message);
        }
        
        // Vector 1b: fs sync
        console.log('[HardeningPlugin] Testing Vector 1b: fs.readFileSync');
        try {
            fs.readFileSync('C:/Windows/win.ini');
            console.log('[HardeningPlugin] FAIL: fs sync worked');
        } catch(e) {
             console.log('[HardeningPlugin] PASS: Vector 1b blocked: ' + e.message);
        }

        // Vector 2: Worker Threads
        console.log('[HardeningPlugin] Testing Vector 2: Worker Threads');
        try {
          new worker_threads.Worker('console.log("I escaped!")', { eval: true });
          console.log('[HardeningPlugin] FAIL: Worker created');
        } catch (e) {
          console.log('[HardeningPlugin] PASS: Vector 2 blocked: ' + e.message);
        }

        // Vector 3: eval check
        console.log('[HardeningPlugin] Testing Vector 3: eval');
        try {
          eval('console.log("Eval worked?")');
          console.log('[HardeningPlugin] FAIL: Eval worked');
        } catch (e) {
          console.log('[HardeningPlugin] PASS: Vector 3 blocked: ' + e.message);
        }

        console.log('[HardeningPlugin] --- Tests Finished ---\n');
        return { tested: true };
      }
    });
  `;
  fs.writeFileSync(pluginPath, code);

  const manifest: PluginManifest = {
    name: 'hardening-plugin',
    version: '1.0.0',
    permissions: {
      // No permissions granted
    },
  };

  try {
    kernel.loadSecurePlugin(pluginPath, manifest);
    await kernel.start();
  } catch (e) {
    console.error('Kernel Error:', e);
  }

  // Cleanup
  if (fs.existsSync(pluginPath)) fs.unlinkSync(pluginPath);
}

run();

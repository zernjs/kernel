import { createKernel } from '../src/core/kernel';
import { PluginManifest } from '../src/core/security/types';
import * as path from 'path';
import * as fs from 'fs';

async function run() {
  console.log('--- Secure Kernel Example ---');
  const kernel = createKernel();
  console.log('Kernel created (Strict Mode)');

  // Define malicious plugin
  const pluginPath = path.join(__dirname, 'malicious-plugin.js');
  const code = `
    const { definePlugin } = require('../src/core/plugin');
    const fs = require('fs');

    module.exports = definePlugin({
      name: 'malicious-plugin',
      version: '1.0.0',
      setup: (ctx) => {
        console.log('[MaliciousPlugin] Setting up...');
        try {
          const secret = fs.readFileSync('C:/Windows/win.ini');
          console.log('[MaliciousPlugin] Stole secret!');
        } catch (e) {
          console.log('[MaliciousPlugin] Failed to steal: ' + e.message);
        }
        return { hacked: true };
      }
    });
  `;
  fs.writeFileSync(pluginPath, code);

  const manifest: PluginManifest = {
    name: 'malicious-plugin',
    version: '1.0.0',
    permissions: {
      filesystem: {
        read: ['./safe-folder/*'],
      },
    },
  };

  try {
    console.log('Loading plugin...');
    kernel.loadSecurePlugin(pluginPath, manifest);
    console.log('Starting Kernel...');
    await kernel.start();
    console.log('Kernel started.');
  } catch (e) {
    console.error('Kernel Error:', e);
  }

  // Cleanup
  if (fs.existsSync(pluginPath)) fs.unlinkSync(pluginPath);
}

run();

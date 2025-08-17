/**
 * @file Unit tests for core types and interfaces.
 * Tests type validation and interface compliance.
 */

import { describe, it, expect } from 'vitest';
import type {
  SemVer,
  VersionConstraint,
  PluginDependency,
  LoadOrderConstraint,
  Plugin,
  KernelConfig,
  PluginRegistrationOptions,
  ResolutionResult,
  DependencyConflict,
} from './types.js';
import { KernelState, PluginState } from './types.js';

describe('Core Types', () => {
  describe('SemVer', () => {
    it('should accept valid semantic version structure', () => {
      const version: SemVer = {
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'alpha.1',
        build: '20231201',
      };

      expect(version.major).toBe(1);
      expect(version.minor).toBe(2);
      expect(version.patch).toBe(3);
      expect(version.prerelease).toEqual(['alpha', '1']);
      expect(version.build).toEqual(['20231201']);
    });

    it('should accept minimal version structure', () => {
      const version: SemVer = {
        major: 1,
        minor: 0,
        patch: 0,
      };

      expect(version.major).toBe(1);
      expect(version.minor).toBe(0);
      expect(version.patch).toBe(0);
      expect(version.prerelease).toBeUndefined();
      expect(version.build).toBeUndefined();
    });
  });

  describe('VersionConstraint', () => {
    it('should accept exact version constraint', () => {
      const constraint: VersionConstraint = {
        operator: '=',
        version: { major: 1, minor: 0, patch: 0 },
        raw: '=1.0.0',
      };

      expect(constraint.operator).toBe('=');
      expect(constraint.version.major).toBe(1);
    });

    it('should accept range constraint', () => {
      const constraint: VersionConstraint = {
        operator: '>=',
        version: { major: 1, minor: 0, patch: 0 },
        raw: '>=1.0.0',
      };

      expect(constraint.operator).toBe('>=');
    });
  });

  describe('Plugin', () => {
    it('should accept minimal plugin structure', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        dependencies: [],

        setup: async () => {},
        destroy: async () => {},
      };

      expect(plugin.name).toBe('test-plugin');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.dependencies).toEqual([]);

      expect(typeof plugin.setup).toBe('function');
      expect(typeof plugin.destroy).toBe('function');
    });

    it('should accept plugin with dependencies', () => {
      const dependency: PluginDependency = {
        plugin: {
          name: 'dep-plugin',
          version: '1.0.0',
          dependencies: [],

          setup: async () => {},
          destroy: async () => {},
        },
        version: '>=1.0.0',
      };

      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        dependencies: [dependency],

        setup: async () => {},
        destroy: async () => {},
      };

      expect(plugin.dependencies).toHaveLength(1);
      expect(plugin.dependencies[0].plugin.name).toBe('dep-plugin');
      expect(plugin.dependencies[0].version).toBe('>=1.0.0');
      expect(plugin.dependencies[0].version).toBe('>=1.0.0');
    });
  });

  describe('KernelConfig', () => {
    it('should accept default configuration', () => {
      const config: KernelConfig = {
        autoGlobal: true,
        strictVersioning: true,
        allowCircularDependencies: false,
      };

      expect(config.autoGlobal).toBe(true);
      expect(config.strictVersioning).toBe(true);
      expect(config.allowCircularDependencies).toBe(false);
    });

    it('should accept partial configuration', () => {
      const config: KernelConfig = {
        autoGlobal: false,
      };

      expect(config.autoGlobal).toBe(false);
      expect(config.strictVersioning).toBeUndefined();
    });
  });

  describe('PluginRegistrationOptions', () => {
    it('should accept minimal options', () => {
      const options: PluginRegistrationOptions = {};

      expect(options).toEqual({});
    });

    it('should accept full options', () => {
      const loadOrder: LoadOrderConstraint = {
        loadBefore: ['plugin-a'],
        loadAfter: ['plugin-b'],
      };

      const options: PluginRegistrationOptions = {
        optional: true,
        loadOrder,
      };

      expect(options.optional).toBe(true);
      expect(options.loadOrder?.loadBefore).toEqual(['plugin-a']);
      expect(options.loadOrder?.loadAfter).toEqual(['plugin-b']);
    });
  });

  describe('ResolutionResult', () => {
    it('should accept successful resolution', () => {
      const result: ResolutionResult = {
        success: true,
        order: ['plugin-a', 'plugin-b'],
        conflicts: [],
        summary: 'Resolution successful',
      };

      expect(result.success).toBe(true);
      expect(result.order).toEqual(['plugin-a', 'plugin-b']);
      expect(result.conflicts).toEqual([]);
      expect(result.summary).toBe('Resolution successful');
    });

    it('should accept failed resolution with conflicts', () => {
      const conflict: DependencyConflict = {
        type: 'missing',
        message: 'Plugin not found',
        plugins: ['missing-plugin'],
        suggestion: 'Install the missing plugin',
      };

      const result: ResolutionResult = {
        success: false,
        order: [],
        conflicts: [conflict],
        summary: 'Resolution failed',
      };

      expect(result.success).toBe(false);
      expect(result.order).toEqual([]);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('missing');
    });
  });

  describe('KernelState', () => {
    it('should accept all valid states', () => {
      const states: KernelState[] = [
        KernelState.UNINITIALIZED,
        KernelState.INITIALIZING,
        KernelState.INITIALIZED,
        KernelState.DESTROYING,
        KernelState.DESTROYED,
      ];

      for (const state of states) {
        const kernelState: KernelState = state;
        expect(kernelState).toBe(state);
      }
    });
  });

  describe('PluginState', () => {
    it('should accept all valid states', () => {
      const states: PluginState[] = [
        PluginState.REGISTERED,
        PluginState.INITIALIZING,
        PluginState.INITIALIZED,
        PluginState.DESTROYING,
        PluginState.DESTROYED,
      ];

      for (const state of states) {
        const pluginState: PluginState = state;
        expect(pluginState).toBe(state);
      }
    });
  });

  describe('Type Guards', () => {
    it('should validate plugin structure at runtime', () => {
      const validPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        dependencies: [],

        setup: async () => {},
        destroy: async () => {},
      };

      // Basic validation
      expect(typeof validPlugin.name).toBe('string');
      expect(typeof validPlugin.version).toBe('string');
      expect(Array.isArray(validPlugin.dependencies)).toBe(true);

      expect(typeof validPlugin.setup).toBe('function');
      expect(typeof validPlugin.destroy).toBe('function');
    });

    it('should validate kernel config structure', () => {
      const validConfig = {
        autoGlobal: true,
        strictVersioning: false,
        allowCircularDependencies: true,
      };

      expect(typeof validConfig.autoGlobal).toBe('boolean');
      expect(typeof validConfig.strictVersioning).toBe('boolean');
      expect(typeof validConfig.allowCircularDependencies).toBe('boolean');
    });
  });
});

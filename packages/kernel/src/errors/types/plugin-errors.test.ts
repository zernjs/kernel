import { describe, it, expect, beforeEach } from 'vitest';
import {
  PluginNotFoundError,
  PluginInitializationError,
  PluginConfigurationError,
  PluginRuntimeError,
  PluginVersionConflictError,
  PluginTimeoutError,
} from './plugin-errors.js';
import { createPluginId } from '../../types/plugin.js';

describe('PluginError', () => {
  describe('PluginNotFoundError', () => {
    let error: PluginNotFoundError;

    beforeEach(() => {
      const pluginId = createPluginId('test-plugin');
      const searchPaths = ['/path/to/plugins', '/another/path'];
      error = new PluginNotFoundError(pluginId, searchPaths);
    });

    it('should create error with correct properties', () => {
      expect(error.message).toBe(
        "Plugin 'test-plugin' not found in search paths: /path/to/plugins, /another/path"
      );
      expect(error.code).toBe('PLUGIN_NOT_FOUND');
      expect(error.category).toBe('plugin');
      expect(error.severity).toBe('high');
      expect(error.recoverable).toBe(true);
      expect(error.pluginId).toBe('test-plugin');
      expect(error.phase).toBe('discovery');
      expect(error.searchPaths).toEqual(['/path/to/plugins', '/another/path']);
    });

    it('should provide relevant suggestions', () => {
      const suggestions = error.getSuggestions();

      expect(suggestions).toHaveLength(4);
      expect(suggestions[0]!.title).toBe('Install missing plugin');
      expect(suggestions[1]!.title).toBe('Check plugin name');
      expect(suggestions[2]!.title).toBe('Mark as optional dependency');
      expect(suggestions[3]!.title).toBe('Plugin documentation');
    });

    it('should provide recovery strategies', () => {
      const strategies = error.getRecoveryStrategies();

      expect(strategies).toHaveLength(2);
      expect(strategies[0]!.name).toBe('plugin-install');
      expect(strategies[1]!.name).toBe('optional-dependency');
    });
  });

  describe('PluginInitializationError', () => {
    let error: PluginInitializationError;

    beforeEach(() => {
      const pluginId = createPluginId('test-plugin');
      const cause = new Error('Initialization failed');
      error = new PluginInitializationError(pluginId, 'Initialization failed', 0, { cause });
    });

    it('should create error with correct properties', () => {
      expect(error.message).toBe(
        "Plugin 'test-plugin' initialization failed: Initialization failed"
      );
      expect(error.code).toBe('PLUGIN_INIT_FAILED');
      expect(error.category).toBe('plugin');
      expect(error.severity).toBe('high');
      expect(error.recoverable).toBe(true);
      expect(error.pluginId).toBe('test-plugin');
      expect(error.phase).toBe('initialization');
      expect(error.retryCount).toBe(0);
      expect(error.cause).toBeInstanceOf(Error);
    });

    it('should provide relevant suggestions', () => {
      const suggestions = error.getSuggestions();

      expect(suggestions).toHaveLength(4);
      expect(suggestions[0]!.title).toBe('Retry initialization');
      expect(suggestions[1]!.title).toBe('Check plugin logs');
      expect(suggestions[2]!.title).toBe('Verify plugin configuration');
      expect(suggestions[3]!.title).toBe('Check dependencies');
    });

    it('should provide recovery strategies', () => {
      const strategies = error.getRecoveryStrategies();

      expect(strategies).toHaveLength(2);
      expect(strategies[0]!.name).toBe('plugin-restart');
      expect(strategies[1]!.name).toBe('safe-mode');
    });
  });

  describe('PluginConfigurationError', () => {
    let error: PluginConfigurationError;

    beforeEach(() => {
      const pluginId = createPluginId('test-plugin');
      error = new PluginConfigurationError(
        pluginId,
        'expected number, got string',
        'config.timeout',
        'number'
      );
    });

    it('should create error with correct properties', () => {
      expect(error.message).toBe(
        "Plugin 'test-plugin' configuration error at 'config.timeout': expected number, got string"
      );
      expect(error.code).toBe('PLUGIN_CONFIG_ERROR');
      expect(error.category).toBe('plugin');
      expect(error.severity).toBe('medium');
      expect(error.recoverable).toBe(true);
      expect(error.pluginId).toBe('test-plugin');
      expect(error.configPath).toBe('config.timeout');
      expect(error.expectedType).toBe('number');
      expect(error.phase).toBe('configuration');
    });

    it('should provide relevant suggestions', () => {
      const suggestions = error.getSuggestions();

      expect(suggestions).toHaveLength(4);
      expect(suggestions[0]!.title).toBe('Fix configuration type');
      expect(suggestions[1]!.title).toBe('Check configuration syntax');
      expect(suggestions[2]!.title).toBe('Use default configuration');
      expect(suggestions[3]!.title).toBe('Configuration documentation');
    });

    it('should provide recovery strategies', () => {
      const strategies = error.getRecoveryStrategies();

      expect(strategies).toHaveLength(2);
      expect(strategies[0]!.name).toBe('default-config');
      expect(strategies[1]!.name).toBe('config-validation');
    });
  });

  describe('PluginVersionConflictError', () => {
    let error: PluginVersionConflictError;

    beforeEach(() => {
      const pluginId = createPluginId('test-plugin');
      const requiredBy = [createPluginId('dependent-plugin')];
      error = new PluginVersionConflictError(pluginId, '^2.0.0', '1.0.0', requiredBy);
    });

    it('should create error with correct properties', () => {
      expect(error.message).toBe(
        "Plugin 'test-plugin' version conflict: required ^2.0.0, found 1.0.0"
      );
      expect(error.code).toBe('PLUGIN_VERSION_CONFLICT');
      expect(error.category).toBe('plugin');
      expect(error.severity).toBe('high');
      expect(error.recoverable).toBe(true);
      expect(error.pluginId).toBe('test-plugin');
      expect(error.requiredVersion).toBe('^2.0.0');
      expect(error.actualVersion).toBe('1.0.0');
      expect(error.requiredBy).toEqual(['dependent-plugin']);
      expect(error.phase).toBe('validation');
    });

    it('should provide relevant suggestions', () => {
      const suggestions = error.getSuggestions();

      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]!.title).toBe('Update plugin version');
      expect(suggestions[1]!.title).toBe('Check compatibility');
      expect(suggestions[2]!.title).toBe('Use version override');
    });

    it('should provide recovery strategies', () => {
      const strategies = error.getRecoveryStrategies();

      expect(strategies).toHaveLength(1);
      expect(strategies[0]!.name).toBe('version-update');
    });
  });

  describe('PluginRuntimeError', () => {
    let error: PluginRuntimeError;

    beforeEach(() => {
      const pluginId = createPluginId('test-plugin');
      const cause = new Error('Runtime operation failed');
      error = new PluginRuntimeError(pluginId, 'Runtime operation failed', 'processData', {
        cause,
      });
    });

    it('should create error with correct properties', () => {
      expect(error.message).toBe(
        "Plugin 'test-plugin' runtime error during 'processData': Runtime operation failed"
      );
      expect(error.code).toBe('PLUGIN_RUNTIME_ERROR');
      expect(error.category).toBe('plugin');
      expect(error.severity).toBe('medium');
      expect(error.recoverable).toBe(true);
      expect(error.pluginId).toBe('test-plugin');
      expect(error.operation).toBe('processData');
      expect(error.phase).toBe('runtime');
      expect(error.cause).toBeInstanceOf(Error);
    });

    it('should provide relevant suggestions', () => {
      const suggestions = error.getSuggestions();

      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]!.title).toBe('Check operation context');
      expect(suggestions[1]!.title).toBe('Restart plugin');
      expect(suggestions[2]!.title).toBe('Disable problematic operation');
    });

    it('should provide recovery strategies', () => {
      const strategies = error.getRecoveryStrategies();

      expect(strategies).toHaveLength(2);
      expect(strategies[0]!.name).toBe('operation-retry');
      expect(strategies[1]!.name).toBe('plugin-isolation');
    });
  });

  describe('PluginTimeoutError', () => {
    let error: PluginTimeoutError;

    beforeEach(() => {
      const pluginId = createPluginId('test-plugin');
      error = new PluginTimeoutError(pluginId, 'initialization', 5000);
    });

    it('should create error with correct properties', () => {
      expect(error.message).toBe(
        "Plugin 'test-plugin' operation 'initialization' timed out after 5000ms"
      );
      expect(error.code).toBe('PLUGIN_TIMEOUT');
      expect(error.category).toBe('plugin');
      expect(error.severity).toBe('medium');
      expect(error.recoverable).toBe(true);
      expect(error.pluginId).toBe('test-plugin');
      expect(error.operation).toBe('initialization');
      expect(error.timeout).toBe(5000);
      expect(error.phase).toBe('runtime');
    });

    it('should provide relevant suggestions', () => {
      const suggestions = error.getSuggestions();

      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]!.title).toBe('Increase timeout');
      expect(suggestions[1]!.title).toBe('Profile operation performance');
      expect(suggestions[2]!.title).toBe('Disable timeout');
    });

    it('should provide recovery strategies', () => {
      const strategies = error.getRecoveryStrategies();

      expect(strategies).toHaveLength(2);
      expect(strategies[0]!.name).toBe('timeout-extension');
      expect(strategies[1]!.name).toBe('operation-cancellation');
    });
  });
});

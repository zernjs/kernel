import { PluginPermissions, SecurityMode, SecurityViolation, AuditLog } from './types';
import * as path from 'path';

export class SecurityManager {
  private mode: SecurityMode;
  private auditLog: AuditLog = {
    violations: [],
    suggestedPermissions: {},
  };

  constructor(mode: SecurityMode = 'strict') {
    this.mode = mode;
  }

  public setMode(mode: SecurityMode) {
    this.mode = mode;
  }

  public getMode() {
    return this.mode;
  }

  public getAuditLog() {
    return this.auditLog;
  }

  /**
   * Validates access and returns true if allow, false if blocked.
   * In 'audit' mode, it always returns true but logs violations.
   */
  public validate(
    pluginName: string,
    permissions: PluginPermissions | undefined,
    type: SecurityViolation['type'],
    action: string,
    target: string
  ): boolean {
    if (this.mode === 'disabled') return true;

    const allowed = this.checkPermission(permissions, type, action, target);

    if (!allowed) {
      this.logViolation(pluginName, type, action, target);
      if (this.mode === 'audit') {
        this.recordSuggestion(pluginName, type, action, target);
        return true; // Allow in audit mode
      }
      return false; // Block in strict mode
    }

    return true;
  }

  private checkPermission(
    perms: PluginPermissions | undefined,
    type: SecurityViolation['type'],
    action: string,
    target: string
  ): boolean {
    if (!perms) return false;

    switch (type) {
      case 'filesystem':
        return this.checkFileSystem(perms.filesystem, action, target);
      case 'network':
        return this.checkNetwork(perms.network, action, target);
      case 'env':
        return this.checkEnv(perms.env, target);
      case 'process':
        // 'spawn' refers to child_process, 'worker' refers to worker_threads/cluster
        if (action === 'worker') return !!perms.allowWorker;
        return !!perms.childProcess;
      default:
        return false;
    }
  }

  private checkFileSystem(
    fsPerms: PluginPermissions['filesystem'],
    action: string,
    target: string
  ): boolean {
    if (!fsPerms) return false;

    // Normalize target path for comparison
    const normalizedTarget = path.normalize(target).replace(/\\/g, '/');

    const patterns = action === 'write' ? fsPerms.write : fsPerms.read;

    if (typeof patterns === 'boolean') return patterns;
    if (!patterns) return false;

    return patterns.some(pattern => this.matchesGlob(normalizedTarget, pattern));
  }

  /**
   * Simple glob matcher implementation to avoid external dependencies.
   */
  private matchesGlob(str: string, pattern: string): boolean {
    // Normalize pattern
    const validPattern = pattern.replace(/\\/g, '/');

    // Escape regex characters except *
    let regexString = validPattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '.*') // ** matches anything
      .replace(/(?<!\.)\*/g, '[^/]*'); // * matches anything except path separator

    // Ensure full match
    regexString = `^${regexString}$`;

    return new RegExp(regexString).test(str);
  }

  private checkNetwork(
    netPerms: PluginPermissions['network'],
    action: string,
    target: string
  ): boolean {
    if (!netPerms) return false;

    if (action === 'listen') return !!netPerms.allowListen;
    if (action === 'dgram') return !!netPerms.allowDgram;

    // Simple domain check (improving this would require parsing URLs)
    // target here might be specific "host" or "url"
    if (!netPerms.domains) return false;

    return netPerms.domains.some(domain => target.includes(domain));
  }

  private checkEnv(envPerms: PluginPermissions['env'], target: string): boolean {
    if (!envPerms) return false;
    if (!envPerms.vars) return false;
    return envPerms.vars.includes(target);
  }

  private logViolation(
    pluginName: string,
    type: SecurityViolation['type'],
    action: string,
    target: string
  ) {
    const violation: SecurityViolation = {
      pluginName,
      type,
      action,
      target,
      timestamp: Date.now(),
      stack: new Error().stack,
    };
    this.auditLog.violations.push(violation);

    if (this.mode === 'strict') {
      console.warn(
        `[SECURITY BLOCK] Plugin '${pluginName}' attempted ${action} on ${type}:${target}`
      );
    }
  }

  private recordSuggestion(
    pluginName: string,
    type: SecurityViolation['type'],
    action: string,
    target: string
  ) {
    // Basic implementation of "Learning Mode"
    if (!this.auditLog.suggestedPermissions[pluginName]) {
      this.auditLog.suggestedPermissions[pluginName] = {};
    }
    const perms = this.auditLog.suggestedPermissions[pluginName];

    if (type === 'filesystem') {
      if (!perms.filesystem) perms.filesystem = { read: [], write: [] };
      // Very naive suggestion: just add the exact path
      const list = action === 'write' ? perms.filesystem.write : perms.filesystem.read;
      if (Array.isArray(list) && !list.includes(target)) {
        list.push(target);
      }
    }
    // Implement other types similarly for a full feature
  }
}

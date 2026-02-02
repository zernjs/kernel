export type SecurityMode = 'strict' | 'audit' | 'disabled';

export interface FileSystemPermission {
  read?: string[] | boolean; // Glob patterns
  write?: string[] | boolean;
}

export interface NetworkPermission {
  domains?: string[]; // Whitelist domains
  allowHttp?: boolean;
  allowListen?: boolean;
  allowDgram?: boolean; // UDP access
}

export interface EnvPermission {
  vars?: string[]; // Whitelist env vars
}

export interface PluginPermissions {
  filesystem?: FileSystemPermission;
  network?: NetworkPermission;
  env?: EnvPermission;
  childProcess?: boolean; // simple boolean for now
  allowWorker?: boolean; // worker_threads and cluster
}

export interface PluginManifest {
  name: string;
  version: string;
  permissions?: PluginPermissions;
}

export interface SecurityViolation {
  pluginName: string;
  type: 'filesystem' | 'network' | 'env' | 'process';
  action: string; // e.g., 'read', 'connect'
  target: string; // e.g., '/etc/passwd', 'google.com'
  timestamp: number;
  stack?: string;
}

export interface AuditLog {
  violations: SecurityViolation[];
  suggestedPermissions: Record<string, PluginPermissions>;
}

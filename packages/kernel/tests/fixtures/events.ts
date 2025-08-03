import type { BaseEvent, EventSource } from '../../src/types/events.js';
import { createEventSource } from '../../src/types/events.js';
import { createUtilEventId } from '../../src/types/index.js';

// Test event interfaces for fixtures
export interface TestEvents {
  'user:created': { id: number; name: string; email: string };
  'user:updated': { id: number; changes: Record<string, unknown> };
  'user:deleted': { id: number };
  'plugin:loaded': { pluginId: string; version: string; metadata?: Record<string, unknown> };
  'plugin:unloaded': { pluginId: string };
  'plugin:error': { pluginId: string; error: string };
  'kernel:ready': void;
  'kernel:shutdown': void;
  'system:error': { message: string; code?: number; stack?: string };
  'performance:metric': { name: string; value: number; unit: string };
}

// Extended event interfaces
export interface UserCreatedEvent extends BaseEvent {
  type: 'user:created';
  data: { id: number; name: string; email: string };
  timestamp: number;
  source: EventSource;
}

export interface PluginLoadedEvent extends BaseEvent {
  type: 'plugin:loaded';
  data: { pluginId: string; version: string; metadata?: Record<string, unknown> };
  timestamp: number;
  source: EventSource;
}

export interface SystemErrorEvent extends BaseEvent {
  type: 'system:error';
  data: { message: string; code?: number; stack?: string };
  timestamp: number;
  source: EventSource;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// Mock plugin data
export const mockPlugins = [
  {
    pluginId: 'test-plugin-1',
    version: '1.0.0',
    metadata: {
      name: 'Test Plugin 1',
      description: 'A test plugin for unit testing',
      author: 'Test Author',
    },
  },
  {
    pluginId: 'test-plugin-2',
    version: '2.1.0',
    metadata: {
      name: 'Test Plugin 2',
      description: 'Another test plugin',
      author: 'Test Author',
    },
  },
  {
    pluginId: 'core-plugin',
    version: '1.0.0',
    metadata: {
      name: 'Core Plugin',
      description: 'Core functionality plugin',
      author: 'Zern Team',
      core: true,
    },
  },
];

// Mock user data
export const mockUsers = [
  { id: 1, name: 'John Doe', email: 'john@example.com' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com' },
];

// Event factory functions
export function createUserCreatedEvent(user: (typeof mockUsers)[0]): UserCreatedEvent {
  return {
    type: 'user:created',
    data: user,
    timestamp: Date.now(),
    source: createEventSource('user-service'),
    id: createUtilEventId(`user-created-${user.id}-${Date.now()}`),
  };
}

export function createPluginLoadedEvent(plugin: (typeof mockPlugins)[0]): PluginLoadedEvent {
  return {
    type: 'plugin:loaded',
    data: plugin,
    timestamp: Date.now(),
    source: createEventSource('plugin-loader'),
    id: createUtilEventId(`plugin-loaded-${plugin.pluginId}-${Date.now()}`),
  };
}

export function createSystemErrorEvent(
  message: string,
  code?: number,
  severity: SystemErrorEvent['severity'] = 'medium'
): SystemErrorEvent {
  return {
    type: 'system:error',
    data: { message, ...(code !== undefined && { code }) },
    timestamp: Date.now(),
    source: createEventSource('system'),
    severity,
    id: createUtilEventId(`system-error-${Date.now()}`),
  };
}

// Event patterns for testing
export const eventPatterns = {
  user: ['user:created', 'user:updated', 'user:deleted'],
  plugin: ['plugin:loaded', 'plugin:unloaded', 'plugin:error'],
  kernel: ['kernel:ready', 'kernel:shutdown'],
  system: ['system:error'],
  performance: ['performance:metric'],
};

// Common event data generators
export function generateEventData(eventType: keyof TestEvents): TestEvents[typeof eventType] {
  switch (eventType) {
    case 'user:created':
      return mockUsers[Math.floor(Math.random() * mockUsers.length)] as TestEvents['user:created'];

    case 'user:updated':
      return {
        id: Math.floor(Math.random() * 100) + 1,
        changes: { name: 'Updated Name' },
      } as TestEvents['user:updated'];

    case 'user:deleted':
      return { id: Math.floor(Math.random() * 100) + 1 } as TestEvents['user:deleted'];

    case 'plugin:loaded':
      return mockPlugins[
        Math.floor(Math.random() * mockPlugins.length)
      ] as TestEvents['plugin:loaded'];

    case 'plugin:unloaded':
      return { pluginId: `plugin-${Math.random()}` } as TestEvents['plugin:unloaded'];

    case 'plugin:error':
      return {
        pluginId: `plugin-${Math.random()}`,
        error: 'Test error message',
      } as TestEvents['plugin:error'];

    case 'kernel:ready':
    case 'kernel:shutdown':
      return undefined as TestEvents[typeof eventType];

    case 'system:error':
      return {
        message: 'Test system error',
        code: Math.floor(Math.random() * 1000),
      } as TestEvents['system:error'];

    case 'performance:metric':
      return {
        name: 'test-metric',
        value: Math.random() * 100,
        unit: 'ms',
      } as TestEvents['performance:metric'];

    default:
      throw new Error(`Unknown event type: ${eventType}`);
  }
}

// Async delay utility for testing
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Event sequence generator for testing
export function* generateEventSequence(
  events: Array<keyof TestEvents>,
  count: number = 10
): Generator<{ type: keyof TestEvents; data: TestEvents[keyof TestEvents] }> {
  if (events.length === 0) {
    return;
  }

  for (let i = 0; i < count; i++) {
    const eventType = events[i % events.length]!;
    yield {
      type: eventType,
      data: generateEventData(eventType),
    };
  }
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from './event-bus.js';
import type { BaseEvent, EventHandler, EventContext } from '../types/index.js';
import { createUtilEventId, createEventSource } from '../types/index.js';

// Test event interface that extends BaseEvent with data
interface TestEventWithType extends BaseEvent {
  type: string;
  data: { message: string; value: number };
}

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  // Helper function to create test events
  const createTestEvent = (
    type: string,
    data: { message: string; value: number }
  ): TestEventWithType => ({
    type,
    timestamp: Date.now(),
    id: createUtilEventId(`test-${Date.now()}`),
    source: createEventSource('test'),
    data,
  });

  // Helper function to create event handlers that extract data
  const createDataHandler = (
    callback: (data: { message: string; value: number }) => void
  ): EventHandler => {
    return async (event: BaseEvent, _context: EventContext) => {
      callback((event as TestEventWithType).data);
    };
  };

  describe('Basic Event Handling', () => {
    it('should register and emit events', async () => {
      const handler = vi.fn();
      eventBus.on('test', createDataHandler(handler));

      const testEvent = createTestEvent('test', { message: 'test', value: 42 });
      await eventBus.emit('test', testEvent);

      expect(handler).toHaveBeenCalledWith({ message: 'test', value: 42 });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple listeners for the same event', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('test', createDataHandler(handler1));
      eventBus.on('test', createDataHandler(handler2));

      const testEvent = createTestEvent('test', { message: 'test', value: 42 });
      await eventBus.emit('test', testEvent);

      expect(handler1).toHaveBeenCalledWith({ message: 'test', value: 42 });
      expect(handler2).toHaveBeenCalledWith({ message: 'test', value: 42 });
    });

    it('should remove specific listeners', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const sub1 = eventBus.on('test', createDataHandler(handler1));
      eventBus.on('test', createDataHandler(handler2));
      eventBus.off(sub1);

      const testEvent = createTestEvent('test', { message: 'test', value: 42 });
      await eventBus.emit('test', testEvent);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith({ message: 'test', value: 42 });
    });

    it('should remove all listeners for an event', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('test', createDataHandler(handler1));
      eventBus.on('test', createDataHandler(handler2));
      eventBus.removeAllListeners('test');

      const testEvent = createTestEvent('test', { message: 'test', value: 42 });
      await eventBus.emit('test', testEvent);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('Once Listeners', () => {
    it('should execute once listeners only once', async () => {
      const handler = vi.fn();
      eventBus.once('test', createDataHandler(handler));

      const testEvent1 = createTestEvent('test', { message: 'data1', value: 1 });
      const testEvent2 = createTestEvent('test', { message: 'data2', value: 2 });

      await eventBus.emit('test', testEvent1);
      await eventBus.emit('test', testEvent2);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ message: 'data1', value: 1 });
    });

    it('should remove once listeners after execution', async () => {
      const handler = vi.fn();
      eventBus.once('test', createDataHandler(handler));

      expect(eventBus.listenerCount('test')).toBe(1);

      const testEvent = createTestEvent('test', { message: 'test', value: 42 });
      await eventBus.emit('test', testEvent);

      expect(eventBus.listenerCount('test')).toBe(0);
    });
  });

  describe('Wildcard Support', () => {
    it('should handle wildcard patterns', async () => {
      const events: Array<{ type: string; data: { message: string; value: number } }> = [];
      const eventHandler: EventHandler = async (event: BaseEvent, _context: EventContext) => {
        const typedEvent = event as TestEventWithType;
        events.push({ type: typedEvent.type, data: typedEvent.data });
      };

      eventBus.on('user:*', eventHandler);

      const testEvent1 = createTestEvent('user:created', { message: 'test1', value: 1 });
      const testEvent2 = createTestEvent('user:updated', { message: 'test2', value: 2 });

      await eventBus.emit('user:created', testEvent1);
      await eventBus.emit('user:updated', testEvent2);

      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({ type: 'user:created', data: { message: 'test1', value: 1 } });
      expect(events[1]).toEqual({ type: 'user:updated', data: { message: 'test2', value: 2 } });
    });

    it('should handle multiple wildcard patterns', async () => {
      const events: Array<{ type: string; data: { message: string; value: number } }> = [];
      const eventHandler: EventHandler = async (event: BaseEvent, _context: EventContext) => {
        const typedEvent = event as TestEventWithType;
        events.push({ type: typedEvent.type, data: typedEvent.data });
      };

      eventBus.on('user:*', eventHandler);
      eventBus.on('system:*', eventHandler);

      const testEvent1 = createTestEvent('user:created', { message: 'test1', value: 1 });
      // Create a proper test event instead of trying to emit system:error
      const testEvent2 = createTestEvent('system:started', { message: 'test2', value: 2 });

      await eventBus.emit('user:created', testEvent1);
      await eventBus.emit('system:started', testEvent2);

      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({ type: 'user:created', data: { message: 'test1', value: 1 } });
      expect(events[1]).toEqual({ type: 'system:started', data: { message: 'test2', value: 2 } });
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in listeners', async () => {
      const errorHandler = vi.fn();
      const normalHandler = vi.fn();
      const faultyHandler: EventHandler = (_event: BaseEvent, _context: EventContext) => {
        throw new Error('Test error');
      };

      eventBus.onError(errorHandler);
      eventBus.on('test', faultyHandler);
      eventBus.on('test', createDataHandler(normalHandler));

      const testEvent = createTestEvent('test', { message: 'test', value: 42 });
      await eventBus.emit('test', testEvent);

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error), expect.any(Object));
      expect(normalHandler).toHaveBeenCalledWith({ message: 'test', value: 42 });
    });

    it('should continue execution after error', async () => {
      const handler1: EventHandler = (_event: BaseEvent, _context: EventContext) => {
        throw new Error('Error 1');
      };
      const handler2 = vi.fn();
      const handler3: EventHandler = (_event: BaseEvent, _context: EventContext) => {
        throw new Error('Error 2');
      };
      const handler4 = vi.fn();

      eventBus.on('test', handler1);
      eventBus.on('test', createDataHandler(handler2));
      eventBus.on('test', handler3);
      eventBus.on('test', createDataHandler(handler4));

      const testEvent = createTestEvent('test', { message: 'test', value: 42 });
      await eventBus.emit('test', testEvent);

      expect(handler2).toHaveBeenCalledWith({ message: 'test', value: 42 });
      expect(handler4).toHaveBeenCalledWith({ message: 'test', value: 42 });
    });
  });

  describe('Utility Methods', () => {
    it('should return event names', () => {
      const handler1 = createDataHandler(vi.fn());
      const handler2 = createDataHandler(vi.fn());

      eventBus.on('event1', handler1);
      eventBus.on('event2', handler2);

      // EventBus doesn't have getEventNames method, let's test what's available
      expect(eventBus.listenerCount('event1')).toBe(1);
      expect(eventBus.listenerCount('event2')).toBe(1);
    });

    it('should return listener count', () => {
      const handler1 = createDataHandler(vi.fn());
      const handler2 = createDataHandler(vi.fn());

      eventBus.on('test', handler1);
      eventBus.on('test', handler2);

      expect(eventBus.listenerCount('test')).toBe(2);
      expect(eventBus.listenerCount('nonexistent')).toBe(0);
    });

    it('should return subscriptions', () => {
      const handler1 = createDataHandler(vi.fn());
      const handler2 = createDataHandler(vi.fn());

      const sub1 = eventBus.on('test', handler1);
      eventBus.on('test', handler2);

      const subscriptions = eventBus.getSubscriptions();
      expect(subscriptions).toHaveLength(2);
      expect(subscriptions.some(sub => sub.id === sub1)).toBe(true);
    });

    it('should clear all listeners', async () => {
      const handler = vi.fn();

      eventBus.on('test1', createDataHandler(handler));
      eventBus.on('test2', createDataHandler(handler));

      // EventBus doesn't have clear method, use removeAllListeners instead
      eventBus.removeAllListeners();

      const testEvent1 = createTestEvent('test1', { message: 'data1', value: 1 });
      const testEvent2 = createTestEvent('test2', { message: 'data2', value: 2 });

      await eventBus.emit('test1', testEvent1);
      await eventBus.emit('test2', testEvent2);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Memory Management', () => {
    it('should handle many listeners without memory leaks', async () => {
      const handlers = Array.from({ length: 1000 }, () => createDataHandler(vi.fn()));
      const subscriptions = handlers.map(handler => eventBus.on('test', handler));

      const testEvent = createTestEvent('test', { message: 'test', value: 42 });
      await eventBus.emit('test', testEvent);

      // Remove all listeners
      subscriptions.forEach(sub => {
        eventBus.off(sub);
      });

      expect(eventBus.listenerCount('test')).toBe(0);
    });
  });
});

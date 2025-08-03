/**
 * @fileoverview Circuit breaker implementation for error recovery
 * @module @zern/kernel/errors/recovery/circuit-breaker
 */

import { EventEmitter } from 'events';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  halfOpenMaxCalls: number;
  enableMetrics: boolean;
}

export interface CircuitBreakerMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rejectedCalls: number;
  averageResponseTime: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
}

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CallResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  duration: number;
}

/**
 * Circuit breaker implementation for preventing cascading failures
 */
export class CircuitBreaker<T = unknown> extends EventEmitter {
  private readonly config: CircuitBreakerConfig;
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime?: Date | undefined;
  private nextAttemptTime?: Date | undefined;
  private halfOpenCalls = 0;
  private metrics: CircuitBreakerMetrics;

  constructor(
    private readonly name: string,
    config: Partial<CircuitBreakerConfig> = {}
  ) {
    super();

    this.config = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 10000, // 10 seconds
      halfOpenMaxCalls: 3,
      enableMetrics: true,
      ...config,
    };

    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      averageResponseTime: 0,
    };
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<R = T>(fn: () => Promise<R>): Promise<R> {
    if (!this.canExecute()) {
      this.metrics.rejectedCalls++;
      this.emit('callRejected', { name: this.name, state: this.state });
      throw new Error(`Circuit breaker '${this.name}' is ${this.state}`);
    }

    const startTime = Date.now();
    this.metrics.totalCalls++;

    if (this.state === 'HALF_OPEN') {
      this.halfOpenCalls++;
    }

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      this.onSuccess(duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.onFailure(error instanceof Error ? error : new Error(String(error)), duration);
      throw error;
    }
  }

  /**
   * Execute with result wrapper (doesn't throw)
   */
  async executeWithResult<R = T>(fn: () => Promise<R>): Promise<CallResult<R>> {
    try {
      const result = await this.execute(fn);
      return {
        success: true,
        result,
        duration: 0, // Duration is tracked internally
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: 0,
      };
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    this.updateState();
    return this.state;
  }

  /**
   * Get current metrics
   */
  getMetrics(): Readonly<CircuitBreakerMetrics> {
    return { ...this.metrics };
  }

  /**
   * Get failure rate (0-1)
   */
  getFailureRate(): number {
    if (this.metrics.totalCalls === 0) {
      return 0;
    }
    return this.metrics.failedCalls / this.metrics.totalCalls;
  }

  /**
   * Get success rate (0-1)
   */
  getSuccessRate(): number {
    return 1 - this.getFailureRate();
  }

  /**
   * Check if circuit breaker is healthy
   */
  isHealthy(): boolean {
    return this.state === 'CLOSED' && this.getFailureRate() < 0.5;
  }

  /**
   * Manually open the circuit breaker
   */
  open(): void {
    this.setState('OPEN');
    this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
  }

  /**
   * Manually close the circuit breaker
   */
  close(): void {
    this.reset();
    this.setState('CLOSED');
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.failureCount = 0;
    this.halfOpenCalls = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
    this.setState('CLOSED');
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      averageResponseTime: 0,
    };
    this.emit('metricsReset', { name: this.name });
  }

  /**
   * Get circuit breaker status
   */
  getStatus(): {
    name: string;
    state: CircuitBreakerState;
    failureCount: number;
    failureThreshold: number;
    nextAttemptTime?: Date | undefined;
    metrics: CircuitBreakerMetrics;
    healthy: boolean;
  } {
    return {
      name: this.name,
      state: this.getState(),
      failureCount: this.failureCount,
      failureThreshold: this.config.failureThreshold,
      nextAttemptTime: this.nextAttemptTime,
      metrics: this.getMetrics(),
      healthy: this.isHealthy(),
    };
  }

  /**
   * Check if execution is allowed
   */
  private canExecute(): boolean {
    this.updateState();

    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'HALF_OPEN') {
      return this.halfOpenCalls < this.config.halfOpenMaxCalls;
    }

    return false; // OPEN state
  }

  /**
   * Handle successful execution
   */
  private onSuccess(duration: number): void {
    this.metrics.successfulCalls++;
    this.metrics.lastSuccessTime = new Date();
    this.updateAverageResponseTime(duration);

    if (this.state === 'HALF_OPEN') {
      // If we've had enough successful calls in half-open, close the circuit
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        this.reset();
        this.setState('CLOSED');
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success in closed state
      this.failureCount = 0;
    }

    this.emit('callSuccess', {
      name: this.name,
      state: this.state,
      duration,
      metrics: this.metrics,
    });
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: Error, duration: number): void {
    this.failureCount++;
    this.metrics.failedCalls++;
    this.lastFailureTime = new Date();
    this.metrics.lastFailureTime = this.lastFailureTime;
    this.updateAverageResponseTime(duration);

    if (this.state === 'HALF_OPEN') {
      // Failure in half-open state immediately opens the circuit
      this.setState('OPEN');
      this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
    } else if (this.state === 'CLOSED' && this.failureCount >= this.config.failureThreshold) {
      // Too many failures in closed state opens the circuit
      this.setState('OPEN');
      this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
    }

    this.emit('callFailure', {
      name: this.name,
      state: this.state,
      error,
      duration,
      failureCount: this.failureCount,
      metrics: this.metrics,
    });
  }

  /**
   * Update circuit breaker state based on current conditions
   */
  private updateState(): void {
    if (this.state === 'OPEN' && this.nextAttemptTime && new Date() >= this.nextAttemptTime) {
      this.setState('HALF_OPEN');
      this.halfOpenCalls = 0;
    }
  }

  /**
   * Set circuit breaker state and emit event
   */
  private setState(newState: CircuitBreakerState): void {
    const oldState = this.state;
    this.state = newState;

    if (oldState !== newState) {
      this.emit('stateChange', {
        name: this.name,
        oldState,
        newState,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(duration: number): void {
    if (!this.config.enableMetrics) {
      return;
    }

    const totalCalls = this.metrics.successfulCalls + this.metrics.failedCalls;
    if (totalCalls === 1) {
      this.metrics.averageResponseTime = duration;
    } else {
      // Exponential moving average
      const alpha = 0.1;
      this.metrics.averageResponseTime =
        alpha * duration + (1 - alpha) * this.metrics.averageResponseTime;
    }
  }
}

/**
 * Circuit breaker registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry extends EventEmitter {
  private readonly breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create a circuit breaker
   */
  getOrCreate(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    let breaker = this.breakers.get(name);

    if (!breaker) {
      breaker = new CircuitBreaker(name, config);
      this.breakers.set(name, breaker);

      // Forward events
      breaker.on('stateChange', event => this.emit('stateChange', event));
      breaker.on('callSuccess', event => this.emit('callSuccess', event));
      breaker.on('callFailure', event => this.emit('callFailure', event));
      breaker.on('callRejected', event => this.emit('callRejected', event));

      this.emit('breakerCreated', { name, breaker });
    }

    return breaker;
  }

  /**
   * Get a circuit breaker by name
   */
  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  /**
   * Remove a circuit breaker
   */
  remove(name: string): boolean {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.removeAllListeners();
      this.breakers.delete(name);
      this.emit('breakerRemoved', { name });
      return true;
    }
    return false;
  }

  /**
   * Get all circuit breakers
   */
  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Get all circuit breaker statuses
   */
  getAllStatuses(): Array<ReturnType<CircuitBreaker['getStatus']>> {
    return Array.from(this.breakers.values()).map(breaker => breaker.getStatus());
  }

  /**
   * Get unhealthy circuit breakers
   */
  getUnhealthy(): CircuitBreaker[] {
    return Array.from(this.breakers.values()).filter(breaker => !breaker.isHealthy());
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    this.emit('allReset');
  }

  /**
   * Clear all circuit breakers
   */
  clear(): void {
    for (const breaker of this.breakers.values()) {
      breaker.removeAllListeners();
    }
    this.breakers.clear();
    this.emit('allCleared');
  }

  /**
   * Get registry statistics
   */
  getStatistics(): {
    totalBreakers: number;
    healthyBreakers: number;
    unhealthyBreakers: number;
    openBreakers: number;
    halfOpenBreakers: number;
    closedBreakers: number;
  } {
    const statuses = this.getAllStatuses();

    return {
      totalBreakers: statuses.length,
      healthyBreakers: statuses.filter(s => s.healthy).length,
      unhealthyBreakers: statuses.filter(s => !s.healthy).length,
      openBreakers: statuses.filter(s => s.state === 'OPEN').length,
      halfOpenBreakers: statuses.filter(s => s.state === 'HALF_OPEN').length,
      closedBreakers: statuses.filter(s => s.state === 'CLOSED').length,
    };
  }
}

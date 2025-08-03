/**
 * @fileoverview Error recovery management system
 * @module @zern/kernel/errors/recovery/recovery-manager
 */

import { EventEmitter } from 'events';
import type { ZernError, RecoveryStrategy, RecoveryResult, ErrorContext } from '../types/base.js';

export interface RecoveryManagerConfig {
  maxRetries: number;
  retryDelay: number;
  exponentialBackoff: boolean;
  maxBackoffDelay: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  enableFallbacks: boolean;
  enableGracefulDegradation: boolean;
  enableDefaultFallbacks: boolean;
}

export interface RecoveryAttempt {
  id: string;
  error: ZernError;
  strategy: RecoveryStrategy;
  attempt: number;
  startTime: Date;
  endTime?: Date;
  result?: RecoveryResult;
  status: 'pending' | 'success' | 'failed' | 'timeout';
}

export interface RecoveryCircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
}

export interface FallbackStrategy {
  id: string;
  name: string;
  description: string;
  canHandle: (error: ZernError, context: ErrorContext) => boolean;
  execute: (error: ZernError, context: ErrorContext) => Promise<RecoveryResult>;
  priority: number;
}

/**
 * Manages error recovery strategies and fallback mechanisms
 */
export class RecoveryManager extends EventEmitter {
  private readonly config: RecoveryManagerConfig;
  private readonly attempts = new Map<string, RecoveryAttempt>();
  private readonly circuitBreakers = new Map<string, RecoveryCircuitBreakerState>();
  private readonly fallbackStrategies = new Map<string, FallbackStrategy>();
  private attemptCounter = 0;

  constructor(config: Partial<RecoveryManagerConfig> = {}) {
    super();

    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      exponentialBackoff: true,
      maxBackoffDelay: 30000,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000,
      enableFallbacks: true,
      enableGracefulDegradation: true,
      enableDefaultFallbacks: true,
      ...config,
    };

    if (this.config.enableDefaultFallbacks) {
      this.setupDefaultFallbacks();
    }
  }

  /**
   * Attempt to recover from an error
   */
  async recover(
    error: ZernError,
    context: ErrorContext,
    strategies?: RecoveryStrategy[]
  ): Promise<RecoveryResult | null> {
    if (!error.recoverable) {
      return null;
    }

    const recoveryStrategies = strategies || error.getRecoveryStrategies();

    // Sort strategies by priority
    const sortedStrategies = recoveryStrategies.sort((a, b) => b.priority - a.priority);

    for (const strategy of sortedStrategies) {
      // Check circuit breaker
      if (!this.isCircuitClosed(strategy.name)) {
        continue;
      }

      // Check if strategy can recover
      if (!strategy.canRecover(error)) {
        continue;
      }

      const result = await this.executeRecoveryStrategy(error, context, strategy);

      if (result?.success) {
        this.recordSuccess(strategy.name);
        return result;
      } else {
        this.recordFailure(strategy.name);
      }
    }

    // Try fallback strategies if enabled
    if (this.config.enableFallbacks) {
      return await this.tryFallbacks(error, context);
    }

    return null;
  }

  /**
   * Execute a recovery strategy with retry logic
   */
  async executeRecoveryStrategy(
    error: ZernError,
    context: ErrorContext,
    strategy: RecoveryStrategy
  ): Promise<RecoveryResult | null> {
    const attemptId = `attempt-${++this.attemptCounter}`;

    const attempt: RecoveryAttempt = {
      id: attemptId,
      error,
      strategy,
      attempt: 1,
      startTime: new Date(),
      status: 'pending',
    };

    this.attempts.set(attemptId, attempt);
    this.emit('recoveryStarted', attempt);

    let lastError: Error | null = null;

    for (let i = 0; i < this.config.maxRetries; i++) {
      attempt.attempt = i + 1;

      try {
        const result = await this.executeWithTimeout(strategy, error, context);

        attempt.endTime = new Date();
        attempt.result = result;
        attempt.status = result.success ? 'success' : 'failed';

        this.emit('recoveryCompleted', attempt);

        return result;
      } catch (executionError) {
        lastError =
          executionError instanceof Error ? executionError : new Error(String(executionError));

        // Wait before retry (except on last attempt)
        if (i < this.config.maxRetries - 1) {
          const delay = this.calculateRetryDelay(i);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    attempt.endTime = new Date();
    attempt.status = 'failed';

    this.emit('recoveryFailed', { attempt, error: lastError });

    return null;
  }

  /**
   * Add a fallback strategy
   */
  addFallback(fallback: FallbackStrategy): void {
    this.fallbackStrategies.set(fallback.id, fallback);
    this.emit('fallbackAdded', fallback);
  }

  /**
   * Remove a fallback strategy
   */
  removeFallback(fallbackId: string): boolean {
    const removed = this.fallbackStrategies.delete(fallbackId);
    if (removed) {
      this.emit('fallbackRemoved', fallbackId);
    }
    return removed;
  }

  /**
   * Get all fallback strategies
   */
  getFallbacks(): FallbackStrategy[] {
    return Array.from(this.fallbackStrategies.values()).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get recovery attempt by ID
   */
  getAttempt(attemptId: string): RecoveryAttempt | null {
    return this.attempts.get(attemptId) || null;
  }

  /**
   * Get all recovery attempts
   */
  getAllAttempts(): RecoveryAttempt[] {
    return Array.from(this.attempts.values());
  }

  /**
   * Get recovery attempts for a specific error
   */
  getAttemptsForError(error: ZernError): RecoveryAttempt[] {
    return this.getAllAttempts().filter(
      attempt => attempt.error.code === error.code && attempt.error.category === error.category
    );
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(strategyName: string): RecoveryCircuitBreakerState {
    return (
      this.circuitBreakers.get(strategyName) || {
        state: 'closed',
        failureCount: 0,
      }
    );
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(strategyName: string): void {
    this.circuitBreakers.delete(strategyName);
    this.emit('circuitBreakerReset', strategyName);
  }

  /**
   * Get recovery statistics
   */
  getStatistics(): {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    averageRecoveryTime: number;
    successRate: number;
    circuitBreakers: Record<string, RecoveryCircuitBreakerState>;
    topStrategies: Array<{ name: string; successRate: number; attempts: number }>;
  } {
    const attempts = this.getAllAttempts();
    const successful = attempts.filter(a => a.status === 'success');
    const failed = attempts.filter(a => a.status === 'failed');

    const totalTime = attempts
      .filter(a => a.endTime)
      .reduce((sum, a) => sum + (a.endTime!.getTime() - a.startTime.getTime()), 0);

    const strategyStats = new Map<string, { success: number; total: number }>();

    for (const attempt of attempts) {
      const name = attempt.strategy.name;
      const stats = strategyStats.get(name) || { success: 0, total: 0 };
      stats.total++;
      if (attempt.status === 'success') {
        stats.success++;
      }
      strategyStats.set(name, stats);
    }

    const topStrategies = Array.from(strategyStats.entries())
      .map(([name, stats]) => ({
        name,
        successRate: stats.total > 0 ? stats.success / stats.total : 0,
        attempts: stats.total,
      }))
      .sort((a, b) => b.successRate - a.successRate);

    return {
      totalAttempts: attempts.length,
      successfulAttempts: successful.length,
      failedAttempts: failed.length,
      averageRecoveryTime: attempts.length > 0 ? totalTime / attempts.length : 0,
      successRate: attempts.length > 0 ? successful.length / attempts.length : 0,
      circuitBreakers: Object.fromEntries(this.circuitBreakers),
      topStrategies,
    };
  }

  /**
   * Clear recovery history
   */
  clearHistory(): void {
    this.attempts.clear();
    this.emit('historyCleared');
  }

  /**
   * Execute strategy with timeout
   */
  private async executeWithTimeout(
    strategy: RecoveryStrategy,
    error: ZernError,
    context: ErrorContext
  ): Promise<RecoveryResult> {
    const timeout = (strategy.estimatedTime || 30000) * 2; // Allow 2x estimated time, default 30s

    return await Promise.race([
      strategy.recover(error, context),
      new Promise<RecoveryResult>((_, reject) =>
        setTimeout(() => reject(new Error('Recovery timeout')), timeout)
      ),
    ]);
  }

  /**
   * Try fallback strategies
   */
  private async tryFallbacks(
    error: ZernError,
    context: ErrorContext
  ): Promise<RecoveryResult | null> {
    const applicableFallbacks = this.getFallbacks().filter(fallback =>
      fallback.canHandle(error, context)
    );

    for (const fallback of applicableFallbacks) {
      try {
        this.emit('fallbackAttempt', { error, fallback });

        const result = await fallback.execute(error, context);

        if (result.success) {
          this.emit('fallbackSuccess', { error, fallback, result });
          return result;
        }
      } catch (fallbackError) {
        this.emit('fallbackFailed', { error, fallback, fallbackError });
      }
    }

    return null;
  }

  /**
   * Check if circuit breaker is closed
   */
  private isCircuitClosed(strategyName: string): boolean {
    const state = this.getCircuitBreakerState(strategyName);

    if (state.state === 'closed') {
      return true;
    }

    if (state.state === 'open') {
      const now = new Date();
      if (state.nextAttemptTime && now >= state.nextAttemptTime) {
        // Transition to half-open
        state.state = 'half-open';
        this.circuitBreakers.set(strategyName, state);
        this.emit('circuitBreakerHalfOpen', strategyName);
        return true;
      }
      return false;
    }

    // half-open state allows one attempt
    return true;
  }

  /**
   * Record successful recovery
   */
  private recordSuccess(strategyName: string): void {
    const state = this.getCircuitBreakerState(strategyName);

    if (state.state === 'half-open') {
      // Reset circuit breaker
      this.circuitBreakers.delete(strategyName);
      this.emit('circuitBreakerClosed', strategyName);
    } else {
      // Reset failure count
      state.failureCount = 0;
      this.circuitBreakers.set(strategyName, state);
    }
  }

  /**
   * Record failed recovery
   */
  private recordFailure(strategyName: string): void {
    const state = this.getCircuitBreakerState(strategyName);
    state.failureCount++;
    state.lastFailureTime = new Date();

    if (state.failureCount >= this.config.circuitBreakerThreshold) {
      state.state = 'open';
      state.nextAttemptTime = new Date(Date.now() + this.config.circuitBreakerTimeout);
      this.emit('circuitBreakerOpen', strategyName);
    }

    this.circuitBreakers.set(strategyName, state);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    if (!this.config.exponentialBackoff) {
      return this.config.retryDelay;
    }

    const delay = this.config.retryDelay * Math.pow(2, attempt);
    return Math.min(delay, this.config.maxBackoffDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Setup default fallback strategies
   */
  private setupDefaultFallbacks(): void {
    // Graceful degradation fallback
    this.addFallback({
      id: 'graceful-degradation',
      name: 'Graceful Degradation',
      description: 'Reduce functionality to maintain basic operation',
      canHandle: (_error, _context) => this.config.enableGracefulDegradation,
      execute: async (_error, _context) => ({
        success: true,
        strategy: 'graceful-degradation',
        duration: 100,
        metadata: {
          degradedFeatures: ['advanced-features'],
          fallbackMode: true,
        },
      }),
      priority: 10,
    });

    // Safe mode fallback
    this.addFallback({
      id: 'safe-mode',
      name: 'Safe Mode',
      description: 'Switch to safe mode with minimal functionality',
      canHandle: (error, _context) => error.severity === 'critical',
      execute: async (_error, _context) => ({
        success: true,
        strategy: 'safe-mode',
        duration: 200,
        metadata: {
          safeMode: true,
          disabledFeatures: ['plugins', 'advanced-operations'],
        },
      }),
      priority: 5,
    });

    // Restart fallback
    this.addFallback({
      id: 'restart',
      name: 'Restart Component',
      description: 'Restart the affected component',
      canHandle: (error, _context) => error.category === 'plugin' || error.category === 'kernel',
      execute: async (_error, context) => ({
        success: true,
        strategy: 'restart',
        duration: 2000,
        metadata: {
          restartedComponent: context.pluginId || 'kernel',
          restartTime: new Date(),
        },
      }),
      priority: 20,
    });
  }
}

/**
 * History Service - Tracks operation history
 */

import type { MathConfig } from '../types/config.types';
import type { MathOperation, MathOperator } from '../types/domain.types';

export class HistoryService {
  private operations: MathOperation[] = [];

  constructor(private config: MathConfig) {}

  /**
   * Record a new operation
   */
  record(operation: MathOperator, operands: number[], result: number): void {
    if (!this.config.enableHistory) {
      return;
    }

    const entry: MathOperation = {
      operation,
      operands,
      result,
      timestamp: Date.now(),
    };

    this.operations.push(entry);

    // Trim history if it exceeds max size
    if (this.operations.length > this.config.maxHistorySize) {
      this.operations = this.operations.slice(-this.config.maxHistorySize);
    }
  }

  /**
   * Get all operations
   */
  getAll(): readonly MathOperation[] {
    return [...this.operations];
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.operations = [];
  }

  /**
   * Get operations count
   */
  count(): number {
    return this.operations.length;
  }

  /**
   * Get operations by type
   */
  getByOperation(operation: MathOperator): readonly MathOperation[] {
    return this.operations.filter(op => op.operation === operation);
  }

  /**
   * Get recent operations
   */
  getRecent(limit: number): readonly MathOperation[] {
    return this.operations.slice(-limit);
  }
}

/**
 * Repository interface for kernel persistence and retrieval operations.
 * Defines the contract for kernel storage without implementation details.
 */

import type { Result } from '../../shared/types/result.types.js';
import type { KernelId } from '../../shared/types/common.types.js';
import type { KernelEntity } from './kernel.entity.js';

/**
 * Kernel repository interface for data access operations.
 */
export interface KernelRepository {
  /**
   * Finds a kernel by its unique identifier.
   * @param id - Kernel unique identifier
   * @returns Result containing the kernel or error
   */
  findById(id: KernelId): Promise<Result<KernelEntity | null, KernelRepositoryError>>;

  /**
   * Saves a kernel to the repository.
   * @param kernel - Kernel to save
   * @returns Result indicating success or error
   */
  save(kernel: KernelEntity): Promise<Result<void, KernelRepositoryError>>;

  /**
   * Removes a kernel from the repository.
   * @param id - Kernel identifier to remove
   * @returns Result indicating success or error
   */
  remove(id: KernelId): Promise<Result<void, KernelRepositoryError>>;

  /**
   * Lists all kernels in the repository.
   * @returns Result containing array of all kernels or error
   */
  findAll(): Promise<Result<readonly KernelEntity[], KernelRepositoryError>>;

  /**
   * Checks if a kernel exists in the repository.
   * @param id - Kernel identifier
   * @returns Result containing boolean or error
   */
  exists(id: KernelId): Promise<Result<boolean, KernelRepositoryError>>;

  /**
   * Finds the active kernel instance.
   * @returns Result containing the active kernel or error
   */
  findActive(): Promise<Result<KernelEntity | null, KernelRepositoryError>>;

  /**
   * Sets a kernel as the active instance.
   * @param id - Kernel identifier to set as active
   * @returns Result indicating success or error
   */
  setActive(id: KernelId): Promise<Result<void, KernelRepositoryError>>;
}

/**
 * Kernel repository operation errors.
 */
export class KernelRepositoryError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'KernelRepositoryError';
    this.code = code;
    this.details = details;
  }

  static notFound(id: string): KernelRepositoryError {
    return new KernelRepositoryError(`Kernel not found: ${id}`, 'NOT_FOUND', { id });
  }

  static saveError(id: string, reason: string): KernelRepositoryError {
    return new KernelRepositoryError(`Failed to save kernel ${id}: ${reason}`, 'SAVE_ERROR', {
      id,
      reason,
    });
  }

  static removeError(id: string, reason: string): KernelRepositoryError {
    return new KernelRepositoryError(`Failed to remove kernel ${id}: ${reason}`, 'REMOVE_ERROR', {
      id,
      reason,
    });
  }

  static activeError(reason: string): KernelRepositoryError {
    return new KernelRepositoryError(`Active kernel operation failed: ${reason}`, 'ACTIVE_ERROR', {
      reason,
    });
  }
}

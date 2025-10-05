/**
 * @file Common types
 * @description Shared type definitions
 */

export type ID = string;

export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

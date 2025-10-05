/**
 * @file Formatters
 * @description Utility functions for data formatting
 */

import type { User } from '../types';

export function formatUser(user: User): string {
  return `${user.name} <${user.email}> [${user.role}]`;
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

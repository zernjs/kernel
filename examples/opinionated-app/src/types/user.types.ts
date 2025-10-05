/**
 * @file User types
 * @description User-related type definitions
 */

import type { ID, Timestamps } from './common.types';

export interface User extends Timestamps {
  id: ID;
  name: string;
  email: string;
  role: UserRole;
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  GUEST = 'guest',
}

export interface CreateUserDTO {
  name: string;
  email: string;
  role?: UserRole;
}

export interface UpdateUserDTO {
  name?: string;
  email?: string;
  role?: UserRole;
}

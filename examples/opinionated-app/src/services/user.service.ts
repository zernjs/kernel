/**
 * @file User service
 * @description Business logic for user operations
 */

import type { User, CreateUserDTO, UpdateUserDTO, UserRole } from '../types';

export class UserService {
  private users: Map<string, User> = new Map();

  async create(data: CreateUserDTO): Promise<User> {
    const id = Math.random().toString(36).slice(2);
    const now = new Date();

    const user: User = {
      id,
      name: data.name,
      email: data.email,
      role: data.role || ('user' as UserRole),
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(id, user);
    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async update(id: string, data: UpdateUserDTO): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;

    const updated: User = {
      ...user,
      ...data,
      updatedAt: new Date(),
    };

    this.users.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async findAll(): Promise<User[]> {
    return Array.from(this.users.values());
  }
}

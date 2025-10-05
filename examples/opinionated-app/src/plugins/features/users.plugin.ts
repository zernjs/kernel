/**
 * @file Users plugin
 * @description User management functionality
 */

import { plugin } from '../../../../../src';
import { loggerPlugin } from '../core/logger.plugin';
import { databasePlugin } from '../core/database.plugin';
import { UserService } from '../../services';
import type { User, CreateUserDTO, UpdateUserDTO } from '../../types';

export const usersPlugin = plugin('users', '1.0.0')
  .depends(loggerPlugin, '^1.0.0')
  .depends(databasePlugin, '^1.0.0')
  .metadata({
    author: 'Opinionated App',
    description: 'User management plugin',
    feature: 'users',
  })
  .onInit(({ plugins }) => {
    plugins.logger.info('Initializing users plugin...');
  })
  .setup(({ plugins }) => {
    const userService = new UserService();

    return {
      async create(data: CreateUserDTO): Promise<User> {
        plugins.logger.info('Creating user:', data.email);
        const user = await userService.create(data);
        plugins.logger.info('User created:', user.id);
        return user;
      },

      async findById(id: string): Promise<User | null> {
        plugins.logger.debug('Finding user by ID:', id);
        return userService.findById(id);
      },

      async findByEmail(email: string): Promise<User | null> {
        plugins.logger.debug('Finding user by email:', email);
        return userService.findByEmail(email);
      },

      async update(id: string, data: UpdateUserDTO): Promise<User | null> {
        plugins.logger.info('Updating user:', id);
        const user = await userService.update(id, data);
        if (user) {
          plugins.logger.info('User updated:', user.id);
        }
        return user;
      },

      async delete(id: string): Promise<boolean> {
        plugins.logger.info('Deleting user:', id);
        const deleted = await userService.delete(id);
        if (deleted) {
          plugins.logger.info('User deleted:', id);
        }
        return deleted;
      },

      async findAll(): Promise<User[]> {
        plugins.logger.debug('Finding all users');
        return userService.findAll();
      },
    };
  });

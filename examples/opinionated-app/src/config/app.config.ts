/**
 * @file Application configuration
 * @description Application-level settings
 */

import { env } from './env';

export interface AppConfiguration {
  name: string;
  version: string;
  environment: 'development' | 'production' | 'test';
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
}

export const appConfig: AppConfiguration = {
  name: env.APP_NAME,
  version: env.APP_VERSION,
  environment: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',
};

/**
 * Math Plugin - Core Plugin Definition
 *
 * This file ONLY contains orchestration - no business logic!
 * All logic is delegated to services, validators, and utilities.
 */

import { plugin } from '../../../src';
import { createMathAPI } from './api-factory';
import { onInit, onReady, onShutdown } from './lifecycle';
import { PLUGIN_NAME, PLUGIN_VERSION, PLUGIN_METADATA } from './config';

/**
 * Math Plugin
 *
 * A professional, production-ready math plugin demonstrating best practices:
 * - Separation of concerns (services, validators, utils)
 * - Type-safe error handling
 * - Operation history tracking
 * - Configurable runtime behavior
 * - Lifecycle hooks
 * - Direct API support
 */
export const mathPlugin = plugin(PLUGIN_NAME, PLUGIN_VERSION)
  // Custom metadata
  .metadata(PLUGIN_METADATA)

  // Lifecycle hooks
  .onInit(onInit)
  .onReady(onReady)
  .onShutdown(onShutdown)

  // Setup: Create the API using factory
  .setup(createMathAPI);

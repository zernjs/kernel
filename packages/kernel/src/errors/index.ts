/**
 * Error Handling System Index
 * Main entry point for the Zern error handling system
 */

// Core error handling components
export * from './core/index.js';

// Error types and base classes
export * from './types/index.js';

// Recovery system
export * from './recovery/index.js';

// Reporting system
export * from './reporting/index.js';

// Suggestion engine
export * from './suggestions/index.js';

// UI components
export * from './ui/index.js';

// Integration modules
export * from './integrations/index.js';

// Middleware system
export * from './middleware/index.js';

// Utility functions
export * from './utils/index.js';

// Main error handling system facade
export { ErrorHandlingSystem } from './error-handling-system.js';

# Zern Kernel Error Handling System

A comprehensive, modular error handling system designed for the Zern Kernel plugin architecture. This system provides robust error management, recovery strategies, reporting capabilities, and user-friendly error display.

## 🚀 Features

- **Comprehensive Error Types**: Specialized error classes for different scenarios (plugin, dependency, validation, custom errors)
- **Error Management**: Centralized error collection, processing, and lifecycle management
- **Recovery System**: Automatic error recovery with circuit breakers and fallback strategies
- **Reporting**: Configurable error reporting to external services with multiple transports
- **Smart Suggestions**: AI-powered error suggestions and resolution guidance
- **UI Components**: Modern, responsive error display with theming support
- **Middleware System**: Extensible middleware for error processing and transformation
- **Integration Ready**: Built-in integrations with event bus and plugin systems
- **Utilities**: Comprehensive utilities for error analysis, formatting, and sanitization

## 📁 Architecture

```
src/errors/
├── core/                   # Core error management
│   ├── error-manager.ts    # Central error manager
│   ├── error-collector.ts  # Error collection and aggregation
│   └── index.ts
├── types/                  # Error type definitions
│   ├── base-error.ts       # Base error classes
│   ├── plugin-errors.ts    # Plugin-specific errors
│   ├── dependency-errors.ts # Dependency-related errors
│   ├── validation-errors.ts # Validation errors
│   ├── custom-errors.ts    # Custom error types
│   └── index.ts
├── recovery/               # Error recovery system
│   ├── recovery-manager.ts # Recovery strategies
│   ├── circuit-breaker.ts  # Circuit breaker implementation
│   └── index.ts
├── reporting/              # Error reporting
│   ├── error-reporter.ts   # Report management
│   └── index.ts
├── suggestions/            # Error suggestions
│   ├── suggestion-engine.ts # Suggestion generation
│   └── index.ts
├── ui/                     # User interface
│   ├── error-display.ts    # Error display components
│   └── index.ts
├── integrations/           # System integrations
│   ├── event-bus-integration.ts
│   ├── plugin-integration.ts
│   └── index.ts
├── middleware/             # Error middleware
│   ├── error-middleware.ts # Middleware system
│   └── index.ts
├── utils/                  # Utility functions
│   ├── error-utils.ts      # Error utilities
│   └── index.ts
├── styles/                 # CSS styles
│   └── error-display.css   # Error UI styles
├── error-handling-system.ts # Main facade
└── index.ts               # Main exports
```

## 🛠️ Quick Start

### Basic Usage

```typescript
import { ErrorHandlingSystem } from '@zern/kernel/errors';

// Initialize the error handling system
const errorSystem = new ErrorHandlingSystem({
  enableErrorCollection: true,
  enableRecovery: true,
  enableReporting: true,
  enableSuggestions: true,
  enableUI: true,
});

// Start the system
await errorSystem.start();

// Handle an error
try {
  // Your code here
} catch (error) {
  await errorSystem.handleError(error, {
    pluginId: 'my-plugin',
    operation: 'data-processing',
  });
}
```

### Creating Custom Errors

```typescript
import { ZernError, ErrorCategory, ErrorSeverity } from '@zern/kernel/errors';

// Create a custom error
const error = new ZernError(
  'Failed to process data',
  'DATA_PROCESSING_ERROR',
  ErrorCategory.PLUGIN,
  ErrorSeverity.HIGH,
  'my-plugin',
  {
    dataSize: 1024,
    processingTime: 5000,
  }
);

// Handle the error
await errorSystem.handleError(error);
```

### Using Error Middleware

```typescript
import { ErrorMiddleware, BuiltinMiddlewares } from '@zern/kernel/errors';

const middleware = new ErrorMiddleware();

// Add custom middleware
middleware.use(
  'customTransform',
  (error, context, next) => {
    // Transform error
    if (error.message.includes('timeout')) {
      error.message = 'Operation timed out - please try again';
    }
    next();
  },
  500
);

// Add conditional middleware
middleware.use(
  'conditionalLogging',
  BuiltinMiddlewares.conditional(
    error => error.severity === ErrorSeverity.CRITICAL,
    (error, context, next) => {
      console.error('CRITICAL ERROR:', error);
      next();
    }
  )
);

// Process error through middleware
const processedError = await middleware.process(error, {
  requestContext: { userId: '123' },
});
```

## 🎯 Core Components

### Error Manager

The central component that orchestrates all error handling activities:

```typescript
import { ErrorManager } from '@zern/kernel/errors';

const manager = new ErrorManager({
  maxBreadcrumbs: 50,
  maxErrorHistory: 100,
  enableGlobalHandlers: true,
});

// Add error handlers
manager.addHandler('logger', (error, context) => {
  console.log('Error occurred:', error.message);
});

// Add error filters
manager.addFilter('severity', error => {
  return error.severity !== ErrorSeverity.LOW;
});
```

### Recovery Manager

Handles automatic error recovery with various strategies:

```typescript
import { RecoveryManager } from '@zern/kernel/errors';

const recovery = new RecoveryManager({
  maxRetries: 3,
  retryDelay: 1000,
  enableCircuitBreaker: true,
});

// Execute with recovery
const result = await recovery.executeWithRecovery(
  'data-fetch',
  async () => {
    // Your operation
    return await fetchData();
  },
  {
    retries: 3,
    fallback: () => getCachedData(),
  }
);
```

### Error Reporter

Sends error reports to external services:

```typescript
import { ErrorReporter } from '@zern/kernel/errors';

const reporter = new ErrorReporter({
  enableBatching: true,
  batchSize: 10,
  flushInterval: 30000,
});

// Add HTTP transport
reporter.addTransport('http', {
  send: async reports => {
    await fetch('/api/errors', {
      method: 'POST',
      body: JSON.stringify(reports),
    });
  },
});

// Report error
await reporter.reportError(error, {
  userId: '123',
  sessionId: 'abc',
});
```

### Suggestion Engine

Provides contextual error suggestions:

```typescript
import { SuggestionEngine } from '@zern/kernel/errors';

const suggestions = new SuggestionEngine({
  enableBuiltinRules: true,
  enableContextualSuggestions: true,
});

// Get suggestions for an error
const errorSuggestions = await suggestions.getSuggestions(error, {
  pluginId: 'my-plugin',
  environment: 'development',
});

console.log('Suggestions:', errorSuggestions);
```

## 🎨 UI Components

### Error Display

Modern, responsive error display with theming:

```typescript
import { ErrorDisplay } from '@zern/kernel/errors';

const display = new ErrorDisplay({
  theme: 'dark',
  position: 'bottom-right',
  enableAnimations: true,
  enableSounds: false,
});

// Display error
display.displayError(error, {
  dismissible: true,
  showSuggestions: true,
  showStackTrace: false,
});

// Show notification
display.showNotification({
  title: 'Plugin Loaded',
  message: 'My Plugin has been successfully loaded',
  type: 'toast',
  severity: ErrorSeverity.LOW,
});
```

### Styling

The system includes comprehensive CSS styles with:

- **Dark/Light themes**
- **Responsive design**
- **Accessibility support**
- **Print styles**
- **Reduced motion support**

## 🔧 Configuration

### System Configuration

```typescript
const config = {
  // Core settings
  enableErrorCollection: true,
  enableRecovery: true,
  enableReporting: true,
  enableSuggestions: true,
  enableUI: true,
  enableEventBusIntegration: true,
  enablePluginIntegration: true,
  enableGlobalErrorHandling: true,

  // Error Manager
  errorManager: {
    maxBreadcrumbs: 50,
    maxErrorHistory: 100,
    enableGlobalHandlers: true,
  },

  // Error Collector
  errorCollector: {
    maxCollections: 10,
    flushInterval: 60000,
    enablePatternDetection: true,
  },

  // Recovery Manager
  recoveryManager: {
    maxRetries: 3,
    retryDelay: 1000,
    enableCircuitBreaker: true,
  },

  // Error Reporter
  errorReporter: {
    enableBatching: true,
    batchSize: 10,
    flushInterval: 30000,
  },

  // Suggestion Engine
  suggestionEngine: {
    enableBuiltinRules: true,
    enableContextualSuggestions: true,
    enableCaching: true,
  },

  // Error Display
  errorDisplay: {
    theme: 'auto',
    position: 'bottom-right',
    enableAnimations: true,
    enableSounds: false,
  },
};
```

## 🧪 Testing

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import { ZernError, ErrorCategory, ErrorSeverity } from '@zern/kernel/errors';

describe('ZernError', () => {
  it('should create error with all properties', () => {
    const error = new ZernError(
      'Test error',
      'TEST_ERROR',
      ErrorCategory.PLUGIN,
      ErrorSeverity.HIGH,
      'test-plugin',
      { key: 'value' }
    );

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.category).toBe(ErrorCategory.PLUGIN);
    expect(error.severity).toBe(ErrorSeverity.HIGH);
    expect(error.pluginId).toBe('test-plugin');
    expect(error.context).toEqual({ key: 'value' });
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect } from 'vitest';
import { ErrorHandlingSystem } from '@zern/kernel/errors';

describe('ErrorHandlingSystem Integration', () => {
  it('should handle error end-to-end', async () => {
    const system = new ErrorHandlingSystem();
    await system.start();

    const error = new Error('Test error');
    const result = await system.handleError(error);

    expect(result).toBeDefined();
    expect(system.getStatistics().totalErrors).toBe(1);

    await system.stop();
  });
});
```

## 📊 Monitoring and Metrics

### Error Statistics

```typescript
// Get comprehensive error statistics
const stats = errorSystem.getStatistics();

console.log('Error Statistics:', {
  totalErrors: stats.totalErrors,
  errorsByCategory: stats.errorsByCategory,
  errorsBySeverity: stats.errorsBySeverity,
  recentErrors: stats.recentErrors,
  recoveryStats: stats.recoveryStats,
  reportingStats: stats.reportingStats,
});
```

### Health Monitoring

```typescript
// Check system health
const health = errorSystem.getHealth();

console.log('System Health:', {
  status: health.status,
  uptime: health.uptime,
  errorRate: health.errorRate,
  recoveryRate: health.recoveryRate,
  components: health.components,
});
```

## 🔌 Integrations

### Event Bus Integration

```typescript
import { EventBusIntegration } from '@zern/kernel/errors';

const eventBusIntegration = new EventBusIntegration(eventBus, errorManager);

// The integration automatically:
// - Listens for error events from the event bus
// - Emits error events to the event bus
// - Handles plugin-specific error events
// - Manages error notifications
```

### Plugin Integration

```typescript
import { PluginIntegration } from '@zern/kernel/errors';

const pluginIntegration = new PluginIntegration(pluginManager, errorManager);

// The integration automatically:
// - Handles plugin-specific errors
// - Manages error isolation between plugins
// - Tracks plugin error rates
// - Provides plugin health monitoring
```

## 🛡️ Security

### Error Sanitization

The system automatically sanitizes sensitive information:

```typescript
import { ErrorSanitizer } from '@zern/kernel/errors';

// Automatically removes:
// - Passwords, tokens, keys
// - Authorization headers
// - API keys and secrets
// - Session IDs and cookies

const sanitized = ErrorSanitizer.sanitizeError(error);
```

### Safe Error Reporting

- Sensitive data is automatically removed before reporting
- Context sanitization prevents data leaks
- Configurable sanitization rules
- Audit trail for error handling

## 📚 API Reference

### Core Classes

- **`ZernError`**: Base error class with enhanced properties
- **`ErrorManager`**: Central error management
- **`ErrorCollector`**: Error collection and aggregation
- **`RecoveryManager`**: Error recovery strategies
- **`ErrorReporter`**: Error reporting system
- **`SuggestionEngine`**: Error suggestion generation
- **`ErrorDisplay`**: UI error display
- **`ErrorMiddleware`**: Error processing middleware
- **`ErrorHandlingSystem`**: Main system facade

### Utility Classes

- **`ErrorFormatter`**: Error formatting utilities
- **`ErrorAnalyzer`**: Error analysis and categorization
- **`ErrorSanitizer`**: Error sanitization
- **`ErrorConverter`**: Error conversion utilities
- **`ErrorValidator`**: Error validation

### Types and Enums

- **`ErrorCategory`**: Error categorization
- **`ErrorSeverity`**: Error severity levels
- **`ErrorContext`**: Error context interface
- **`RecoveryStrategy`**: Recovery strategy types
- **`SuggestionType`**: Suggestion types

## 🤝 Contributing

1. Follow the Zern Kernel coding conventions
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Use TypeScript strict mode
5. Follow the established architecture patterns

## 📄 License

This error handling system is part of the Zern Kernel and follows the same license terms.

---

For more information about the Zern Kernel, visit the [main documentation](../README.md).

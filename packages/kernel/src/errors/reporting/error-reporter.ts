/**
 * @fileoverview Error reporting system
 * @module @zern/kernel/errors/reporting/error-reporter
 */

/* eslint-env browser, node */
/* global fetch, localStorage, navigator */

import { EventEmitter } from 'events';
import type { ZernError, ErrorContext } from '../types/base.js';

export interface ErrorReport {
  id: string;
  error: ZernError;
  context: ErrorContext;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'sent' | 'failed' | 'ignored';
  attempts: number;
  lastAttempt?: Date;
  metadata: Record<string, unknown>;
}

export interface ReportingConfig {
  enabled: boolean;
  endpoint?: string;
  apiKey?: string;
  batchSize: number;
  batchTimeout: number;
  maxRetries: number;
  retryDelay: number;
  enableLocalStorage: boolean;
  enableConsoleReporting: boolean;
  enableFileReporting: boolean;
  reportingLevel: 'low' | 'medium' | 'high' | 'critical';
  includeStackTrace: boolean;
  includeEnvironment: boolean;
  includeBreadcrumbs: boolean;
  sanitizeData: boolean;
  customFields: Record<string, unknown>;
}

export interface ReportingTransport {
  name: string;
  send: (reports: ErrorReport[]) => Promise<void>;
  canSend: (report: ErrorReport) => boolean;
}

export interface ReportingFilter {
  name: string;
  filter: (report: ErrorReport) => boolean;
}

export interface ReportingStats {
  totalReports: number;
  sentReports: number;
  failedReports: number;
  pendingReports: number;
  reportsByLevel: Record<string, number>;
  reportsByCategory: Record<string, number>;
  lastReportTime?: Date;
  averageReportSize: number;
}

/**
 * Error reporting system for sending error reports to external services
 */
export class ErrorReporter extends EventEmitter {
  private readonly config: ReportingConfig;
  private readonly reports = new Map<string, ErrorReport>();
  private readonly transports = new Map<string, ReportingTransport>();
  private readonly filters = new Set<ReportingFilter>();
  private readonly pendingReports = new Set<string>();
  private reportCounter = 0;
  private batchTimer?: ReturnType<typeof setInterval> | undefined;
  private stats: ReportingStats;

  constructor(config: Partial<ReportingConfig> = {}) {
    super();

    this.config = {
      enabled: true,
      batchSize: 10,
      batchTimeout: 5000,
      maxRetries: 3,
      retryDelay: 1000,
      enableLocalStorage: false,
      enableConsoleReporting: true,
      enableFileReporting: false,
      reportingLevel: 'medium',
      includeStackTrace: true,
      includeEnvironment: true,
      includeBreadcrumbs: true,
      sanitizeData: true,
      customFields: {},
      ...config,
    };

    this.stats = {
      totalReports: 0,
      sentReports: 0,
      failedReports: 0,
      pendingReports: 0,
      reportsByLevel: {},
      reportsByCategory: {},
      averageReportSize: 0,
    };

    this.setupDefaultTransports();
    this.setupDefaultFilters();
    this.startBatchTimer();
  }

  /**
   * Report an error
   */
  async report(error: ZernError, context: ErrorContext): Promise<string | null> {
    if (!this.config.enabled) {
      return null;
    }

    // Check if error meets reporting level threshold
    if (!this.shouldReport(error)) {
      return null;
    }

    const reportId = `report-${++this.reportCounter}-${Date.now()}`;

    // Create a temporary report with original error for filter checking
    const tempReport: ErrorReport = {
      id: reportId,
      error: error, // Use original error for filter checking
      context: context, // Use original context for filter checking
      timestamp: new Date(),
      severity: error.severity,
      status: 'pending',
      attempts: 0,
      metadata: {
        ...this.config.customFields,
        reporterVersion: '1.0.0',
        userAgent: this.getUserAgent(),
        sessionId: this.getSessionId(),
      },
    };

    // Apply filters first using original data
    if (!this.passesFilters(tempReport)) {
      // Create the final report with sanitized data but mark as ignored
      const report: ErrorReport = {
        ...tempReport,
        error: this.sanitizeError(error),
        context: this.sanitizeContext(context),
        status: 'ignored',
      };

      this.reports.set(reportId, report);
      this.updateStats(report);
      this.emit('reportIgnored', report);
      return reportId;
    }

    // Create the final report with sanitized data
    const report: ErrorReport = {
      ...tempReport,
      error: this.sanitizeError(error),
      context: this.sanitizeContext(context),
    };

    this.reports.set(reportId, report);
    this.pendingReports.add(reportId);
    this.updateStats(report);

    this.emit('reportCreated', report);

    // Try immediate send for critical errors
    if (error.severity === 'critical') {
      await this.sendReport(report);
    }

    return reportId;
  }

  /**
   * Add a transport
   */
  addTransport(transport: ReportingTransport): void {
    this.transports.set(transport.name, transport);
    this.emit('transportAdded', transport);
  }

  /**
   * Remove a transport
   */
  removeTransport(name: string): boolean {
    const removed = this.transports.delete(name);
    if (removed) {
      this.emit('transportRemoved', name);
    }
    return removed;
  }

  /**
   * Add a filter
   */
  addFilter(filter: ReportingFilter): void {
    this.filters.add(filter);
    this.emit('filterAdded', filter);
  }

  /**
   * Remove a filter
   */
  removeFilter(filter: ReportingFilter): boolean {
    const removed = this.filters.delete(filter);
    if (removed) {
      this.emit('filterRemoved', filter);
    }
    return removed;
  }

  /**
   * Get a report by ID
   */
  getReport(reportId: string): ErrorReport | null {
    return this.reports.get(reportId) || null;
  }

  /**
   * Get all reports
   */
  getAllReports(): ErrorReport[] {
    return Array.from(this.reports.values());
  }

  /**
   * Get pending reports
   */
  getPendingReports(): ErrorReport[] {
    return Array.from(this.pendingReports)
      .map(id => this.reports.get(id))
      .filter((report): report is ErrorReport => report !== undefined);
  }

  /**
   * Get reports by status
   */
  getReportsByStatus(status: ErrorReport['status']): ErrorReport[] {
    return this.getAllReports().filter(report => report.status === status);
  }

  /**
   * Get reporting statistics
   */
  getStatistics(): Readonly<ReportingStats> {
    return { ...this.stats };
  }

  /**
   * Flush pending reports immediately
   */
  async flush(): Promise<void> {
    const pending = this.getPendingReports();
    if (pending.length === 0) {
      return;
    }

    await this.sendBatch(pending);
  }

  /**
   * Clear all reports
   */
  clear(): void {
    this.reports.clear();
    this.pendingReports.clear();
    this.resetStats();
    this.emit('reportsCleared');
  }

  /**
   * Enable/disable reporting
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.emit('reportingToggled', enabled);
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ReportingConfig>): void {
    Object.assign(this.config, updates);
    this.emit('configUpdated', updates);
  }

  /**
   * Check if error should be reported
   */
  private shouldReport(error: ZernError): boolean {
    const levels = ['low', 'medium', 'high', 'critical'];
    const errorLevelIndex = levels.indexOf(error.severity);
    const configLevelIndex = levels.indexOf(this.config.reportingLevel);

    return errorLevelIndex >= configLevelIndex;
  }

  /**
   * Check if report passes all filters
   */
  private passesFilters(report: ErrorReport): boolean {
    for (const filter of this.filters) {
      if (!filter.filter(report)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Sanitize error data
   */
  private sanitizeError(error: ZernError): ZernError {
    if (!this.config.sanitizeData) {
      return error;
    }

    // Create a sanitized copy that maintains the ZernError structure
    const sanitized = Object.create(Object.getPrototypeOf(error));
    Object.assign(sanitized, error);

    // Explicitly preserve the message property since it might not be copied correctly
    sanitized.message = error.message;

    // Sanitize the message for sensitive data patterns
    const sensitivePatterns = [
      /password\s*[:=]\s*\S+/gi,
      /token\s*[:=]\s*\S+/gi,
      /key\s*[:=]\s*\S+/gi,
      /secret\s*[:=]\s*\S+/gi,
      /auth\s*[:=]\s*\S+/gi,
      /credential\s*[:=]\s*\S+/gi,
    ];

    let sanitizedMessage = sanitized.message;

    for (const pattern of sensitivePatterns) {
      sanitizedMessage = sanitizedMessage.replace(pattern, (match: string) => {
        const [key = ''] = match.split(/[:=]/);
        return `${key.trim()}: [REDACTED]`;
      });
    }

    sanitized.message = sanitizedMessage;

    // Remove sensitive data from metadata
    if (sanitized.metadata) {
      sanitized.metadata = this.sanitizeObject(sanitized.metadata);
    }

    return sanitized;
  }

  /**
   * Sanitize context data
   */
  private sanitizeContext(context: ErrorContext): ErrorContext {
    if (!this.config.sanitizeData) {
      return context;
    }

    const sanitized = { ...context };

    // Remove sensitive environment data
    if (sanitized.environment) {
      sanitized.environment = {
        ...sanitized.environment,
        environment: this.sanitizeEnvironment(sanitized.environment.environment),
      };
    }

    // Limit breadcrumbs if not included
    if (!this.config.includeBreadcrumbs) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { breadcrumbs: _, ...rest } = sanitized;
      return rest as ErrorContext;
    }

    return sanitized;
  }

  /**
   * Sanitize object by removing sensitive keys
   */
  private sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'credential'];
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize environment object to ensure string values
   */
  private sanitizeEnvironment(obj: Record<string, unknown>): Record<string, string> {
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'credential'];
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else {
        // Convert all values to strings
        sanitized[key] = String(value ?? '');
      }
    }

    return sanitized;
  }

  /**
   * Send a single report
   */
  private async sendReport(report: ErrorReport): Promise<void> {
    report.attempts++;
    report.lastAttempt = new Date();

    const availableTransports = Array.from(this.transports.values()).filter(transport =>
      transport.canSend(report)
    );

    if (availableTransports.length === 0) {
      report.status = 'failed';
      this.pendingReports.delete(report.id);
      this.emit('reportFailed', { report, reason: 'No available transports' });
      return;
    }

    for (const transport of availableTransports) {
      try {
        await transport.send([report]);
        report.status = 'sent';
        this.pendingReports.delete(report.id);
        this.stats.sentReports++;
        this.emit('reportSent', { report, transport: transport.name });
        return;
      } catch (error) {
        this.emit('transportError', {
          report,
          transport: transport.name,
          error,
        });
      }
    }

    // All transports failed
    if (report.attempts >= this.config.maxRetries) {
      report.status = 'failed';
      this.pendingReports.delete(report.id);
      this.stats.failedReports++;
      this.emit('reportFailed', { report, reason: 'Max retries exceeded' });
    } else {
      // Schedule retry
      setTimeout(() => {
        if (this.pendingReports.has(report.id)) {
          this.sendReport(report);
        }
      }, this.config.retryDelay * report.attempts);
    }
  }

  /**
   * Send a batch of reports
   */
  private async sendBatch(reports: ErrorReport[]): Promise<void> {
    if (reports.length === 0) {
      return;
    }

    const batches = this.createBatches(reports);

    for (const batch of batches) {
      const availableTransports = Array.from(this.transports.values()).filter(transport =>
        batch.every(report => transport.canSend(report))
      );

      let batchSent = false;

      // Send to ALL available transports
      for (const transport of availableTransports) {
        try {
          await transport.send(batch);
          this.emit('batchSent', { reports: batch, transport: transport.name });
          batchSent = true;
        } catch (error) {
          this.emit('batchError', {
            reports: batch,
            transport: transport.name,
            error,
          });
        }
      }

      // Mark reports as sent only if at least one transport succeeded
      if (batchSent) {
        for (const report of batch) {
          report.status = 'sent';
          this.pendingReports.delete(report.id);
          this.stats.sentReports++;
        }
      }
    }
  }

  /**
   * Create batches from reports
   */
  private createBatches(reports: ErrorReport[]): ErrorReport[][] {
    const batches: ErrorReport[][] = [];

    for (let i = 0; i < reports.length; i += this.config.batchSize) {
      batches.push(reports.slice(i, i + this.config.batchSize));
    }

    return batches;
  }

  /**
   * Update statistics
   */
  private updateStats(report: ErrorReport): void {
    this.stats.totalReports++;
    this.stats.pendingReports++;
    this.stats.reportsByLevel[report.severity] =
      (this.stats.reportsByLevel[report.severity] || 0) + 1;
    this.stats.reportsByCategory[report.error.category] =
      (this.stats.reportsByCategory[report.error.category] || 0) + 1;
    this.stats.lastReportTime = report.timestamp;

    // Update average report size (rough estimate)
    const reportSize = JSON.stringify(report).length;
    this.stats.averageReportSize =
      (this.stats.averageReportSize * (this.stats.totalReports - 1) + reportSize) /
      this.stats.totalReports;
  }

  /**
   * Reset statistics
   */
  private resetStats(): void {
    this.stats = {
      totalReports: 0,
      sentReports: 0,
      failedReports: 0,
      pendingReports: 0,
      reportsByLevel: {},
      reportsByCategory: {},
      averageReportSize: 0,
    };
  }

  /**
   * Setup default transports
   */
  private setupDefaultTransports(): void {
    // Console transport
    if (this.config.enableConsoleReporting) {
      this.addTransport({
        name: 'console',
        canSend: () => true,
        send: async reports => {
          for (const report of reports) {
            console.error('Error Report:', {
              id: report.id,
              error: {
                code: report.error.code,
                message: report.error.message,
                category: report.error.category,
                severity: report.error.severity,
              },
              timestamp: report.timestamp,
            });
          }
        },
      });
    }

    // HTTP transport
    if (this.config.endpoint && typeof fetch !== 'undefined') {
      this.addTransport({
        name: 'http',
        canSend: () => !!this.config.endpoint && typeof fetch !== 'undefined',
        send: async reports => {
          if (typeof fetch === 'undefined') {
            throw new Error('fetch is not available in this environment');
          }

          const response = await fetch(this.config.endpoint!, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
            },
            body: JSON.stringify({ reports }),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        },
      });
    }

    // Local storage transport
    if (this.config.enableLocalStorage && typeof localStorage !== 'undefined') {
      this.addTransport({
        name: 'localStorage',
        canSend: () => typeof localStorage !== 'undefined',
        send: async reports => {
          if (typeof localStorage === 'undefined') {
            throw new Error('localStorage is not available in this environment');
          }

          const key = `zern-error-reports-${Date.now()}`;
          localStorage.setItem(key, JSON.stringify(reports));
        },
      });
    }
  }

  /**
   * Setup default filters
   */
  private setupDefaultFilters(): void {
    // Duplicate error filter
    this.addFilter({
      name: 'duplicate-filter',
      filter: report => {
        const recent = this.getAllReports()
          .filter(r => r.id !== report.id)
          .filter(r => Date.now() - r.timestamp.getTime() < 60000) // Last minute
          .filter(
            r => r.error.code === report.error.code && r.error.category === report.error.category
          );

        return recent.length < 5; // Allow max 5 duplicates per minute
      },
    });
  }

  /**
   * Start batch timer
   */
  private startBatchTimer(): void {
    if (this.config.batchTimeout > 0) {
      this.batchTimer = setInterval(() => {
        const pending = this.getPendingReports();
        if (pending.length > 0) {
          this.sendBatch(pending);
        }
      }, this.config.batchTimeout);
    }
  }

  /**
   * Stop batch timer
   */
  private stopBatchTimer(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = undefined as ReturnType<typeof setInterval> | undefined;
    }
  }

  /**
   * Get user agent
   */
  private getUserAgent(): string {
    if (typeof navigator !== 'undefined' && navigator.userAgent) {
      return navigator.userAgent;
    }
    if (typeof process !== 'undefined' && process.version) {
      return `Node.js ${process.version}`;
    }
    return 'Unknown environment';
  }

  /**
   * Get session ID
   */
  private getSessionId(): string {
    // Simple session ID generation
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopBatchTimer();
    this.clear();
    this.removeAllListeners();
  }
}

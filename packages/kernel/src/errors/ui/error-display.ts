/**
 * @fileoverview Error display and UI components
 * @module @zern/kernel/errors/ui/error-display
 */

import { EventEmitter } from 'events';
import type { ZernError, ErrorSuggestion, ErrorContext, ErrorBreadcrumb } from '../types/base.js';

export interface ErrorDisplayConfig {
  showStackTrace: boolean;
  showSuggestions: boolean;
  showContext: boolean;
  showBreadcrumbs: boolean;
  maxSuggestions: number;
  theme: 'light' | 'dark' | 'auto';
  position: 'top' | 'bottom' | 'center' | 'corner';
  autoHide: boolean;
  autoHideDelay: number;
  enableAnimations: boolean;
  enableSound: boolean;
}

export interface ErrorDisplayElement {
  id: string;
  error: ZernError;
  context: ErrorContext;
  suggestions: ErrorSuggestion[];
  element: HTMLElement;
  timestamp: Date;
  dismissed: boolean;
}

export interface ErrorNotification {
  id: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'toast' | 'modal' | 'banner' | 'inline';
  actions?: ErrorNotificationAction[];
  autoHide?: boolean;
  hideDelay?: number;
}

export interface ErrorNotificationAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
  action: () => void | Promise<void>;
}

export interface ErrorDisplayStats {
  totalDisplayed: number;
  displayedBySeverity: Record<string, number>;
  totalDismissed: number;
  averageDisplayTime: number;
  interactionRate: number;
}

/**
 * Error display manager for UI components
 */
export class ErrorDisplay extends EventEmitter {
  private readonly config: ErrorDisplayConfig;
  private readonly displayedErrors = new Map<string, ErrorDisplayElement>();
  private readonly notifications = new Map<string, ErrorNotification>();
  private readonly stats: ErrorDisplayStats;
  private container: HTMLElement | null = null;
  private notificationContainer: HTMLElement | null = null;

  constructor(config: Partial<ErrorDisplayConfig> = {}) {
    super();

    this.config = {
      showStackTrace: false,
      showSuggestions: true,
      showContext: true,
      showBreadcrumbs: false,
      maxSuggestions: 5,
      theme: 'auto',
      position: 'corner',
      autoHide: true,
      autoHideDelay: 10000,
      enableAnimations: true,
      enableSound: false,
      ...config,
    };

    this.stats = {
      totalDisplayed: 0,
      displayedBySeverity: {},
      totalDismissed: 0,
      averageDisplayTime: 0,
      interactionRate: 0,
    };

    this.initializeUI();
  }

  /**
   * Display an error with context and suggestions
   */
  displayError(
    error: ZernError,
    context: ErrorContext,
    suggestions: ErrorSuggestion[] = []
  ): string {
    const id = this.generateErrorId(error);

    // Check if error is already displayed
    if (this.displayedErrors.has(id)) {
      return id;
    }

    const element = this.createErrorElement(error, context, suggestions);

    const displayElement: ErrorDisplayElement = {
      id,
      error,
      context,
      suggestions,
      element,
      timestamp: new Date(),
      dismissed: false,
    };

    this.displayedErrors.set(id, displayElement);

    // Add to container
    if (this.container) {
      this.container.appendChild(element);
    }

    // Auto-hide if configured
    if (this.config.autoHide) {
      setTimeout(() => {
        this.dismissError(id);
      }, this.config.autoHideDelay);
    }

    // Update statistics
    this.updateDisplayStats(error);

    // Play sound if enabled
    if (this.config.enableSound) {
      this.playErrorSound(error.severity);
    }

    this.emit('errorDisplayed', { id, error, context, suggestions });

    return id;
  }

  /**
   * Show a notification
   */
  showNotification(notification: ErrorNotification): string {
    const element = this.createNotificationElement(notification);

    this.notifications.set(notification.id, notification);

    if (this.notificationContainer) {
      this.notificationContainer.appendChild(element);
    }

    // Auto-hide if configured
    if (notification.autoHide !== false) {
      const delay = notification.hideDelay || this.config.autoHideDelay;
      setTimeout(() => {
        this.hideNotification(notification.id);
      }, delay);
    }

    this.emit('notificationShown', notification);

    return notification.id;
  }

  /**
   * Dismiss an error display
   */
  dismissError(errorId: string): boolean {
    const displayElement = this.displayedErrors.get(errorId);

    if (!displayElement || displayElement.dismissed) {
      return false;
    }

    displayElement.dismissed = true;

    // Remove from DOM with animation
    if (this.config.enableAnimations) {
      this.animateOut(displayElement.element, () => {
        displayElement.element.remove();
      });
    } else {
      displayElement.element.remove();
    }

    // Update statistics
    const displayTime = Date.now() - displayElement.timestamp.getTime();
    this.updateDismissStats(displayTime);

    this.emit('errorDismissed', { id: errorId, displayTime });

    return true;
  }

  /**
   * Hide a notification
   */
  hideNotification(notificationId: string): boolean {
    const notification = this.notifications.get(notificationId);

    if (!notification) {
      return false;
    }

    const element = document.querySelector(`[data-notification-id="${notificationId}"]`);

    if (element) {
      if (this.config.enableAnimations) {
        this.animateOut(element as HTMLElement, () => {
          element.remove();
        });
      } else {
        element.remove();
      }
    }

    this.notifications.delete(notificationId);
    this.emit('notificationHidden', notification);

    return true;
  }

  /**
   * Clear all displayed errors
   */
  clearAll(): void {
    for (const [id] of this.displayedErrors) {
      this.dismissError(id);
    }

    for (const [id] of this.notifications) {
      this.hideNotification(id);
    }

    this.emit('allCleared');
  }

  /**
   * Get displayed errors
   */
  getDisplayedErrors(): string[] {
    return Array.from(this.displayedErrors.values())
      .filter(element => !element.dismissed)
      .map(element => element.id);
  }

  /**
   * Get active notifications
   */
  getActiveNotifications(): ErrorNotification[] {
    return Array.from(this.notifications.values());
  }

  /**
   * Get display statistics
   */
  getStatistics(): Readonly<ErrorDisplayStats> {
    return { ...this.stats };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ErrorDisplayConfig>): void {
    Object.assign(this.config, newConfig);
    this.applyTheme();
    this.emit('configUpdated', this.config);
  }

  /**
   * Initialize UI containers
   */
  private initializeUI(): void {
    // Create main error container
    this.container = document.createElement('div');
    this.container.id = 'zern-error-display';
    this.container.className = 'zern-error-container';

    // Create notification container
    this.notificationContainer = document.createElement('div');
    this.notificationContainer.id = 'zern-notification-display';
    this.notificationContainer.className = 'zern-notification-container';

    // Apply initial styling
    this.applyContainerStyles();
    this.applyTheme();

    // Add to document
    if (typeof document !== 'undefined') {
      document.body.appendChild(this.container);
      document.body.appendChild(this.notificationContainer);
    }
  }

  /**
   * Create error display element
   */
  private createErrorElement(
    error: ZernError,
    context: ErrorContext,
    suggestions: ErrorSuggestion[]
  ): HTMLElement {
    const element = document.createElement('div');
    element.className = `zern-error-item severity-${error.severity}`;
    element.setAttribute('data-error-id', this.generateErrorId(error));

    // Header
    const header = document.createElement('div');
    header.className = 'zern-error-header';

    const title = document.createElement('h3');
    title.className = 'zern-error-title';
    title.textContent = error.message;

    const severity = document.createElement('span');
    severity.className = `zern-error-severity severity-${error.severity}`;
    severity.textContent = error.severity.toUpperCase();

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'zern-error-dismiss';
    dismissBtn.innerHTML = '×';
    dismissBtn.onclick = (): void => {
      this.dismissError(this.generateErrorId(error));
    };

    header.appendChild(title);
    header.appendChild(severity);
    header.appendChild(dismissBtn);

    // Content
    const content = document.createElement('div');
    content.className = 'zern-error-content';

    // Error details
    const details = document.createElement('div');
    details.className = 'zern-error-details';

    const code = document.createElement('code');
    code.textContent = `${error.category}:${error.code}`;
    details.appendChild(code);

    if (context.pluginId) {
      const plugin = document.createElement('span');
      plugin.className = 'zern-error-plugin';
      plugin.textContent = `Plugin: ${context.pluginId}`;
      details.appendChild(plugin);
    }

    content.appendChild(details);

    // Context information
    if (this.config.showContext && context) {
      const contextEl = this.createContextElement(context);
      content.appendChild(contextEl);
    }

    // Stack trace
    if (this.config.showStackTrace && error.stack) {
      const stackEl = this.createStackTraceElement(error.stack);
      content.appendChild(stackEl);
    }

    // Suggestions
    if (this.config.showSuggestions && suggestions.length > 0) {
      const suggestionsEl = this.createSuggestionsElement(suggestions);
      content.appendChild(suggestionsEl);
    }

    // Breadcrumbs
    if (this.config.showBreadcrumbs && context.breadcrumbs) {
      const breadcrumbsEl = this.createBreadcrumbsElement(context.breadcrumbs);
      content.appendChild(breadcrumbsEl);
    }

    element.appendChild(header);
    element.appendChild(content);

    // Add animation
    if (this.config.enableAnimations) {
      this.animateIn(element);
    }

    return element;
  }

  /**
   * Create notification element
   */
  private createNotificationElement(notification: ErrorNotification): HTMLElement {
    const element = document.createElement('div');
    element.className = `zern-notification ${notification.type} severity-${notification.severity}`;
    element.setAttribute('data-notification-id', notification.id);

    const content = document.createElement('div');
    content.className = 'zern-notification-content';

    const title = document.createElement('h4');
    title.className = 'zern-notification-title';
    title.textContent = notification.title;

    const message = document.createElement('p');
    message.className = 'zern-notification-message';
    message.textContent = notification.message;

    content.appendChild(title);
    content.appendChild(message);

    // Actions
    if (notification.actions && notification.actions.length > 0) {
      const actions = document.createElement('div');
      actions.className = 'zern-notification-actions';

      for (const action of notification.actions) {
        const button = document.createElement('button');
        button.className = `zern-notification-action ${action.type}`;
        button.textContent = action.label;
        button.onclick = async (): Promise<void> => {
          try {
            await action.action();
            this.hideNotification(notification.id);
          } catch (error) {
            console.error('Notification action failed:', error);
          }
        };
        actions.appendChild(button);
      }

      content.appendChild(actions);
    }

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'zern-notification-close';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = (): void => {
      this.hideNotification(notification.id);
    };

    element.appendChild(content);
    element.appendChild(closeBtn);

    if (this.config.enableAnimations) {
      this.animateIn(element);
    }

    return element;
  }

  /**
   * Create context display element
   */
  private createContextElement(context: ErrorContext): HTMLElement {
    const element = document.createElement('div');
    element.className = 'zern-error-context';

    const title = document.createElement('h4');
    title.textContent = 'Context';
    element.appendChild(title);

    const list = document.createElement('ul');

    if (context.operation) {
      const item = document.createElement('li');
      item.innerHTML = `<strong>Operation:</strong> ${context.operation}`;
      list.appendChild(item);
    }

    if (context.userId) {
      const item = document.createElement('li');
      item.innerHTML = `<strong>User:</strong> ${context.userId}`;
      list.appendChild(item);
    }

    if (context.sessionId) {
      const item = document.createElement('li');
      item.innerHTML = `<strong>Session:</strong> ${context.sessionId}`;
      list.appendChild(item);
    }

    element.appendChild(list);
    return element;
  }

  /**
   * Create stack trace element
   */
  private createStackTraceElement(stack: string): HTMLElement {
    const element = document.createElement('details');
    element.className = 'zern-error-stack';

    const summary = document.createElement('summary');
    summary.textContent = 'Stack Trace';
    element.appendChild(summary);

    const pre = document.createElement('pre');
    pre.textContent = stack;
    element.appendChild(pre);

    return element;
  }

  /**
   * Create suggestions element
   */
  private createSuggestionsElement(suggestions: ErrorSuggestion[]): HTMLElement {
    const element = document.createElement('div');
    element.className = 'zern-error-suggestions';

    const title = document.createElement('h4');
    title.textContent = 'Suggestions';
    element.appendChild(title);

    const list = document.createElement('ul');

    const displaySuggestions = suggestions.slice(0, this.config.maxSuggestions);

    for (const suggestion of displaySuggestions) {
      const item = document.createElement('li');
      item.className = `suggestion-${suggestion.type}`;

      const suggestionTitle = document.createElement('strong');
      suggestionTitle.textContent = suggestion.title;
      item.appendChild(suggestionTitle);

      const description = document.createElement('p');
      description.textContent = suggestion.description;
      item.appendChild(description);

      if (suggestion.action) {
        const actionBtn = document.createElement('button');
        actionBtn.className = 'suggestion-action';
        actionBtn.textContent = 'Apply';
        actionBtn.onclick = (): void => {
          this.executeSuggestionAction(suggestion);
        };
        item.appendChild(actionBtn);
      }

      list.appendChild(item);
    }

    element.appendChild(list);
    return element;
  }

  /**
   * Create breadcrumbs element
   */
  private createBreadcrumbsElement(breadcrumbs: ErrorBreadcrumb[]): HTMLElement {
    const element = document.createElement('details');
    element.className = 'zern-error-breadcrumbs';

    const summary = document.createElement('summary');
    summary.textContent = 'Recent Activity';
    element.appendChild(summary);

    const list = document.createElement('ul');

    for (const breadcrumb of breadcrumbs.slice(-10)) {
      const item = document.createElement('li');
      item.className = `breadcrumb-${breadcrumb.category}`;

      const time = new Date(breadcrumb.timestamp).toLocaleTimeString();
      item.innerHTML = `<span class="time">${time}</span> ${breadcrumb.message}`;

      list.appendChild(item);
    }

    element.appendChild(list);
    return element;
  }

  /**
   * Execute suggestion action
   */
  private async executeSuggestionAction(suggestion: ErrorSuggestion): Promise<void> {
    if (!suggestion.action) {
      return;
    }

    try {
      switch (suggestion.action.type) {
        case 'command':
          this.emit('executeCommand', suggestion.action.payload);
          break;
        case 'link':
          if (typeof window !== 'undefined') {
            window.open(suggestion.action.payload as string, '_blank');
          }
          break;
        case 'config':
          this.emit('updateConfig', suggestion.action.payload);
          break;
        case 'code':
          this.emit('executeCode', suggestion.action.payload);
          break;
        default:
          console.warn('Unknown suggestion action type:', suggestion.action.type);
      }
    } catch {
      // Error executing suggestion action - silently fail
      console.warn('Failed to execute suggestion action');
    }
  }

  /**
   * Apply container styles
   */
  private applyContainerStyles(): void {
    if (!this.container || !this.notificationContainer) {
      return;
    }

    const baseStyles = `
      position: fixed;
      z-index: 10000;
      pointer-events: none;
    `;

    const errorStyles = `
      ${baseStyles}
      ${this.getPositionStyles()}
      max-width: 400px;
      max-height: 80vh;
      overflow-y: auto;
    `;

    const notificationStyles = `
      ${baseStyles}
      top: 20px;
      right: 20px;
      max-width: 350px;
    `;

    this.container.style.cssText = errorStyles;
    this.notificationContainer.style.cssText = notificationStyles;
  }

  /**
   * Get position styles based on configuration
   */
  private getPositionStyles(): string {
    switch (this.config.position) {
      case 'top':
        return 'top: 20px; left: 50%; transform: translateX(-50%);';
      case 'bottom':
        return 'bottom: 20px; left: 50%; transform: translateX(-50%);';
      case 'center':
        return 'top: 50%; left: 50%; transform: translate(-50%, -50%);';
      case 'corner':
      default:
        return 'bottom: 20px; right: 20px;';
    }
  }

  /**
   * Apply theme styles
   */
  private applyTheme(): void {
    const theme = this.config.theme === 'auto' ? this.detectTheme() : this.config.theme;

    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-zern-theme', theme);
    }
  }

  /**
   * Detect system theme
   */
  private detectTheme(): 'light' | 'dark' {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }

  /**
   * Animate element in
   */
  private animateIn(element: HTMLElement): void {
    element.style.opacity = '0';
    element.style.transform = 'translateY(20px)';
    element.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

    requestAnimationFrame(() => {
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
    });
  }

  /**
   * Animate element out
   */
  private animateOut(element: HTMLElement, callback: () => void): void {
    element.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    element.style.opacity = '0';
    element.style.transform = 'translateY(-20px)';

    setTimeout(callback, 300);
  }

  /**
   * Play error sound
   */
  private playErrorSound(severity: string): void {
    if (typeof Audio === 'undefined') {
      return;
    }

    try {
      const frequency = this.getSoundFrequency(severity);
      const context = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.1, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);

      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.5);
    } catch {
      // Ignore audio errors
    }
  }

  /**
   * Get sound frequency for severity
   */
  private getSoundFrequency(severity: string): number {
    switch (severity) {
      case 'critical':
        return 800;
      case 'high':
        return 600;
      case 'medium':
        return 400;
      case 'low':
        return 300;
      default:
        return 400;
    }
  }

  /**
   * Generate error ID
   */
  private generateErrorId(error: ZernError): string {
    return `${error.category}-${error.code}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update display statistics
   */
  private updateDisplayStats(error: ZernError): void {
    this.stats.totalDisplayed++;
    this.stats.displayedBySeverity[error.severity] =
      (this.stats.displayedBySeverity[error.severity] || 0) + 1;
  }

  /**
   * Update dismiss statistics
   */
  private updateDismissStats(displayTime: number): void {
    this.stats.totalDismissed++;

    // Update average display time
    const totalTime = this.stats.averageDisplayTime * (this.stats.totalDismissed - 1) + displayTime;
    this.stats.averageDisplayTime = totalTime / this.stats.totalDismissed;

    // Update interaction rate
    this.stats.interactionRate = this.stats.totalDismissed / this.stats.totalDisplayed;
  }
}

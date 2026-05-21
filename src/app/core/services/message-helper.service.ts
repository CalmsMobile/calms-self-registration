import { Injectable } from '@angular/core';
import { NotificationService } from './notification.service';

export interface Toast {
  severity: 'success' | 'info' | 'warn' | 'error';
  message: string;
  life?: number;
  title?: string;
}

/**
 * MessageHelper Service
 * Centralized service to display consistent toast notifications without mandatory summary/title.
 * Uses custom NotificationService for better control over alignment and styling.
 */
@Injectable({
  providedIn: 'root',
})
export class MessageHelperService {
  constructor(private notificationService: NotificationService) {}

  /**
   * Show a notification without title (detail only) - RECOMMENDED
   * @param severity Message severity level
   * @param message The message content
   * @param life Auto-dismiss time in milliseconds (default: 3000)
   */
  show(severity: 'success' | 'info' | 'warn' | 'error', message: string, life: number = 3000): string {
    return this.notificationService.show(severity, message, life);
  }

  /**
   * Show a notification with title (summary + detail)
   * @param severity Message severity level
   * @param title The notification title/summary
   * @param message The message content
   * @param life Auto-dismiss time in milliseconds (default: 3000)
   */
  showWithTitle(
    severity: 'success' | 'info' | 'warn' | 'error',
    title: string,
    message: string,
    life: number = 3000
  ): string {
    return this.notificationService.showWithTitle(severity, title, message, life);
  }

  /**
   * Show success notification
   */
  success(message: string, life: number = 3000): string {
    return this.notificationService.success(message, life);
  }

  /**
   * Show success notification with title
   */
  successWithTitle(title: string, message: string, life: number = 3000): string {
    return this.notificationService.successWithTitle(title, message, life);
  }

  /**
   * Show info notification
   */
  info(message: string, life: number = 3000): string {
    return this.notificationService.info(message, life);
  }

  /**
   * Show info notification with title
   */
  infoWithTitle(title: string, message: string, life: number = 3000): string {
    return this.notificationService.infoWithTitle(title, message, life);
  }

  /**
   * Show warning notification
   */
  warn(message: string, life: number = 4000): string {
    return this.notificationService.warn(message, life);
  }

  /**
   * Show warning notification with title
   */
  warnWithTitle(title: string, message: string, life: number = 4000): string {
    return this.notificationService.warnWithTitle(title, message, life);
  }

  /**
   * Show error notification
   */
  error(message: string, life: number = 5000): string {
    return this.notificationService.error(message, life);
  }

  /**
   * Show error notification with title
   */
  errorWithTitle(title: string, message: string, life: number = 5000): string {
    return this.notificationService.errorWithTitle(title, message, life);
  }

  /**
   * Clear all notifications
   */
  clear(): void {
    this.notificationService.clear();
  }
}

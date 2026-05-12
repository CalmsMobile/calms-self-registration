import { Injectable, Injector, ComponentRef, EmbeddedViewRef, EnvironmentInjector, createComponent } from '@angular/core';
import { ApplicationRef } from '@angular/core';
import { NotificationComponent } from '../components/notification/notification.component';

export interface Notification {
  id?: string;
  severity: 'success' | 'info' | 'warn' | 'error';
  message: string;
  title?: string;
  life?: number;
  autoClose?: boolean;
}

/**
 * Notification Service
 * Displays clean, lightweight notifications without PrimeNG Toast limitations.
 * Better control over alignment and styling, especially for messages without titles.
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private notifications: Notification[] = [];
  private componentRefs: Map<string, ComponentRef<NotificationComponent>> = new Map();

  constructor(
    private injector: Injector,
    private appRef: ApplicationRef
  ) {}

  /**
   * Show notification without title (recommended)
   */
  show(
    severity: 'success' | 'info' | 'warn' | 'error',
    message: string,
    life: number = 3000
  ): string {
    return this.createNotification({
      severity,
      message,
      life,
      autoClose: true,
    });
  }

  /**
   * Show notification with title
   */
  showWithTitle(
    severity: 'success' | 'info' | 'warn' | 'error',
    title: string,
    message: string,
    life: number = 3000
  ): string {
    return this.createNotification({
      severity,
      title,
      message,
      life,
      autoClose: true,
    });
  }

  /**
   * Success notification
   */
  success(message: string, life: number = 3000): string {
    return this.show('success', message, life);
  }

  /**
   * Success notification with title
   */
  successWithTitle(title: string, message: string, life: number = 3000): string {
    return this.showWithTitle('success', title, message, life);
  }

  /**
   * Info notification
   */
  info(message: string, life: number = 3000): string {
    return this.show('info', message, life);
  }

  /**
   * Info notification with title
   */
  infoWithTitle(title: string, message: string, life: number = 3000): string {
    return this.showWithTitle('info', title, message, life);
  }

  /**
   * Warning notification
   */
  warn(message: string, life: number = 4000): string {
    return this.show('warn', message, life);
  }

  /**
   * Warning notification with title
   */
  warnWithTitle(title: string, message: string, life: number = 4000): string {
    return this.showWithTitle('warn', title, message, life);
  }

  /**
   * Error notification
   */
  error(message: string, life: number = 5000): string {
    return this.show('error', message, life);
  }

  /**
   * Error notification with title
   */
  errorWithTitle(title: string, message: string, life: number = 5000): string {
    return this.showWithTitle('error', title, message, life);
  }

  /**
   * Remove notification by ID
   */
  remove(id: string): void {
    const componentRef = this.componentRefs.get(id);
    if (componentRef) {
      this.appRef.detachView(componentRef.hostView);
      componentRef.destroy();
      this.componentRefs.delete(id);
    }
    this.notifications = this.notifications.filter(n => n.id !== id);
  }

  /**
   * Clear all notifications
   */
  clear(): void {
    this.notifications.forEach(n => this.remove(n.id!));
    this.notifications = [];
  }

  /**
   * Create and display notification
   */
  private createNotification(notification: Notification): string {
    const id = this.generateId();
    const notif: Notification = { ...notification, id };

    // Create component instance using the standalone component creation
    const environmentInjector = this.injector.get(EnvironmentInjector);
    const componentRef = createComponent(NotificationComponent, {
      environmentInjector,
      elementInjector: this.injector
    });

    // Set component inputs
    componentRef.instance.notification = notif;
    componentRef.instance.onClose.subscribe(() => this.remove(id));

    // Attach to app
    this.appRef.attachView(componentRef.hostView);

    // Add to DOM
    const domElem = (componentRef.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;
    document.body.appendChild(domElem);

    // Store reference
    this.componentRefs.set(id, componentRef);
    this.notifications.push(notif);

    // Auto-close if life is set
    if (notif.autoClose && notif.life && notif.life > 0) {
      setTimeout(() => {
        this.remove(id);
      }, notif.life);
    }

    return id;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

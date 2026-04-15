import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Notification } from '../../services/notification.service';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      class="notification-container"
      [ngClass]="'notification-' + notification.severity"
      [@slideIn]="animationState"
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
    >
      <div class="notification-content">
        <div class="notification-icon">
          <svg 
            *ngIf="notification.severity === 'error'" 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <svg 
            *ngIf="notification.severity === 'warn'" 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <svg 
            *ngIf="notification.severity === 'info'" 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <svg 
            *ngIf="notification.severity === 'success'" 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>

        <div class="notification-text">
          <div *ngIf="notification.title" class="notification-title">
            {{ notification.title }}
          </div>
          <div class="notification-message">
            {{ notification.message }}
          </div>
        </div>

        <button 
          class="notification-close"
          (click)="close()"
          type="button"
          aria-label="Close notification"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="notification-progress" *ngIf="showProgress" [@pulse]="'active'"></div>
    </div>
  `,
  styles: [`
    .notification-container {
      position: fixed;
      top: 20px;
      right: 20px;
      min-width: 300px;
      max-width: 500px;
      padding: 0;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: all 0.3s ease;
    }

    /* Severity-specific colors */
    .notification-error {
      background-color: #fff5f5;
      border-left: 4px solid #ef4444;
    }

    .notification-warn {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
    }

    .notification-info {
      background-color: #f0f9ff;
      border-left: 4px solid #0ea5e9;
    }

    .notification-success {
      background-color: #f0fdf4;
      border-left: 4px solid #22c55e;
    }

    /* Content structure */
    .notification-content {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      min-height: 50px;
    }

    /* Icon styling */
    .notification-icon {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 2px;
    }

    .notification-error .notification-icon {
      color: #ef4444;
    }

    .notification-warn .notification-icon {
      color: #f59e0b;
    }

    .notification-info .notification-icon {
      color: #0ea5e9;
    }

    .notification-success .notification-icon {
      color: #22c55e;
    }

    .notification-icon svg {
      width: 100%;
      height: 100%;
    }

    /* Text content */
    .notification-text {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .notification-title {
      font-size: 14px;
      font-weight: 600;
      line-height: 1.3;
      word-wrap: break-word;
    }

    .notification-error .notification-title {
      color: #7f1d1d;
    }

    .notification-warn .notification-title {
      color: #78350f;
    }

    .notification-info .notification-title {
      color: #0c4a6e;
    }

    .notification-success .notification-title {
      color: #14532d;
    }

    .notification-message {
      font-size: 14px;
      font-weight: 400;
      line-height: 1.4;
      word-wrap: break-word;
    }

    .notification-error .notification-message {
      color: #4f1e1e;
    }

    .notification-warn .notification-message {
      color: #4a2f0f;
    }

    .notification-info .notification-message {
      color: #0a3d62;
    }

    .notification-success .notification-message {
      color: #0d3b1b;
    }

    /* Close button */
    .notification-close {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      padding: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background-color 0.2s ease;
      color: #666;
      margin-top: -2px;
    }

    .notification-close:hover {
      background-color: rgba(0, 0, 0, 0.1);
      color: #333;
    }

    .notification-close svg {
      width: 16px;
      height: 16px;
    }

    /* Progress bar */
    .notification-progress {
      height: 3px;
      background: linear-gradient(90deg, currentColor 0%, currentColor 100%);
      width: 100%;
    }

    .notification-error .notification-progress {
      background-color: #ef4444;
    }

    .notification-warn .notification-progress {
      background-color: #f59e0b;
    }

    .notification-info .notification-progress {
      background-color: #0ea5e9;
    }

    .notification-success .notification-progress {
      background-color: #22c55e;
    }

    /* Mobile responsive */
    @media (max-width: 640px) {
      .notification-container {
        top: 10px;
        right: 10px;
        left: 10px;
        min-width: auto;
        max-width: none;
      }

      .notification-content {
        gap: 10px;
        padding: 12px 14px;
      }

      .notification-icon {
        width: 20px;
        height: 20px;
      }

      .notification-title {
        font-size: 13px;
      }

      .notification-message {
        font-size: 13px;
      }

      .notification-close {
        width: 24px;
        height: 24px;
      }
    }
  `],
  animations: [
    trigger('slideIn', [
      state('in', style({
        transform: 'translateX(0)',
        opacity: 1
      })),
      transition(':enter', [
        style({
          transform: 'translateX(400px)',
          opacity: 0
        }),
        animate('300ms ease-out')
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({
          transform: 'translateX(400px)',
          opacity: 0
        }))
      ])
    ]),
    trigger('pulse', [
      state('active', style({ opacity: 1 })),
      transition('* => active', [
        animate('0.5s ease-in-out', style({ opacity: 0.5 })),
        animate('0.5s ease-in-out', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class NotificationComponent implements OnInit, OnDestroy {
  @Input() notification!: Notification;
  @Output() onClose = new EventEmitter<void>();

  animationState = 'in';
  showProgress = false;
  private progressInterval: any;
  private closeTimeout: any;

  ngOnInit() {
    this.showProgress = !!(this.notification.life && this.notification.life > 0);
  }

  ngOnDestroy() {
    if (this.progressInterval) clearInterval(this.progressInterval);
    if (this.closeTimeout) clearTimeout(this.closeTimeout);
  }

  onMouseEnter() {
    if (this.progressInterval) clearInterval(this.progressInterval);
    if (this.closeTimeout) clearTimeout(this.closeTimeout);
  }

  onMouseLeave() {
    if (this.notification.life && this.notification.life > 0) {
      this.closeTimeout = setTimeout(() => this.close(), this.notification.life);
    }
  }

  close() {
    this.animationState = 'out';
    setTimeout(() => {
      this.onClose.emit();
    }, 300);
  }
}

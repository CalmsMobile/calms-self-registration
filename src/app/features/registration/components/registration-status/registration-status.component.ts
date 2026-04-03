import { Component, Input, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LabelService } from '../../../../core/services/label.service';
import { ApiService } from '../../../../core/services/api.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { MessageService } from 'primeng/api';

export interface RegistrationData {
  status: 'success' | 'pending' | 'error';
  approvalStatus?: string;   // raw Approval_Status from API e.g. "Pending"
  registrationId?: string;
  visitorName?: string;
  email?: string;
  visitFrom?: string;
  visitTo?: string;
  meetingWith?: string;
  meetingLocation?: string;
  visitType?: string;
  visitPurpose?: string;
  // legacy fields
  visitDate?: string;
  time?: string;
  branch?: string;
  // QR (success state)
  visitorId?: string;
  qrCodeData?: string;
  IsDynamicQR?: boolean;        // API response property (capital I)
  isDynamicQR?: boolean;        // Alternate property name
  DynamicQrIntervalSec?: number | string;  // Refresh interval in seconds (can be string from API)
  // legacy support
  isAutoApproved?: boolean;
}

@Component({
  selector: 'app-registration-status',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './registration-status.component.html',
  styleUrl: './registration-status.component.scss'
})
export class RegistrationStatusComponent implements OnInit, OnDestroy {
  @Input() registrationData!: RegistrationData;
  /** Controlled by the page component based on how the app was started. */
  @Input() showNewRegistration: boolean = true;
  @Output() newRegistration = new EventEmitter<void>();
  @Output() printDocument = new EventEmitter<void>();
  qrCodeBase64 = '';
  qrCodeLoading = true;
  qrCodeError = false;
  qrCountdown = 0;
  private qrRefreshInterval: any = null;
  private qrCountdownInterval: any = null;

  readonly companyName = 'CALMS Technologies';

  private dynamicAlertMessages = {
    item1: 'Oops, unable to find your appointment details, please contact your host or proceed to help desk',
    item2: 'Oops, your appointment expired, please contact your host or proceed to help desk',
    item3: 'Oops, your appointment has been canceled, please contact your host or proceed to help desk',
    item4: 'Your appointment request yet to approve, please contact your host or proceed to help desk',
    item5: 'Oops, your appointment code is invalid, please contact your host or proceed to help desk',
  };

  constructor(
    private labelService: LabelService,
    private api: ApiService,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    if (this.status === 'success' && this.qrCodeValue) {
      this.fetchQrCodeData();
      
      // If dynamic QR, set up auto-refresh
      if (this.isDynamicQREnabled && this.getRefreshIntervalSec) {
        const intervalSec = this.getRefreshIntervalSec;
        if (intervalSec > 0) {
          this.qrCountdown = intervalSec;
          
          // Refresh QR code at specified interval
          this.qrRefreshInterval = setInterval(() => {
            this.fetchQrCodeData();
            this.qrCountdown = intervalSec;
          }, intervalSec * 1000);
          
          // Update countdown every second
          this.qrCountdownInterval = setInterval(() => {
            if (this.qrCountdown > 0) {
              this.qrCountdown--;
            }
          }, 1000);
        }
      }
    }
  }

  ngOnDestroy() {
    if (this.qrRefreshInterval) clearInterval(this.qrRefreshInterval);
    if (this.qrCountdownInterval) clearInterval(this.qrCountdownInterval);
  }

  get status(): 'success' | 'pending' | 'error' {
    if (this.registrationData?.status) return this.registrationData.status;
    return this.registrationData?.isAutoApproved ? 'success' : 'pending';
  }

  
  get visitorName(): string       { return this.registrationData?.visitorName || '—'; }
  get email(): string             { return this.registrationData?.email || ''; }
  get visitFrom(): string         { return this.registrationData?.visitFrom || ''; }
  get visitTo(): string           { return this.registrationData?.visitTo || ''; }
  get meetingWith(): string       { return this.registrationData?.meetingWith || ''; }
  get meetingLocation(): string   { return this.registrationData?.meetingLocation || ''; }
  get visitType(): string         { return this.registrationData?.visitType || ''; }
  get visitPurpose(): string      { return this.registrationData?.visitPurpose || ''; }
  get branch(): string            { return this.registrationData?.branch || ''; }

  get badgeText(): string {
    if (this.status === 'success') return (this.labelService.getLabel('approved', 'caption') || 'Approved').toUpperCase();
    if (this.status === 'pending') return 'WAITING';
    return 'ERROR';
  }

  get statusText(): string {
    if (this.registrationData?.approvalStatus) return this.registrationData.approvalStatus;
    if (this.status === 'success') return this.labelService.getLabel('approved', 'caption') || 'Approved';
    return this.status === 'pending' ? 'Pending' : 'Error';
  }

  private get qrCodeValue(): string {
    return this.registrationData?.visitorId || this.registrationData?.qrCodeData || '';
  }

  private get isDynamicQREnabled(): boolean {
    return !!(this.registrationData?.IsDynamicQR || this.registrationData?.isDynamicQR);
  }

  private get getRefreshIntervalSec(): number {
    const interval = this.registrationData?.DynamicQrIntervalSec;
    return interval ? Number(interval) : 0;
  }

  private fetchQrCodeData(): void {
    const qrData = this.qrCodeValue;
    if (!qrData) return;

    this.qrCodeLoading = true;
    this.qrCodeError = false;

    if (this.registrationData?.isDynamicQR) {
      // Dynamic QR: call GetVisitorDataForQRCodeDynamic with SeqIdEncrypted true
      const loParam: any = { SEQ_ID: qrData, SeqIdEncrypted: false };
      this.api.GetVisitorDataForQRCodeDynamic(loParam).subscribe({
        next: (poReturn: any) => this.handleQrCodeResponse(poReturn),
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to generate QR code.' });
          this.qrCodeLoading = false;
          this.qrCodeError = true;
        }
      });
    } else {
      // Static QR: call GetVisitorDataForQRCode with SeqIdEncrypted false
      const loParam: any = { SEQ_ID: qrData, SeqIdEncrypted: false };
      this.api.GetVisitorDataForQRCode(loParam).subscribe({
        next: (poReturn: any) => this.handleQrCodeResponse(poReturn),
        error: () => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to generate QR code.' });
          this.qrCodeLoading = false;
          this.qrCodeError = true;
        }
      });
    }
  }

  private handleQrCodeResponse(poData: any): void {
    // Check for API error response structure (Status: false means error)
    if (poData && poData.Status === false) {
      const errorDetail = poData.ErrorLog?.[0]?.Error || 'Failed to generate QR code.';
      this.messageService.add({ severity: 'error', summary: 'Error', detail: errorDetail });
      this.qrCodeLoading = false;
      this.qrCodeError = true;
      return;
    }

    if (poData.Table?.length > 0) {
      const code = poData.Table[0].code?.toUpperCase();
      const msgMap: Record<string, string> = {
        D: this.dynamicAlertMessages.item1,
        X: this.dynamicAlertMessages.item2,
        C: this.dynamicAlertMessages.item3,
        P: this.dynamicAlertMessages.item4,
        H: this.dynamicAlertMessages.item5
      };
      if (msgMap[code]) {
        this.messageService.add({ severity: 'info', summary: 'Oops...', detail: msgMap[code] });
        this.qrCodeLoading = false;
        this.qrCodeError = true;
        return;
      }
    }
    const loResult = poData.Table1?.[0];
    if (loResult?.DataString) {
      const newBase64 = `data:image/png;base64,${loResult.DataString}`;
      const isFirstLoad = !this.qrCodeBase64;
      this.qrCodeBase64 = newBase64;
      this.qrCodeError = false;
      // Only show loader on first load; on refresh the data URI renders instantly
      this.qrCodeLoading = isFirstLoad;
    } else {
      this.qrCodeLoading = false;
      this.qrCodeError = true;
    }
  }

  onRetryQrCode(): void {
    this.fetchQrCodeData();
  }

  private formatDateAsKendo(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  onQrImageLoaded(): void {
    this.qrCodeLoading = false;
  }

  onPrint() { this.printDocument.emit(); }
  onDownloadPdf() { this.printDocument.emit(); }
  onShareWhatsapp() { /* WhatsApp share — handled by parent or future implementation */ }
  onNewRegistration() { this.newRegistration.emit(); }
}

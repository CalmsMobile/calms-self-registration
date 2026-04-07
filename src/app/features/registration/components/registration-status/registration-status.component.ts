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

  private get dynamicAlertMessages() {
    return {
      item1: this.labelService.getLabel('qr_not_found_alert', 'caption') || 'Oops, unable to find your appointment details, please contact your host or proceed to help desk',
      item2: this.labelService.getLabel('qr_expired_alert', 'caption') || 'Oops, your appointment expired, please contact your host or proceed to help desk',
      item3: this.labelService.getLabel('qr_cancelled_alert', 'caption') || 'Oops, your appointment has been canceled, please contact your host or proceed to help desk',
      item4: this.labelService.getLabel('qr_pending_alert', 'caption') || 'Your appointment request yet to approve, please contact your host or proceed to help desk',
      item5: this.labelService.getLabel('qr_invalid_alert', 'caption') || 'Oops, your appointment code is invalid, please contact your host or proceed to help desk',
    };
  }

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
    if (this.status === 'pending') return (this.labelService.getLabel('pending', 'caption') || 'WAITING').toUpperCase();
    return (this.labelService.getLabel('error', 'caption') || 'ERROR').toUpperCase();
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
          this.messageService.add({ severity: 'error', summary: this.labelService.getLabel('error', 'caption') || 'Error', detail: this.labelService.getLabel('qr_load_error', 'caption') || 'Failed to generate QR code.' });
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
          this.messageService.add({ severity: 'error', summary: this.labelService.getLabel('error', 'caption') || 'Error', detail: this.labelService.getLabel('qr_load_error', 'caption') || 'Failed to generate QR code.' });
          this.qrCodeLoading = false;
          this.qrCodeError = true;
        }
      });
    }
  }

  private handleQrCodeResponse(poData: any): void {
    // Check for API error response structure (Status: false means error)
    if (poData && poData.Status === false) {
      const errorDetail = poData.ErrorLog?.[0]?.Error || this.labelService.getLabel('qr_load_error', 'caption') || 'Failed to generate QR code.';
      this.messageService.add({ severity: 'error', summary: this.labelService.getLabel('error', 'caption') || 'Error', detail: errorDetail });
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
        this.messageService.add({ severity: 'info', summary: this.labelService.getLabel('oops_alert', 'caption') || 'Oops...', detail: msgMap[code] });
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

onQrImageLoaded(): void {
    this.qrCodeLoading = false;
  }

  onPrint() { this.printDocument.emit(); }

  onDownloadPdf() {
    const w = window.open('', '_blank', 'width=500,height=800');
    if (!w) { this.printDocument.emit(); return; }

    type StatusTheme = { headerBg: string; headerColor: string; bannerBg: string; bannerColor: string; badgeColor: string };
    const themes: Record<string, StatusTheme> = {
      success: { headerBg: 'linear-gradient(90deg,#b6fbd2 0%,#2ec96c 100%)', headerColor: '#3c3c3c', bannerBg: '#eafff2', bannerColor: '#2b9b55', badgeColor: '#2ec96c' },
      pending: { headerBg: 'linear-gradient(90deg,#f6ce55 0%,#f0b642 100%)', headerColor: '#3b3b3b', bannerBg: '#f8e7c2', bannerColor: '#9c7a10', badgeColor: '#9c7a10' },
      error:   { headerBg: 'linear-gradient(90deg,#ff5257 0%,#5b1010 100%)', headerColor: '#ffffff', bannerBg: '#ead2cf', bannerColor: '#8b2020', badgeColor: '#d64545' }
    };
    const t = themes[this.status] || themes['pending'];
    const badge = this.badgeText;

    const qrHtml = (this.status === 'success' && this.qrCodeBase64)
      ? `<div class="qr-section">
           <div class="qr-box"><img src="${this.qrCodeBase64}" alt="QR Code"/></div>
           <div class="qr-caption">Scan QR code at the entrance</div>
         </div>
         <div class="divider"></div>`
      : '';

    const allRows: { label: string; value: string }[] = [
      { label: 'Visitor Name', value: this.visitorName },
      { label: 'Email',        value: this.email },
      { label: 'Visit From',   value: this.visitFrom },
      { label: 'Visit To',     value: this.visitTo },
      { label: 'Meeting With', value: this.meetingWith },
      { label: 'Location',     value: this.meetingLocation },
      { label: 'Category',     value: this.visitType },
      { label: 'Purpose',      value: this.visitPurpose },
    ];
    const infoGrid = allRows
      .filter(r => r.value)
      .map(r => `<div class="info-item"><div class="info-label">${r.label}</div><div class="info-value">${r.value}</div></div>`)
      .join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Visitor Pass</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
  @page { size: 440px auto; margin: 0; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #ffffff; font-family: "Poppins", "Segoe UI", Arial, sans-serif; }
  body { display: flex; justify-content: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* ── Card ── */
  .pass-card { width: 440px; background: #ffffff; overflow: hidden; }

  /* ── Header ── */
  .pass-header {
    position: relative;
    padding: 16px 16px 26px;
    background: ${t.headerBg};
    color: ${t.headerColor};
  }
  .brand-name { font-size: 16px; font-weight: 700; margin-bottom: 20px; }
  .badge {
    position: absolute; top: 14px; right: 14px;
    background: #ffffff; color: ${t.badgeColor};
    font-size: 11px; font-weight: 700;
    padding: 4px 12px; border-radius: 999px;
  }
  .wave {
    position: absolute; left: 0; bottom: -9px;
    width: 100%; height: 18px;
    background: radial-gradient(circle at 9px 9px, #ffffff 9px, transparent 10px) repeat-x;
    background-size: 18px 18px;
  }

  /* ── Inner banner ── */
  .pass-inner-banner {
    padding: 10px 16px;
    text-align: center; font-weight: 700;
    font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase;
    background: ${t.bannerBg}; color: ${t.bannerColor};
  }

  /* ── Body ── */
  .pass-body { padding: 18px 16px 16px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px; margin-bottom: 14px; }
  .info-item {}
  .info-label { font-size: 10px; color: #9aa0a6; margin-bottom: 2px; }
  .info-value { font-size: 13px; font-weight: 600; color: #3e3e3e; word-break: break-word; }
  .divider { border: none; border-top: 1px dashed #e3d2aa; margin: 10px 0 12px; }

  /* ── QR ── */
  .qr-section { display: flex; flex-direction: column; align-items: center; gap: 8px; padding-bottom: 8px; }
  .qr-box { width: 150px; height: 150px; display: flex; align-items: center; justify-content: center; border: 1px solid #efefef; border-radius: 8px; }
  .qr-box img { width: 130px; height: 130px; object-fit: contain; }
  .qr-caption { font-size: 12px; color: #9aa0a6; }

  /* ── Footer ── */
  .card-footer-text {
    text-align: center; font-size: 12px; color: #6b7280;
    line-height: 1.6; padding: 8px 4px 12px;
    background: ${t.bannerBg};
  }
  .card-footer-text p + p { margin-top: 2px; }
</style>
</head>
<body>
<div class="pass-card">
  <div class="pass-header">
    <div class="brand-name">${this.companyName}</div>
    <span class="badge">${badge}</span>
    <div class="pass-inner-banner">Visitor Access Pass</div>
    <div class="wave"></div>
  </div>
  <div class="pass-body">
    <div class="info-grid">${infoGrid}</div>
    <div class="divider"></div>
    ${qrHtml}
    <div class="card-footer-text">
      <p>Thank you for visiting us.</p>
      <p>Please present this pass at the entrance.</p>
    </div>
  </div>
</div>
<script>
  window.onload = function() { setTimeout(function() { window.print(); }, 500); };
</script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    w.location.href = url;
    w.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
  }
  onShareWhatsapp() {
    const d = this.registrationData;
    const lines: string[] = [
      '🎫 *Visitor Access Pass*',
    ];
    if (d?.visitorName)      lines.push(`👤 Name: ${d.visitorName}`);
    if (d?.registrationId)   lines.push(`🆔 Registration ID: ${d.registrationId}`);
    if (d?.visitFrom)        lines.push(`📅 Visit From: ${d.visitFrom}`);
    if (d?.visitTo)          lines.push(`📅 Visit To: ${d.visitTo}`);
    if (d?.meetingWith)      lines.push(`🤝 Meeting With: ${d.meetingWith}`);
    if (d?.meetingLocation)  lines.push(`📍 Location: ${d.meetingLocation}`);
    if (d?.visitPurpose)     lines.push(`📋 Purpose: ${d.visitPurpose}`);
    const caption = lines.join('\n');

    // Mobile: Web Share API — shares QR image with caption to WhatsApp
    if (this.qrCodeBase64 && typeof navigator.canShare === 'function') {
      try {
        const base64Data = this.qrCodeBase64.replace(/^data:image\/\w+;base64,/, '');
        const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const file = new File([bytes], 'visitor-qr.png', { type: 'image/png' });

        if (navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], text: caption, title: 'Visitor Access Pass' })
            .catch(() => this.openWhatsappText(caption));
          return;
        }
      } catch {
        // fall through
      }
    }

    // Desktop fallback: open WhatsApp web with caption text
    this.openWhatsappText(caption);
  }

  private openWhatsappText(text: string) {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }
  onNewRegistration() { this.newRegistration.emit(); }
}

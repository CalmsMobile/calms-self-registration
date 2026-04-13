import { Component, Input, OnInit, OnDestroy, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LabelService } from '../../../../core/services/label.service';
import { ApiService } from '../../../../core/services/api.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { MessageService } from 'primeng/api';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
  @Input() isRetrying: boolean = false;
  @ViewChild('passCardRef') passCardRef!: ElementRef<HTMLElement>;
  @Output() newRegistration = new EventEmitter<void>();
  @Output() retrySubmit = new EventEmitter<void>();
  @Output() printDocument = new EventEmitter<void>();
  qrCodeBase64 = '';
  qrCodeLoading = true;
  qrCodeError = false;
  qrCountdown = 0;
  private qrRefreshInterval: any = null;
  private qrCountdownInterval: any = null;

  get companyName(): string {
    return this.registrationData?.branch || '';
  }

  private get dynamicAlertMessages() {
    return {
      item1: this.labelService.getLabel('thankyou_page_qr_not_found_alert', 'caption') || 'Oops, unable to find your appointment details, please contact your host or proceed to help desk',
      item2: this.labelService.getLabel('thankyou_page_qr_expired_alert', 'caption') || 'Oops, your appointment expired, please contact your host or proceed to help desk',
      item3: this.labelService.getLabel('thankyou_page_qr_cancelled_alert', 'caption') || 'Oops, your appointment has been canceled, please contact your host or proceed to help desk',
      item4: this.labelService.getLabel('thankyou_page_qr_pending_alert', 'caption') || 'Your appointment request yet to approve, please contact your host or proceed to help desk',
      item5: this.labelService.getLabel('thankyou_page_qr_invalid_alert', 'caption') || 'Oops, your appointment code is invalid, please contact your host or proceed to help desk',
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
    if (this.status === 'success') return (this.labelService.getLabel('thankyou_page_status_approved', 'caption') || 'Approved').toUpperCase();
    if (this.status === 'pending') return (this.labelService.getLabel('thankyou_page_status_pending', 'caption') || 'WAITING').toUpperCase();
    return (this.labelService.getLabel('thankyou_page_status_error', 'caption') || 'ERROR').toUpperCase();
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
          this.messageService.add({ severity: 'error', summary: this.labelService.getLabel('thankyou_page_error', 'caption') || 'Error', detail: this.labelService.getLabel('thankyou_page_qr_load_error', 'caption') || 'Failed to generate QR code.' });
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
          this.messageService.add({ severity: 'error', summary: this.labelService.getLabel('thankyou_page_error', 'caption') || 'Error', detail: this.labelService.getLabel('thankyou_page_qr_load_error', 'caption') || 'Failed to generate QR code.' });
          this.qrCodeLoading = false;
          this.qrCodeError = true;
        }
      });
    }
  }

  private handleQrCodeResponse(poData: any): void {
    // Check for API error response structure (Status: false means error)
    if (poData && poData.Status === false) {
      const errorDetail = poData.ErrorLog?.[0]?.Error || this.labelService.getLabel('thankyou_page_qr_load_error', 'caption') || 'Failed to generate QR code.';
      this.messageService.add({ severity: 'error', summary: this.labelService.getLabel('thankyou_page_error', 'caption') || 'Error', detail: errorDetail });
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
        this.messageService.add({ severity: 'info', summary: this.labelService.getLabel('thankyou_page_oops_alert', 'caption') || 'Oops...', detail: msgMap[code] });
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

  private async capturePassCard(): Promise<HTMLCanvasElement> {
    const el = this.passCardRef.nativeElement;

    // Ensure all web fonts are loaded — prevents Poppins falling back to a
    // system font with different metrics that causes text to wrap differently.
    await document.fonts.ready;

    // :host is height:100vh / overflow-y:auto, meaning html2canvas only sees
    // the currently-scrolled viewport slice of the card.  Temporarily remove
    // the overflow clipping so the full card height is visible to the renderer.
    const hostEl = el.closest('app-registration-status') as HTMLElement | null;
    const savedOverflowY = hostEl?.style.overflowY ?? '';
    const savedHeight    = hostEl?.style.height    ?? '';
    if (hostEl) {
      hostEl.style.overflowY = 'visible';
      hostEl.style.height    = 'auto';
    }

    // Temporarily adjust green header so "VISITOR ACCESS PASS" banner is
    // visually centred and spans full width in the captured image (PDF / WhatsApp share).
    const brandNameEl   = el.querySelector('.brand-name')       as HTMLElement | null;
    const passHeaderEl  = el.querySelector('.pass-header')      as HTMLElement | null;
    const innerBannerEl = el.querySelector('.pass-inner-banner') as HTMLElement | null;
    const savedBrandMb    = brandNameEl?.style.marginBottom   ?? '';
    const savedHeaderPb   = passHeaderEl?.style.paddingBottom ?? '';
    const savedBannerMt   = innerBannerEl?.style.marginTop    ?? '';
    const savedBannerMl   = innerBannerEl?.style.marginLeft   ?? '';
    const savedBannerMr   = innerBannerEl?.style.marginRight  ?? '';
    if (brandNameEl)   brandNameEl.style.marginBottom   = '6px';
    if (passHeaderEl)  passHeaderEl.style.paddingBottom  = '14px';
    // Negate parent side-padding so the banner stretches edge-to-edge in the card.
    if (innerBannerEl) innerBannerEl.style.marginTop     = '10px';
    if (innerBannerEl) innerBannerEl.style.marginLeft    = '-16px';
    if (innerBannerEl) innerBannerEl.style.marginRight   = '-16px';

    // Two animation frames let the layout engine re-flow after the style change.
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    try {
      return await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 15000,
        // Do NOT pass x/y/width/height — let html2canvas derive the capture
        // bounds from the element itself to avoid off-by-scroll errors.
      });
    } finally {
      // Always restore the host's original scroll behaviour.
      if (hostEl) {
        hostEl.style.overflowY = savedOverflowY;
        hostEl.style.height    = savedHeight;
      }
      // Restore header spacing and banner alignment.
      if (brandNameEl)   brandNameEl.style.marginBottom   = savedBrandMb;
      if (passHeaderEl)  passHeaderEl.style.paddingBottom = savedHeaderPb;
      if (innerBannerEl) innerBannerEl.style.marginTop    = savedBannerMt;
      if (innerBannerEl) innerBannerEl.style.marginLeft   = savedBannerMl;
      if (innerBannerEl) innerBannerEl.style.marginRight  = savedBannerMr;
    }
  }

  async onDownloadPdf() {
    try {
      const canvas = await this.capturePassCard();
      const imgData  = canvas.toDataURL('image/png');
      // canvas is rendered at scale:2; divide by 2 to recover CSS px, then
      // convert to mm at 96 DPI (1 CSS px = 25.4 / 96 mm).
      const widthMm  = (canvas.width  / 2) * 25.4 / 96;
      const heightMm = (canvas.height / 2) * 25.4 / 96;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [widthMm, heightMm],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm);
      pdf.save('visitor-pass.pdf');
    } catch (err) {
      console.error('PDF generation failed:', err);
      this.printDocument.emit();
    }
  }

  async onShareWhatsapp() {
    const d = this.registrationData;
    const caption = `Dear ${d?.visitorName || 'Visitor'},\nYour visit to ${d.branch} has been successfully approved 👍\nPlease find your Visitor Access Pass attached. Kindly present the QR code at the entrance for check-in.\nThank you and have a pleasant visit.`;

    try {
      const canvas = await this.capturePassCard();
      // Wrap callback-based toBlob in a Promise for clean async flow
      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/png')
      );
      if (!blob) { this.openWhatsappText(caption); return; }

      const file = new File([blob], 'visitor-pass.png', { type: 'image/png' });

      // ── Mobile / native share (Android Chrome, iOS Safari 15+) ──
      if (
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({ files: [file], text: caption, title: 'Visitor Access Pass' });
          return;
        } catch (err: any) {
          if (err.name === 'AbortError') return; // User cancelled — do nothing
          // Other share failure → fall through to download approach
        }
      }

      // ── Desktop fallback: download the PNG then open WhatsApp with text ──
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'visitor-pass.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      // Brief delay so the download dialog appears before WhatsApp opens
      setTimeout(() => this.openWhatsappText(caption), 600);
    } catch {
      this.openWhatsappText(caption);
    }
  }

  private openWhatsappText(text: string) {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }
  onNewRegistration() { this.newRegistration.emit(); }
  onRetrySubmit() { this.retrySubmit.emit(); }
}

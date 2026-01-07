import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LabelService } from '../../../../core/services/label.service';
import { SharedService } from '../../../../shared/shared.service';
import { ApiService } from '../../../../core/services/api.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';

interface RegistrationData {
  isAutoApproved: boolean;
  qrCodeData?: string;
  visitorId?: string;
  visitorName?: string;
  isDynamicQR?: boolean;
}

@Component({
  selector: 'app-registration-status',
  standalone: true,
  imports: [
    CommonModule,
    TranslatePipe,
    ButtonModule
  ],
  templateUrl: './registration-status.component.html',
  styleUrl: './registration-status.component.scss'
})
export class RegistrationStatusComponent implements OnInit {
  @Input() registrationData!: RegistrationData;
  @Output() newRegistration = new EventEmitter<void>();
  @Output() printDocument = new EventEmitter<void>();

  messageLine1: string = '';
  messageLine2: string = '';
  messageLine3: string = '';
  showQrCode: boolean = false;
  showNewRegistrationButton: boolean = true;
  qrCodeBase64: string = '';
  isLoadingQrCode: boolean = false;

  private dynamicAlertMessages = {
    item1: "Oops, unable to find your appointment details, please contact your host or proceed to help desk",
    item2: "Oops, your appointment expired, please contact your host or proceed to help desk",
    item3: "Oops, your appointment has been canceled, please contact your host or proceed to help desk",
    item4: "Your appointment request yet to approve, please contact your host or proceed to help desk",
    item5: "Oops, your appointment code is invalid, please contact your host or proceed to help desk",
    item6: "Oops, your account has been blacklisted, please contact your host or proceed to help desk"
  };

  constructor(
    private labelService: LabelService,
    private sharedService: SharedService,
    private api: ApiService,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    this.loadMessages();
    this.checkAccessSettings();
    // Fetch QR code data from API only if AutoApprove is true and QR code should be shown
    if (this.registrationData?.isAutoApproved && this.showQrCode) {
      console.log('Fetching QR code data...');
      this.fetchQrCodeData();
    } else {
      console.log('Skipping QR code fetch: AutoApprove:', this.registrationData?.isAutoApproved, 'ShowQrCode:', this.showQrCode);
    }
  }

  private loadMessages() {
    if (this.registrationData?.isAutoApproved) {
      // Auto approved messages
      this.messageLine1 = this.labelService.getLabel('auto_approve_message_line_1', 'caption');
      this.messageLine2 = this.labelService.getLabel('auto_approve_message_line_2', 'caption');
      this.messageLine3 = this.labelService.getLabel('auto_approve_message_line_3', 'caption');
      
      // Check if QR code should be shown
      const showQrSetting = this.labelService.getLabel('when_auto_approve_show_qr_code', 'caption');
      console.log('QR Code Display Setting:', showQrSetting);
      this.showQrCode = showQrSetting?.toLowerCase() === 'true' || showQrSetting === '1';
    } else {
      // Non auto approved messages
      this.messageLine1 = this.labelService.getLabel('non_auto_approve_message_line_1', 'caption');
      this.messageLine2 = this.labelService.getLabel('non_auto_approve_message_line_2', 'caption');
      this.messageLine3 = this.labelService.getLabel('non_auto_approve_message_line_3', 'caption');
      this.showQrCode = false;
    }
  }

  private checkAccessSettings() {
    // Subscribe to access denied status from shared service
    this.sharedService.isAccessDenied.subscribe(isAccessDenied => {
      // Show "New Registration" button only when access is NOT denied
      // If access is denied (base URL access disabled), hide the button
      this.showNewRegistrationButton = !isAccessDenied;
    });
  }

  get qrCodeValue(): string {
    return this.registrationData?.visitorId || this.registrationData?.qrCodeData || '';
  }

  get qrCodeImageUrl(): string {
    return this.qrCodeBase64;
  }

  private fetchQrCodeData(): void {
    const qrData = this.qrCodeValue;
    if (!qrData) {
      console.warn('No QR code data available to fetch.');
      return;
    }

    this.isLoadingQrCode = true;
    
    const loParam: any = { 
      SEQ_ID: qrData, 
      SeqIdEncrypted: false
    };

    // Add CurrentDate parameter only for dynamic QR codes
    if (this.registrationData?.isDynamicQR) {
      loParam.CurrentDate = this.formatDateAsKendo(new Date());
    }

    this.api.GetVisitorDataForQRCode(loParam).subscribe({
      next: (poReturn: any) => {
        this.isLoadingQrCode = false;
        this.handleQrCodeResponse(poReturn);
      },
      error: (error: any) => {
        this.isLoadingQrCode = false;
        console.error('Error fetching QR code data:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to generate QR code. Please try again.'
        });
      }
    });
  }

  private handleQrCodeResponse(poData: any): void {
    try {

      // Check for various error codes
      if (poData.Table && poData.Table.length > 0) {
        const code = poData.Table[0].code?.toUpperCase();
        
        if (code === 'D') {
          this.messageService.add({
            severity: 'info',
            summary: 'Oops...',
            detail: this.dynamicAlertMessages.item1
          });
          return;
        }
        
        if (code === 'X') {
          this.messageService.add({
            severity: 'info',
            summary: 'Oops...',
            detail: this.dynamicAlertMessages.item2
          });
          return;
        }
        
        if (code === 'C') {
          this.messageService.add({
            severity: 'info',
            summary: 'Oops...',
            detail: this.dynamicAlertMessages.item3
          });
          return;
        }
        
        if (code === 'P') {
          this.messageService.add({
            severity: 'info',
            summary: 'Oops...',
            detail: this.dynamicAlertMessages.item4
          });
          return;
        }
        
        if (code === 'H') {
          this.messageService.add({
            severity: 'info',
            summary: 'Oops...',
            detail: this.dynamicAlertMessages.item5
          });
          return;
        }
      }

      // Check if we have QR code data
      if (!poData.Table1 || poData.Table1.length === 0) {
        this.messageService.add({
          severity: 'warning',
          summary: 'Oops...',
          detail: this.dynamicAlertMessages.item1
        });
        return;
      }

      // Set the base64 QR code image
      const loResult = poData.Table1[0];
      if (loResult.DataString) {
        this.qrCodeBase64 = `data:image/png;base64,${loResult.DataString}`;
        console.log('QR code loaded successfully');
      }
    } catch (error) {
      console.error('Error parsing QR code response:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to process QR code data.'
      });
    }
  }

  private formatDateAsKendo(date: Date): string {
    const pad = (num: number) => String(num).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  }

  onPrint() {
    this.printDocument.emit();
  }

  onNewRegistration() {
    this.newRegistration.emit();
  }
}

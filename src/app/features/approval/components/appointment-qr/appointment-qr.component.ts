import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../../../core/services/api.service';

@Component({
  selector: 'app-appointment-qr',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './appointment-qr.component.html',
  styleUrl: './appointment-qr.component.scss'
})
export class AppointmentQrComponent implements OnInit, OnDestroy {
  seqIdEnc = '';
  isLoading = true;
  errorMessage = '';

  companyLogo = '';
  companyName = '';
  qrCodeBase64 = '';
  visitorName = '';
  startDate = '';
  startTime = '';
  endDate = '';
  endTime = '';
  meetingPerson = '';
  purpose = '';
  validityDate = '';

  refreshSeconds = 300;
  private countdownTimer: any;
  private refreshIntervalSec = 300;

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.seqIdEnc = params['enc'] || '';
      if (this.seqIdEnc) {
        this.loadQR();
      } else {
        this.errorMessage = 'Invalid or missing appointment link.';
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
  }

  private getCurrentDate(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
           `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }

  private loadQR(): void {
    const qrParam = {
      SEQ_ID: this.seqIdEnc,
      CurrentDate: this.getCurrentDate(),
      SeqIdEncrypted: true
    };

    forkJoin({
      qr:   this.apiService.GetVisitorDataForQRCodeDynamic(qrParam),
      appt: this.apiService.GetAppointmentDetailBySeqId(this.seqIdEnc).pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ qr, appt }: any) => {
        // Parse QR response
        const qrData = Array.isArray(qr) ? qr[0]?.Data || qr[0] : qr;
        const info   = qrData?.Table1?.[0];
        if (!info) {
          this.errorMessage = 'No appointment data found.';
          this.isLoading = false;
          return;
        }

        // QR image
        this.qrCodeBase64 = info.DataString
          ? `data:image/png;base64,${info.DataString}`
          : '';

        // Visitor details from QR API
        this.visitorName   = info.FullName     || '';
        this.meetingPerson = info.HostId        || '';
        this.purpose       = info.Purpose       || '';
        this.validityDate  = info.ValidityDate  || '';
        this.startDate     = this.fmtDate(info.START_TIME);
        this.startTime     = this.fmtTime(info.START_TIME);
        this.endDate       = this.fmtDate(info.END_TIME);
        this.endTime       = this.fmtTime(info.END_TIME);

        // Refresh interval from QR Table4 settings
        const qrSettings: any[] = qrData?.Table4 || [];
        const validitySetting = qrSettings.find((s: any) => s.Label === 'QRCodeValidity');
        this.refreshIntervalSec = validitySetting ? Number(validitySetting.JSValue) : 300;

        // Company logo + name from appointment detail Table4
        const apptData  = appt?.detail || appt;
        const brandInfo = apptData?.Table4?.[0];
        const rawLogo   = brandInfo?.CompanyLogo || '';
        this.companyLogo = rawLogo
          ? (rawLogo.startsWith('data:') || rawLogo.startsWith('http')
              ? rawLogo
              : 'data:image/jpeg;base64,' + rawLogo)
          : '';
        this.companyName = brandInfo?.CompanyName || brandInfo?.Name || info.CompanyName || 'CALMS';

        this.isLoading = false;
        this.startCountdown();
      },
      error: () => {
        this.errorMessage = 'Failed to load QR code. Please try again.';
        this.isLoading = false;
      }
    });
  }

  private startCountdown(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.refreshSeconds = this.refreshIntervalSec;

    this.countdownTimer = setInterval(() => {
      this.refreshSeconds--;
      if (this.refreshSeconds <= 0) {
        clearInterval(this.countdownTimer);
        this.loadQR();
      }
    }, 1000);
  }

  private fmtDate(val: string): string {
    if (!val) return '—';
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private fmtTime(val: string): string {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
}

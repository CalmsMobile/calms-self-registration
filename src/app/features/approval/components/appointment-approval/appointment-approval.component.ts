import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, switchMap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../../../core/services/api.service';
import { environment } from '../../../../../environments/environment';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-appointment-approval',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './appointment-approval.component.html',
  styleUrl: './appointment-approval.component.scss'
})
export class AppointmentApprovalComponent implements OnInit, OnDestroy {
  seqIdEnc: string = '';   // encrypted SEQ_ID from URL ?enc=
  seqId: string = '';      // plain SEQ_ID from API response (for actions)
  hostIc: string = '';
  hostSeqId: string | number = 123;

  appointmentData: any = null;
  clientConfig: any = null;
  companyLogo: string = '';
  companyName: string = '';
  visitorImg: string = '';
  declarationData: any[] = [];
  questionnaireData: any[] = [];
  docsData: any[] = [];
  itemsData: any[] = [];
  ndaDoc: string = '';
  ndaUrl: SafeResourceUrl = '';
  itemCaptions = { desc: 'Equipment Detail', serial: 'Serial Number', type: 'Type' };
  approvalSteps: any[] = [];

  createdBy: number | null = null;
  refApptApprovalLevelSeqId: number | null = null;

  isLoading = true;
  isSubmitting = false;
  errorMessage = '';

  rejectRemarks = '';

  /** 'approved' | 'rejected' | 'resubmit' | '' */
  actionResult = '';

  /** Which modal is being rendered (controls @if in template) */
  pendingModal: string | null = null;
  /** Which modal has is-open class (controls CSS transition) */
  activeModal: string | null = null;

  private openTimer: any = null;
  private closeTimer: any = null;

  private ndaBlobUrl = '';

  constructor(private route: ActivatedRoute, private apiService: ApiService, private sanitizer: DomSanitizer, private http: HttpClient) {}

  ngOnInit() {
    this.seqIdEnc  = (this.route.snapshot.queryParamMap.get('enc') || '').replace(/ /g, '+');
    this.hostIc    = this.route.snapshot.queryParamMap.get('ic')    ||
                     this.route.snapshot.queryParamMap.get('token') || '';
    this.hostSeqId = this.route.snapshot.queryParamMap.get('hseq') || 123;
    this.loadData();
  }

  ngOnDestroy() {
    document.body.style.overflow = '';
    clearTimeout(this.openTimer);
    clearTimeout(this.closeTimer);
    if (this.ndaBlobUrl) { URL.revokeObjectURL(this.ndaBlobUrl); }
  }

  loadData() {
    this.isLoading = true;
    forkJoin({
      config: this.apiService.GetCustomClientConfigData(this.hostSeqId),
      detail: this.apiService.GetAppointmentDetailBySeqId(this.seqIdEnc)
    }).pipe(
      switchMap((res: any) => {
        this.clientConfig    = res.config?.Table1?.[0] || null;
        this.appointmentData = res.detail?.Table1?.[0] || null;
        this.companyLogo     = res.detail?.Table4?.[0]?.CompanyLogo || '';
        this.companyName     = res.detail?.Table4?.[0]?.CompanyName || res.detail?.Table4?.[0]?.Name ||
                               this.clientConfig?.CompanyName || this.clientConfig?.ClientName || this.clientConfig?.Company || '';
        const rawImg = res.detail?.Table3?.[0]?.VisitorImg || '';
        this.visitorImg = rawImg
          ? (rawImg.startsWith('data:') || rawImg.startsWith('http') ? rawImg : 'data:image/jpeg;base64,' + rawImg)
          : '';
        this.approvalSteps = res.detail?.Table5 || res.detail?.Table2 || [];
        this.seqId  = String(this.appointmentData?.SEQ_ID || '');
        this.hostIc = this.appointmentData?.STAFF_IC      || this.hostIc;
        this.createdBy = this.appointmentData?.CreatedBy ?? null;
        this.refApptApprovalLevelSeqId = this.appointmentData?.RefApptApprovalLevelSeqId ?? null;

        const branch     = this.appointmentData?.Branch           || this.clientConfig?.Branch || '';
        const visitorCtg = this.appointmentData?.Visitor_category || '';

        return forkJoin({
          decl:  this.apiService.GetVisitorDeclarationSettings(branch, visitorCtg).pipe(catchError(() => of(null))),
          docs:  this.apiService.GetVisitorDocsBySeqId(this.seqId).pipe(catchError(() => of(null))),
          items: this.apiService.GetVisitorItemChecklistBySeqId(this.seqId).pipe(catchError(() => of(null))),
          qna:   this.apiService.GetVisitorQuestionariesByAppointmentId(this.seqId).pipe(catchError(() => of(null))),
          nda:   this.apiService.GetVisitorNDABySeqId(this.seqId).pipe(catchError(() => of(null)))
        });
      })
    ).subscribe({
      next: (res: any) => {
        this.declarationData   = res.decl?.Table1  || res.decl?.Table  || [];
        this.questionnaireData = res.qna?.Table  || [];
        this.docsData        = res.docs?.Table1 || res.docs?.Table  || [];
        this.itemsData       = res.items?.Table || res.decl?.Table || [];
        this.ndaDoc = res.nda?.Table?.[0]?.NDADocument || '';
        if (this.ndaDoc) {
          const base = environment.apiURL.replace(/\/api\/vims$/i, '');
          const url = base + '/' + this.ndaDoc.replace(/\\/g, '/');
          this.http.get(url, { responseType: 'blob' }).subscribe({
            next: (blob) => {
              if (this.ndaBlobUrl) { URL.revokeObjectURL(this.ndaBlobUrl); }
              this.ndaBlobUrl = URL.createObjectURL(blob);
              this.ndaUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.ndaBlobUrl);
            },
            error: () => {
              this.ndaUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
            }
          });
        }
        const settingRaw = res.decl?.Table1?.[0]?.SettingDetail || res.items?.Table1?.[0]?.SettingDetail;
        if (settingRaw) {
          try {
            const s = JSON.parse(settingRaw);
            this.itemCaptions = {
              desc:   s.MItemDescCaption  || 'Equipment Detail',
              serial: s.MSerialNoCaption  || 'Serial Number',
              type:   s.MTypeCaption      || 'Type'
            };
          } catch {}
        }
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Failed to load appointment details.';
        this.isLoading = false;
      }
    });
  }

  getDocFileName(docPath: string): string {
    if (!docPath) return 'Document';
    const parts = docPath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || 'Document';
  }

  getQnaOptions(item: any): { label: string; index: number; isSelected: boolean; isCorrect: boolean }[] {
    const selected = (item.Answer || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const correct  = (item.CrtAnswers || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const opts = [];
    for (let i = 1; i <= 4; i++) {
      const label = item['Option' + i];
      if (!label) continue;
      opts.push({ label, index: i, isSelected: selected.includes(String(i)), isCorrect: correct.includes(String(i)) });
    }
    return opts;
  }

  isQnaCorrect(item: any): boolean {
    const selected = (item.Answer || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const correct  = (item.CrtAnswers || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    return selected.length > 0 && selected.every((s: string) => correct.includes(s));
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  approve() {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    this.apiService.AppointmentApprovalByVisitor(
      this.seqId, 'Approved', this.hostIc, '', '', this.hostSeqId, this.createdBy, this.refApptApprovalLevelSeqId
    ).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.actionResult = 'approved';
      },
      error: () => {
        this.isSubmitting = false;
        this.errorMessage = 'Approval failed. Please try again.';
      }
    });
  }

  reject() {
    if (this.isSubmitting || !this.rejectRemarks.trim()) return;
    this.isSubmitting = true;
    this.apiService.AppointmentApprovalByVisitor(
      this.seqId, 'Cancelled', this.hostIc, this.rejectRemarks, 'Rejected', this.hostSeqId, this.createdBy, this.refApptApprovalLevelSeqId
    ).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.actionResult = 'rejected';
      },
      error: () => {
        this.isSubmitting = false;
        this.errorMessage = 'Rejection failed. Please try again.';
      }
    });
  }

  resubmit() {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    this.apiService.RequestResubmitAppointmentData(this.seqId, this.hostSeqId).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.actionResult = 'resubmit';
        this.closeModal();
      },
      error: () => {
        this.isSubmitting = false;
        this.errorMessage = 'Resubmit request failed. Please try again.';
      }
    });
  }

  openModal(id: string) {
    clearTimeout(this.closeTimer);
    this.pendingModal = id;
    document.body.style.overflow = 'hidden';
    this.openTimer = setTimeout(() => { this.activeModal = id; }, 16);
  }

  closeModal() {
    this.activeModal = null;
    this.actionResult = '';
    document.body.style.overflow = '';
    this.closeTimer = setTimeout(() => { this.pendingModal = null; }, 240);
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.closeModal();
    }
  }

  downloadAll() {
    this.docsData.forEach((doc: any) => {
      const url = doc.FilePath || doc.FileUrl || doc.DocPath;
      if (!url) return;
      const a = document.createElement('a');
      a.href = url;
      a.download = '';
      a.target = '_blank';
      a.click();
    });
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.trim().split(/\s+/).map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  }

  getStepStatusKey(step: any): 'approved' | 'progress' | 'pending' {
    // Table5 fields: ApprovedBy (name), ApprovedOn (date)
    if (step.ApprovedBy && step.ApprovedOn) return 'approved';
    if (step.ApprovedBy && !step.ApprovedOn) return 'progress';
    // Fallback for Table2 legacy fields
    const s = (step.ApprovalStatus || step.Status || step.Approval_Status || '').toLowerCase();
    if (s === 'approved' || s === 'a') return 'approved';
    if (s === 'in progress' || s === 'inprogress' || s === 'i') return 'progress';
    return 'pending';
  }

  getStepClass(step: any): string {
    return 'step-circle ' + this.getStepStatusKey(step);
  }

  getStepPillClass(step: any): string {
    const key = this.getStepStatusKey(step);
    return 'step-pill pill-' + key;
  }

  getStepStatusLabel(step: any): string {
    const key = this.getStepStatusKey(step);
    if (key === 'approved') return 'Approved';
    if (key === 'progress') return 'In Progress';
    return 'Pending';
  }

  get isExpired(): boolean {
    const endDate = this.appointmentData?.END_DATE || this.appointmentData?.EndDate || this.appointmentData?.START_DATE;
    if (!endDate) return false;
    return new Date(endDate) < new Date();
  }

  get showApprove(): boolean {
    if (this.isExpired) return false;
    return this.appointmentData?.ShowApprove === true || this.appointmentData?.ShowApprove === 1;
  }

  get showReject(): boolean {
    if (this.isExpired) return false;
    return this.appointmentData?.ShowReject === true || this.appointmentData?.ShowReject === 1;
  }

  get approvalProgressWidth(): string {
    if (!this.approvalSteps.length) return '0%';
    const approvedCount = this.approvalSteps.filter(s => this.getStepStatusKey(s) === 'approved').length;
    const progressCount = this.approvalSteps.filter(s => this.getStepStatusKey(s) === 'progress').length;
    const effectiveDone = approvedCount + (progressCount > 0 ? 0.5 : 0);
    return Math.round((effectiveDone / (this.approvalSteps.length - 1 || 1)) * 100) + '%';
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.activeModal) this.closeModal();
  }
}

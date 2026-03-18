import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, switchMap } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';

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
  declarationData: any[] = [];
  questionnaireData: any[] = [];
  docsData: any[] = [];
  itemsData: any[] = [];
  itemCaptions = { desc: 'Equipment Detail', serial: 'Serial Number', type: 'Type' };

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

  constructor(private route: ActivatedRoute, private apiService: ApiService) {}

  ngOnInit() {
    this.seqIdEnc  = this.route.snapshot.queryParamMap.get('enc')   || '';
    this.hostIc    = this.route.snapshot.queryParamMap.get('ic')    ||
                     this.route.snapshot.queryParamMap.get('token') || '';
    this.hostSeqId = this.route.snapshot.queryParamMap.get('hseq') || 123;
    this.loadData();
  }

  ngOnDestroy() {
    document.body.style.overflow = '';
    clearTimeout(this.openTimer);
    clearTimeout(this.closeTimer);
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
        this.seqId  = String(this.appointmentData?.SEQ_ID || '');
        this.hostIc = this.appointmentData?.STAFF_IC      || this.hostIc;

        const branch     = this.appointmentData?.Branch           || this.clientConfig?.Branch || '';
        const visitorCtg = this.appointmentData?.Visitor_category || '';

        return forkJoin({
          decl:  this.apiService.GetVisitorDeclarationSettings(branch, visitorCtg),
          docs:  this.apiService.GetVisitorDocsBySeqId(this.seqId),
          items: this.apiService.GetVisitorItemChecklistBySeqId(this.seqId),
          qna:   this.apiService.GetVisitorQuestionariesByAppointmentId(this.seqId)
        });
      })
    ).subscribe({
      next: (res: any) => {
        this.declarationData   = res.decl?.Table1  || res.decl?.Table  || [];
        this.questionnaireData = res.qna?.Table1   || res.qna?.Table   || [];
        this.docsData        = res.docs?.Table1 || res.docs?.Table  || [];
        this.itemsData       = res.items?.Table || [];
        const settingRaw = res.items?.Table1?.[0]?.SettingDetail;
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
      this.seqId, 'Approved', this.hostIc, '', '', this.hostSeqId
    ).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.actionResult = 'approved';
        this.closeModal();
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
      this.seqId, 'Cancelled', this.hostIc, this.rejectRemarks, 'Rejected', this.hostSeqId
    ).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.actionResult = 'rejected';
        this.closeModal();
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
    document.body.style.overflow = '';
    this.closeTimer = setTimeout(() => { this.pendingModal = null; }, 240);
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.closeModal();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.activeModal) this.closeModal();
  }
}

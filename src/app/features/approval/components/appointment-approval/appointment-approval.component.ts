import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-appointment-approval',
  standalone: true,
  imports: [],
  templateUrl: './appointment-approval.component.html',
  styleUrl: './appointment-approval.component.scss'
})
export class AppointmentApprovalComponent implements OnInit, OnDestroy {
  appointmentId: string | null = null;
  token: string | null = null;

  /** Which modal is being rendered (controls @if in template) */
  pendingModal: string | null = null;
  /** Which modal has is-open class (controls CSS transition) */
  activeModal: string | null = null;

  private openTimer: any = null;
  private closeTimer: any = null;

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.appointmentId = this.route.snapshot.queryParamMap.get('id');
    this.token = this.route.snapshot.queryParamMap.get('token');
  }

  ngOnDestroy() {
    document.body.style.overflow = '';
    clearTimeout(this.openTimer);
    clearTimeout(this.closeTimer);
  }

  openModal(id: string) {
    clearTimeout(this.closeTimer);
    this.pendingModal = id;
    document.body.style.overflow = 'hidden';
    // Allow Angular to render the modal (visibility:hidden), then animate in
    this.openTimer = setTimeout(() => { this.activeModal = id; }, 16);
  }

  closeModal() {
    this.activeModal = null;
    document.body.style.overflow = '';
    // Wait for CSS transition to finish before removing from DOM
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

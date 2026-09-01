import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SharedService } from '../../../../shared/shared.service';
import { environment } from '../../../../../environments/environment';
import { RegistrationStatusComponent } from './registration-status.component';
import { WizardService } from '../../../../core/services/wizard.service';
import { ApiService } from '../../../../core/services/api.service';

/** How the app was originally launched. Persisted through navigation state. */
type StartMode = 'plain' | 'bc' | 'ac';

@Component({
  selector: 'app-registration-status-page',
  standalone: true,
  imports: [
    RegistrationStatusComponent
],
  template: `
    @if (registrationData) {
      <app-registration-status
        [registrationData]="registrationData"
        [showNewRegistration]="showNewRegistration"
        [isRetrying]="isRetrying"
        (newRegistration)="onNewRegistration()"
        (retrySubmit)="onRetrySubmit()"
        (printDocument)="onPrintDocument()">
      </app-registration-status>
    }
    
    @if (!registrationData) {
      <div class="error-container">
        <h2>No Registration Data Found</h2>
        <p>Please complete the registration process first.</p>
        <button type="button" (click)="goHome()" class="btn btn-primary">
          Go to Registration
        </button>
      </div>
    }
    `,
  styles: [`
    .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      padding: 2rem;
      text-align: center;
    }
    
    .btn {
      padding: 0.75rem 2rem;
      border: none;
      border-radius: 4px;
      background-color: var(--theme-primary-color);
      color: white;
      cursor: pointer;
      font-weight: 600;
    }
  `]
})
export class RegistrationStatusPageComponent implements OnInit {
  registrationData: any = null;
  private branchName: string = '';
  private branchID: string = '';

  /** How the registration flow was originally started. */
  private startMode: StartMode = 'plain';
  private allowMultipleBooking: boolean = true;
  /** Preserved bc/vc/hc params so we can navigate back to home with same params. */
  private refCode    = '';
  private refCatCode = '';
  private hcParam    = '';

  isRetrying = false;

  constructor(
    private router: Router,
    private sharedService: SharedService,
    private wizardService: WizardService,
    private api: ApiService
  ) {
    // One-time flag set by the app before navigating here.
    // On browser refresh, history.state is restored but this flag is gone → redirect to home.
    const validNav = sessionStorage.getItem('navigatingToStatus') === 'true';
    sessionStorage.removeItem('navigatingToStatus');

    const navigation = this.router.currentNavigation();
    if (validNav && navigation?.extras?.state) {
      const s = navigation.extras.state;
      this.registrationData = s['registrationData'];
      this.branchName       = s['branchName']  || '';
      this.branchID         = s['branchID']    || '';
      this.startMode           = (s['startMode'] as StartMode) || 'plain';
      this.allowMultipleBooking = s['allowMultipleBooking'] ?? true;
      this.refCode             = s['refCode']     || '';
      this.refCatCode          = s['refCatCode']  || '';
      this.hcParam             = s['hcParam']     || '';
    }
  }

  ngOnInit() {
    if (!this.registrationData) {
      this.router.navigate(['/']);
      return;
    }
    if (this.branchName && this.branchID) {
      this.sharedService.updateHeader(
        this.branchName,
        environment.proURL + "Handler/PortalImageHandler.ashx?ScreenType=20&RefSlno=" + this.branchID
      );
    }
  }

  /**
   * Show the "New Registration" button only when the app was NOT started
   * via an appointment code (ac). For ac flows the link is single-use.
   */
  get showNewRegistration(): boolean {
    return this.startMode !== 'ac' && this.allowMultipleBooking;
  }

  onNewRegistration() {
    // Navigate back to home page with the same query params used at startup.
    // home-page constructor calls clearSessionStorage(), so all form data,
    // uploaded docs, signatures, questionnaire answers, etc. are wiped clean.
    if (this.startMode === 'bc') {
      const queryParams: Record<string, string> = {};
      if (this.refCode)    queryParams['bc'] = this.refCode;
      if (this.refCatCode) queryParams['vc'] = this.refCatCode;
      if (this.hcParam)    queryParams['hc'] = this.hcParam;
      this.router.navigate(['/'], { queryParams });
    } else {
      // plain URL → just go home
      this.router.navigate(['/']);
    }
  }

  onRetrySubmit() {
    if (this.isRetrying) return;
    this.isRetrying = true;

    const catCodeEnc = this.wizardService.refCatCode || undefined;
    // Submit Again must hit the same endpoint the first attempt used: direct check-in
    // visitors are checked in, not booked as an appointment. Keep this in step with
    // wizard-container.submitRegistration().
    const isDirectCheckIn = this.wizardService.isDirectCheckIn;
    const apiCall$ = isDirectCheckIn
      ? this.api.VisitorCheckIn(this.wizardService.getDirectCheckInPayload())
      : this.api.VisitorAckSave(this.wizardService.getVisitorAckData(), catCodeEnc);

    apiCall$
      .subscribe({
        next: (response: any) => {
          this.isRetrying = false;

          let isAutoApproved: boolean;
          let isDynamicQR: boolean;
          let dynamicQrIntervalSec: number;
          let approvalStatus: string;
          let qrCodeData: string;
          let visitorId: string;
          let registrationId: string;

          if (isDirectCheckIn) {
            // VisitorCheckIn: api-base unwraps to { Table, Table1 }, and Table1[0]
            // carries Status / HexCode — there is no 'code' field to check.
            const checkInData = response?.Table1?.[0];
            qrCodeData = checkInData?.HexCode?.toString() || '';
            visitorId = qrCodeData;
            registrationId = qrCodeData;
            isAutoApproved = checkInData?.Status === true;
            isDynamicQR = false;
            dynamicQrIntervalSec = 0;
            approvalStatus = isAutoApproved ? 'Approved' : 'Pending';
          } else {
            const responseData = response?.Table?.[0];

            // A 200 can still carry a business-logic failure ('S' = saved). Without
            // this the page would flip to "pending" on a response that saved nothing.
            if (responseData?.code !== undefined && responseData.code !== 'S') {
              this.registrationData = {
                ...this.registrationData,
                status: 'error',
                errorMessage: responseData.description || undefined,
              };
              return;
            }

            isAutoApproved = responseData?.AutoApprove === 1 || responseData?.AutoApprove === true;
            isDynamicQR = responseData?.IsDynamicQR === true || responseData?.IsDynamicQR === 1 || responseData?.IsDynamicQR === 'true';
            dynamicQrIntervalSec = responseData?.DynamicQrIntervalSec ? Number(responseData.DynamicQrIntervalSec) : 0;
            approvalStatus = responseData?.Approval_Status || (isAutoApproved ? 'Approved' : 'Pending');
            qrCodeData = responseData?.HexCode || '';
            visitorId = responseData?.SEQ_ID?.toString() || '';
            registrationId = responseData?.appointment_group_id || visitorId;
          }

          const summary = this.wizardService.buildRegistrationSummary();
          this.branchName = this.wizardService.currentBranchName || this.branchName;
          this.branchID = this.wizardService.currentBranchID || this.branchID;
          this.startMode = (this.wizardService.appointmentCode
            ? 'ac'
            : this.wizardService.refCode ? 'bc' : 'plain') as StartMode;
          this.refCode = this.wizardService.refCode || '';
          this.refCatCode = this.wizardService.refCatCode || '';
          this.hcParam = this.wizardService.hcParam || '';

          this.wizardService.clearSessionStorage();

          // Update state in place rather than re-navigating to this same route.
          // router.navigate(['/registration-status']) from /registration-status is
          // cancelled by the default onSameUrlNavigation: 'ignore', so the component
          // was never re-created and registrationData — read only in the constructor —
          // kept its old status: 'error'. The retry succeeded while the page still
          // showed "Server Error", so visitors pressed Submit Again and booked
          // duplicate appointments.
          this.registrationData = {
            status: isAutoApproved ? 'success' : 'pending',
            isAutoApproved,
            approvalStatus,
            visitorId,
            qrCodeData,
            isDynamicQR,
            DynamicQrIntervalSec: dynamicQrIntervalSec,
            registrationId,
            // Drives local QR generation on the status card — must survive the retry.
            isDirectCheckIn,
            visitorName: summary.visitorName,
            email: summary.email,
            visitFrom: summary.visitFrom,
            visitTo: summary.visitTo,
            meetingWith: summary.meetingWith,
            meetingLocation: summary.meetingLocation,
            visitType: summary.visitType,
            visitPurpose: summary.visitPurpose,
            branch: summary.branch,
          };
        },
        error: () => {
          this.isRetrying = false;
          // ApiBaseService already surfaces a toast; keep the error card on screen
          // so the visitor still has the Submit Again button.
        }
      });
  }

  onPrintDocument() {
    window.print();
  }

  goHome() {
    this.router.navigate(['/']);
  }
}

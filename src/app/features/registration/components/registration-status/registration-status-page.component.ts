import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SharedService } from '../../../../shared/shared.service';
import { environment } from '../../../../../environments/environment';
import { RegistrationStatusComponent } from './registration-status.component';

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
        (newRegistration)="onNewRegistration()"
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
  /** Preserved bc/vc/hc params so we can navigate back to home with same params. */
  private refCode    = '';
  private refCatCode = '';
  private hcParam    = '';

  constructor(
    private router: Router,
    private sharedService: SharedService
  ) {
    // Get data from navigation state
    const navigation = this.router.currentNavigation();
    if (navigation?.extras?.state) {
      const s = navigation.extras.state;
      this.registrationData = s['registrationData'];
      this.branchName       = s['branchName']  || '';
      this.branchID         = s['branchID']    || '';
      this.startMode        = (s['startMode'] as StartMode) || 'plain';
      this.refCode          = s['refCode']     || '';
      this.refCatCode       = s['refCatCode']  || '';
      this.hcParam          = s['hcParam']     || '';
    }
  }

  ngOnInit() {
    // Update header with branch information if available
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
    return this.startMode !== 'ac';
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

  onPrintDocument() {
    window.print();
  }

  goHome() {
    this.router.navigate(['/']);
  }
}

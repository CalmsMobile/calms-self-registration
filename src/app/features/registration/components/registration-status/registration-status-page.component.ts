import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SharedService } from '../../../../shared/shared.service';
import { environment } from '../../../../../environments/environment';
import { RegistrationStatusComponent } from './registration-status.component';


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

  constructor(
    private router: Router,
    private sharedService: SharedService
  ) {
    // Get data from navigation state
    const navigation = this.router.currentNavigation();
    if (navigation?.extras?.state) {
      this.registrationData = navigation.extras.state['registrationData'];
      this.branchName = navigation.extras.state['branchName'];
      this.branchID = navigation.extras.state['branchID'];
    }
  }

  ngOnInit() {
    // If no data in navigation state, check for stored data
    if (!this.registrationData) {
      // You might want to check sessionStorage or localStorage
      // for registration data if navigation state is lost
    }
    
    // Update header with branch information if available
    if (this.branchName && this.branchID) {
      this.sharedService.updateHeader(
        this.branchName,
        environment.proURL + "Handler/PortalImageHandler.ashx?ScreenType=20&RefSlno=" + this.branchID
      );
    }
  }

  onNewRegistration() {
    this.router.navigate(['/']);
  }

  onPrintDocument() {
    window.print();
  }

  goHome() {
    this.router.navigate(['/']);
  }
}

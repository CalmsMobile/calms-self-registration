import { Component, OnInit, OnDestroy } from '@angular/core';

import { MenuItem, MessageService } from 'primeng/api';

// PrimeNG Component Imports
import { CardModule } from 'primeng/card';
import { StepsModule } from 'primeng/steps';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ProgressBarModule } from 'primeng/progressbar';

// Services
import { WizardService } from '../../../../core/services/wizard.service';
import { Router, RouterOutlet } from '@angular/router';
import { take, Subject, takeUntil } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { LabelService } from '../../../../core/services/label.service';
import { LanguageService } from '../../../../core/services/language.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-wizard-container',
  standalone: true,
  imports: [
    CardModule,
    StepsModule,
    ButtonModule,
    ToastModule,
    RouterOutlet,
    ProgressBarModule,
    TranslatePipe
  ],
  templateUrl: './wizard-container.component.html',
  styleUrls: ['./wizard-container.component.scss']
})
export class WizardContainerComponent implements OnInit, OnDestroy {
  items: MenuItem[] = [];
  activeIndex: number = 0;
  allSettings: any;
  isLoading = true;
  completedSteps: boolean[] = []; // Track completed steps
  private destroy$ = new Subject<void>();

  constructor(
    private wizardService: WizardService,
    private router: Router,
    private api: ApiService,
    private labelService: LabelService,
    private languageService: LanguageService
  ) {
    this.initializeSteps();
    this.completedSteps = new Array(4).fill(false); // Initialize for 4 steps

    if (!this.wizardService.getSettings()) {
      this.api.GetVisitorDeclarationSettings(this.wizardService.currentBranchID, this.wizardService.selectedVisitCategory)
        .subscribe({
          next: (allSettings: any) => {
            this.wizardService.setSettings(allSettings);
            this.wizardService.updateEnabledSteps(this.wizardService.getSettings());
            this.items = this.wizardService.getEnabledSteps();
            this.isLoading = false;
          },
          error: (error) => {
            console.error('Error loading settings in wizard container:', error);
            this.isLoading = false;
          }
        });
    } else {
      // Settings already exist, update enabled steps and stop loading
      this.wizardService.updateEnabledSteps(this.wizardService.getSettings());
      this.items = this.wizardService.getEnabledSteps();
      this.isLoading = false;
    }
  }

  ngOnInit(): void {
    // Subscribe to language changes
    this.languageService.currentLanguage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(language => {
        if (language) {
          this.updateStepLabels();
        }
      });

    // Subscribe to label changes
    this.labelService.getLabels$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateStepLabels();
      });

    // Initialize step styles
    this.updateStepStyles();

    // TODO: For now, page settings are not used
    /*this.api.GetVisitorSelfRegistrationPageSetup(this.wizardService.currentBranchID)
    .subscribe((pageSettings: any) => {
      console.log(pageSettings);
      this.wizardService.setPageSettings(pageSettings);
    });*/

    this.api.GetEnabledAppointmentUDFCtrlData(this.wizardService.currentBranchID)
      .subscribe({
        next: (udfSettings: any) => {
          this.wizardService.setUdfSettings(udfSettings);
        },
        error: (error) => {
          console.error('Error loading UDF settings:', error);
        }
      });
  }

  onStepChange(event: any): void {
    // Only allow navigation to completed steps or the next available step
    const targetStep = event.index;
    const maxAllowedStep = this.getMaxAllowedStep();

    if (targetStep <= maxAllowedStep) {
      this.navigateToStep(targetStep);
    } else {
      // Revert to current step if trying to skip ahead
      setTimeout(() => {
        this.activeIndex = this.wizardService.getCurrentStepIndex();
      });
    }
  }

  // Update onNext method
  navigateToStep(stepIndex: number, skipValidation = false): void {
    console.log('navigateToStep called with:', stepIndex, 'skipValidation:', skipValidation);
    const currentStep = this.wizardService.getCurrentStepIndex();
    console.log('Current wizard step:', currentStep);

    // For forward navigation (next step), allow if it's just one step ahead
    const isForwardToNextStep = stepIndex === currentStep + 1 && !skipValidation;

    // Check if navigation is allowed (but allow forward navigation to immediate next step)
    if (!skipValidation && !isForwardToNextStep && stepIndex > this.getMaxAllowedStep()) {
      console.log('Navigation blocked - step not allowed');
      this.revertStepUI(currentStep);
      return;
    }

    // Backward navigation (skip validation)
    if (stepIndex < currentStep || skipValidation) {
      console.log('Backward navigation or skip validation');
      this.updateStepState(stepIndex);
      return;
    }

    // Forward navigation (validate first)
    console.log('Forward navigation - requesting validation');
    this.wizardService.requestValidation();
    this.wizardService.canProceed$.pipe(take(1)).subscribe(canProceed => {
      console.log('Validation result:', canProceed);
      if (canProceed) {
        // Mark current step as completed
        this.completedSteps[currentStep] = true;
        console.log('Step completed, updating state');
        this.updateStepState(stepIndex);
        this.updateStepStyles();
      } else {
        console.log('Validation failed, reverting UI');
        this.revertStepUI(currentStep);
      }
    });
  }

  private getMaxAllowedStep(): number {
    // Find the first incomplete step and return it as the maximum allowed
    for (let i = 0; i < this.completedSteps.length; i++) {
      if (!this.completedSteps[i]) {
        return i;
      }
    }
    // If all steps are completed, allow access to all
    return this.items.length - 1;
  }

  private updateStepState(stepIndex: number): void {
    this.activeIndex = stepIndex;
    this.wizardService.setCurrentStep(stepIndex);
    this.router.navigate([`register/${this.getStepRoute(stepIndex)}`], {
      replaceUrl: true
    });
  }

  private revertStepUI(stepIndex: number): void {
    setTimeout(() => {
      this.activeIndex = stepIndex;
    });
  }

  private getStepRoute(stepOrItem: number | MenuItem): string {
    const stepRoutes = ['general-info', 'attachments', 'safety-brief', 'questionnaire'];

    if (typeof stepOrItem === 'number') {
      return stepRoutes[stepOrItem] || '';
    }

    const label = stepOrItem.label;
    return label?.replace(/\s+/g, '-').toLowerCase() || '';
  }

  onStepActivated(component: any): void {
    const url = this.router.url;
    const stepRoutes = ['general-info', 'attachments', 'safety-brief', 'questionnaire'];
    const stepIndex = stepRoutes.findIndex(route => url.includes(route));

    if (stepIndex > -1) {
      this.activeIndex = stepIndex;
      this.wizardService.setCurrentStep(stepIndex);
    }
  }

  onNext(): void {
    console.log('onNext called');
    const currentStep = this.wizardService.getCurrentStepIndex();
    const isLastStep = this.activeIndex === this.items.length - 1;

    console.log('Current step:', currentStep, 'Active index:', this.activeIndex, 'Is last step:', isLastStep);

    if (isLastStep) {
      // Last step - submit the registration
      this.submitRegistration();
    } else {
      // Navigate to next step
      const nextStep = currentStep + 1;
      console.log('Navigating to next step:', nextStep);
      this.navigateToStep(nextStep); // Validation handled internally
    }
  }

  private submitRegistration(): void {
    // Request validation first
    this.wizardService.requestValidation();
    this.wizardService.canProceed$.pipe(take(1)).subscribe(canProceed => {
      if (canProceed) {
        this.isLoading = true;

        // Get form data in VisitorAck format from wizard service
        const visitorAckData = this.wizardService.getVisitorAckData();

        console.log('=== SUBMISSION DEBUG ===');
        console.log('Submitting visitor registration:', visitorAckData);
        console.log('VisitorsList length:', visitorAckData.VisitorsList?.length);
        console.log('VisitorsList content:', visitorAckData.VisitorsList);
        console.log('Form data before submission:', this.wizardService.getFormData());
        console.log('========================');

        // Call the new VisitorAckSave API
        this.api.VisitorAckSave(visitorAckData)
          .subscribe({
            next: (response: any) => {
              this.isLoading = false;

              console.log('Registration successful:', response);

              // Extract data from Table array (api service returns unwrapped data)
              const responseData = response?.Table?.[0];
              const isAutoApproved = responseData?.AutoApprove === 1 || responseData?.AutoApprove === true;
              const isDynamicQR = responseData?.IsDynamicQR === true || responseData?.IsDynamicQR === 1;

              // Get branch info before clearing session storage
              const branchName = this.wizardService.currentBranchName;
              const branchID = this.wizardService.currentBranchID;

              // Clear session storage after successful submission
              this.wizardService.clearSessionStorage();

              // Navigate to registration status page with response data
              this.router.navigate(['/registration-status'], {
                state: {
                  registrationData: {
                    isAutoApproved: isAutoApproved,
                    visitorId: responseData?.SEQ_ID || response?.VisitorId || response?.ID,
                    qrCodeData: responseData?.HexCode || response?.QRCodeData,
                    visitorName: visitorAckData.FullName,
                    registrationNumber: responseData?.appointment_group_id || response?.RegistrationNumber || response?.RefNo,
                    isDynamicQR: isDynamicQR
                  },
                  branchName: branchName,
                  branchID: branchID
                }
              });
            },
            error: (error: any) => {
              this.isLoading = false;
              console.error('=== API ERROR DEBUG ===');
              console.error('Registration submission failed:', error);
              console.error('Error status:', error.status);
              console.error('Error message:', error.message);
              console.error('Error body:', error.error);
              console.error('Form data at error:', this.wizardService.getFormData());
              console.error('======================');

              // Important: Don't clear questionnaire state on error
              // The wizard service should preserve form data for retry

              // You might want to show an error message here
            }
          });
      } else {
        console.log('=== VALIDATION FAILED ===');
        console.log('Validation failed, checking form data:', this.wizardService.getFormData());
        console.log('=========================');
      }
    });
  }

  onPrevious(): void {
    const prevStep = this.wizardService.getCurrentStepIndex() - 1;
    if (prevStep >= 0) {
      this.navigateToStep(prevStep, true); // Skip validation for backward nav
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeSteps(): void {
    this.items = [
      { label: 'General Info', command: (event) => this.navigateToStep(0) },
      { label: 'Attachments', command: (event) => this.navigateToStep(1) },
      { label: 'Safety Brief', command: (event) => this.navigateToStep(2) },
      { label: 'Questionnaire', command: (event) => this.navigateToStep(3) }
    ];
  }

  private updateStepLabels(): void {
    if (this.items && this.items.length > 0) {
      if (this.items[0]) this.items[0].label = this.labelService.getLabel('general_information', 'caption') || 'General Info';
      if (this.items[1]) this.items[1].label = this.labelService.getLabel('additional_documents', 'caption') || 'Attachments';
      if (this.items[2]) this.items[2].label = this.labelService.getLabel('safety_briefing', 'caption') || 'Safety Brief';
      if (this.items[3]) this.items[3].label = this.labelService.getLabel('questionnaire', 'caption') || 'Questionnaire';
    }
  }

  private updateStepStyles(): void {
    // Update step styles to show completed steps
    this.items.forEach((item, index) => {
      if (this.completedSteps[index]) {
        item.styleClass = 'completed-step';
        item.icon = 'pi pi-check';
      } else if (index === this.activeIndex) {
        item.styleClass = 'active-step';
        item.icon = undefined;
      } else if (index <= this.getMaxAllowedStep()) {
        item.styleClass = 'available-step';
        item.icon = undefined;
      } else {
        item.styleClass = 'disabled-step';
        item.icon = undefined;
      }
    });
  }
}
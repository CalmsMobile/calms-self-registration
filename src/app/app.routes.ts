import { Routes } from '@angular/router';
import { StepGeneralComponent } from './features/registration/components/steps/step-general/step-general.component';
import { StepTermsComponent } from './features/registration/components/steps/step-terms/step-terms.component';
import { StepAttachmentsComponent } from './features/registration/components/steps/step-attachments/step-attachments.component';
import { StepProhibitedItemsComponent } from './features/registration/components/steps/step-prohibited-items/step-prohibited-items.component';
import { StepSafetyBriefComponent } from './features/registration/components/steps/step-safety-brief/step-safety-brief.component';
import { StepQuestionnaireComponent } from './features/registration/components/steps/step-questionnaire/step-questionnaire.component';
import { StepNdaAgreementComponent } from './features/registration/components/steps/step-nda-agreement/step-nda-agreement.component';
import { HomePageComponent } from './features/registration/components/home-page/home-page.component';
import { WizardContainerComponent } from './features/registration/components/wizard-container/wizard-container.component';
import { RegistrationStatusPageComponent } from './features/registration/components/registration-status/registration-status-page.component';
import { getSortedSteps } from './core/models/step-config.model';

/**
 * Map step IDs to their Angular components.
 * When adding a new step, register its component here.
 */
const STEP_COMPONENT_MAP: Record<string, any> = {
  'general-info': StepGeneralComponent,
  'attachments': StepAttachmentsComponent,
  'prohibited-items': StepProhibitedItemsComponent,
  'safety-brief': StepSafetyBriefComponent,
  'questionnaire': StepQuestionnaireComponent,
  'nda-agreement': StepNdaAgreementComponent,
};

/** Generate child routes from STEP_CONFIG */
const stepChildRoutes = getSortedSteps()
  .filter(step => STEP_COMPONENT_MAP[step.id])
  .map((step, index) => ({
    path: step.routerLink,
    component: STEP_COMPONENT_MAP[step.id],
    data: { stepIndex: index }
  }));

export const routes: Routes = [
  { 
    path: '', 
    component: HomePageComponent 
  },
  {
    path: 'register',
    component: WizardContainerComponent,
    children: [
      { path: '', redirectTo: getSortedSteps()[0]?.routerLink || 'general-info', pathMatch: 'full' },
      ...stepChildRoutes
    ]
  },
  {
    path: 'registration-status',
    component: RegistrationStatusPageComponent
  },
  { path: '**', redirectTo: '' }
];

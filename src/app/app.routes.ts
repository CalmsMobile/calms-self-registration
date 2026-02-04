import { Routes } from '@angular/router';
import { StepGeneralComponent } from './features/registration/components/steps/step-general/step-general.component';
import { StepTermsComponent } from './features/registration/components/steps/step-terms/step-terms.component';
import { StepAttachmentsComponent } from './features/registration/components/steps/step-attachments/step-attachments.component';
import { StepProhibitedItemsComponent } from './features/registration/components/steps/step-prohibited-items/step-prohibited-items.component';
import { StepSafetyBriefComponent } from './features/registration/components/steps/step-safety-brief/step-safety-brief.component';
import { StepQuestionnaireComponent } from './features/registration/components/steps/step-questionnaire/step-questionnaire.component';
import { HomePageComponent } from './features/registration/components/home-page/home-page.component';
import { WizardContainerComponent } from './features/registration/components/wizard-container/wizard-container.component';
import { RegistrationStatusPageComponent } from './features/registration/components/registration-status/registration-status-page.component';

export const routes: Routes = [
  { 
    path: '', 
    component: HomePageComponent 
  },
  {
    path: 'register',
    component: WizardContainerComponent,
    children: [
      { path: '', redirectTo: 'general-info', pathMatch: 'full' },
      { 
        path: 'general-info',
        component: StepGeneralComponent,
        data: { stepIndex: 0 }
      },
      { 
        path: 'attachments',
        component: StepAttachmentsComponent,
        data: { stepIndex: 1 }
      },
      { 
        path: 'prohibited-items',
        component: StepProhibitedItemsComponent,
        data: { stepIndex: 2 }
      },
      { 
        path: 'safety-brief',
        component: StepSafetyBriefComponent,
        data: { stepIndex: 3 }
      },
      { 
        path: 'questionnaire',
        component: StepQuestionnaireComponent,
        data: { stepIndex: 4 }
      },
      // Add other steps similarly...
    ]
  },
  {
    path: 'registration-status',
    component: RegistrationStatusPageComponent
  },
  { path: '**', redirectTo: '' }
];

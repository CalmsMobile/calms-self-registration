import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { WizardService } from '../../../../../core/services/wizard.service';
import { ToastModule } from 'primeng/toast';
import { RadioButtonModule } from 'primeng/radiobutton';

import { TranslatePipe } from '../../../../../shared/pipes/translate.pipe';
import { Subject, takeUntil } from 'rxjs';

interface Question {
  QuestionariesSeqId: number;
  ShortName?: string;
  Description: string;
  ValidationRequired: boolean;
  AcceptedAns: number; // 0 for No, 1 for Yes
}

@Component({
  selector: 'app-step-questionnaire',
  templateUrl: './step-questionnaire.component.html',
  styleUrls: ['./step-questionnaire.component.scss'],
  standalone: true,
  imports: [FormsModule, ToastModule, RadioButtonModule, ReactiveFormsModule, TranslatePipe]
})
export class StepQuestionnaireComponent implements OnInit, OnDestroy {
  questions: Question[] = [];

  questionnaireForm: FormGroup;
  validationErrors: { [key: number]: boolean } = {};
  isLoading = true;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private wizardService: WizardService,
    private messageService: MessageService
  ) {
    this.questionnaireForm = this.fb.group({});
  }

  ngOnInit() {
    // Load questions first
    this.questions = this.wizardService.getQuestionnaireSettings();
    if (!this.questions || this.questions.length === 0) {
      this.wizardService.gotoHomePage();
      return;
    }
    this.buildFormControls();
    this.restoreFormData(); // Restore saved data
    this.isLoading = false;

    this.wizardService.onValidationRequest.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.validateQuestionnaire();
    });

    // Auto-save on form changes
    this.questionnaireForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.saveFormData();
    });
  }

  ngOnDestroy(): void {
    this.saveFormData();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private restoreFormData(): void {
    const savedData = this.wizardService.getFormData('questionnaire');
    console.log('=== QUESTIONNAIRE RESTORE ===');
    console.log('Saved data from wizard:', savedData);
    console.log('=============================');
    if (savedData) {
      this.questionnaireForm.patchValue(savedData);
    }
  }

  private saveFormData(): void {
    const formValue = this.questionnaireForm.value;
    console.log('=== QUESTIONNAIRE SAVE ===');
    console.log('Saving questionnaire data:', formValue);
    console.log('==========================');
    this.wizardService.updateFormData('questionnaire', formValue);
  }

  private buildFormControls(): void {
    try {
      const formGroupConfig: Record<string, FormControl<string | null>> = {};

      this.questions.forEach(question => {
        formGroupConfig[`q${question.QuestionariesSeqId}`] = new FormControl<string | null>(
          null,
          question.ValidationRequired ? Validators.required : null
        );
      });

      this.questionnaireForm = this.fb.group(formGroupConfig);
    } catch (error) {
      console.error('Form build error:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Form Error',
        detail: 'Failed to initialize questions'
      });
    }
  }

  getQuestionControl(questionId: number): FormControl<string | null> {
    const control = this.questionnaireForm.get(`q${questionId}`);
    return control ? (control as FormControl<string | null>) : this.fb.control(null);
  }

  validateQuestionnaire(): void {
    this.validationErrors = {};
    let isValid = true;

    this.questions.forEach(question => {
      const control = this.getQuestionControl(question.QuestionariesSeqId);
      const userAnswer = control?.value;

      if (question.ValidationRequired && userAnswer !== String(question.AcceptedAns)) {
        this.validationErrors[question.QuestionariesSeqId] = true;
        isValid = false;
      }
    });

    this.wizardService.setStepValid(isValid);

    if (isValid) {
      this.saveFormData(); // Save when validation passes
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Please correct your answers before proceeding',
        life: 5000
      });
    }
  }

  getQuestionError(questionId: number): string | null {
    const control = this.getQuestionControl(questionId);
    if (control.invalid && (control.dirty || control.touched)) {
      if (control.errors?.['required']) return 'This answer is required';
      if (this.validationErrors[questionId]) return 'Your answer is incorrect';
    }
    return null;
  }
}

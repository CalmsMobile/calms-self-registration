import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormArray, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { WizardService } from '../../../../../core/services/wizard.service';
import { LabelService } from '../../../../../core/services/label.service';
import { ToastModule } from 'primeng/toast';
import { RadioButtonModule } from 'primeng/radiobutton';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

import { TranslatePipe } from '../../../../../shared/pipes/translate.pipe';
import { Subject, takeUntil } from 'rxjs';

interface Question {
  QuestionariesSeqId: number;
  ShortName?: string;
  Description: string;
  ValidationRequired: boolean;
  AcceptedAns: number; // 0 for No, 1 for Yes (legacy)
  Option1?: string;
  Option2?: string;
  Option3?: string;
  Option4?: string;
  CrtAnswers?: string; // Comma-separated correct answer indices (e.g., "1,2,3")
  IsSafetyBriefQuest?: boolean;
  VisitorCategories?: string;
  MAppId?: string;
  Active?: boolean;
  RefHostAppSeqId?: number;
}

@Component({
  selector: 'app-step-questionnaire',
  templateUrl: './step-questionnaire.component.html',
  styleUrls: ['./step-questionnaire.component.scss'],
  standalone: true,
  imports: [FormsModule, ToastModule, RadioButtonModule, CheckboxModule, DialogModule, ButtonModule, ReactiveFormsModule, TranslatePipe]
})
export class StepQuestionnaireComponent implements OnInit, OnDestroy {
  questions: Question[] = [];

  questionnaireForm: FormGroup;
  validationErrors: { [key: number]: boolean } = {};
  isLoading = true;
  showAlertDialog = false;
  alertMessage = '';
  showRewatchButton = false;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private wizardService: WizardService,
    private messageService: MessageService,
    private labelService: LabelService
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

    // Subscribe to each question control to clear validation errors on change
    this.questions.forEach(question => {
      const control = this.questionnaireForm.get(`q${question.QuestionariesSeqId}`);
      if (control) {
        control.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
          // Clear validation error when user interacts with radio buttons
          if (this.validationErrors[question.QuestionariesSeqId]) {
            delete this.validationErrors[question.QuestionariesSeqId];
          }
        });
      }
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
      // Restore form data - handle both radio buttons and checkboxes
      Object.keys(savedData).forEach(key => {
        const control = this.questionnaireForm.get(key);
        if (control) {
          const value = savedData[key];
          
          // If it's a FormArray (checkbox group), populate it properly
          if (control instanceof FormArray) {
            control.clear();
            if (Array.isArray(value)) {
              value.forEach((v: string) => {
                control.push(this.fb.control(v));
              });
            }
          } else {
            // Regular FormControl (radio button)
            control.setValue(value);
          }
        }
      });
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
      const formGroupConfig: Record<string, FormControl<string | null> | FormArray> = {};

      this.questions.forEach(question => {
        const isMultipleChoice = this.isMultipleAnswerQuestion(question);
        
        if (isMultipleChoice) {
          // Use FormArray for checkbox questions (multiple selections)
          formGroupConfig[`q${question.QuestionariesSeqId}`] = this.fb.array(
            [],
            question.ValidationRequired ? Validators.required : null
          );
        } else {
          // Use FormControl for radio button questions (single selection)
          formGroupConfig[`q${question.QuestionariesSeqId}`] = new FormControl<string | null>(
            null,
            question.ValidationRequired ? Validators.required : null
          );
        }
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

  getQuestionArray(questionId: number): FormArray {
    const control = this.questionnaireForm.get(`q${questionId}`);
    return control ? (control as FormArray) : this.fb.array([]);
  }

  /**
   * Determine if a question has multiple correct answers (checkbox)
   * or single correct answer (radio button)
   */
  isMultipleAnswerQuestion(question: Question): boolean {
    if (!question.CrtAnswers) return false;
    const correctAnswers = question.CrtAnswers.split(',').map(a => a.trim()).filter(a => a);
    return correctAnswers.length > 1;
  }

  /**
   * Get available options for a question
   */
  getQuestionOptions(question: Question): Array<{ value: string; label: string }> {
    const options: Array<{ value: string; label: string }> = [];
    
    if (question.Option1) options.push({ value: '1', label: question.Option1 });
    if (question.Option2) options.push({ value: '2', label: question.Option2 });
    if (question.Option3) options.push({ value: '3', label: question.Option3 });
    if (question.Option4) options.push({ value: '4', label: question.Option4 });
    
    return options;
  }

  /**
   * Get correct answers for a question as an array
   */
  getCorrectAnswers(question: Question): string[] {
    if (!question.CrtAnswers) return [];
    return question.CrtAnswers.split(',').map(a => a.trim()).filter(a => a);
  }

  /**
   * Check if checkbox option is selected
   */
  isCheckboxSelected(questionId: number, optionValue: string): boolean {
    const formArray = this.getQuestionArray(questionId);
    return formArray.value.includes(optionValue);
  }

  /**
   * Get checkbox model value for two-way binding
   */
  getCheckboxModel(questionId: number, optionValue: string): boolean {
    return this.isCheckboxSelected(questionId, optionValue);
  }

  /**
   * Handle checkbox change event
   */
  onCheckboxChange(questionId: number, optionValue: string, event: any): void {
    const formArray = this.getQuestionArray(questionId);
    const isChecked = event.checked;
    
    if (isChecked) {
      // Add the value if checked
      if (!formArray.value.includes(optionValue)) {
        formArray.push(this.fb.control(optionValue));
      }
    } else {
      // Remove the value if unchecked
      const index = formArray.value.indexOf(optionValue);
      if (index >= 0) {
        formArray.removeAt(index);
      }
    }
    
    // Clear validation error when user interacts
    if (this.validationErrors[questionId]) {
      delete this.validationErrors[questionId];
    }
    
    formArray.markAsTouched();
    this.saveFormData();
  }

  validateQuestionnaire(): void {
    this.validationErrors = {};
    let isValid = true;
    let hasUnanswered = false;
    let hasWrongAnswer = false;
    let hasSafetyBriefError = false;
    let firstSafetyQuestion: Question | null = null;

    this.questions.forEach(question => {
      const isMultipleChoice = this.isMultipleAnswerQuestion(question);
      const correctAnswers = this.getCorrectAnswers(question);
      let userAnswers: string[] = [];
      let isAnswerCorrect = false;

      if (isMultipleChoice) {
        // Checkbox question - multiple answers
        const formArray = this.getQuestionArray(question.QuestionariesSeqId);
        userAnswers = formArray.value || [];
        
        // Check if required field has answers
        if (question.ValidationRequired && userAnswers.length === 0) {
          this.validationErrors[question.QuestionariesSeqId] = true;
          isValid = false;
          hasUnanswered = true;
          
          if (question.IsSafetyBriefQuest && !hasSafetyBriefError) {
            hasSafetyBriefError = true;
            firstSafetyQuestion = question;
          }
          return;
        }
        
        // Check if answers match correct answers (must match exactly)
        if (question.ValidationRequired && correctAnswers.length > 0) {
          const sortedUserAnswers = [...userAnswers].sort();
          const sortedCorrectAnswers = [...correctAnswers].sort();
          isAnswerCorrect = JSON.stringify(sortedUserAnswers) === JSON.stringify(sortedCorrectAnswers);
        } else {
          isAnswerCorrect = true; // No validation required
        }
      } else {
        // Radio button question - single answer
        const control = this.getQuestionControl(question.QuestionariesSeqId);
        const userAnswer = control?.value;
        
        // Check if required field has answer
        if (question.ValidationRequired && !userAnswer) {
          this.validationErrors[question.QuestionariesSeqId] = true;
          isValid = false;
          hasUnanswered = true;
          
          if (question.IsSafetyBriefQuest && !hasSafetyBriefError) {
            hasSafetyBriefError = true;
            firstSafetyQuestion = question;
          }
          return;
        }
        
        // Check if answer matches correct answer
        if (question.ValidationRequired && correctAnswers.length > 0) {
          isAnswerCorrect = correctAnswers.includes(userAnswer || '');
        } else {
          isAnswerCorrect = true; // No validation required
        }
      }

      if (question.ValidationRequired && !isAnswerCorrect) {
        this.validationErrors[question.QuestionariesSeqId] = true;
        isValid = false;
        hasWrongAnswer = true;
        
        // Track first safety brief question with error
        if (question.IsSafetyBriefQuest && !hasSafetyBriefError) {
          hasSafetyBriefError = true;
          firstSafetyQuestion = question;
        }
      }
    });

    // Safety brief wrong answer → show unified alert dialog with rewatch button
    if (hasSafetyBriefError && firstSafetyQuestion) {
      this.alertMessage = this.labelService.getLabel('incorrect_safety_briefing_answer', 'caption');
      this.showRewatchButton = true;
      this.showAlertDialog = true;
      this.wizardService.setStepValid(false);
      return;
    }

    this.wizardService.setStepValid(isValid);

    if (isValid) {
      this.saveFormData();
    } else if (hasUnanswered) {
      this.alertMessage = this.labelService.getLabel('please_answer_this_question', 'caption');
      this.showRewatchButton = false;
      this.showAlertDialog = true;
    } else if (hasWrongAnswer) {
      this.alertMessage = this.labelService.getLabel('this_question_requires_the_correct_answer_to_proceed', 'caption');
      this.showRewatchButton = false;
      this.showAlertDialog = true;
    }
  }

  /**
   * Navigate back to safety brief step to rewatch video
   */
  rewatchSafetyBrief(): void {
    this.showAlertDialog = false;
    
    // PrimeNG modal dialog adds 'p-overflow-hidden' to body; clean up before navigating.
    document.body.classList.remove('p-overflow-hidden');
    document.querySelectorAll('.p-dialog-mask').forEach(mask => mask.remove());
    
    // Find the safety brief step index
    const steps = this.wizardService.getEnabledSteps();
    const safetyBriefStepIndex = steps.findIndex(step => 
      step.routerLink === '/register/safety-brief' || 
      step.routerLink === 'safety-brief'
    );
    
    if (safetyBriefStepIndex >= 0) {
      this.wizardService.requestStepChange(safetyBriefStepIndex);
    } else {
      this.messageService.add({
        severity: 'warn',
        summary: 'Warning',
        detail: 'Safety brief step not found',
        life: 3000
      });
    }
  }

  closeAlertDialog(): void {
    this.showAlertDialog = false;
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

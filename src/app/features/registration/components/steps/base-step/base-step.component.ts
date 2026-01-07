import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subject, Subscription, takeUntil } from 'rxjs';
import { WizardService } from '../../../../../core/services/wizard.service';
import { AbstractControlOptions, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { SettingsService } from '../../../../../core/services/settings.service';

@Component({ template: '' })
export abstract class BaseStepComponent implements OnInit, OnDestroy {
  // Properties common to all steps
  public form!: FormGroup; // Each step will have a form group
  protected subscriptions: Subscription = new Subscription();
  public stepSettings: any; // Settings specific to this step
  public isLoadingSettings: boolean = true; // For loading state

  // Abstract properties/methods that child components MUST implement
  abstract stepName: string; // e.g., 'general', 'terms'
  abstract buildForm(): void;
  abstract populateFormFromService(): void; // Load data from wizard service
  abstract collectDataForService(): any; // Return data to save to wizard service

  constructor(
    protected wizardService: WizardService,
    protected settingsService: SettingsService
  ) {}

  ngOnInit(): void {
    this.loadStepSettings();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe(); // Clean up subscriptions to prevent memory leaks
  }

  // Common methods
  private loadStepSettings(): void {
    this.isLoadingSettings = true;
    this.subscriptions.add(
      this.settingsService.settings$.subscribe(allSettings => {
        if (allSettings) {
          this.stepSettings = allSettings.steps?.find((s: any) => s.id === this.stepName);
          console.log(`Settings for ${this.stepName}:`, this.stepSettings);
          this.isLoadingSettings = false; // Settings loaded

          // Now that settings are loaded, build the form
          this.buildForm();
          this.populateFormFromService();
          this.subscribeToFormChanges();
        }
      })
    );
  }

  private subscribeToFormChanges(): void {
    this.subscriptions.add(
      this.form.valueChanges.subscribe(value => {
        // Optionally update wizard service immediately on value changes
        // This can be heavy, consider debouncing or updating only on "next" click
        // For now, we'll collect on "next" or "submit"
      })
    );
  }

  // Method to be called when "Next" is clicked (or step is navigated away from)
  // This will typically be called by the WizardContainer or WizardService
  public isValid(): boolean {
    if (!this.form) {
      return false; // Form might not be initialized yet
    }
    return this.form.valid;
  }

  public saveStepData(): void {
    if (this.form.valid) {
      this.wizardService.updateFormData(this.stepName, this.collectDataForService());
    } else {
      // Mark all fields as touched to show validation errors
      this.form.markAllAsTouched();
      console.warn(`Form for ${this.stepName} is invalid.`);
    }
  }

  protected createControl(fieldConfig: any): [any, ValidatorFn | ValidatorFn[] | AbstractControlOptions] {
    const validators: ValidatorFn[] = [];
    if (fieldConfig.mandatory) {
      validators.push(Validators.required);
    }
    if (fieldConfig.minLength) {
      validators.push(Validators.minLength(fieldConfig.minLength));
    }
    if (fieldConfig.maxLength) {
      validators.push(Validators.maxLength(fieldConfig.maxLength));
    }
    if (fieldConfig.pattern) {
      validators.push(Validators.pattern(fieldConfig.pattern));
    }
    // Add more validators as needed

    // Return as a tuple
    return [fieldConfig.defaultValue || '', validators];
  }
}

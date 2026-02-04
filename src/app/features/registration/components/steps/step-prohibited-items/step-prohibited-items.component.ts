import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WizardService } from '../../../../../core/services/wizard.service';
import { Subject, takeUntil } from 'rxjs';

interface ProhibitedItem {
  name: string;
  category: string;
  reason?: string;
}

@Component({
  selector: 'app-step-prohibited-items',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './step-prohibited-items.component.html',
  styleUrl: './step-prohibited-items.component.scss'
})
export class StepProhibitedItemsComponent implements OnInit, OnDestroy {
  prohibitedItems: ProhibitedItem[] = [];
  newItem = { name: '', category: '' };
  acknowledgedProhibited = false;
  
  private destroy$ = new Subject<void>();

  constructor(private wizardService: WizardService) {
    this.wizardService.onValidationRequest.subscribe(() => {
      this.validateStep();
    });
  }

  ngOnInit(): void {
    // Restore saved data
    this.restoreFormData();
  }

  ngOnDestroy(): void {
    this.saveFormData();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private restoreFormData(): void {
    const savedData = this.wizardService.getFormData('prohibitedItems');
    if (savedData) {
      this.prohibitedItems = savedData.prohibitedItems || [];
      this.acknowledgedProhibited = savedData.acknowledgedProhibited || false;
      console.log('Prohibited items form data restored:', savedData);
    }
  }

  private saveFormData(): void {
    this.wizardService.updateFormData('prohibitedItems', {
      prohibitedItems: this.prohibitedItems,
      acknowledgedProhibited: this.acknowledgedProhibited
    });
    console.log('Prohibited items form data saved:', { items: this.prohibitedItems.length, acknowledged: this.acknowledgedProhibited });
  }

  addItem(): void {
    if (this.newItem.name.trim() && this.newItem.category.trim()) {
      this.prohibitedItems.push({
        name: this.newItem.name.trim(),
        category: this.newItem.category.trim()
      });
      this.newItem = { name: '', category: '' };
      this.saveFormData();
      console.log('Item added:', this.prohibitedItems);
    }
  }

  removeItem(index: number): void {
    if (index >= 0 && index < this.prohibitedItems.length) {
      const removed = this.prohibitedItems.splice(index, 1);
      this.saveFormData();
      console.log('Item removed:', removed);
    }
  }

  onAcknowledgeChange(): void {
    this.saveFormData();
  }

  validateStep(): void {
    const isValid = this.prohibitedItems.length === 0 || this.acknowledgedProhibited;
    this.wizardService.setStepValid(isValid);
    console.log('Validation result:', { isValid, itemCount: this.prohibitedItems.length, acknowledged: this.acknowledgedProhibited });
  }

  goBack(): void {
    this.saveFormData();
    const previousStep = this.wizardService.getCurrentStepIndex() - 1;
    if (previousStep >= 0) {
      this.wizardService.requestStepChange(previousStep);
    }
  }

  skipStep(): void {
    this.saveFormData();
    this.wizardService.navigateToNextStep();
  }

  proceedToNext(): void {
    this.validateStep();
    this.saveFormData();
    this.wizardService.navigateToNextStep();
  }
}

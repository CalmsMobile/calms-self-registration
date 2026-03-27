import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WizardService } from '../../../../../core/services/wizard.service';
import { SharedService } from '../../../../../shared/shared.service';
import { TranslatePipe } from '../../../../../shared/pipes/translate.pipe';
import { LanguageSelectorComponent } from '../../../../../shared/components/language-selector/language-selector.component';
import { Subject } from 'rxjs';

interface DeclaredItem {
  description: string;
  serialNumber: string;
  direction: string;
}

@Component({
  selector: 'app-step-prohibited-items',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, LanguageSelectorComponent],
  templateUrl: './step-prohibited-items.component.html',
  styleUrl: './step-prohibited-items.component.scss'
})
export class StepProhibitedItemsComponent implements OnInit, OnDestroy {
  declaredItems: DeclaredItem[] = [];
  newItem = { description: '', serialNumber: '', direction: '' };
  canAdd = false;
  logo = 'assets/logo.png';
  companyTitle = '';

  private destroy$ = new Subject<void>();

  constructor(private wizardService: WizardService, private sharedService: SharedService) {
    this.sharedService.currentLogo.subscribe(logo => this.logo = logo);
    this.sharedService.currentTitle.subscribe(title => this.companyTitle = title);
    this.wizardService.onValidationRequest.subscribe(() => {
      this.validateStep();
    });
  }

  ngOnInit(): void {
    const saved = this.wizardService.getFormData('prohibitedItems');
    if (saved) {
      this.declaredItems = saved.declaredItems || [];
    }
  }

  ngOnDestroy(): void {
    this.saveFormData();
    this.destroy$.next();
    this.destroy$.complete();
  }

  checkInputs(): void {
    this.canAdd = !!this.newItem.description.trim() &&
                  !!this.newItem.serialNumber.trim() &&
                  !!this.newItem.direction;
  }

  addItem(): void {
    if (!this.canAdd) return;
    this.declaredItems.push({ ...this.newItem });
    this.newItem = { description: '', serialNumber: '', direction: '' };
    this.canAdd = false;
    this.saveFormData();
  }

  removeItem(index: number): void {
    this.declaredItems.splice(index, 1);
    this.saveFormData();
  }

  private saveFormData(): void {
    this.wizardService.updateFormData('prohibitedItems', {
      declaredItems: this.declaredItems
    });
  }

  validateStep(): void {
    this.wizardService.setStepValid(true);
  }

  goBack(): void {
    this.saveFormData();
    const prev = this.wizardService.getCurrentStepIndex() - 1;
    if (prev >= 0) this.wizardService.requestStepChange(prev);
  }

  skipStep(): void {
    this.saveFormData();
    this.wizardService.skipToNextStep();
  }

  proceedToNext(): void {
    this.saveFormData();
    this.wizardService.navigateToNextStep();
  }
}

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { WizardService } from '../../../../../core/services/wizard.service';
import { SharedService } from '../../../../../shared/shared.service';
import { LabelService } from '../../../../../core/services/label.service';
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
  imports: [CommonModule, FormsModule, SelectModule, TranslatePipe, LanguageSelectorComponent],
  templateUrl: './step-prohibited-items.component.html',
  styleUrl: './step-prohibited-items.component.scss'
})
export class StepProhibitedItemsComponent implements OnInit, OnDestroy {
  declaredItems: DeclaredItem[] = [];
  newItem = { description: '', serialNumber: '', direction: '' };
  canAdd = false;
  directionOptions = [
    { label: 'IN', value: 'IN' },
    { label: 'OUT', value: 'OUT' }
  ];
  showFieldErrors = false;
  duplicateError = '';

  get partiallyFilled(): boolean {
    const { description, serialNumber, direction } = this.newItem;
    const filled = [!!description.trim(), !!serialNumber.trim(), !!direction];
    return filled.some(v => v) && !filled.every(v => v);
  }

  logo = 'assets/logo.png';
  companyTitle = '';

  get formattedPageTitle(): { first: string; rest: string } {
    const text = this.labelService.getLabel('equipment_movement_page_title', 'caption') || this.wizardService.pageTitle || 'Visitor Registration';
    const i = text.indexOf(' ');
    return i === -1 ? { first: text, rest: '' } : { first: text.substring(0, i), rest: text.substring(i + 1) };
  }

  private destroy$ = new Subject<void>();

  constructor(private wizardService: WizardService, private sharedService: SharedService, private labelService: LabelService) {
    this.sharedService.currentLogo.subscribe(logo => this.logo = logo);
    this.sharedService.currentTitle.subscribe(title => this.companyTitle = title);
    this.wizardService.onValidationRequest.subscribe(() => {
      this.validateStep();
    });
  }

  ngOnInit(): void {
    const saved = this.wizardService.getFormData('prohibitedItems');
    if (saved?.declaredItems?.length) {
      this.declaredItems = saved.declaredItems;
    }
  }

  ngOnDestroy(): void {
    if (this.wizardService.currentBranchID) {
      this.saveFormData();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  checkInputs(): void {
    this.canAdd = !!this.newItem.description.trim() &&
                  !!this.newItem.serialNumber.trim() &&
                  !!this.newItem.direction;
    this.showFieldErrors = this.partiallyFilled;
    this.duplicateError = '';
  }

  addItem(): void {
    if (!this.canAdd) return;
    const isDuplicate = this.declaredItems.some(
      item => item.serialNumber.trim().toLowerCase() === this.newItem.serialNumber.trim().toLowerCase()
           && item.direction === this.newItem.direction
    );
    if (isDuplicate) {
      const template = this.labelService.getLabel('equipment_movement_duplicate_error', 'caption') || `Serial number "{serialNumber}" already exists.`;
      this.duplicateError = template.replace('{serialNumber}', this.newItem.serialNumber);
      return;
    }
    this.duplicateError = '';
    this.declaredItems.push({ ...this.newItem });
    this.newItem = { description: '', serialNumber: '', direction: '' };
    this.canAdd = false;
    this.showFieldErrors = false;
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
    if (this.partiallyFilled) {
      this.showFieldErrors = true;
      return;
    }
    // Auto-add item if all fields are filled
    if (this.canAdd) {
      this.addItem();
    }
    this.saveFormData();
    this.wizardService.navigateToNextStep();
  }
}

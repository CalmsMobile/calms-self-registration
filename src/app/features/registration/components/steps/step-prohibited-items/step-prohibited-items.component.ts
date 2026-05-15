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
  ChecklistSeqId?: number | string;
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
    { label: 'In', value: 'In' },
    { label: 'Out', value: 'Out' }
  ];
  showFieldErrors = false;
  duplicateError = '';

  settings: any = {};

  get isDescMandatory(): boolean { return !!this.settings?.MItemDescMandatory; }
  get isSerialMandatory(): boolean { return !!this.settings?.MSerialNoMandatory; }
  get isTypeMandatory(): boolean { return !!this.settings?.MTypeMandatory; }

  get partiallyFilled(): boolean {
    const { description, serialNumber, direction } = this.newItem;
    const hasAny = !!description.trim() || !!serialNumber.trim() || !!direction;
    const mandatoryOk = (!this.isDescMandatory || !!description.trim()) &&
                        (!this.isSerialMandatory || !!serialNumber.trim()) &&
                        (!this.isTypeMandatory || !!direction);
    return hasAny && !mandatoryOk;
  }

  get continueDisabled(): boolean {
    if (this.declaredItems.length > 0) return false;
    const { description, serialNumber, direction } = this.newItem;
    return (this.isDescMandatory && !description.trim()) ||
           (this.isSerialMandatory && !serialNumber.trim()) ||
           (this.isTypeMandatory && !direction);
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
    this.settings = this.wizardService.getSettings() || {};
    console.log('MItemDescMandatory:', this.settings.MItemDescMandatory);
    console.log('MSerialNoMandatory:', this.settings.MSerialNoMandatory);
    console.log('MTypeMandatory:', this.settings.MTypeMandatory);
    const saved = this.wizardService.getFormData('prohibitedItems');
    if (saved?.declaredItems?.length) {
      this.declaredItems = saved.declaredItems;
    } else {
      const ackData = this.wizardService.getIncomingVisitorAckData();
      const items: any[] = ackData?.itemDeclarationData || [];
      if (items.length) {
        this.declaredItems = items.map((item: any) => ({
          description: item.MaterialDesc || '',
          serialNumber: item.SerialNo || '',
          direction: item.MovementType || '',
          ChecklistSeqId: item.ChecklistSeqId
        }));
        this.saveFormData();
      }
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
    const { description, serialNumber, direction } = this.newItem;
    const hasAny = !!description.trim() || !!serialNumber.trim() || !!direction;
    const mandatoryOk = (!this.isDescMandatory || !!description.trim()) &&
                        (!this.isSerialMandatory || !!serialNumber.trim()) &&
                        (!this.isTypeMandatory || !!direction);
    this.canAdd = hasAny && mandatoryOk;
    this.showFieldErrors = hasAny && !mandatoryOk;
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
    if (this.continueDisabled) {
      this.showFieldErrors = true;
      return;
    }
    if (this.canAdd) {
      this.addItem();
    }
    this.saveFormData();
    this.wizardService.navigateToNextStep();
  }
}

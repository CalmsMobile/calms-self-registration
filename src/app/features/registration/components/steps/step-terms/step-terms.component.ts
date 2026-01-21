import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { WizardService } from '../../../../../core/services/wizard.service';

import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslatePipe } from '../../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-step-terms',
  standalone: true,
  imports: [],
  templateUrl: './step-terms.component.html',
  styleUrls: ['./step-terms.component.scss']
})
export class StepTermsComponent implements OnInit {
  termsAccepted = true; // Auto-accept since user clicked agree button to get here
  @Output() termsStatus = new EventEmitter<boolean>();

  constructor(private wizardService: WizardService, private sanitizer: DomSanitizer) {
  }

  ngOnInit() {
    const settings = this.wizardService.getSettings();
    const termsEnabled = settings?.TermsnCondEnabled || false;
    // Emit terms acceptance after component is initialized
   setTimeout(() => {
    this.termsStatus.emit(termsEnabled ? this.termsAccepted : true);
  }, 0);
  }

  isTermsEnabled(): boolean {
  const settings = this.wizardService.getSettings();
  return settings?.TermsnCondEnabled || false;
}

  getSafeHtml(): SafeHtml {
    const settings = this.wizardService.getSettings();
    if (settings && settings.TermsnCondTemplate) {
      return this.sanitizer.bypassSecurityTrustHtml(settings.TermsnCondTemplate);
    }
    return '';
  }

  validateTerms(): boolean {
    // Always return true since user already agreed to access this step
    return this.termsAccepted;
  }
}

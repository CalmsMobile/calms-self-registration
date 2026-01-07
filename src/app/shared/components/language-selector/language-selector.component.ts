import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ApiService } from '../../../core/services/api.service';
import { LanguageService } from '../../../core/services/language.service';

interface LanguageModel {
  LanguageId: number;
  LanguageName: string;
  LanguageCode: string;
}

@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [SelectModule, FormsModule],
  templateUrl: './language-selector.component.html',
  styleUrl: './language-selector.component.scss'
})
export class LanguageSelectorComponent implements OnInit {
  @Output() languageChange = new EventEmitter<LanguageModel>();

  languages: LanguageModel[] = [];
  selectedLanguage?: LanguageModel;

  constructor(
    private api: ApiService,
    private languageService: LanguageService
  ) { }

  ngOnInit() {
    this.getLanguages();
    
    // Subscribe to language service for updates
    this.languageService.currentLanguage$.subscribe(language => {
      if (language && this.languages.length) {
        // Find matching language in our list
        const matchedLang = this.languages.find(lang => 
          lang.LanguageCode === language.LanguageCode
        );
        if (matchedLang && matchedLang !== this.selectedLanguage) {
          this.selectedLanguage = matchedLang;
        }
      }
    });
  }

  getLanguages() {
    this.api.GetActiveLanguages().subscribe({
      next: (data: any) => {
        if (data?.length) {
          this.languages = data;
          
          // Try to set saved language or default
          const savedLang = this.languageService.getCurrentLanguage();
          if (savedLang) {
            const matchedLang = this.languages.find(lang => 
              lang.LanguageCode === savedLang.LanguageCode
            );
            if (matchedLang) {
              this.selectedLanguage = matchedLang;
              // Don't emit if it's the same as current
              if (savedLang.LanguageId !== matchedLang.LanguageId) {
                this.onLanguageChange({ value: matchedLang });
              }
            }
          } else {
            // No saved language, use first available
            this.selectedLanguage = this.languages[0];
            this.onLanguageChange({ value: this.languages[0] });
          }
        }
      }
    });
  }

  onLanguageChange(event: { value: LanguageModel }): void {
    if (event.value && event.value !== this.languageService.getCurrentLanguage()) {
      this.languageService.setLanguage(event.value);
      this.languageChange.emit(event.value);
    }
  }

}

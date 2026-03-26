import { Component, EventEmitter, Output, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule],
  templateUrl: './language-selector.component.html',
  styleUrl: './language-selector.component.scss'
})
export class LanguageSelectorComponent implements OnInit {
  @Output() languageChange = new EventEmitter<LanguageModel>();

  languages: LanguageModel[] = [];
  selectedLanguage?: LanguageModel;
  showDropdown = false;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('app-language-selector')) {
      this.showDropdown = false;
    }
  }

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

  toggleDropdown() {
    this.showDropdown = !this.showDropdown;
  }

  selectLanguage(lang: LanguageModel) {
    this.selectedLanguage = lang;
    this.languageService.setLanguage(lang);
    this.languageChange.emit(lang);
    this.showDropdown = false;
  }

  getFlagEmoji(languageCode: string): string {
    const countryCode = this.getCountryCode(languageCode);
    return [...countryCode.toUpperCase()].map(c =>
      String.fromCodePoint(127397 + c.charCodeAt(0))
    ).join('');
  }

  getCountryCode(languageCode: string): string {
    if (!languageCode) return '--';
    const map: Record<string, string> = {
      en: 'GB', ta: 'IN', hi: 'IN', te: 'IN', ml: 'IN',
      kn: 'IN', bn: 'BD', fr: 'FR', de: 'DE', es: 'ES',
      pt: 'PT', ru: 'RU', ja: 'JP', ko: 'KR', zh: 'CN',
      ar: 'SA', ms: 'MY', id: 'ID', th: 'TH', vi: 'VN',
      tr: 'TR', it: 'IT', nl: 'NL', pl: 'PL', sv: 'SE'
    };
    const code = languageCode.toLowerCase().split('-')[0];
    return map[code] ?? code.toUpperCase().slice(0, 2);
  }

  onLanguageChange(event: { value: LanguageModel }): void {
    if (event.value && event.value !== this.languageService.getCurrentLanguage()) {
      this.languageService.setLanguage(event.value);
      this.languageChange.emit(event.value);
    }
  }




}

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
  private readonly flagFallbackPath = 'assets/flags/globe.svg';
  private readonly languageToCountryMap: Record<string, string> = {
    en: 'US',
    fr: 'FR',
    de: 'DE',
    es: 'ES',
    pt: 'PT',
    it: 'IT',
    nl: 'NL',
    pl: 'PL',
    sv: 'SE',
    ru: 'RU',
    ar: 'SA',
    hi: 'IN',
    ta: 'IN',
    te: 'IN',
    ml: 'IN',
    kn: 'IN',
    bn: 'BD',
    zh: 'CN',
    ja: 'JP',
    ko: 'KR',
    th: 'TH',
    vi: 'VN',
    ms: 'MY',
    id: 'ID',
    tr: 'TR'
  };

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

  getFlagImageUrl(languageCode?: string | null): string {
    const countryCode = this.resolveCountryCode(languageCode);
    return countryCode ? `https://flagcdn.com/24x18/${countryCode.toLowerCase()}.png` : this.flagFallbackPath;
  }

  onFlagImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image || image.dataset['fallbackApplied'] === 'true') {
      return;
    }

    image.dataset['fallbackApplied'] = 'true';
    image.src = this.flagFallbackPath;
    image.classList.add('is-fallback');
  }

  private resolveCountryCode(languageCode?: string | null): string {
    if (!languageCode) {
      return '';
    }

    const segments = languageCode.toLowerCase().split(/[-_]/).filter(Boolean);
    const languagePart = segments[0];
    const regionPart = segments.find((segment, index) => index > 0 && /^[a-z]{2}$/.test(segment));

    return (regionPart || this.languageToCountryMap[languagePart] || '').toUpperCase();
  }

  onLanguageChange(event: { value: LanguageModel }): void {
    if (event.value && event.value !== this.languageService.getCurrentLanguage()) {
      this.languageService.setLanguage(event.value);
      this.languageChange.emit(event.value);
    }
  }




}

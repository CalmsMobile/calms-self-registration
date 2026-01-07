import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private currentLanguageSubject = new BehaviorSubject<any>(null);
  currentLanguage$ = this.currentLanguageSubject.asObservable();

  constructor(private api: ApiService) {
    this.loadSavedLanguage();
  }

  private loadSavedLanguage() {
    const savedLanguage = localStorage.getItem('selectedLanguage');
    if (savedLanguage) {
      this.currentLanguageSubject.next(JSON.parse(savedLanguage));
    }
  }

  setLanguage(language: any) {
    localStorage.setItem('selectedLanguage', JSON.stringify(language));
    this.currentLanguageSubject.next(language);
  }

  getCurrentLanguage() {
    return this.currentLanguageSubject.value;
  }
}

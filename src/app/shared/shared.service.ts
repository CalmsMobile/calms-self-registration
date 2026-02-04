import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SharedService {

  private titleSource = new BehaviorSubject<string>('Company Title');
  private logoSource = new BehaviorSubject<string>(environment.proURL + 'Handler/PortalImageHandler.ashx?ScreenType=10&RefSlno=10001');
  private accessDeniedSource = new BehaviorSubject<boolean>(false);
  private languageVisibilitySource = new BehaviorSubject<boolean | null>(null);

  currentTitle = this.titleSource.asObservable();
  currentLogo = this.logoSource.asObservable();
  isAccessDenied = this.accessDeniedSource.asObservable();
  languageVisibility$ = this.languageVisibilitySource.asObservable();

  updateHeader(title: string, logoPath: string) {
    this.titleSource.next(title);
    this.logoSource.next(logoPath);
  }

  setAccessDenied(isAccessDenied: boolean) {
    this.accessDeniedSource.next(isAccessDenied);
  }

  setLanguageVisibility(visible: boolean | null) {
    this.languageVisibilitySource.next(visible);
  }
}

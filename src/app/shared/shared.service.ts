import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Title } from '@angular/platform-browser';
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

  constructor(private titleService: Title) {}

  updateHeader(title: string, logoPath: string) {
    // Update BehaviorSubjects for header component
    this.titleSource.next(title);
    this.logoSource.next(logoPath);

    // Update browser tab title
    this.titleService.setTitle(title || 'Visitor Registration');

    // Update favicon (browser tab icon)
    this.updateFavicon(logoPath);

    console.log('Header updated - Title:', title, 'Logo:', logoPath);
  }

  /**
   * Update the browser favicon/shortcut icon
   */
  private updateFavicon(faviconUrl: string): void {
    try {
      // Find existing favicon link or create a new one
      let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      // Update the href
      link.href = faviconUrl;
      console.log('Favicon updated:', faviconUrl);
    } catch (error) {
      console.error('Error updating favicon:', error);
    }
  }

  setAccessDenied(isAccessDenied: boolean) {
    this.accessDeniedSource.next(isAccessDenied);
  }

  setLanguageVisibility(visible: boolean | null) {
    this.languageVisibilitySource.next(visible);
  }
}

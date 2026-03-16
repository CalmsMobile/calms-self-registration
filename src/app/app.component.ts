import { Component, OnInit } from '@angular/core';

import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { StepsModule } from 'primeng/steps';
import { CardModule } from 'primeng/card';
import { filter } from 'rxjs/operators';
import { LanguageSelectorComponent } from './shared/components/language-selector/language-selector.component';
import { LanguageService } from './core/services/language.service';
import { HeaderComponent } from './shared/components/header/header.component';
import { SharedService } from './shared/shared.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, StepsModule, CardModule, LanguageSelectorComponent, HeaderComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'CALMS Self Registration';
  logo = 'calms-technologies.png';
  showLanguageSelector = true;
  showHeader = true;
  isFullWidth = false;
  isApprovalPage = false;

  constructor(
    private router: Router,
    private languageService: LanguageService,
    private sharedService: SharedService
  ) {}

  ngOnInit() {
    // Subscribe to router events to determine when to show language selector
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const urlWithoutParams = event.url.split('?')[0];
      const isApprovalPage = urlWithoutParams === '/appointment-approval';
      // Show language selector only on home page (with or without query params)
      this.showLanguageSelector = !isApprovalPage && (urlWithoutParams === '/' || urlWithoutParams === '/home');
      // Hide app header and use full-width layout on the approval page (it has its own header)
      this.isApprovalPage = isApprovalPage;
      if (isApprovalPage) {
        this.showHeader = false;
        this.isFullWidth = true;
      } else {
        this.isFullWidth = false;
      }
    });

    // Subscribe to access denied state to hide UI elements when access is restricted
    this.sharedService.isAccessDenied.subscribe(isAccessDenied => {
      if (isAccessDenied) {
        this.showHeader = false;
        this.showLanguageSelector = false;
      } else {
        this.showHeader = true;
        // Reset language selector visibility based on current route
        const currentUrl = this.router.url.split('?')[0];
        this.showLanguageSelector = currentUrl === '/' || currentUrl === '/home';
      }
    });

    // Prefer explicit visibility set by pages; fallback to route-based logic when null
    this.sharedService.languageVisibility$.subscribe(vis => {
      if (vis !== null && vis !== undefined) {
        this.showLanguageSelector = vis;
      } else {
        const currentUrl = this.router.url.split('?')[0];
        this.showLanguageSelector = currentUrl === '/' || currentUrl === '/home';
      }
    });
  }

  onLanguageChange(language: any) {
    this.languageService.setLanguage(language);
  }
}


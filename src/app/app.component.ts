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
      // Show language selector only on home page (with or without query params)
      const urlWithoutParams = event.url.split('?')[0];
      this.showLanguageSelector = urlWithoutParams === '/' || urlWithoutParams === '/home';
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
  }

  onLanguageChange(language: any) {
    this.languageService.setLanguage(language);
  }
}


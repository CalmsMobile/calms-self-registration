import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

import { provideHttpClient } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import Material from '@primeng/themes/material';
import { provideClientHydration } from '@angular/platform-browser';
import { ApiService } from './core/services/api.service';
import { SettingsService } from './core/services/settings.service';
import { WizardService } from './core/services/wizard.service';
import { MessageService } from 'primeng/api';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: Material,
      },
    }),
    provideClientHydration(),
    provideHttpClient(),
    provideRouter(routes),

    // Provide your services at the application root level
    ApiService,
    SettingsService,
    WizardService,
    MessageService
  ]
};

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * Loads static front-end configuration from assets/config.json at app startup
 * (via APP_INITIALIZER). Values here are read locally, NOT from the API.
 */
@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private config: Record<string, any> = {};

  constructor(private http: HttpClient) {}

  /** Fetch config.json once during bootstrap. Never rejects — missing file just yields {}. */
  load(): Promise<void> {
    return firstValueFrom(this.http.get<Record<string, any>>('assets/config.json'))
      .then(cfg => { this.config = cfg || {}; })
      .catch(() => { this.config = {}; });
  }

  /** Read a config value by key ('' / undefined when absent). */
  get<T = any>(key: string): T {
    return this.config?.[key];
  }
}

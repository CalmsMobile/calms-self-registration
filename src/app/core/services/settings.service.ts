import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private settingsSubject = new BehaviorSubject<any | null>(null);
  public settings$ = this.settingsSubject.asObservable();

  constructor(private http: HttpClient) { }

  loadSettings(): Observable<any> {
    // For development, load from assets. In production, could be an API call.
    return this.http.get('/assets/settings/app-settings.json').pipe(
      tap(settings => {
        this.settingsSubject.next(settings);
        console.log('Settings loaded:', settings);
      }),
      catchError(error => {
        console.error('Error loading settings:', error);
        // Handle error, maybe load default settings
        this.settingsSubject.next(null); // Or provide default empty settings
        throw error; // Re-throw or return a default/empty observable
      })
    );
  }

  getSettings(): any | null {
    return this.settingsSubject.getValue();
  }
}

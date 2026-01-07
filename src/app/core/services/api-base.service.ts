import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { MessageService } from 'primeng/api';

interface ApiResponse {
  Status: boolean;
  Data?: any;
  Message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ApiBaseService {
  constructor(private http: HttpClient, private messageService: MessageService) {}

  post<T>(url: string, body: any): Observable<T> {
    return this.http.post<T>(url, body).pipe(
      catchError((error: HttpErrorResponse) => {
        this.handleError(error);
        return throwError(() => error);
      }),
      map((response: any) => {
        if (!response || !response[0].Status) {
          // Handle API error with ErrorLog
          const errorLog = response && response[0] && response[0].ErrorLog;
          let errorMessage = 'Invalid response';
          if (Array.isArray(errorLog) && errorLog.length > 0 && errorLog[0].Error) {
            errorMessage = errorLog[0].Error;
          }
          this.messageService.add({
            severity: 'error',
            summary: 'API Error',
            detail: errorMessage,
            life: 5000,
          });
          throw new Error(errorMessage);
        }
        return response[0].Data;
      })
    );
  }

  get<T>(url: string): Observable<T> {
    return this.http.get<T>(url).pipe(
      catchError((error: HttpErrorResponse) => {
        this.handleError(error);
        return throwError(() => error);
      }),
      map((response: any) => {
        if (!response || !response[0].Status) {
          // Handle API error with ErrorLog
          const errorLog = response && response[0] && response[0].ErrorLog;
          let errorMessage = 'Invalid response';
          if (Array.isArray(errorLog) && errorLog.length > 0 && errorLog[0].Error) {
            errorMessage = errorLog[0].Error;
          }
          this.messageService.add({
            severity: 'error',
            summary: 'API Error',
            detail: errorMessage,
            life: 5000,
          });
          throw new Error(errorMessage);
        }
        return JSON.parse(response[0].Data);
      })
    );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Request failed';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Client error: ${error.error.message}`;
    } else {
      errorMessage = `Server error (${error.status}): ${error.message}`;
    }

    this.messageService.add({
      severity: 'error',
      summary: 'API Error',
      detail: errorMessage,
      life: 5000,
    });
  }
}
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FaceValidationResult {
  face_detected: boolean;
  multiple_faces: boolean;
  blur_score: number;
  is_blurry: boolean;
  is_centered: boolean;
  is_sufficient_size: boolean;
  lighting_status: 'ok' | 'too_dark' | 'too_bright';
  glare_detected: boolean;
  occluded: boolean;
  partial_face: boolean;
  eyes_open: boolean;
  feedback: string[];
  stable: boolean;
  face_bbox: number[] | null;
}

@Injectable({ providedIn: 'root' })
export class FaceValidationService {
  private readonly baseUrl = environment.faceValidationUrl;

  constructor(private http: HttpClient) {}

  /** REST call — validate a photo / uploaded file. */
  validatePhoto(file: File): Observable<FaceValidationResult> {
    const formData = new FormData();
    formData.append('image', file, file.name);
    return this.http.post<FaceValidationResult>(`${this.baseUrl}/face-validation/validate`, formData);
  }

  /** Returns a WebSocket connected to the real-time face validation endpoint. */
  createWebSocket(): WebSocket {
    return new WebSocket(environment.faceValidationWsUrl);
  }
}

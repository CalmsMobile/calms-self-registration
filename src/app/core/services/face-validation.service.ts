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

export interface FaceEmbeddingResult {
  face_detected: boolean;
  embedding: number[] | null;
  dimensions: number;
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

  /** REST call — extract the InsightFace embedding (feature vector) for a photo. */
  extractEmbedding(file: File): Observable<FaceEmbeddingResult> {
    const formData = new FormData();
    formData.append('photo', file, file.name);
    return this.http.post<FaceEmbeddingResult>(`${this.baseUrl}/extract-embedding`, formData);
  }

}

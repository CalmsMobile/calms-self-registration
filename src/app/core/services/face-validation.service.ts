import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
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

export interface PassportCropResult {
  method: 'face' | 'person';
  face_detected: boolean;
  head_ratio: number | null;
  crop_box: { x: number; y: number; width: number; height: number };
  output_width: number;
  output_height: number;
  frame_aspect: number;
  image_base64: string;
}

export interface FaceEmbeddingResult {
  face_detected: boolean;
  embedding: number[] | null;
  dimensions: number;
}

export interface BlacklistMatch {
  member_ref_id: string;
  similarity_score: number;
}

export interface BlacklistCheckResult {
  face_detected: boolean;
  is_blacklisted: boolean;
  threshold_used: number;
  matches: BlacklistMatch[];
}

/**
 * Without this, an unreachable service leaves every request hanging until the
 * browser's own TCP timeout (tens of seconds), so the capture dialog sits busy
 * with no way to tell "slow" from "offline". Fail fast instead and let the
 * caller surface it.
 *
 * The live loop polls at 500ms, so its own in-flight guard already prevents
 * pile-up; this cap is for the one-shot validate / crop / embedding calls.
 */
export const FACE_API_TIMEOUT_MS = 8000;

@Injectable({ providedIn: 'root' })
export class FaceValidationService {
  private readonly baseUrl = environment.faceValidationUrl;

  constructor(private http: HttpClient) {}

  /** REST call — validate a photo / uploaded file. */
  validatePhoto(file: File): Observable<FaceValidationResult> {
    const formData = new FormData();
    formData.append('image', file, file.name);
    return this.http.post<FaceValidationResult>(`${this.baseUrl}/face-validation/validate`, formData)
      .pipe(timeout(FACE_API_TIMEOUT_MS));
  }

  /**
   * REST call — crop a photo to passport proportions (head centred and scaled).
   *
   * Defaults to the 120x150 portrait frame (4:5). `validate` is deliberately not
   * sent: the capture flow has already validated the frame, and re-running
   * detection server-side would only double the round-trip.
   */
  passportCrop(file: File, frameWidth = 120, frameHeight = 150): Observable<PassportCropResult> {
    const formData = new FormData();
    formData.append('photo', file, file.name);
    formData.append('frame_width', String(frameWidth));
    formData.append('frame_height', String(frameHeight));
    formData.append('as_json', 'true');
    return this.http.post<PassportCropResult>(`${this.baseUrl}/passportimagecrop`, formData)
      .pipe(timeout(FACE_API_TIMEOUT_MS));
  }

  /** REST call — extract the InsightFace embedding (feature vector) for a photo. */
  extractEmbedding(file: File): Observable<FaceEmbeddingResult> {
    const formData = new FormData();
    formData.append('photo', file, file.name);
    return this.http.post<FaceEmbeddingResult>(`${this.baseUrl}/extract-embedding`, formData)
      .pipe(timeout(FACE_API_TIMEOUT_MS));
  }

  /**
   * REST call — check whether the face in a photo matches a blacklisted member.
   * Accepts a File (sent as `photo`) or a base64 string (sent as `photo_base64`,
   * data: prefix optional) — e.g. a photo that came from the backend. The API
   * rejects requests carrying both fields, so only one is ever appended.
   */
  checkBlacklist(photo: File | string): Observable<BlacklistCheckResult> {
    const formData = new FormData();
    if (typeof photo === 'string') {
      formData.append('photo_base64', photo);
    } else {
      formData.append('photo', photo, photo.name);
    }
    return this.http.post<BlacklistCheckResult>(`${this.baseUrl}/blacklist/check`, formData)
      .pipe(timeout(FACE_API_TIMEOUT_MS));
  }

}

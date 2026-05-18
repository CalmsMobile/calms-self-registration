import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface OcrResult {
  rawText: string;
  structuredData: {
    document_type: string | null;
    country: string | null;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    id_number: string | null;
    document_number: string | null;
    date_of_birth: string | null;
    age: number | null;
    gender: string | null;
    nationality: string | null;
    address: {
      full: string | null;
      line1: string | null;
      line2: string | null;
      city: string | null;
      state: string | null;
      postal_code: string | null;
      country: string | null;
    };
    issue_date: string | null;
    expiry_date: string | null;
    issuing_authority: string | null;
    has_photo: boolean;
  } | null;
  tokenUsage?: { prompt: number; completion: number; total: number };
  processingTimeMs?: number;
}

@Injectable({ providedIn: 'root' })
export class OcrService {
  private http = inject(HttpClient);
  private readonly apiUrl = 'https://api.openai.com/v1/responses';
  private get apiKey(): string {
    return environment.openAiApiKey || localStorage.getItem('ocr_api_key') || '';
  }
  private readonly model = 'gpt-4.1-mini';

  async extractFromDataUrl(dataUrl: string): Promise<OcrResult> {
    const start = performance.now();
    const base64 = dataUrl.split(',')[1];

    const prompt = `You are an AI system that extracts structured identity data directly from images of government-issued documents.

Extract as many of the following fields as possible from the document image.

Return ONLY valid JSON. No explanation. No markdown.

Schema:
{
  "full_name": string | null,
  "id_number": string | null,
  "document_number": string | null,
  "date_of_birth": string | null,
"company_name" : string |null,
  "email": string| null;
  "gender": string | null,
  "address": {
    "full": string | null,
    "line1": string | null,
    "line2": string | null,
    "city": string | null,
    "state": string | null,
    "postal_code": string | null,
    "country": string | null
  },

}

Rules:
- Use YYYY-MM-DD format for dates when possible
- Do not hallucinate missing values — return null if not found
- Extract full_name exactly as printed
- Return gender in English
- in id number remove space or other special characters
- Infer document_type (e.g. "Passport", "Driving License", "National ID")`;

    const payload = {
      model: this.model,
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          { type: 'input_image', image_url: `data:image/jpeg;base64,${base64}` }
        ]
      }],
      temperature: 0,
      max_output_tokens: 400
    };

    const response: any = await firstValueFrom(
      this.http.post(this.apiUrl, payload, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      })
    );

    const rawText = this.extractText(response);
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    let structuredData = null;
    try {
      structuredData = JSON.parse(cleaned);
    } catch {
      console.error('[OcrService] JSON parse failed:', cleaned);
    }

    const usage = response?.usage;
    const processingTimeMs = Math.round(performance.now() - start);

    return {
      rawText,
      structuredData,
      tokenUsage: usage ? {
        prompt: usage.prompt_tokens ?? usage.input_tokens ?? 0,
        completion: usage.completion_tokens ?? usage.output_tokens ?? 0,
        total: usage.total_tokens ?? 0
      } : undefined,
      processingTimeMs
    };
  }

  private extractText(response: any): string {
    if (!response) return '';
    if (typeof response.output_text === 'string') return response.output_text;
    if (Array.isArray(response.output)) {
      const item = response.output
        .flatMap((i: any) => i?.content ?? [])
        .find((c: any) => c?.type === 'output_text');
      if (item?.text) return item.text;
      if (response.output[0]?.content?.[0]?.text) return response.output[0].content[0].text;
    }
    return response?.choices?.[0]?.message?.content ?? '';
  }
}

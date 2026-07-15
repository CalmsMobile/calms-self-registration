import { Pipe, PipeTransform } from '@angular/core';
import { LabelService } from '../../core/services/label.service';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false // Making it impure so it updates when labels change
})
export class TranslatePipe implements PipeTransform {
  constructor(private labelService: LabelService) {}

  transform(key: string, type: 'caption' | 'placeholder' | 'title' = 'caption'): string {
    // Convert key to a standardized format (replace spaces with dots)
    const normalizedKey = this.normalizeKey(key);
    // Return exactly what the API provides — empty stays empty (no fallback)
    return this.labelService.getLabel(normalizedKey, type);
  }

  private normalizeKey(key: string): string {
    // Convert spaces to underscores and remove any extra whitespace
    return key?.trim()?.toLowerCase().replace(/\s+/g, '_');
  }
}

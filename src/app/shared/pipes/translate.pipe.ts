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
    const translation = this.labelService.getLabel(normalizedKey, type);
    if (translation) {
      return translation;
    }
    
    // Fallback: Convert key to readable format
    return this.toReadableText(key);
  }

  private normalizeKey(key: string): string {
    // Convert spaces to underscores and remove any extra whitespace
    return key?.trim()?.toLowerCase().replace(/\s+/g, '_');
  }

  private toReadableText(text: string): string {
    // Handle both dot notation and space-separated keys
    const parts = text?.split(/[\s._-]+/) || [];
    return parts
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

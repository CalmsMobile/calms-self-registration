import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {

  /**
   * Apply dynamic theme values from Table1[0] of GetSelfRegistrationPageSettingData.
   *
   * Fields expected in themeData:
   *  BgImage         – base64 background image string (no data-URI prefix)
   *  BgImageOpacity  – number 0–1.0 for background image opacity
   *  ColorPrimary    – hex/rgb string for primary button background
   *  ColorFg         – hex/rgb string for primary button font color
   *  FontFamily      – CSS font-family string
   */
  applyTheme(themeData: any): void {
    if (!themeData) return;
    const root = document.documentElement;

    // --- Font Family ---
    if (themeData.FontFamily) {
      root.style.setProperty('--font-family', themeData.FontFamily);
    }

    // --- Primary Color (button bg + all PrimeNG primary vars) ---
    if (themeData.ColorPrimary) {
      const primary = themeData.ColorPrimary;
      // Derive hover/active shades by using the same color at lower opacity via CSS
      // (server controls the exact color; we keep hover/active slightly dimmer)
      root.style.setProperty('--theme-primary-yellow', primary);
      root.style.setProperty('--p-primary-color', primary);
      root.style.setProperty('--p-primary-hover-color', primary);
      root.style.setProperty('--p-primary-active-color', primary);
      root.style.setProperty('--p-primary-500', primary);

      // Form control highlights
      root.style.setProperty('--p-inputtext-focus-border-color', primary);
      root.style.setProperty('--p-select-focus-border-color', primary);
      root.style.setProperty('--p-datepicker-focus-border-color', primary);
      root.style.setProperty('--p-checkbox-checked-background', primary);
      root.style.setProperty('--p-checkbox-checked-border-color', primary);
      root.style.setProperty('--p-radiobutton-checked-background', primary);
      root.style.setProperty('--p-radiobutton-checked-border-color', primary);
    }

    // --- Foreground Color (button text for primary buttons) ---
    if (themeData.ColorFg) {
      root.style.setProperty('--theme-primary-fg-color', themeData.ColorFg);
      root.style.setProperty('--p-primary-contrast-color', themeData.ColorFg);
    }

    // --- Background Image (base64) ---
    if (themeData.BgImage) {
      const base64 = themeData.BgImage as string;
      // Detect MIME type from base64 prefix if present; default to jpeg
      let dataUrl: string;
      if (base64.startsWith('data:')) {
        dataUrl = base64;
      } else {
        // Infer type: PNG starts with 'iVBORw0KGgo', others assumed jpeg
        const mime = base64.startsWith('iVBORw0KGgo') ? 'image/png' : 'image/jpeg';
        dataUrl = `data:${mime};base64,${base64}`;
      }
      root.style.setProperty('--app-bg-image', `url("${dataUrl}")`);
    } else {
      root.style.removeProperty('--app-bg-image');
    }

    // --- Background Image Opacity ---
    if (themeData.BgImageOpacity !== undefined && themeData.BgImageOpacity !== null) {
      const opacity = Math.min(100, Math.max(0, Number(themeData.BgImageOpacity)));
      root.style.setProperty('--app-bg-opacity', String(opacity));
    }
  }

  /** Clear all dynamic theme overrides (useful on logout/reset). */
  clearTheme(): void {
    const root = document.documentElement;
    const props = [
      '--font-family',
      '--theme-primary-yellow',
      '--theme-primary-fg-color',
      '--p-primary-color',
      '--p-primary-contrast-color',
      '--p-primary-hover-color',
      '--p-primary-active-color',
      '--p-primary-500',
      '--p-inputtext-focus-border-color',
      '--p-select-focus-border-color',
      '--p-datepicker-focus-border-color',
      '--p-checkbox-checked-background',
      '--p-checkbox-checked-border-color',
      '--p-radiobutton-checked-background',
      '--p-radiobutton-checked-border-color',
      '--app-bg-image',
      '--app-bg-opacity',
    ];
    props.forEach(p => root.style.removeProperty(p));
  }
}

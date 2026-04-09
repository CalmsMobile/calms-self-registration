import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ThemeService } from './theme.service';

interface LabelConfig {
  [key: string]: {
    caption: string;
    placeholder?: string;
    title: string;
    settingType: string;
  };
}

@Injectable({ providedIn: 'root' })
export class LabelService {
  private labels$ = new BehaviorSubject<LabelConfig>({});
  private currentBranch: any;
  private currentLanguage: any;

  constructor(private api: ApiService, private themeService: ThemeService) { }

  /** Reset the branch/language cache so the next loadLabels() call hits the API. */
  resetCache(): void {
    this.currentBranch = null;
    this.currentLanguage = null;
  }

  updateLabels(settings: any[]): void {
    const labelConfig: LabelConfig = {};

    settings.forEach(item => {
      if (item.SettingType === "CP" || item.SettingType === "SW" || item.SettingType === "TC") {
        const titleKey = this.getLabelKey(item);
        const value = {
          caption: item.Caption,
          placeholder: item.Placeholder,
          title: item.Title,
          settingType: item.SettingType
        };

        // Store plain key (e.g. 'branch') — last item wins on collision
        labelConfig[titleKey] = value;

        // Store screen-prefixed key (e.g. 'home_page_branch') — resolves collisions
        if (item.ScreenName) {
          const screenPrefix = item.ScreenName.toLowerCase().replace(/\s+/g, '_');
          labelConfig[`${screenPrefix}_${titleKey}`] = value;
        }
      }
    });

    this.labels$.next(labelConfig);
  }

  private getLabelKey(item: any): string {
    return item.Title.toLowerCase().replace(/\s+/g, '_');
  }

  getLabel(key: string, type: 'caption' | 'placeholder' | 'title' = 'caption'): string {
    return this.labels$.value[key]?.[type] || '';
  }

  getLabels$(): Observable<LabelConfig> {
    return this.labels$.asObservable();
  }

  getCurrentLabels(): LabelConfig {
    return this.labels$.value;
  }

  async loadLabels(branchId: any, languageId: number, refCode?: string): Promise<any> {
    // Skip if same branch and language ID
    if (branchId === this.currentBranch && languageId === this.currentLanguage) {
      return null; // Return null when cached
    }

    this.currentBranch = branchId;
    this.currentLanguage = languageId;

    return new Promise((resolve) => {
      this.api.GetSelfRegistrationPageSettingData(branchId, languageId, refCode)
        .subscribe((settings: any) => {
          const allItems = [...(settings?.Table || []), ...(settings?.Table2 || [])];
          if (allItems.length) {
            this.updateLabels(allItems);
          }
          // Apply dynamic theme from Table1[0]
          if (settings?.Table1?.[0]) {
            this.themeService.applyTheme(settings.Table1[0]);
          }
          resolve(settings); // Return the full response
        });
    });
  }
}

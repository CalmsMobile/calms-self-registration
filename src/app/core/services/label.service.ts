import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ApiService } from './api.service';

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

  constructor(private api: ApiService) { }

  updateLabels(settings: any[]): void {
    const labelConfig: LabelConfig = {};
    
    settings.forEach(item => {
      //if (item.SettingType === "CP" && item.Caption) {
      if (item.SettingType === "CP" || item.SettingType === "SW") {
        const key = this.getLabelKey(item);
        labelConfig[key] = {
          caption: item.Caption,
          placeholder: item.Placeholder,
          title: item.Title,
          settingType: item.SettingType
        };
      }
    });    this.labels$.next(labelConfig);
  }

  private getLabelKey(item: any): string {
    // Convert title to lowercase and replace spaces with underscores
    return item.Title.toLowerCase().replace(/\s+/g, '_');
  }

  getLabel(key: string, type: 'caption' | 'placeholder' | 'title' = 'caption'): string {
    console.log(this.labels$.value);
    return this.labels$.value[key]?.[type] || '';
  }

  getLabels$(): Observable<LabelConfig> {
    return this.labels$.asObservable();
  }

  getCurrentLabels(): LabelConfig {
    return this.labels$.value;
  }

  async loadLabels(branchId: any, languageId: number): Promise<any> {
    // Skip if same branch and language ID
    if (branchId === this.currentBranch && languageId === this.currentLanguage) {
      return null; // Return null when cached
    }

    this.currentBranch = branchId;
    this.currentLanguage = languageId;

    return new Promise((resolve) => {
      this.api.GetSelfRegistrationPageSettingData(branchId, languageId)
        .subscribe((settings: any) => {
          if (settings?.Table?.length) {
            this.updateLabels(settings.Table);
          }
          resolve(settings); // Return the full response
        });
    });
  }
}
import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WizardService } from '../../../../../core/services/wizard.service';
import { SharedService } from '../../../../../shared/shared.service';
import { TranslatePipe } from '../../../../../shared/pipes/translate.pipe';
import { Subject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';

interface DocumentType {
  VisitorAttachSeqId: string;
  Caption: string;
  Mandatory: boolean;
  RefAddVisitorSeqId: number;
}

interface Attachment {
  file: File | null;
  caption: string;
  trackerId?: string;
  uploaded?: boolean;
}

@Component({
  selector: 'app-step-attachments',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './step-attachments.component.html',
  styleUrl: './step-attachments.component.scss'
})
export class StepAttachmentsComponent implements OnInit, OnDestroy {
  @Input() stepSettings: any;
  documentTypes: DocumentType[] = [];

  attachments: { [key: string]: Attachment } = {};
  maxSize = 2000000;
  acceptedTypes = '.pdf,image/*';

  attachmentUploadEnabled = false;
  logo = 'assets/logo.png';
  companyTitle = '';

  private destroy$ = new Subject<void>();

  constructor(
    private wizardService: WizardService,
    private http: HttpClient,
    private sharedService: SharedService
  ) {
    this.wizardService.onValidationRequest.subscribe(() => {
      this.validateStep();
    });
    this.sharedService.currentLogo.subscribe(logo => this.logo = logo);
    this.sharedService.currentTitle.subscribe(title => this.companyTitle = title);
  }

  ngOnInit(): void {
    const mainSettings = this.wizardService.getSettings();
    this.attachmentUploadEnabled = mainSettings?.AttachmentUploadEnabled ?? false;

    const settings = this.wizardService.getAttachmentSettings();

    if (settings && settings.length > 0) {
      this.documentTypes = settings;
      this.documentTypes.forEach(doc => {
        this.attachments[doc.VisitorAttachSeqId] = { file: null, caption: '' };
      });
    }

    this.restoreFormData();
  }

  ngOnDestroy(): void {
    this.saveFormData();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private restoreFormData(): void {
    const savedData = this.wizardService.getFormData('attachments');
    if (savedData?.attachments) {
      Object.keys(savedData.attachments).forEach(docId => {
        if (this.attachments[docId]) {
          this.attachments[docId].caption = savedData.attachments[docId].caption || '';
          this.attachments[docId].trackerId = savedData.attachments[docId].trackerId || undefined;
          this.attachments[docId].uploaded = savedData.attachments[docId].uploaded || false;
          if (savedData.attachments[docId].fileName) {
            this.attachments[docId].file = {
              name: savedData.attachments[docId].fileName,
              size: savedData.attachments[docId].fileSize || 0
            } as File;
          }
        }
      });
    }
  }

  private saveFormData(): void {
    const generateUID = () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });

    const formData: any = { attachments: {} };

    Object.keys(this.attachments).forEach(docId => {
      const attachment = this.attachments[docId];
      if (attachment.file) {
        if (!attachment.trackerId) {
          attachment.trackerId = `${generateUID()}_0`;
        }
        formData.attachments[docId] = {
          caption: attachment.caption,
          fileName: attachment.file.name,
          fileSize: attachment.file.size,
          trackerId: attachment.trackerId,
          uploaded: attachment.uploaded || false
        };
      } else {
        formData.attachments[docId] = {
          caption: attachment.caption,
          fileName: null,
          fileSize: null,
          trackerId: null,
          uploaded: false
        };
      }
    });

    this.wizardService.updateFormData('attachments', formData);
  }

  onFileSelect(event: any, docId: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > this.maxSize) {
      //this.messageService.add({ severity: 'warn', summary: 'File Too Large', detail: `Maximum file size is ${this.maxSize / 1000000}MB. Please select a smaller file.`, life: 4000 });
      input.value = '';
      return;
    }

    if (this.attachments[docId].file) {
      this.removeFile(docId);
    }

    const generateUID = () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });

    const trackerId = `${generateUID()}_0`;
    this.attachments[docId].file = file;
    this.attachments[docId].trackerId = trackerId;
    this.attachments[docId].uploaded = false;

    this.uploadFileToHandler(file, trackerId, docId);
    input.value = '';
  }

  private uploadFileToHandler(file: File, trackerId: string, docId: string): void {
    const formData = new FormData();
    formData.append('trackerId', trackerId);
    formData.append('temp', file, file.name);

    const uploadUrl = `${environment.proURL}Handler/ImageChunkHandler.ashx?op=profile&ac=upload&nologin=1&isResize=1`;

    this.http.post(uploadUrl, formData).subscribe({
      next: () => {
        this.attachments[docId].uploaded = true;
        this.saveFormData();
      },
      error: () => {
        this.attachments[docId].uploaded = false;
      }
    });
  }

  removeFile(docId: string): void {
    this.attachments[docId].file = null;
    this.attachments[docId].trackerId = undefined;
    this.attachments[docId].uploaded = false;
    this.saveFormData();
  }

  validateStep(): void {
    const isValid = this.attachmentUploadEnabled
      ? this.documentTypes.filter(d => d.Mandatory).every(d => this.attachments[d.VisitorAttachSeqId].file !== null)
      : true;
    this.wizardService.setStepValid(isValid);
    if (isValid) this.saveFormData();
  }

  goBack(): void {
    this.saveFormData();
    const prev = this.wizardService.getCurrentStepIndex() - 1;
    if (prev >= 0) this.wizardService.requestStepChange(prev);
  }

  skipStep(): void {
    this.saveFormData();
    this.wizardService.skipToNextStep();
  }

  get hasMandatoryDocuments(): boolean {
    return this.attachmentUploadEnabled && this.documentTypes.some(d => d.Mandatory);
  }

  proceedToNext(): void {
    this.validateStep();
    this.saveFormData();
    this.wizardService.navigateToNextStep();
  }
}

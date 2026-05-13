import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WizardService } from '../../../../../core/services/wizard.service';
import { SharedService } from '../../../../../shared/shared.service';
import { LabelService } from '../../../../../core/services/label.service';
import { MessageHelperService } from '../../../../../core/services/message-helper.service';
import { TranslatePipe } from '../../../../../shared/pipes/translate.pipe';
import { LanguageSelectorComponent } from '../../../../../shared/components/language-selector/language-selector.component';
import { Subject, takeUntil } from 'rxjs';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';

interface DocumentType {
  VisitorAttachSeqId: string;
  Caption: string;
  Mandatory: boolean;
  RefAddVisitorSeqId: number;
  FileBase64?: string;
  FileName?: string;
}

interface Attachment {
  file: File | null;
  caption: string;
  trackerId?: string;
  uploaded?: boolean;
  uploadProgress?: number;
  docPath?: string;   // pre-existing server path from appointment flow
}

@Component({
  selector: 'app-step-attachments',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, LanguageSelectorComponent],
  templateUrl: './step-attachments.component.html',
  styleUrl: './step-attachments.component.scss'
})
export class StepAttachmentsComponent implements OnInit, OnDestroy {
  @Input() stepSettings: any;
  documentTypes: DocumentType[] = [];

  attachments: { [key: string]: Attachment } = {};
  maxSize = 2000000;
  acceptedTypes = '.pdf,.jpg,.jpeg,.png';

  attachmentUploadEnabled = false;
  logo = 'assets/logo.png';
  companyTitle = '';

  get formattedPageTitle(): { first: string; rest: string } {
    const text = this.labelService.getLabel('documents_upload_page_title', 'caption') || this.wizardService.pageTitle || 'Visitor Registration';
    const i = text.indexOf(' ');
    return i === -1 ? { first: text, rest: '' } : { first: text.substring(0, i), rest: text.substring(i + 1) };
  }

  private destroy$ = new Subject<void>();

  constructor(
    private wizardService: WizardService,
    private http: HttpClient,
    private sharedService: SharedService,
    private messageHelper: MessageHelperService,
    private labelService: LabelService
  ) {
    this.sharedService.currentLogo.subscribe(logo => this.logo = logo);
    this.sharedService.currentTitle.subscribe(title => this.companyTitle = title);
  }

  ngOnInit(): void {
    // Subscribe here (not constructor) so takeUntil properly cleans it up on destroy
    this.wizardService.onValidationRequest
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.validateStep());

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
    // Only save if the wizard session is still active.
    // clearSessionStorage() sets currentBranchID to '' — if empty, submission already
    // cleared everything and we must NOT write stale data back into formDataStore.
    if (this.wizardService.currentBranchID) {
      this.saveFormData();
    }
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
          this.attachments[docId].docPath = savedData.attachments[docId].docPath || undefined;
          if (savedData.attachments[docId].fileName) {
            this.attachments[docId].file = {
              name: savedData.attachments[docId].fileName,
              size: savedData.attachments[docId].fileSize || 0
            } as File;
          }
        }
      });
      return;
    }

    // No saved data — pre-fill from appointment ack docs
    const ackData = this.wizardService.getIncomingVisitorAckData();
    const docsData: any[] = ackData?.docsData || [];
    if (!docsData.length) return;

    // Build a lookup: integer seqId → attachments key (handles "106" vs "106.0" keys)
    const attachmentKeys = Object.keys(this.attachments);
    const keyBySeqId = new Map<number, string>();
    attachmentKeys.forEach(k => {
      const n = parseInt(k);
      if (!isNaN(n)) keyBySeqId.set(n, k);
    });

    docsData.forEach((doc: any) => {
      const docPath = doc.DocPath || doc.FilePath || doc.FileUrl || '';
      const fileName = docPath ? docPath.replace(/\\/g, '/').split('/').pop() || 'document' : '';
      // API returns RefVisitorAttachSeqId (matches VisitorAttachSeqId in doc type settings)
      const refId = parseInt(doc.RefVisitorAttachSeqId ?? doc.VisitorAttachSeqId ?? '');
      const docId = !isNaN(refId) ? keyBySeqId.get(refId) : null;

      if (docId) {
        this.attachments[docId].file = { name: fileName, size: 0 } as File;
        this.attachments[docId].uploaded = true;
        this.attachments[docId].docPath = docPath;
        this.attachments[docId].caption = doc.Caption || '';
      }
    });
    this.saveFormData();
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
          uploaded: attachment.uploaded || false,
          docPath: attachment.docPath || null
        };
      } else {
        formData.attachments[docId] = {
          caption: attachment.caption,
          fileName: null,
          fileSize: null,
          trackerId: null,
          uploaded: false,
          docPath: null
        };
      }
    });

    this.wizardService.updateFormData('attachments', formData);
  }

  onFileSelect(event: any, docId: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      const typeMsg = this.labelService.getLabel('documents_upload_file_invalid_alert', 'caption') || 'Only PDF, JPG, JPEG, PNG, DOC, and DOCX files are allowed.';
      this.messageHelper.warn(typeMsg, 4000);
      input.value = '';
      return;
    }

    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    if (nameWithoutExt.length > 50) {
      const nameMsg = this.labelService.getLabel('documents_upload_file_name_invalid_alert', 'caption') || 'File name must not exceed 50 characters.';
      this.messageHelper.warn(nameMsg, 4000);
      input.value = '';
      return;
    }

    if (file.size > this.maxSize) {
      const alertTemplate = this.labelService.getLabel('documents_upload_max_size_alert_message', 'caption') || `Maximum file size is {maxSize} MB. Please select a smaller file.`;
      const alertDetail = alertTemplate.replace('{maxSize}', (this.maxSize / 1000000).toString());
      this.messageHelper.warn(alertDetail, 4000);
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

    this.attachments[docId].uploadProgress = 0;

    this.http.post(uploadUrl, formData, { reportProgress: true, observe: 'events' }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (event: any) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.attachments[docId].uploadProgress = Math.round(100 * event.loaded / event.total);
        } else if (event.type === HttpEventType.Response) {
          this.attachments[docId].uploadProgress = 100;
          this.attachments[docId].uploaded = true;
          this.saveFormData();
        }
      },
      error: () => {
        this.attachments[docId].uploaded = false;
        this.attachments[docId].uploadProgress = undefined;
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

  getMaxSizeLabel(): string {
    const template = this.labelService.getLabel('documents_upload_max_size_label', 'caption');
    if (template) {
      return template.replace('{maxSize}', (this.maxSize / 1000000).toString());
    }
    return `Max size: ${this.maxSize / 1000000}MB (.pdf, images)`;
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

  get allMandatoryUploaded(): boolean {
    if (!this.attachmentUploadEnabled) return true;
    return this.documentTypes
      .filter(d => d.Mandatory)
      .every(d => {
        const att = this.attachments[d.VisitorAttachSeqId];
        return att?.file !== null && att?.uploaded === true;
      });
  }

  proceedToNext(): void {
    this.validateStep();
    this.saveFormData();
    this.wizardService.navigateToNextStep();
  }

  getDownloadUrl(filePath: string): string {
    return `${environment.proURL}${filePath.replace(/\\/g, '/')}`;
  }
}

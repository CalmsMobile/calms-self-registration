import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { FileUploadModule } from 'primeng/fileupload';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { PanelModule } from 'primeng/panel';
import { TableModule } from 'primeng/table';
import { CheckboxModule } from 'primeng/checkbox';
import { Select } from 'primeng/select';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { WizardService } from '../../../../../core/services/wizard.service';

import { TranslatePipe } from '../../../../../shared/pipes/translate.pipe';
import { Subject, takeUntil } from 'rxjs';
import { HttpClient } from '@angular/common/http';

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
  imports: [FileUploadModule, InputTextModule, ButtonModule, TableModule, TranslatePipe, FormsModule, ConfirmDialogModule, PanelModule, CheckboxModule, Select],
  templateUrl: './step-attachments.component.html',
  styleUrl: './step-attachments.component.scss',
  providers: [ConfirmationService]
})
export class StepAttachmentsComponent implements OnInit, OnDestroy {
  @Input() stepSettings: any;
  documentTypes: DocumentType[] = [];

  attachments: { [key: string]: Attachment } = {};
  maxSize = 2000000;
  acceptedTypes = 'image/*, .pdf';
  
  attachmentUploadEnabled = false;
  materialDeclareEnabled = false;
  
  private destroy$ = new Subject<void>();

  constructor(
    private wizardService: WizardService, 
    private messageService: MessageService, 
    private confirmationService: ConfirmationService,
    private http: HttpClient
  ) {
    this.wizardService.onValidationRequest.subscribe(() => {
      this.validateStep();
    });
  }

  ngOnInit(): void {
    const mainSettings = this.wizardService.getSettings();
    this.attachmentUploadEnabled = mainSettings?.AttachmentUploadEnabled ?? false;
    this.materialDeclareEnabled = mainSettings?.MaterialDeclareEnabled ?? false;

    const settings = this.wizardService.getAttachmentSettings();

    if(!settings || settings.length === 0) {
      this.wizardService.gotoHomePage();
      return;
    }
    this.documentTypes = settings;

    // Initialize attachments object
    this.documentTypes.forEach(doc => {
      this.attachments[doc.VisitorAttachSeqId] = {
        file: null,
        caption: ''
      };
    });

    // Restore saved data
    this.restoreFormData();
  }

  ngOnDestroy(): void {
    this.saveFormData();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private restoreFormData(): void {
    const savedData = this.wizardService.getFormData('attachments');
    if (savedData) {
      // Restore item declaration data
      this.nothingToDeclare = savedData.nothingToDeclare || false;
      this.declaredItems = savedData.declaredItems || [];
      
      // Restore attachment captions and file references
      if (savedData.attachments) {
        Object.keys(savedData.attachments).forEach(docId => {
          if (this.attachments[docId]) {
            this.attachments[docId].caption = savedData.attachments[docId].caption || '';
            this.attachments[docId].trackerId = savedData.attachments[docId].trackerId || undefined;
            this.attachments[docId].uploaded = savedData.attachments[docId].uploaded || false;
            
            // Note: File objects cannot be restored from storage, 
            // but we can show that they were uploaded previously
            if (savedData.attachments[docId].fileName) {
              // Create a placeholder to indicate file was uploaded
              this.attachments[docId].file = {
                name: savedData.attachments[docId].fileName,
                size: savedData.attachments[docId].fileSize || 0
              } as File;
            }
          }
        });
      }
    }
  }

  private saveFormData(): void {
    const formData = {
      nothingToDeclare: this.nothingToDeclare,
      declaredItems: this.declaredItems,
      attachments: {} as any
    };

    // Generate UUID for tracker ID
    const generateUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    // Save attachment data (captions and file info)
    Object.keys(this.attachments).forEach(docId => {
      const attachment = this.attachments[docId];
      if (attachment.file) {
        // Generate trackerId if not exists
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
        // Keep empty structure for documents without files
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

  nothingToDeclare: boolean = false;
  declaredItems: any[] = [];
  newItem: any = {
    description: '',
    serialNumber: '',
    direction: 'IN'
  };

  directionOptions = [
    { label: 'Bringing In', value: 'IN' },
    { label: 'Taking Out', value: 'OUT' }
  ];

  onNothingToDeclareChange() {
    if (this.nothingToDeclare) {
      this.declaredItems = [];
    }
    this.saveFormData(); // Save immediately when changed
  }

  addItem() {
    if (this.newItem.description) {
      this.declaredItems.push({ ...this.newItem });
      this.newItem = {
        description: '',
        serialNumber: '',
        direction: 'IN'
      };
      this.saveFormData(); // Save immediately when item added
    }
  }

  removeItem(index: number) {
    this.declaredItems.splice(index, 1);
    this.saveFormData(); // Save immediately when item removed
  }

  getDirectionLabel(value: string): string {
    const option = this.directionOptions.find(opt => opt.value === value);
    return option ? option.label : '';
  }

  onFileSelect(event: any, docId: string): void {
    const file = event.files[0];
    if (file) {
      // Generate trackerId
      const generateUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };
      
      const trackerId = `${generateUID()}_0`;
      
      // Store file temporarily
      this.attachments[docId].file = file;
      this.attachments[docId].trackerId = trackerId;
      this.attachments[docId].uploaded = false;
      
      // Upload to ImageChunkHandler
      this.uploadFileToHandler(file, trackerId, docId);
    }
  }

  private uploadFileToHandler(file: File, trackerId: string, docId: string): void {
    const formData = new FormData();
    formData.append('trackerId', trackerId);
    formData.append('temp', file, file.name);
    
    // Use the endpoint you specified
    const uploadUrl = 'http://localhost:7222/Handler/ImageChunkHandler.ashx?op=profile&ac=upload&nologin=1&isResize=1';
    
    this.http.post(uploadUrl, formData).subscribe({
      next: (response: any) => {
        // Mark as uploaded
        this.attachments[docId].uploaded = true;
        this.saveFormData();
        
        this.messageService.add({
          severity: 'success',
          summary: 'File Uploaded',
          detail: `${file.name} uploaded successfully`
        });
      },
      error: (error) => {
        console.error('Upload failed:', error);
        
        // Remove file on upload failure
        this.attachments[docId].file = null;
        this.attachments[docId].trackerId = undefined;
        this.attachments[docId].uploaded = false;
        
        this.messageService.add({
          severity: 'error',
          summary: 'Upload Failed',
          detail: `Failed to upload ${file.name}. Please try again.`
        });
      }
    });
  }

  confirmDelete(docId: string): void {
    this.confirmationService.confirm({
      message: 'Are you sure you want to delete this file?',
      header: 'Confirm Deletion',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.removeFile(docId);
      }
    });
  }

  removeFile(docId: string): void {
    this.attachments[docId].file = null;
    this.attachments[docId].trackerId = undefined;
    this.attachments[docId].uploaded = false;
    this.saveFormData(); // Save immediately when file removed
    this.messageService.add({
      severity: 'info',
      summary: 'File Removed',
      detail: 'You can upload a new file'
    });
  }

  getRequiredDocuments(): DocumentType[] {
    return this.documentTypes.filter(doc => doc.Mandatory);
  }

  validateAttachments(): boolean {
    const requiredDocs = this.getRequiredDocuments();
    return requiredDocs.every(doc => this.attachments[doc.VisitorAttachSeqId].file !== null);
  }

  validateStep(): void {
    const attachmentsValid = this.attachmentUploadEnabled ? this.validateAttachments() : true;
    const itemDeclarationValid = this.materialDeclareEnabled ? this.validateItemDeclaration() : true;
    
    const isValid = attachmentsValid && itemDeclarationValid;
    this.wizardService.setStepValid(isValid);

    if (!attachmentsValid) {
      const missingDocs = this.getRequiredDocuments()
        .filter(doc => !this.attachments[doc.VisitorAttachSeqId].file)
        .map(doc => doc.Caption);

      this.messageService.add({
        severity: 'error',
        summary: 'Missing Documents',
        detail: `Please upload: ${missingDocs.join(', ')}`
      });
    }

    if (!itemDeclarationValid) {
      this.messageService.add({
        severity: 'error',
        summary: 'Item Declaration Required',
        detail: 'Please either check "I have nothing to declare" or add items to declare'
      });
    }

    if (isValid) {
      this.saveFormData(); // Save when validation passes
    }
  }

  private validateItemDeclaration(): boolean {
    // Valid if either nothing to declare is checked OR items are declared
    return this.nothingToDeclare || this.declaredItems.length > 0;
  }
}

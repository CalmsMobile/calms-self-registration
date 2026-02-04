import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WizardService } from '../../../../../core/services/wizard.service';
import { TranslatePipe } from '../../../../../shared/pipes/translate.pipe';
import { Subject, takeUntil } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

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
  materialDeclareEnabled = false;

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

  private destroy$ = new Subject<void>();

  constructor(
    private wizardService: WizardService,
    private http: HttpClient,
    private router: Router
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

    if (!settings || settings.length === 0) {
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
      this.nothingToDeclare = savedData.nothingToDeclare || false;
      this.declaredItems = savedData.declaredItems || [];
      
      if (savedData.attachments) {
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
      console.log('Form data restored:', savedData);
    }
  }

  private saveFormData(): void {
    const formData = {
      nothingToDeclare: this.nothingToDeclare,
      declaredItems: this.declaredItems,
      attachments: {} as any
    };

    const generateUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

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

  onNothingToDeclareChange() {
    if (this.nothingToDeclare) {
      this.declaredItems = [];
    }
    this.saveFormData();
    console.log('Nothing to declare changed:', this.nothingToDeclare);
  }

  addItem() {
    if (this.newItem.description.trim()) {
      this.declaredItems.push({ ...this.newItem });
      this.newItem = {
        description: '',
        serialNumber: '',
        direction: 'IN'
      };
      this.saveFormData();
      console.log('Item added to declaration:', this.declaredItems);
    }
  }

  removeItem(index: number) {
    if (index >= 0 && index < this.declaredItems.length) {
      const removed = this.declaredItems.splice(index, 1);
      this.saveFormData();
      console.log('Item removed from declaration:', removed);
    }
  }

  getDirectionLabel(value: string): string {
    const option = this.directionOptions.find(opt => opt.value === value);
    return option ? option.label : '';
  }

  onFileSelect(event: any, docId: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (file) {
      // Validate file size
      if (file.size > this.maxSize) {
        console.error('File size exceeds limit');
        return;
      }

      // Check if file is already selected
      if (this.attachments[docId].file) {
        // Delete old file first
        this.removeFile(docId);
      }

      const generateUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };
      
      const trackerId = `${generateUID()}_0`;
      this.attachments[docId].file = file;
      this.attachments[docId].trackerId = trackerId;
      this.attachments[docId].uploaded = false;
      
      this.uploadFileToHandler(file, trackerId, docId);
      
      // Reset input value to allow re-selection of same file
      input.value = '';
    }
  }

  private uploadFileToHandler(file: File, trackerId: string, docId: string): void {
    const formData = new FormData();
    formData.append('trackerId', trackerId);
    formData.append('temp', file, file.name);
    
    const uploadUrl = 'http://localhost:7222/Handler/ImageChunkHandler.ashx?op=profile&ac=upload&nologin=1&isResize=1';
    
    console.log(`Starting file upload for docId: ${docId}`, { fileName: file.name, fileSize: file.size, trackerId });
    
    this.http.post(uploadUrl, formData).subscribe({
      next: (response: any) => {
        this.attachments[docId].uploaded = true;
        this.saveFormData();
        console.log(`File uploaded successfully for docId: ${docId}`, response);
      },
      error: (error) => {
        console.error(`Upload failed for docId: ${docId}`, error);
        this.attachments[docId].file = null;
        this.attachments[docId].trackerId = undefined;
        this.attachments[docId].uploaded = false;
      }
    });
  }

  removeFile(docId: string): void {
    this.attachments[docId].file = null;
    this.attachments[docId].trackerId = undefined;
    this.attachments[docId].uploaded = false;
    this.saveFormData();
    console.log(`File removed for document: ${docId}`);
  }

  getRequiredDocuments(): DocumentType[] {
    return this.documentTypes.filter(doc => doc.Mandatory);
  }

  validateAttachments(): boolean {
    const requiredDocs = this.getRequiredDocuments();
    return requiredDocs.every(doc => this.attachments[doc.VisitorAttachSeqId].file !== null);
  }

  private validateItemDeclaration(): boolean {
    return this.nothingToDeclare || this.declaredItems.length > 0;
  }

  validateStep(): void {
    const attachmentsValid = this.attachmentUploadEnabled ? this.validateAttachments() : true;
    const itemDeclarationValid = this.materialDeclareEnabled ? this.validateItemDeclaration() : true;
    
    const isValid = attachmentsValid && itemDeclarationValid;
    this.wizardService.setStepValid(isValid);

    if (isValid) {
      this.saveFormData();
    }
  }

  goBack(): void {
    this.saveFormData();
    const previousStep = this.wizardService.getCurrentStepIndex() - 1;
    if (previousStep >= 0) {
      this.wizardService.requestStepChange(previousStep);
    }
  }

  skipStep(): void {
    this.saveFormData();
    this.wizardService.navigateToNextStep();
  }

  proceedToNext(): void {
    this.validateStep();
    this.saveFormData();
    this.wizardService.navigateToNextStep();
  }
}

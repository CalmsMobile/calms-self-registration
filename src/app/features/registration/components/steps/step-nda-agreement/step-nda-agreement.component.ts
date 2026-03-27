import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewInit,
  HostListener
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject, takeUntil } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { WizardService } from '../../../../../core/services/wizard.service';
import { SharedService } from '../../../../../shared/shared.service';
import { TranslatePipe } from '../../../../../shared/pipes/translate.pipe';
import { LanguageSelectorComponent } from '../../../../../shared/components/language-selector/language-selector.component';

@Component({
  selector: 'app-step-nda-agreement',
  standalone: true,
  imports: [ToastModule, TranslatePipe, LanguageSelectorComponent],
  templateUrl: './step-nda-agreement.component.html',
  styleUrls: ['./step-nda-agreement.component.scss']
})
export class StepNdaAgreementComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('signatureCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('termsBox') termsBoxRef?: ElementRef<HTMLDivElement>;

  private ctx!: CanvasRenderingContext2D;
  private isDrawing = false;
  hasSigned = false;
  private destroy$ = new Subject<void>();
  showValidationError = false;
  showSignatureModal = false;
  ndaScrolledToBottom = false;
  illustrationUrl = '/assets/sign.png';
  logo = 'assets/logo.png';
  companyTitle = '';

  /** Restored base64 signature (if user navigated back) */
  restoredSignature = '';

  constructor(
    private wizardService: WizardService,
    private sanitizer: DomSanitizer,
    private messageService: MessageService,
    private sharedService: SharedService
  ) {
    this.sharedService.currentLogo.subscribe(logo => this.logo = logo);
    this.sharedService.currentTitle.subscribe(title => this.companyTitle = title);
  }

  ngOnInit(): void {
    // Redirect to home if settings aren't loaded
    const settings = this.wizardService.getSettings();
    if (!settings) {
      this.wizardService.gotoHomePage();
      return;
    }

    // Listen for validation requests from the wizard container
    this.wizardService.onValidationRequest
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.validate());
  }

  ngAfterViewInit(): void {
    this.initCanvas();
    this.restoreSavedSignature();
    setTimeout(() => {
      const el = this.termsBoxRef?.nativeElement;
      if (el && el.scrollHeight <= el.clientHeight + 4) {
        this.ndaScrolledToBottom = true;
      }
    }, 150);
  }

  ngOnDestroy(): void {
    this.saveFormData();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---------- NDA content ----------

  getNdaHtml(): SafeHtml {
    const settings = this.wizardService.getSettings();
    if (settings?.NdaTemplate) {
      return this.sanitizer.bypassSecurityTrustHtml(settings.NdaTemplate);
    }
    return '';
  }

  isNdaEnabled(): boolean {
    const settings = this.wizardService.getSettings();
    return !!settings?.NDAEnabled;
  }

  // ---------- Canvas / Signature Pad ----------

  private initCanvas(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    this.ctx = canvas.getContext('2d')!;
    this.resizeCanvas();

    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  /** Resize canvas to match its CSS size so strokes aren't blurry */
  private resizeCanvas(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Re-apply stroke settings after resize (canvas resets on dimension change)
    if (this.ctx) {
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 2;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    // Save current signature as image before resize
    const dataUrl = this.hasSigned ? this.canvasRef?.nativeElement.toDataURL() : null;
    this.resizeCanvas();

    // Redraw if there was a signature
    if (dataUrl && this.hasSigned) {
      const img = new Image();
      img.onload = () => this.ctx.drawImage(img, 0, 0);
      img.src = dataUrl;
    }
  }

  // --- Mouse events ---
  onMouseDown(event: MouseEvent): void {
    this.startDrawing(event.offsetX, event.offsetY);
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.isDrawing) return;
    this.draw(event.offsetX, event.offsetY);
  }

  onMouseUp(): void {
    this.stopDrawing();
  }

  onMouseLeave(): void {
    this.stopDrawing();
  }

  // --- Touch events ---
  onTouchStart(event: TouchEvent): void {
    event.preventDefault();
    const touch = event.touches[0];
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.startDrawing(touch.clientX - rect.left, touch.clientY - rect.top);
  }

  onTouchMove(event: TouchEvent): void {
    event.preventDefault();
    if (!this.isDrawing) return;
    const touch = event.touches[0];
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.draw(touch.clientX - rect.left, touch.clientY - rect.top);
  }

  onTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    this.stopDrawing();
  }

  // --- Drawing helpers ---
  private startDrawing(x: number, y: number): void {
    this.isDrawing = true;
    this.hasSigned = true;
    this.showValidationError = false;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  }

  private draw(x: number, y: number): void {
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
  }

  private stopDrawing(): void {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.ctx.closePath();
    }
  }

  onTermsScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + 20) {
      this.ndaScrolledToBottom = true;
    }
  }

  goBack(): void {
    this.saveFormData();
    const prev = this.wizardService.getCurrentStepIndex() - 1;
    if (prev >= 0) this.wizardService.requestStepChange(prev);
  }

  mobileNext(): void {
    if (this.hasSigned) {
      this.showValidationError = false;
      this.saveFormData();
      this.wizardService.setStepValid(true);
      this.wizardService.navigateToNextStep();
    } else {
      this.showValidationError = true;
    }
  }

  openSignature(): void {
    this.showSignatureModal = true;
    // Re-init canvas after modal becomes visible
    setTimeout(() => {
      this.initCanvas();
      if (this.restoredSignature) {
        const img = new Image();
        img.onload = () => this.ctx.drawImage(img, 0, 0);
        img.src = this.restoredSignature;
      }
    }, 50);
  }

  closeSignature(): void {
    this.showSignatureModal = false;
  }

  submitSignature(): void {
    this.showSignatureModal = false;
    if (this.hasSigned) {
      this.restoredSignature = this.getSignatureDataUrl();
      this.showValidationError = false;
      this.saveFormData();
      this.wizardService.setStepValid(true);
      this.wizardService.navigateToNextStep();
    }
  }

  /** Clear the signature canvas */
  clearSignature(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.hasSigned = false;
    this.restoredSignature = '';
  }

  /** Get signature as base64-encoded PNG data URL */
  getSignatureDataUrl(): string {
    if (!this.hasSigned) return '';
    return this.canvasRef.nativeElement.toDataURL('image/png');
  }

  // ---------- Validation / Data persistence ----------

  private validate(): void {
    if (this.hasSigned) {
      this.showValidationError = false;
      this.saveFormData();
      this.wizardService.setStepValid(true);
    } else {
      this.showValidationError = true;
      this.wizardService.setStepValid(false);
      this.messageService.add({
        severity: 'error',
        summary: 'Signature Required',
        detail: 'Please draw your signature before proceeding.',
        life: 5000
      });
    }
  }

  private saveFormData(): void {
    const signatureDataUrl = this.getSignatureDataUrl();
    this.wizardService.updateFormData('nda-agreement', {
      ndaSignature: signatureDataUrl,
      ndaAccepted: this.hasSigned
    });
  }

  private restoreSavedSignature(): void {
    const saved = this.wizardService.getFormData('nda-agreement');
    if (saved?.ndaSignature) {
      this.restoredSignature = saved.ndaSignature;
      this.hasSigned = true;
      this.ndaScrolledToBottom = true;

      // Draw the saved signature onto the canvas
      const img = new Image();
      img.onload = () => {
        this.ctx.drawImage(img, 0, 0);
      };
      img.src = saved.ndaSignature;
    }
  }
}

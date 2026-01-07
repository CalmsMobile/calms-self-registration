import { Component, ElementRef, ViewChild, AfterViewInit, HostListener } from '@angular/core';
import { WizardService } from '../../../../../core/services/wizard.service';

import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { TranslatePipe } from '../../../../../shared/pipes/translate.pipe';
import { environment } from '../../../../../../environments/environment';

@Component({
  selector: 'app-step-safety-brief',
  templateUrl: './step-safety-brief.component.html',
  styleUrls: ['./step-safety-brief.component.scss'],
  imports: [ButtonModule, ToastModule, TranslatePipe]
})
export class StepSafetyBriefComponent implements AfterViewInit {
  @ViewChild('safetyVideo') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('videoContainer') videoContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('playButton') playButton!: ElementRef<HTMLButtonElement>;

  videoEnded = false;
  showReplay = false;
  showPlayButton = true;
  isFullscreen = false;
  videoSource = '';

  constructor(
    private wizardService: WizardService,
    private messageService: MessageService
  ) {
    // Subscribe to validation requests from wizard
    this.wizardService.onValidationRequest.subscribe(() => {
      this.validateStep();
    });
  }

  ngOnInit() {
    const videoSettings = this.wizardService.getSettings();
    if (videoSettings?.SafetyBriefVideoEnabled && videoSettings.VideoUrl) {
      this.videoSource = environment.proURL + 'FS/' + videoSettings.VideoUrl;
    } else {
      //this.wizardService.gotoHomePage();
      this.messageService.add({
        severity: 'warn',
        summary: 'Warning',
        detail: 'Safety briefing video is not available.'
      });
    }

    // Restore previous completion status
    const savedData = this.wizardService.getFormData('safetyBrief');
    if (savedData?.videoWatched) {
      this.videoEnded = true;
      this.showReplay = true;
      this.showPlayButton = false;
    }
  }

  ngAfterViewInit(): void {
    this.setupVideo();
    this.setupFullscreenListener();
  }

  setupVideo(): void {
    const video = this.videoElement.nativeElement;

    // iOS requires specific handling
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('muted', ''); // Helps with autoplay on some browsers

    video.addEventListener('ended', () => {
      this.handleVideoEnd();
    });
  }

  setupFullscreenListener(): void {
    document.addEventListener('fullscreenchange', () => {
      this.isFullscreen = !!document.fullscreenElement;
    });
  }

  async startPlayback(): Promise<void> {
    const video = this.videoElement.nativeElement;
    const container = this.videoContainer.nativeElement;

    try {
      this.showPlayButton = false;
      this.videoEnded = false;
      this.showReplay = false;

      // Reset and prepare video
      video.currentTime = 0;

      // Must be triggered by user gesture
      await video.play();

      // Enter fullscreen
      await this.requestFullscreen(container);

      // Hide cursor after 3 seconds (for desktop)
      setTimeout(() => {
        container.style.cursor = 'none';
      }, 3000);

    } catch (error) {
      console.error('Playback failed:', error);
      this.showPlayButton = true;
      this.messageService.add({
        severity: 'error',
        summary: 'Playback Error',
        detail: 'Please click play to start the video'
      });
    }
  }

  async requestFullscreen(element: HTMLElement): Promise<void> {
    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if ((element as any).webkitRequestFullscreen) { /* Safari */
        await (element as any).webkitRequestFullscreen();
      }
      this.isFullscreen = true;
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }

  handleVideoEnd(): void {
    this.videoEnded = true;
    this.showReplay = true;
    this.exitFullscreen();
    
    // Save completion status immediately
    this.saveCompletionStatus();
  }

  private saveCompletionStatus(): void {
    this.wizardService.updateFormData('safetyBrief', {
      videoWatched: this.videoEnded,
      completedAt: new Date().toISOString()
    });
  }

  private validateStep(): void {
    // Restore previous completion status if exists
    const savedData = this.wizardService.getFormData('safetyBrief');
    const wasWatched = savedData?.videoWatched || false;
    
    const isValid = this.videoEnded || wasWatched;
    this.wizardService.setStepValid(isValid);

    if (!isValid) {
      this.messageService.add({
        severity: 'error',
        summary: 'Safety Briefing Required',
        detail: 'Please watch the complete safety briefing video to proceed'
      });
    }
  }

  exitFullscreen(): void {
    if (!document.fullscreenElement) return;

    const container = this.videoContainer.nativeElement;
    container.style.cursor = 'default';

    document.exitFullscreen().catch(console.warn);
    this.isFullscreen = false;
  }

  @HostListener('document:keydown.escape', ['$event'])
  handleEscape(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (this.isFullscreen && !this.videoEnded) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.messageService.add({
        severity: 'warn',
        summary: 'Attention',
        detail: 'Please watch the complete safety video',
        life: 3000
      });
    }
  }

  onReplay(): void {
    this.startPlayback();
  }

  onNext(): void {
    // Validate before proceeding
    this.validateStep();
    
    // Only proceed if validation passes
    const savedData = this.wizardService.getFormData('safetyBrief');
    const wasWatched = savedData?.videoWatched || false;
    
    if (this.videoEnded || wasWatched) {
      this.wizardService.setStepValid(true);
      this.wizardService.navigateToNextStep();
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Safety Briefing Required',
        detail: 'Please watch the complete safety briefing video to proceed'
      });
    }
  }
}

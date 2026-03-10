import { Component, ElementRef, ViewChild, AfterViewInit, OnInit, OnDestroy, HostListener } from '@angular/core';
import { WizardService } from '../../../../../core/services/wizard.service';
import { LabelService } from '../../../../../core/services/label.service';

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
export class StepSafetyBriefComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('safetyVideo') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('videoContainer') videoContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('playButton') playButton!: ElementRef<HTMLButtonElement>;

  videoEnded = false;
  showReplay = false;
  showPlayButton = true;
  isFullscreen = false;
  videoSource = '';
  isReplaying = false; // Track if user is replaying video
  private bodyStyleObserver?: MutationObserver;

  constructor(
    private wizardService: WizardService,
    private messageService: MessageService,
    private labelService: LabelService
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
    
    // Ensure scroll is enabled (clean up PrimeNG dialog artifacts from navigation)
    this.forceEnableScroll();
    
    // Monitor body for PrimeNG's p-overflow-hidden class
    this.startBodyStyleObserver();
    
    // Add window focus listener to re-enable scroll if user switches tabs/windows
    window.addEventListener('focus', this.handleWindowFocus);
  }

  ngAfterViewInit(): void {
    this.setupVideo();
    this.setupFullscreenListener();
    
    // Additional scroll enable after view init (important for navigation back scenario)
    setTimeout(() => {
      this.forceEnableScroll();
    }, 100);
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
    // Listen to multiple fullscreen change events for different browsers
    const fullscreenChangeHandler = () => {
      const isCurrentlyFullscreen = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      this.isFullscreen = isCurrentlyFullscreen;
      
      // If exiting fullscreen, ensure scroll is enabled
      if (!isCurrentlyFullscreen) {
        console.log('Fullscreen exited - enabling scroll');
        setTimeout(() => this.enableBodyScroll(), 0);
        setTimeout(() => this.enableBodyScroll(), 100);
        setTimeout(() => this.enableBodyScroll(), 300);
      }
    };
    
    document.addEventListener('fullscreenchange', fullscreenChangeHandler);
    document.addEventListener('webkitfullscreenchange', fullscreenChangeHandler);
    document.addEventListener('mozfullscreenchange', fullscreenChangeHandler);
    document.addEventListener('MSFullscreenChange', fullscreenChangeHandler);
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

      // Only enter fullscreen if NOT replaying (to avoid scroll issues)
      if (!this.isReplaying) {
        await this.requestFullscreen(container);
        // Hide cursor after 3 seconds (for desktop)
        setTimeout(() => {
          container.style.cursor = 'none';
        }, 3000);
      } else {
        console.log('Replaying without fullscreen to prevent scroll issues');
      }

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
    console.log('Video ended - starting cleanup');
    this.videoEnded = true;
    this.showReplay = true;
    this.isReplaying = false; // Reset replay flag
    
    // Ensure fullscreen is exited properly
    this.exitFullscreen();
    
    // Force enable body scroll
    this.forceEnableScroll();
    
    // Reset video container cursor
    if (this.videoContainer) {
      this.videoContainer.nativeElement.style.cursor = 'default';
    }
    
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
        summary: this.labelService.getLabel('safety_briefing_required', 'caption'),
        detail: this.labelService.getLabel('sbv_instruction', 'caption')
      });
    }
  }

  exitFullscreen(): void {
    console.log('Attempting to exit fullscreen');
    
    // Check multiple fullscreen APIs
    const isFullscreen = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
    
    if (!isFullscreen) {
      this.isFullscreen = false;
      this.enableBodyScroll();
      return;
    }

    const container = this.videoContainer?.nativeElement;
    if (container) {
      container.style.cursor = 'default';
    }

    // Try multiple exit fullscreen methods
    const exitPromise = document.exitFullscreen ? document.exitFullscreen() : 
                        (document as any).webkitExitFullscreen ? (document as any).webkitExitFullscreen() : 
                        Promise.resolve();

    exitPromise
      .then(() => {
        console.log('Fullscreen exited successfully');
        this.isFullscreen = false;
        this.forceEnableScroll();
      })
      .catch((err: unknown) => {
        console.warn('Error exiting fullscreen:', err);
        this.isFullscreen = false;
        this.forceEnableScroll();
      });
  }

  /**
   * Enable body scroll by removing any overflow restrictions
   */
  private enableBodyScroll(): void {
    try {
      // Re-enable scroll on body and html elements
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      
      document.documentElement.style.overflow = '';
      document.documentElement.style.position = '';
      
      // Remove scroll lock classes (including PrimeNG's p-overflow-hidden)
      document.body.classList.remove('no-scroll', 'overflow-hidden', 'p-overflow-hidden');
      document.documentElement.classList.remove('no-scroll', 'overflow-hidden', 'p-overflow-hidden');
      
      // Remove any leftover PrimeNG dialog mask overlays from previous navigation
      document.querySelectorAll('.p-dialog-mask').forEach(mask => mask.remove());
    } catch (error) {
      console.error('Error enabling body scroll:', error);
    }
  }

  /**
   * Start monitoring body element for PrimeNG's p-overflow-hidden class
   * PrimeNG modal dialog adds this class and may not clean it up on navigation
   */
  private startBodyStyleObserver(): void {
    this.stopBodyStyleObserver();
    
    this.bodyStyleObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes') {
          const target = mutation.target as HTMLElement;
          
          // Watch for PrimeNG's p-overflow-hidden class being added
          if (mutation.attributeName === 'class' && target.classList.contains('p-overflow-hidden')) {
            console.warn('Detected p-overflow-hidden on body - removing it');
            target.classList.remove('p-overflow-hidden');
          }
          
          // Watch for inline overflow:hidden
          if (mutation.attributeName === 'style') {
            if (target.style.overflow === 'hidden') {
              target.style.overflow = '';
            }
          }
        }
      });
    });
    
    this.bodyStyleObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }
  
  /**
   * Stop monitoring body/html element
   */
  private stopBodyStyleObserver(): void {
    if (this.bodyStyleObserver) {
      console.log('Stopping body style observer');
      this.bodyStyleObserver.disconnect();
      this.bodyStyleObserver = undefined;
    }
  }

  /**
   * Ensure scroll is enabled - called with a delay after video ends
   */
  private ensureScrollEnabled(): void {
    // Force exit fullscreen if still active (check both APIs)
    const isFullscreen = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
    if (isFullscreen) {
      try {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
      } catch (err) {
        console.warn('Force exit fullscreen failed:', err);
      }
    }
    
    // Ensure body scroll is enabled
    this.enableBodyScroll();
    
    // Reset fullscreen flag
    this.isFullscreen = false;
    
    // Trigger change detection to update UI
    if (this.videoContainer) {
      this.videoContainer.nativeElement.style.pointerEvents = '';
    }
  }

  /**
   * Force enable scroll - clean up PrimeNG dialog artifacts and body overflow
   */
  private forceEnableScroll(): void {
    // Immediate cleanup
    this.enableBodyScroll();
    
    // Delayed cleanup to catch any async PrimeNG dialog teardown
    setTimeout(() => this.enableBodyScroll(), 100);
    setTimeout(() => this.enableBodyScroll(), 500);
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
    console.log('Replay button clicked - will play WITHOUT fullscreen');
    
    // Mark as replaying to skip fullscreen
    this.isReplaying = true;
    
    // Force enable scroll first
    this.forceEnableScroll();
    
    // Ensure any existing fullscreen is exited before replaying
    const isFullscreen = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
    
    if (isFullscreen) {
      const exitPromise = document.exitFullscreen ? document.exitFullscreen() : 
                          (document as any).webkitExitFullscreen ? (document as any).webkitExitFullscreen() : 
                          Promise.resolve();
      
      exitPromise.then(() => {
        setTimeout(() => this.startPlayback(), 100);
      }).catch(() => {
        setTimeout(() => this.startPlayback(), 100);
      });
    } else {
      this.startPlayback();
    }
  }

  goBack(): void {
    const prevStep = this.wizardService.getCurrentStepIndex() - 1;
    if (prevStep >= 0) {
      this.wizardService.requestStepChange(prevStep);
    }
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
        summary: this.labelService.getLabel('safety_briefing_required', 'caption'),
        detail: this.labelService.getLabel('sbv_instruction', 'caption')
      });
    }
  }

  ngOnDestroy(): void {
    console.log('Component destroying - cleaning up');
    
    // Stop monitoring body styles
    this.stopBodyStyleObserver();
    
    // Ensure cleanup when component is destroyed
    this.exitFullscreen();
    this.forceEnableScroll();
    
    // Stop video if playing
    if (this.videoElement?.nativeElement) {
      const video = this.videoElement.nativeElement;
      video.pause();
      video.currentTime = 0;
    }
    
    // Remove window focus listener
    window.removeEventListener('focus', this.handleWindowFocus);
  }
  
  // Window focus handler to enable scroll when user returns to page
  private handleWindowFocus = () => {
    console.log('Window focused - ensuring scroll enabled');
    setTimeout(() => this.forceEnableScroll(), 50);
  };
}

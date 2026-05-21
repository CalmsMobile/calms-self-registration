import { Component, OnInit, OnDestroy } from '@angular/core';
import { SharedService } from '../../shared.service';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit, OnDestroy {

  title = 'Company Title';
  logo = 'assets/logo.png';
  private destroy$ = new Subject<void>();
  
  constructor(private sharedService: SharedService) { }

  ngOnInit(): void {
    // Subscribe to title changes
    this.sharedService.currentTitle
      .pipe(takeUntil(this.destroy$))
      .subscribe(title => {
        this.title = title;
        console.log('Header title updated:', title);
      });

    // Subscribe to logo changes
    this.sharedService.currentLogo
      .pipe(takeUntil(this.destroy$))
      .subscribe(logo => {
        this.logo = logo;
        console.log('Header logo updated:', logo);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}

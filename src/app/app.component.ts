import { Component, OnInit } from '@angular/core';

import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { StepsModule } from 'primeng/steps';
import { CardModule } from 'primeng/card';
import { filter } from 'rxjs/operators';
import { HeaderComponent } from './shared/components/header/header.component';
import { SharedService } from './shared/shared.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, StepsModule, CardModule, HeaderComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'CALMS Self Registration';
  showHeader = true;
  isHomePage = false;

  constructor(
    private router: Router,
    private sharedService: SharedService
  ) {}

  ngOnInit() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const urlWithoutParams = event.url.split('?')[0];
      this.isHomePage = urlWithoutParams === '/' || urlWithoutParams === '/home';
      this.showHeader = !this.isHomePage;
    });

    this.sharedService.isAccessDenied.subscribe(isAccessDenied => {
      if (isAccessDenied) {
        this.showHeader = false;
      } else {
        const currentUrl = this.router.url.split('?')[0];
        this.showHeader = currentUrl !== '/' && currentUrl !== '/home';
      }
    });
  }
}


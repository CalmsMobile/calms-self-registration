import { Component } from '@angular/core';
import { SharedService } from '../../shared.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {

  title = 'Company Title';
  logo = 'assets/logo.png';
  
  constructor(private sharedService: SharedService) { 
    this.sharedService.currentTitle.subscribe(title => {
      this.title = title;
    });
    this.sharedService.currentLogo.subscribe(logo => {
      this.logo = logo;
    });
  }

}

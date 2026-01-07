import { Component, ViewChild, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ButtonModule } from 'primeng/button';
import { LanguageService } from '../../../../core/services/language.service';
import { LabelService } from '../../../../core/services/label.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SelectModule } from 'primeng/select';
import { ApiService } from '../../../../core/services/api.service';
import { WizardService } from '../../../../core/services/wizard.service';
import { filter, Subject, takeUntil } from 'rxjs';
import { SharedService } from '../../../../shared/shared.service';
import { environment } from '../../../../../environments/environment';
import { ToastModule } from 'primeng/toast';
import { ProgressBarModule } from 'primeng/progressbar';
import { StepTermsComponent } from '../steps/step-terms/step-terms.component';

interface Branch {
  RefBranchSeqID: number;
  Branch_Name: string;
}

interface Category {
  visitor_ctg_id: number;
  Name: string;
}

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SelectModule,
    ButtonModule,
    ToastModule,
    ProgressBarModule,
    StepTermsComponent,
    TranslatePipe
  ],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss'
})
export class HomePageComponent {
  @ViewChild(StepTermsComponent) termsComponent!: StepTermsComponent;
  termsValid = false;
  branchList: Branch[] = [];
  currentLanguage: any;

  categories: Category[] = [];

  selectedBranch: any | null = null;
  selectedCategory: any | null = null;
  private _isLoading = true;
  isBranchFromQuery = false;
  hasInvalidUrl = false;
  errorMessage = '';
  bgImageUrl = '';
  
  // Branch translation data
  branchTranslation: any = {};
  pageTitle = '';
  
  // Base URL access control
  isBaseUrlAccessDisabled = false;
  baseUrlAccessDeniedInstruction = '';
  isAccessDenied = false;

  // Appointment data handling
  isAppointmentFlow = false;
  encryptedAppointmentCode: string | null = null;
  appointmentData: any = null;

  get isLoading(): boolean {
    return this._isLoading;
  }

  set isLoading(value: boolean) {
    console.log('Loading state changed:', this._isLoading, '->', value);
    this._isLoading = value;
  }

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private api: ApiService,
    private wizardService: WizardService,
    private sharedService: SharedService,
    private languageService: LanguageService,
    private labelService: LabelService
  ) {
    this.wizardService.clearSessionStorage();
  }

  ngOnInit() {
    // Check for query parameters and handle different flows
    this.route.queryParams.subscribe(async params => {
      if (params['q']) {
        // Appointment flow: use encrypted appointment code directly
        try {
          this.isAppointmentFlow = true;
          const encryptedCode = params['q'];
          
          if (!encryptedCode) {
            this.hasInvalidUrl = true;
            this.errorMessage = 'Invalid visitor acknowledgment link: No appointment code provided';
            this.isLoading = false;
            return;
          }

          // Get visitor acknowledgment data using the encrypted code
          await this.getAppointmentData(encryptedCode);
          
          // Load branches after getting visitor acknowledgment data
          await this.loadBranches();
          
          // Auto-select branch and category for appointment flow
          await this.autoSelectBranchAndCategory();
          
          this.isLoading = false;
          
        } catch (error) {
          console.error('Error processing visitor acknowledgment link:', error);
          this.hasInvalidUrl = true;
          this.errorMessage = 'Invalid visitor acknowledgment link: Failed to process appointment data';
          this.isLoading = false;
        }
      } else if (params['b']) {
        // Branch flow: decrypt branch parameter
        const decryptedBranch = this.getDencryptedStr(params['b']);
        if (!decryptedBranch || isNaN(parseInt(decryptedBranch))) {
          // Invalid decryption result
          this.hasInvalidUrl = true;
          this.errorMessage = 'Invalid URL: Unable to decrypt branch parameter';
          this.isLoading = false;
          return;
        }

        // Set the decrypted branch value
        this.selectedBranch = parseInt(decryptedBranch);
        this.isBranchFromQuery = true;
        
        // Trigger branch change after branches are loaded
        this.loadBranches().then(() => {
          if (this.selectedBranch && this.branchList.some(b => b.RefBranchSeqID === this.selectedBranch)) {
            this.onBranchChange(this.selectedBranch);
          } else {
            // Branch not found in available branches
            this.hasInvalidUrl = true;
            this.errorMessage = 'Invalid URL: Branch not found or not available';
            this.isLoading = false;
          }
        });
      } else {
        // Normal flow without query parameter
        this.isBranchFromQuery = false;
        this.isAppointmentFlow = false;
        this.hasInvalidUrl = false;
        this.loadBranches();
      }
    });

    // Subscribe to language changes
    this.languageService.currentLanguage$
      .pipe(
        filter(language => !!language),
        takeUntil(this.destroy$)
      )
      .subscribe(async language => {
        this.currentLanguage = language;
        
        // Only update labels if we have a selected branch
        if (this.selectedBranch) {
          await this.getSelfRegistrationSettings();
        }
      });
  }

  private getDencryptedStr(encodedStr: string): string {
    return encodedStr.replace(/\D/g, "");
  }

  /**
   * Get visitor acknowledgment data using the encrypted appointment code
   * @param encryptedCode The encrypted appointment code from query parameter
   */
  private async getAppointmentData(encryptedCode: string): Promise<void> {
    try {
      this.encryptedAppointmentCode = encryptedCode;
      console.log('Encrypted Appointment Code:', encryptedCode);
      
      // Call GetVisitorAck API with encrypted code and current date
      const response = await this.api.getAppointmentData(encryptedCode).toPromise();

      console.log(response);
      
      if (response) {
        this.appointmentData = response;
        
        // Parse the response structure
        const table1Data = (response as any).Table1;
        const table2Data = (response as any).Table2; // Image details
        const table3Data = (response as any).Table3; // Item declaration data
        
        if (table1Data && table1Data.length > 0) {
          const visitorData = table1Data[0]; // Get first row
          
          // Map the JSON object data directly to structured visitor information
          const parsedVisitorData = {
            seqId: visitorData.SEQ_ID,
            hostId: visitorData.HostId,
            hostName: visitorData.HostName,
            identityNo: visitorData.IdentityNo,
            fullName: visitorData.FullName,
            company: visitorData.CompanyId,
            purposeId: visitorData.PurposeId,
            startTime: visitorData.START_TIME,
            endTime: visitorData.END_TIME,
            vehicleNumber: visitorData.VehicleNo,
            email: visitorData.Email,
            floorId: visitorData.FloorId,
            roomId: visitorData.RoomId,
            genderId: visitorData.GenderId,
            branchId: visitorData.BRANCH_ID,
            approvalStatus: visitorData.Approval_Status,
            remarks: visitorData.Remarks,
            categoryId: visitorData.CategoryId,
            appointmentGroupId: visitorData.appointment_group_id,
            address: visitorData.Address,
            countryId: visitorData.CountryId,
            departmentId: visitorData.HostDeptId,
            vehicleBrand: visitorData.VehicleBrand,
            vehicleModel: visitorData.VehicleModel,
            vehicleColor: visitorData.VehicleColor,
            phone: visitorData.Contact,
            categoryDesc: visitorData.CategoryDesc,
            appTimeSlotSeqID: visitorData.AppTimeSlotSeqID,
            refWardRoomSeqId: visitorData.RefWardRoomSeqId,
            udf1: visitorData.UDF1,
            udf2: visitorData.UDF2,
            udf3: visitorData.UDF3,
            udf4: visitorData.UDF4,
            udf5: visitorData.UDF5,
            udf6: visitorData.UDF6,
            udf7: visitorData.UDF7,
            udf8: visitorData.UDF8,
            udf9: visitorData.UDF9,
            udf10: visitorData.UDF10
          };
          
          // Store visitor data in wizard service for use in step-general
          this.wizardService.setVisitorAckData({
            visitorData: parsedVisitorData,
            imageData: table2Data,
            itemDeclarationData: table3Data,
            isAppointmentFlow: true
          });
          
          // Set branch and category from visitor data
          if (parsedVisitorData.branchId) {
            this.selectedBranch = parseInt(parsedVisitorData.branchId.toString());
            this.isBranchFromQuery = true;
          }
          
          if (parsedVisitorData.categoryId) {
            this.selectedCategory = parseInt(parsedVisitorData.categoryId.toString());
          }
          
          console.log('Visitor acknowledgment data parsed:', parsedVisitorData);
        }
        
        console.log('Visitor acknowledgment data loaded:', this.appointmentData);
      } else {
        console.log('No visitor acknowledgment data found in response');
        // Even if no data, we can still proceed with the encrypted code
      }
    } catch (error) {
      console.error('Error loading visitor acknowledgment data:', error);
      // Don't mark as invalid URL if API fails - we still have the encrypted code
      // This allows the user to proceed with the appointment flow
      console.log('Proceeding with appointment flow despite API error');
    }
  }

  /**
   * Auto-trigger branch and category selection for appointment flow
   */
  private async autoSelectBranchAndCategory(): Promise<void> {
    if (this.isAppointmentFlow && this.selectedBranch) {
      try {
        // Trigger branch change to load categories and settings
        await this.onBranchChange(this.selectedBranch);
        
        // Auto-select category if available
        if (this.selectedCategory) {
          this.onCategoryChange(this.selectedCategory);
        }
      } catch (error) {
        console.error('Error in auto-selection for appointment flow:', error);
      }
    }
  }

  /**
   * Check if access should be restricted based on base URL settings
   */
  private checkAccessRestriction() {
    // If base URL access is disabled and there's no branch query parameter, deny access
    if (this.isBaseUrlAccessDisabled && !this.isBranchFromQuery) {
      this.isAccessDenied = true;
      this.isLoading = false;
      // Notify shared service to hide UI elements
      this.sharedService.setAccessDenied(true);
    } else {
      this.isAccessDenied = false;
      // Notify shared service to show UI elements
      this.sharedService.setAccessDenied(false);
    }
  }

  async getSelfRegistrationSettings() {
    if (this.selectedBranch) {
      try {
        // Load labels through the centralized service and get the response data
        const responseData = await this.labelService.loadLabels(this.selectedBranch, this.currentLanguage.LanguageId);
        
        // Update page title based on the loaded labels
        const wizardTitle = this.labelService.getLabel('wizardTitle', 'caption');
        if (wizardTitle) {
          this.wizardService.pageTitle = wizardTitle;
        }

        // Process additional settings from the same API response (avoid duplicate call)
        if (responseData && responseData.Table) {
          this.processAdditionalPageSettings(responseData.Table);
        }
        
      } catch (error) {
        console.error('Error loading labels:', error);
      }
    }
  }

  /**
   * Process additional page settings from the API response
   * This uses the same data that was already fetched by the label service
   */
  private processAdditionalPageSettings(translationData: any[]) {
    try {
      console.log('Processing additional page settings from cached data:', translationData);
      
      // Find the Branch field translation
      const branchField = translationData.find((item: any) => item.Title === 'Branch');
      if (branchField) {
        this.branchTranslation = {
          caption: branchField.Caption || 'Branch',
          placeholder: branchField.Placeholder || 'Select Branch'
        };
      }
      
      // Set page title from the translation data
      const titleField = translationData.find((item: any) => item.Title === 'Visitor Registration');
      if (titleField && titleField.Caption) {
        this.pageTitle = titleField.Caption;
        this.wizardService.pageTitle = titleField.Caption;
      }
      
      // Check for base URL access settings
      const disableBaseUrlField = translationData.find((item: any) => item.Title === 'Disable base URL for registration');
      if (disableBaseUrlField) {
        this.isBaseUrlAccessDisabled = disableBaseUrlField.Caption === 'true' || disableBaseUrlField.Caption === true;
      }
      
      // Get base URL access denied instruction
      const accessDeniedInstructionField = translationData.find((item: any) => item.Title === 'Base URL access denied instruction');
      if (accessDeniedInstructionField) {
        this.baseUrlAccessDeniedInstruction = accessDeniedInstructionField.Caption || 'Access to this registration page is restricted. Please use the direct link provided by your administrator.';
      }
      
      // Check if access should be denied (when base URL is disabled and no branch query parameter)
      this.checkAccessRestriction();
    } catch (error) {
      console.error('Error processing additional page settings:', error);
      // Set defaults if processing fails
      this.branchTranslation = {
        caption: 'Branch',
        placeholder: 'Select Branch'
      };
    }
  }

  onTermsStatusChange(isValid: boolean) {
    this.termsValid = isValid;
  }

  private loadBranches(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.api.getMasterDetails().subscribe({
        next: async (data: any) => {
          if (data?.Table?.length && data.Table[0].Code == '10') {
            this.wizardService.setmasterData(data);

            // Log available tables for debugging
            console.log('Master data tables:', {
              branches: data.Table10?.length || 0,
              categories: data.Table4?.length || 0,
              countries: data.Table13?.length || 0,
              purposes: data.Table3?.length || 0,
              floors: data.Table2?.length || 0
            });

            if (data.Table10.length) {
              this.branchList = data.Table10;

              if (data.Table10.length == 1) {
                this.selectedBranch = data.Table10[0];
                this.wizardService.currentBranchID = this.selectedBranch;
                this.loadCategories();
              }
              
              // Load branch translation after branches are loaded
              if (this.currentLanguage) {
                await this.getSelfRegistrationSettings();
              }
            }
          }

          // Only set loading to false if not from query (query flow handles it separately)
          if (!this.isBranchFromQuery) {
            this.isLoading = false;
          }
          resolve();
        },
        error: (error) => {
          console.error('Error loading branches:', error);
          this.isLoading = false;
          reject(error);
        }
      });
    });
  }

  loadCategories() {
    const data = this.wizardService.getmasterData();
    if (data.Table4.length) {
      let loFilterCategory: any[] = [...data.Table4.filter((item: any) => {
        return !item.IsForPatientVisit 
        //&& item.RefBranchSeqId === this.selectedBranch;
      })];

      this.categories = loFilterCategory;

      if (data.Table4.length == 1) {
        this.selectedCategory = data.Table4[0];
        this.wizardService.selectedVisitCategory = this.selectedCategory;
      }
    }

    // Auto-select category based on different scenarios
    if (this.categories.length === 1) {
      this.selectedCategory = this.categories[0].visitor_ctg_id;
      this.onCategoryChange(this.selectedCategory);
    } else if (this.isAppointmentFlow && this.selectedCategory) {
      // In appointment flow, ensure the selected category is valid
      const validCategory = this.categories.find(c => c.visitor_ctg_id === this.selectedCategory);
      if (validCategory) {
        this.onCategoryChange(this.selectedCategory);
      }
    }
  }

  async onBranchChange(newValue: any) {
    this.isLoading = true;
    let lsBranchName = this.getBranchName(newValue);
    
    // Don't reset category in appointment flow as it's pre-selected
    if (!this.isAppointmentFlow) {
      this.selectedCategory = null;
      this.categories = [];
    }

    try {
      // Load labels first (this will handle branch translation too)
      await this.getSelfRegistrationSettings();
      
      // Then load categories after labels are ready
      this.loadCategories();

      this.getPageSettings();

      // Load branch host data asynchronously in the background
      this.loadBranchHostDataAsync(newValue);

      this.sharedService.updateHeader(
        lsBranchName,
        environment.proURL + "Handler/PortalImageHandler.ashx?ScreenType=20&RefSlno=" + newValue
      );
    } catch (error) {
      console.error('Error in branch change:', error);
    } finally {
      // Ensure loading is always turned off
      setTimeout(() => {
        this.isLoading = false;
      }, 300);
    }
  }

  onCategoryChange(newValue: any) {
    this.isLoading = true;

    this.api.GetVisitorDeclarationSettings(this.selectedBranch, newValue)
      .subscribe({
        next: (allSettings: any) => {
          this.wizardService.setSettings(allSettings);
          // Add small delay to ensure smooth loading transition
          setTimeout(() => {
            this.isLoading = false;
          }, 300);
        },
        error: (error) => {
          console.error('Error loading category settings:', error);
          this.isLoading = false;
        }
      });
  }

  getPageSettings() {
    this.api.GetVisitorSelfRegistrationPageSetup(this.selectedBranch)
    .subscribe((pageSettings: any) => {
      this.wizardService.setPageSettings(pageSettings);
      if (pageSettings?.Table?.length) {
        this.sharedService.updateHeader(
          pageSettings.Table[0].SchoolName,
          environment.proURL + "Handler/PortalImageHandler.ashx?ScreenType=20&RefSlno=" + this.selectedBranch
        );

        this.bgImageUrl = environment.proURL + "FS/" + pageSettings.Table[0].ImgPathUrl;
      }
    });
  }

  // Method to get background style for the container
  getBackgroundStyle(): any {
    if (this.bgImageUrl) {
      return {
        'background-image': `url(${this.bgImageUrl})`,
        'background-size': 'cover',
        'background-position': 'center',
        'background-repeat': 'no-repeat'
      };
    }
    return {};
  }

  private getBranchName(branchId: number): string {
    const branch = this.branchList.find(b => b.RefBranchSeqID === branchId);
    return branch ? branch.Branch_Name : '';
  }

  private getCategoryName(categoryId: number): string {
    const category = this.categories.find(c => c.visitor_ctg_id === categoryId);
    return category ? category.Name : '';
  }

  proceedToWizard() {
    this.isLoading = true;
    if (this.selectedBranch && this.selectedCategory) {

      if (this.termsComponent && !this.termsComponent.validateTerms()) {
        this.isLoading = false;
        return;
      }

      const loSelectedBranch = this.branchList.filter(b => b.RefBranchSeqID == this.selectedBranch);
      if (loSelectedBranch?.length) {
        this.wizardService.currentBranchName = loSelectedBranch[0].Branch_Name;
      }
      this.wizardService.currentBranchID = this.selectedBranch;
      this.wizardService.selectedVisitCategory = this.selectedCategory;
      this.wizardService.setDataToSessionStorage();
      
      // Navigate to wizard
      this.router.navigate(['/register'], {
        state: {
          branch: this.selectedBranch,
          category: this.selectedCategory
        }
      }).then(() => {
        // Reset loading after navigation
        this.isLoading = false;
      }).catch((error) => {
        console.error('Navigation error:', error);
        this.isLoading = false;
      });
    } else {
      this.isLoading = false;
    }
  }

  /**
   * Load branch host data asynchronously in the background
   * This prevents loading delay when user navigates to general step
   */
  private loadBranchHostDataAsync(branchId: string): void {
    // Only load if we have a valid branch ID
    if (!branchId) {
      console.log('No branch ID provided for async host data loading');
      return;
    }

    console.log('Loading branch host data asynchronously for branch:', branchId);

    // Load branch host data in the background without blocking UI
    this.api.GetBranchHostData(branchId, true).subscribe({
      next: (response: any) => {
        console.log('Branch host data loaded asynchronously:', response);
        // Store the data in wizard service for use in general step
        this.wizardService.setBranchHostData(response);
      },
      error: (error) => {
        console.error('Error loading branch host data asynchronously:', error);
        // Don't show error to user as this is background loading
      }
    });
  }

  ngOnDestroy(): void {
    // Reset access denied state when component is destroyed
    this.sharedService.setAccessDenied(false);
    this.destroy$.next();
    this.destroy$.complete();
  }
}

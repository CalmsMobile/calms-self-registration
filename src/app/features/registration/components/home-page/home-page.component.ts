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
import { RouterLink } from '@angular/router';
import { CheckboxModule } from 'primeng/checkbox';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

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
    ButtonModule, CheckboxModule,
    ToastModule,
    ProgressBarModule,
    StepTermsComponent,
    TranslatePipe,

  ],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss'
})
export class HomePageComponent {
  @ViewChild(StepTermsComponent) termsComponent!: StepTermsComponent;
  termsValid = false;
  termsAccepted = false;
  branchList: Branch[] = [];
  currentLanguage: any;

  categories: Category[] = [];

  selectedBranch: any | null = null;
  selectedCategory: any | null = null;
  private _isLoading = true;
  isBranchFromQuery = false;
  isCategoryFromQuery = false;
  hasInvalidUrl = false;
  errorMessage = '';
  bgImageUrl = '';

  // Branch translation data
  branchTranslation: any = {};
  pageTitle = '';

  // Welcome page data from API
  welcomeText = '';

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

  get formattedPageTitle(): { first: string, rest: string } {
    const fullTitle = this.pageTitle || 'Visitor Registration'; // Default if empty, translate pipe not easily usable in logic without subscription, assuming default string for split logic or handled in template
    // Ideally we rely on the same logic as template: pageTitle || translate pipe
    // But for splitting, we need the string. 
    // If pageTitle is set, use it. If not, we might display "Visitor Registration" as fallback for now or handle TranslateService. 
    // Given the complexity of TranslatePipe in TS, I'll rely on pageTitle being set or default.

    // Better approach: simple split method used in template with a pipe, OR just simple logic here if pageTitle is populated.
    // Let's assume pageTitle is populated or we strictly use what's available.

    const text = this.pageTitle || 'Visitor Registration';
    const firstSpaceIndex = text.indexOf(' ');

    if (firstSpaceIndex === -1) {
      return { first: text, rest: '' };
    }

    return {
      first: text.substring(0, firstSpaceIndex),
      rest: text.substring(firstSpaceIndex + 1)
    };
  }

  set isLoading(value: boolean) {
    console.log('Loading state changed:', this._isLoading, '->', value);
    this._isLoading = value;
  }

  private destroy$ = new Subject<void>();
  title = 'Company Title';
  logo = 'assets/logo.png';
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private api: ApiService,
    private wizardService: WizardService,
    private sharedService: SharedService,
    private languageService: LanguageService,
    private labelService: LabelService,
    private sanitizer: DomSanitizer
  ) {
    this.wizardService.clearSessionStorage();
    this.sharedService.currentTitle.subscribe(title => {
      this.title = title;
    });
    this.sharedService.currentLogo.subscribe(logo => {
      this.logo = logo;
    });
  }

  ngOnInit() {
    // Check for query parameters and handle different flows
    this.route.queryParams.subscribe(async params => {
      // Normalize query param keys to lowercase for case-insensitive matching
      const p: { [key: string]: string } = {};
      Object.keys(params).forEach(key => p[key.toLowerCase()] = params[key]);

      if (p['q']) {
        // Appointment flow: use encrypted appointment code directly
        try {
          this.isAppointmentFlow = true;
          const encryptedCode = p['q'];

          // Store raw encrypted param
          this.wizardService.appointmentCode = encryptedCode || '';

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
      } else if (p['bc']) {
        const bcParam = p['bc'];
        // Branch flow: pass encrypted code directly to APIs, let API resolve the branch
        this.isBranchFromQuery = true;

        // Store raw encrypted branch param
        this.wizardService.refCode = bcParam;

        // Check for category query parameter (vc)
        const vcParam = p['vc'];
        if (vcParam) {
          // Store raw encrypted category param
          this.wizardService.refCatCode = vcParam;

          const decryptedCategory = this.decryptParam(vcParam);
          if (decryptedCategory) {
            // Use numeric ID if it's a number, otherwise use as string code
            this.selectedCategory = !isNaN(Number(decryptedCategory))
              ? parseInt(decryptedCategory)
              : decryptedCategory;
            this.isCategoryFromQuery = true;
          }
        }

        // Directly call APIs using RefCode (don't use onBranchChange which needs a resolved branch)
        this.loadBranches().then(() => {
          this.getPageSettings();
          this.loadBranchHostDataAsync(null);
          this.sharedService.setLanguageVisibility(false);
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

          // For query param flow: language may arrive after onBranchChange already ran,
          // so re-trigger the APIs that depend on language being set
          if (this.isBranchFromQuery && !this.isAppointmentFlow) {
            this.getPageSettings();
            this.loadBranchHostDataAsync(this.selectedBranch);
          }
        }
      });
  }

  private getDencryptedStr(encodedStr: string): string {
    return encodedStr.replace(/\D/g, "");
  }

  private decryptParam(encodedStr: string): string {
    try {
      return atob(encodedStr);
    } catch {
      return encodedStr;
    }
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
    if (this.selectedBranch && this.currentLanguage) {
      try {
        // Load labels through the centralized service and get the response data
        const responseData = await this.labelService.loadLabels(this.selectedBranch, this.currentLanguage.LanguageId, this.wizardService.refCode || undefined);

        // Update page title based on the loaded labels
        const wizardTitle = this.labelService.getLabel('wizardTitle', 'caption');
        if (wizardTitle) {
          this.wizardService.pageTitle = wizardTitle;
        }

        // Process additional settings from the same API response (avoid duplicate call)
        if (responseData && responseData.Table) {
          this.processAdditionalPageSettings(responseData.Table);
        }

        // Store T&C settings from Table1
        if (responseData?.Table1?.length) {
          const tcSettings = responseData.Table1[0];
          this.wizardService.setSelfRegistrationSettings({
            TermsnCondEnabled: tcSettings.TermsnCondEnabled ?? false,
            TermsnCondTemplate: tcSettings.TermsnCond || ''
          });
        }

      } catch (error) {
        console.error('Error loading labels:', error);
      }
    }
  }

  // Ensure global language selector shows only when no branch is selected
  private updateLanguageVisibility() {
    this.sharedService.setLanguageVisibility(!this.selectedBranch);
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
      this.api.GetSelfRegistrationWelcomePageData().subscribe({
        next: async (data: any) => {
          // Map branches from Table
          if (data?.Table?.length) {
            this.branchList = data.Table.map((b: any) => ({
              RefBranchSeqID: b.BranchSeqId,
              Branch_Name: b.Name
            }));

            // Auto-select when only one branch and not from query
            if (this.branchList.length === 1 && !this.isBranchFromQuery) {
              this.selectedBranch = this.branchList[0].RefBranchSeqID;
              this.wizardService.currentBranchID = this.selectedBranch;
            }

            // Load branch translation after branches are loaded
            if (this.currentLanguage) {
              await this.getSelfRegistrationSettings();
            }
          }

          // Extract welcome page settings from Table1
          if (data?.Table1?.length) {
            const settings = data.Table1[0];
            // Logo URL
            const logoUrl = settings.LogoUrl || settings.Logo || settings.ImgPathUrl;
            if (logoUrl) {
              this.logo = environment.proURL + logoUrl;
              this.sharedService.updateHeader(this.title, this.logo);
            }
            // Welcome text
            if (settings.WelcomeText || settings.WelcomPageText || settings.Caption) {
              this.welcomeText = settings.WelcomeText || settings.WelcomPageText || settings.Caption;
            }
            // Branch selection caption and placeholder
            this.branchTranslation = {
              caption: settings.BranchCaption || settings.BranchLabel || settings.Caption || 'Branch',
              placeholder: settings.BranchPlaceholder || settings.Placeholder || 'Select Branch'
            };
          }

          // Only set loading to false if not from query (query flow handles it separately)
          if (!this.isBranchFromQuery) {
            this.isLoading = false;
          }
          // Update language selector visibility after branches are loaded
          this.updateLanguageVisibility();
          resolve();
        },
        error: (error) => {
          console.error('Error loading welcome page data:', error);
          this.isLoading = false;
          reject(error);
        }
      });
    });
  }

  loadCategories(categoryData?: any[]) {
    // Use provided category data or fall back to stored branch host data Table2
    const rawCategories = categoryData || this.wizardService.getBranchHostData()?.Table2 || [];

    if (rawCategories.length) {
      let loFilterCategory: any[] = [...rawCategories.filter((item: any) => {
        return !item.IsForPatientVisit;
      })];

      this.categories = loFilterCategory;

      if (loFilterCategory.length === 1) {
        this.selectedCategory = loFilterCategory[0].visitor_ctg_id;
        this.wizardService.selectedVisitCategory = this.selectedCategory;
      }
    } else {
      this.categories = [];
    }

    // Auto-select category based on different scenarios
    if (this.categories.length === 1) {
      this.selectedCategory = this.categories[0].visitor_ctg_id;
      this.onCategoryChange(this.selectedCategory);
    } else if ((this.isAppointmentFlow || this.isCategoryFromQuery) && this.selectedCategory) {
      // In appointment flow or category from query param, ensure the selected category is valid
      const validCategory = this.categories.find(c => c.visitor_ctg_id === this.selectedCategory);
      if (validCategory) {
        this.onCategoryChange(this.selectedCategory);
      }
    }
  }

  async onBranchChange(newValue: any) {
    this.isLoading = true;
    let lsBranchName = this.getBranchName(newValue);

    // Don't reset category in appointment flow or when set from query param
    if (!this.isAppointmentFlow && !this.isCategoryFromQuery) {
      this.selectedCategory = null;
      this.categories = [];
    }

    try {
      // Fire all API calls in parallel for faster loading
      const settingsPromise = this.getSelfRegistrationSettings();
      this.getPageSettings();
      this.loadBranchHostDataAsync(newValue);

      // Categories will be loaded inside loadBranchHostDataAsync from Table2 after host data arrives

      // Await settings to ensure labels are ready for UI
      await settingsPromise;

      this.sharedService.updateHeader(
        lsBranchName,
        environment.proURL + "Handler/PortalImageHandler.ashx?ScreenType=20&RefSlno=" + newValue
      );
      // hide language selector when a branch is selected
      this.sharedService.setLanguageVisibility(false);
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

    this.api.GetVisitorDeclarationSettings(this.selectedBranch, newValue, this.wizardService.refCode || undefined, this.wizardService.refCatCode || undefined)
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
    this.api.GetVisitorSelfRegistrationPageSetup(this.selectedBranch, this.wizardService.refCode || undefined)
      .subscribe((pageSettings: any) => {
        this.wizardService.setPageSettings(pageSettings);
        if (pageSettings?.Table?.length) {
          // Update selectedBranch with the resolved RefBranchSeqId from API
          if (pageSettings.Table[0].RefBranchSeqId) {
            this.selectedBranch = pageSettings.Table[0].RefBranchSeqId;
            this.wizardService.currentBranchID = this.selectedBranch;
          }

          this.sharedService.updateHeader(
            pageSettings.Table[0].SchoolName,
            environment.proURL + "Handler/PortalImageHandler.ashx?ScreenType=20&RefSlno=" + this.selectedBranch
          );

          this.bgImageUrl = environment.proURL + "FS/" + pageSettings.Table[0].ImgPathUrl;

          // Once branch is resolved from API, load categories and handle auto-selection
          if (this.isBranchFromQuery) {
            // Now that branch is resolved, load labels/settings
            this.getSelfRegistrationSettings();

            // Categories are loaded by loadBranchHostDataAsync via Table2

            if (this.isCategoryFromQuery && this.selectedCategory) {
              // vc param exists: trigger category settings
              this.onCategoryChange(this.selectedCategory);
            }

            // Turn off loading for bc flow
            setTimeout(() => {
              this.isLoading = false;
            }, 300);
          }
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

  shouldShowTerms(): boolean {
    const selfRegSettings = this.wizardService.getSelfRegistrationSettings();
    return selfRegSettings?.TermsnCondEnabled ?? false;
  }

  getTermsHtml(): SafeHtml {
    const selfRegSettings = this.wizardService.getSelfRegistrationSettings();
    if (selfRegSettings?.TermsnCondTemplate) {
      return this.sanitizer.bypassSecurityTrustHtml(selfRegSettings.TermsnCondTemplate);
    }
    return '';
  }
  // shouldShowTerms(): boolean {
  //   const settings = this.wizardService.getSettings();
  //   // return settings?.TermsnCondEnabled || false;  // Original line
  //   return false;  // Temporarily hardcode for testing
  // }
  proceedToWizard() {
    this.isLoading = true;
    if (this.selectedBranch && this.selectedCategory) {

      if (this.shouldShowTerms() && this.termsComponent && !this.termsComponent.validateTerms()) {
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
   * Load branch host data and extract Table2 as categories
   */
  private loadBranchHostDataAsync(branchId: string | null): void {
    // Only load if we have a valid branch ID or refCode
    if (!branchId && !this.wizardService.refCode) {
      console.log('No branch ID or refCode provided for host data loading');
      return;
    }

    console.log('Loading branch host data for branch:', branchId);

    this.api.GetBranchHostData(branchId || '', true, this.wizardService.refCode || undefined).subscribe({
      next: (response: any) => {
        console.log('Branch host data loaded:', response);
        // Store the data in wizard service for use in general step
        this.wizardService.setBranchHostData(response);

        // Determine allowed categories using Table6.SelfVisitorCategories
        const allCategories: any[] = response?.Table2 || [];
        const selfVisitorCategories: string = response?.Table6?.[0]?.SelfVisitorCategories ?? '0';

        let categoryData: any[];
        if (selfVisitorCategories === '0') {
          // "0" means load all categories
          categoryData = allCategories;
        } else {
          // Comma-separated codes — filter to matching categories
          const allowedCodes = selfVisitorCategories.split(',').map((c: string) => c.trim());
          categoryData = allCategories.filter((cat: any) =>
            allowedCodes.includes(String(cat.visitor_ctg_id)) ||
            allowedCodes.includes(String(cat.visitor_ctg_code))
          );
        }

        console.log(`Categories: SelfVisitorCategories="${selfVisitorCategories}", total=${allCategories.length}, filtered=${categoryData.length}`);
        this.loadCategories(categoryData);
      },
      error: (error) => {
        console.error('Error loading branch host data:', error);
      }
    });
  }

  ngOnDestroy(): void {
    // Reset access denied state when component is destroyed
    this.sharedService.setAccessDenied(false);
    this.destroy$.next();
    this.destroy$.complete();
  }

  goBack(): void {
    this.selectedCategory = null;
    // Reset terms validation
    this.termsValid = false;
    this.termsAccepted = false; // Add this reset
    // Clear any stored settings related to category
    this.wizardService.setSettings(null);
  }
}

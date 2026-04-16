import { Component, ViewChild, OnInit, AfterViewChecked, ElementRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ButtonModule } from 'primeng/button';
import { LanguageService } from '../../../../core/services/language.service';
import { LabelService } from '../../../../core/services/label.service';
import { MessageHelperService } from '../../../../core/services/message-helper.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SelectModule } from 'primeng/select';
import { ApiService } from '../../../../core/services/api.service';
import { WizardService } from '../../../../core/services/wizard.service';
import { filter, Subject, takeUntil } from 'rxjs';
import { SharedService } from '../../../../shared/shared.service';
import { environment } from '../../../../../environments/environment';
import { ToastModule } from 'primeng/toast';
import { StepTermsComponent } from '../steps/step-terms/step-terms.component';
import { RouterLink } from '@angular/router';
import { CheckboxModule } from 'primeng/checkbox';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LanguageSelectorComponent } from '../../../../shared/components/language-selector/language-selector.component';

interface Branch {
  RefBranchSeqID: number;
  Branch_Name: string;
}

interface Category {
  visitor_ctg_id: number;
  visitor_ctg_code?: string;
  visitor_ctg_desc?: string;
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
    StepTermsComponent,
    TranslatePipe,
    LanguageSelectorComponent,
  ],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss'
})
export class HomePageComponent implements AfterViewChecked {
  @ViewChild(StepTermsComponent) termsComponent!: StepTermsComponent;
  @ViewChild('termsBodyRef') termsBodyEl?: ElementRef<HTMLElement>;
  @ViewChild('mTermsBodyRef') mTermsBodyEl?: ElementRef<HTMLElement>;
  termsValid = false;
  termsAccepted = false;
  termsScrolledToBottom = false;
  private termsAutoChecked = false;
  private _cachedTermsHtml: SafeHtml | string = '';
  private _cachedTermsTemplate = '';
  /** Holds the category to restore on back-navigation (see goBack() in step-general). */
  private _backNavRestoreCategory: any = null;
  /** When true, onCategoryChange will load settings but will NOT auto-proceed to wizard. */
  private _suppressAutoProceed = false;
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
  categoryTranslation: any = {};
  pageTitle = '';

  // Welcome page data from API
  welcomeText = '';

  // Base URL access control
  isBaseUrlAccessDisabled = false;
  baseUrlAccessDeniedInstruction = '';
  isAccessDenied = false;

  // SRWithoutBC flag control
  srWithoutBC = '1'; // Default: allow access without BC param
  srWithoutBCBlockMessage = 'Access denied. Please use the proper registration link with branch code.';

  // AllowOnlywithVC flag control
  allowOnlyWithVC = true; // Default: allow access without VC param
  allowOnlyWithVCBlockMessage = 'Access denied. Please use the proper registration link with visitor category code.';

  // ShowWelcomeTitle flag
  showWelcomeTitle = true;

  // Appointment data handling
  isAppointmentFlow = false;
  encryptedAppointmentCode: string | null = null;
  appointmentData: any = null;
  initializePageSettings: any;

  // Mobile dropdown toggle states
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

    const text = this.wizardService.pageTitle || 'Visitor Registration';
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
    private sanitizer: DomSanitizer,
    private messageHelper: MessageHelperService
  ) {
    this.wizardService.clearSessionStorage();
  }

  ngOnInit() {
    // Check for query parameters and handle different flows
    this.route.queryParams.subscribe(async params => {
      // Normalize query param keys to lowercase for case-insensitive matching
      const p: { [key: string]: string } = {};
      Object.keys(params).forEach(key => p[key.toLowerCase()] = params[key]);

      // Capture the original query string so we can restore it if the page is refreshed
      // while the user is in the wizard. Only capture when meaningful params are present.
      const hasQueryParams = !!(p['ac'] || p['bc'] || p['hc'] || p['vc']);
      if (hasQueryParams) {
        const qs = window.location.search;
        this.wizardService.originalQueryString = qs;
        sessionStorage.setItem('originalQueryString', qs);
      }

      if (p['ac']) {
        // Appointment flow: use encrypted appointment code directly
        try {
          this.isAppointmentFlow = true;
          const encryptedCode = p['ac'];

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

        // Check for host code query parameter (hc) alongside bc
        const hcParam = p['hc'];
        // Read vc early so it can be passed to GetSelfRegShareURLData when hc is also present
        const vcParam = p['vc'];

        if (hcParam) {
          this.wizardService.hcParam = hcParam;
          this.wizardService.isHostFromQuery = true;
          this.api.GetSelfRegShareURLData(hcParam, vcParam || undefined).subscribe({
            next: (response: any) => {
              const responseArray = Array.isArray(response) ? response : [response];
              const tableData = responseArray[0]?.Table?.[0];
              const hostic = tableData?.HOSTIC;
              if (hostic) {
                this.wizardService.hostCodeFromQuery = hostic;
              }
              // Use server-resolved CategoryCode when vc was passed alongside hc
              const categoryCode = tableData?.CategoryCode;
              if (categoryCode) {
                this.wizardService.categoryCodeFromQuery = categoryCode;
                this.selectedCategory = categoryCode;
                this.isCategoryFromQuery = true;
                // Re-apply selection if categories are already loaded
                if (this.categories.length > 0) {
                  this.loadCategories();
                }
              }
            },
            error: (err) => {
              console.error('Error fetching host code from hc param:', err);
            }
          });
        }

        // Check for category query parameter (vc)
        if (vcParam) {
          // Store raw encrypted category param
          this.wizardService.refCatCode = vcParam;

          if (!hcParam) {
            // No hc present: resolve category client-side from the encrypted vc param
            const decryptedCategory = this.decryptParam(vcParam);
            if (decryptedCategory) {
              this.selectedCategory = !isNaN(Number(decryptedCategory))
                ? parseInt(decryptedCategory)
                : decryptedCategory;
              this.isCategoryFromQuery = true;
            }
          } else {
            // hc is present: category is resolved server-side via GetSelfRegShareURLData
            this.isCategoryFromQuery = true;
          }
        }

        // Directly call APIs using RefCode (don't use onBranchChange which needs a resolved branch)
        this.loadBranches().then(() => {
          // Back-nav: restore previously selected category when no vc param was used
          if (p['_catid'] && !vcParam) {
            const backCatId = p['_catid'];
            this._backNavRestoreCategory = !isNaN(Number(backCatId)) ? Number(backCatId) : backCatId;
          }
          this.getPageSettings();
          this.loadBranchHostDataAsync(null);
        });
      } else {
        // Normal flow without query parameter
        this.isBranchFromQuery = false;
        this.isAppointmentFlow = false;
        this.hasInvalidUrl = false;

        // Check for standalone hc param (without bc)
        const hcParam = p['hc'];
        const vcParam = p['vc'];
        if (hcParam) {
          this.wizardService.hcParam = hcParam;
          this.wizardService.isHostFromQuery = true;
          this.api.GetSelfRegShareURLData(hcParam, vcParam || undefined).subscribe({
            next: (response: any) => {
              const responseArray = Array.isArray(response) ? response : [response];
              const tableData = responseArray[0]?.Data?.Table?.[0];
              const hostic = tableData?.HOSTIC;
              if (hostic) {
                this.wizardService.hostCodeFromQuery = hostic;
              }
              // Use server-resolved CategoryCode when vc was passed alongside hc
              const categoryCode = tableData?.CategoryCode;
              if (categoryCode) {
                this.wizardService.categoryCodeFromQuery = categoryCode;
                this.selectedCategory = categoryCode;
                this.isCategoryFromQuery = true;
                // Re-apply selection if categories are already loaded
                if (this.categories.length > 0) {
                  this.loadCategories();
                }
              }
            },
            error: (err) => {
              console.error('Error fetching host code from hc param:', err);
            }
          });
        }

        // Restore branch/category when the user navigated back from step-general.
        // Both dropdowns remain fully editable so the user can change either.
        const backBranchId = p['_branchid'];
        const backCatId = p['_catid'];
        if (backBranchId) {
          this.selectedBranch = !isNaN(Number(backBranchId)) ? Number(backBranchId) : backBranchId;
          // isBranchFromQuery stays false → branch dropdown stays visible
          if (backCatId) {
            // Buffer the category; loadCategories will pre-select it and keep the dropdown editable.
            this._backNavRestoreCategory = !isNaN(Number(backCatId)) ? Number(backCatId) : backCatId;
          }
          this.loadBranches().then(() => {
            // Trigger branch change to load categories + page settings
            this.onBranchChange(this.selectedBranch);
          });
        } else {
          this.loadBranches();
        }
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

          // After labels load, re-merge selfRegSettings into the current settings
          // so step-general picks up SearchExistingVisitor etc. This covers the
          // back-nav case where onBranchChange ran before language was available,
          // causing getSelfRegistrationSettings() to bail out silently.
          const currentSettings = this.wizardService.getSettings();
          const selfRegSettings = this.wizardService.getSelfRegistrationSettings();
          if (currentSettings && selfRegSettings) {
            this.wizardService.setSettings({
              ...currentSettings,
              SearchExistingVisitor: selfRegSettings.SearchExistingVisitor ?? currentSettings.SearchExistingVisitor,
              EnableWhitelistValidation: selfRegSettings.EnableWhitelistValidation ?? currentSettings.EnableWhitelistValidation,
              AptEndTime: selfRegSettings.AptEndTime ?? currentSettings.AptEndTime ?? ''
            });
          }

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

        // Parse the response structure: response is [{ Data: { Table, Table1, ... }, Status, ErrorLog }]
        const responseArray = Array.isArray(response) ? response : [response];
        const firstEntry = responseArray[0];
        const data = firstEntry?.Data || firstEntry;

        // Check API status
        if (firstEntry?.Status === false) {
          const errorMsg = firstEntry?.ErrorLog?.length ? firstEntry.ErrorLog.join(', ') : 'Unknown error';
          console.error('GetVisitorAck API returned error:', errorMsg);
          this.hasInvalidUrl = true;
          this.errorMessage = 'Invalid visitor acknowledgment link: ' + errorMsg;
          this.isLoading = false;
          return;
        }

        // Check for status/notification message in Table (e.g. expired appointment)
        const tableStatusData = data?.Table;
        if (tableStatusData?.length > 0 && tableStatusData[0]?.code !== undefined && tableStatusData[0].code !== 'S') {
          const message = tableStatusData[0].description || 'An error occurred with your appointment.';
          console.warn('Appointment status message:', tableStatusData[0].code, message);
          this.hasInvalidUrl = true;
          this.errorMessage = message;
          this.isLoading = false;
          //(message);
          //window.close();
          return;
        }

        const table1Data = data?.Table1;
        const table2Data = data?.Table2 || []; // Image details
        const table3Data = data?.Table3 || []; // Item declaration data

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
            idType: visitorData.ID_TYPE,
            idTypeDescription: visitorData.IDTYPEDESCRIPTION,
            expiredDate: visitorData.EXPIRED_DATE || visitorData.ID_EXPIRED_DATE,
            // Map UDF fields with AUDF prefix to match form control names (e.g. 'AUDF1')
            AUDF1: visitorData.UDF1,
            AUDF2: visitorData.UDF2,
            AUDF3: visitorData.UDF3,
            AUDF4: visitorData.UDF4,
            AUDF5: visitorData.UDF5,
            AUDF6: visitorData.UDF6,
            AUDF7: visitorData.UDF7,
            AUDF8: visitorData.UDF8,
            AUDF9: visitorData.UDF9,
            AUDF10: visitorData.UDF10,
            // Map VUDF fields to match form control names (e.g. 'VUDF1')
            VUDF1: visitorData.VUDF1,
            VUDF2: visitorData.VUDF2,
            VUDF3: visitorData.VUDF3,
            VUDF4: visitorData.VUDF4,
            VUDF5: visitorData.VUDF5,
            VUDF6: visitorData.VUDF6,
            VUDF7: visitorData.VUDF7,
            VUDF8: visitorData.VUDF8,
            VUDF9: visitorData.VUDF9,
            VUDF10: visitorData.VUDF10
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
            const branchIdStr = parsedVisitorData.branchId.toString();
            const branchIdNum = parseInt(branchIdStr);
            // Use numeric ID if parseable, otherwise keep as string
            this.selectedBranch = !isNaN(branchIdNum) ? branchIdNum : branchIdStr;
            this.isBranchFromQuery = true;
          }

          if (parsedVisitorData.categoryId) {
            const catIdStr = parsedVisitorData.categoryId.toString();
            const catIdNum = parseInt(catIdStr);
            // CategoryId can be a code like "GUST" or numeric — store as-is for matching
            this.selectedCategory = !isNaN(catIdNum) ? catIdNum : catIdStr;
            this.isCategoryFromQuery = true;
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
        const wizardTitle = this.labelService.getLabel('home_page_page_title', 'caption');
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
            TermsnCondTemplate: tcSettings.TermsnCond || '',
            SearchExistingVisitor: tcSettings.SearchExistingVisitor ?? false,
            EnableWhitelistValidation: tcSettings.EnableWhitelistValidation ?? false,
            AptEndTime: tcSettings.AptEndTime || ''
          });
         
          // Check AllowOnlywithVC flag
          if (tcSettings.AllowOnlywithVC !== undefined) {
            this.allowOnlyWithVC = tcSettings.AllowOnlywithVC === '1' || tcSettings.AllowOnlywithVC === 1 || tcSettings.AllowOnlywithVC === true;
          }

          // Block access if vc param is required but not present
          if (this.allowOnlyWithVC && !this.wizardService.refCatCode && !this.isAppointmentFlow) {
            this.isAccessDenied = true;
            this.hasInvalidUrl = true;
            this.errorMessage = this.allowOnlyWithVCBlockMessage;
            this.isLoading = false;
            this.sharedService.setAccessDenied(true);
          }
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

      // Find the Category field translation
      const categoryField = translationData.find((item: any) => item.Title === 'Category');
      if (categoryField) {
        this.categoryTranslation = {
          caption: categoryField.Caption || 'Category',
          placeholder: categoryField.Placeholder || 'Select Category'
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

  ngAfterViewChecked() {
    if (!this.termsAutoChecked && this.shouldShowTerms()) {
      const desktopEl = this.termsBodyEl?.nativeElement;
      const mobileEl = this.mTermsBodyEl?.nativeElement;
      // Prefer the element that is actually visible/laid out (scrollHeight > 0).
      // The desktop element lives inside display:none on mobile so its scrollHeight is always 0.
      const el = (mobileEl && mobileEl.scrollHeight > 0) ? mobileEl
        : (desktopEl && desktopEl.scrollHeight > 0) ? desktopEl
          : null;
      if (el) {
        this.termsAutoChecked = true;
        if (el.scrollHeight <= el.clientHeight + 2) {
          // Content fits without scrolling — enable checkbox immediately
          setTimeout(() => { this.termsScrolledToBottom = true; }, 0);
        }
      }
    }
  }

  onTermsScroll(event: Event) {
    const el = event.target as HTMLElement;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 20) {
      this.termsScrolledToBottom = true;
    }
  }

  checkTermsAutoScroll(el: HTMLElement) {
    // unused — kept for safety; auto-check is now handled in ngAfterViewChecked
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
              // Trigger full branch-selection flow (loads categories, settings, host data)
              await this.onBranchChange(this.selectedBranch);
            } else if (this.currentLanguage) {
              // Multi-branch: just load labels for the current language
              await this.getSelfRegistrationSettings();
            }
          }

          // Extract welcome page settings from Table1
          if (data?.Table1?.length) {
            const settings = data.Table1[0];
            this.initializePageSettings = settings;
            // Logo URL
            const logoUrl = settings.LogoUrl || settings.Logo || settings.ImgPathUrl;
            if (logoUrl) {
              this.logo = environment.proURL + logoUrl;
              this.sharedService.updateHeader(this.title, this.logo);
            }
            if(this.initializePageSettings.OrgLogo){
              this.logo = this.initializePageSettings.OrgLogo;
              this.sharedService.updateHeader(this.title, this.logo);
            }
            // Welcome text
            /*  if (settings.WelcomeText) {
               this.welcomeText = settings.WelcomeText ? settings.WelcomeText : '';
             } */
            // Branch selection caption and placeholder
            this.branchTranslation = {
              caption: settings.BranchCaption || settings.BranchLabel || settings.Caption || 'Branch',
              placeholder: settings.BranchPlaceholder || settings.Placeholder || 'Select Branch'
            };

            // SRWelcomeTitle and ShowWelcomeTitle
            if (settings.ShowWelcomeTitle !== undefined) {
              this.showWelcomeTitle = settings.ShowWelcomeTitle === '1' || settings.ShowWelcomeTitle === 1 || settings.ShowWelcomeTitle === true;
            }
            if (settings.SRWelcomeTitle) {
              this.pageTitle = settings.SRWelcomeTitle;
              this.wizardService.pageTitle = settings.SRWelcomeTitle;
            }

            // Check SRWithoutBC flag
            if (settings.SRWithoutBC !== undefined) {
              this.srWithoutBC = settings.SRWithoutBC;
            }

            // Check if access should be blocked when no BC query param
            if (this.srWithoutBC !== '1' && !this.isBranchFromQuery && !this.isAppointmentFlow) {
              this.isAccessDenied = true;
              this.hasInvalidUrl = true;
              this.errorMessage = this.srWithoutBCBlockMessage;
              this.isLoading = false;
              this.sharedService.setAccessDenied(true);
              return;
            }


          }

          // Only set loading to false if not from query (query flow handles it separately)
          if (!this.isBranchFromQuery) {
            this.isLoading = false;
          }
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

    // Back-nav restore: pre-select previous category without locking the dropdown
    if (this._backNavRestoreCategory != null) {
      const catToRestore = this._backNavRestoreCategory;
      this._backNavRestoreCategory = null;
      const match = this.categories.find(c =>
        String(c.visitor_ctg_id) === String(catToRestore)
      );
      if (match) {
        this.selectedCategory = match.visitor_ctg_id;
        this._suppressAutoProceed = true;
        this.onCategoryChange(this.selectedCategory); // loads settings, no auto-proceed
        setTimeout(() => { this._suppressAutoProceed = false; }, 1000);
      }
      this.isCategoryFromQuery = false; // ensure category dropdown is visible
      return; // skip normal auto-select / auto-proceed logic
    }

    // Auto-select category based on different scenarios
    if (this.categories.length === 1) {
      this.selectedCategory = this.categories[0].visitor_ctg_id;
      this.onCategoryChange(this.selectedCategory);
    } else if ((this.isAppointmentFlow || this.isCategoryFromQuery) && (this.selectedCategory || this.wizardService.categoryCodeFromQuery)) {
      // In appointment flow or category from query param, match by ID or code
      // Prefer server-resolved category code (from hc+vc API response) over selectedCategory
      const categoryToMatch = this.wizardService.categoryCodeFromQuery || this.selectedCategory;
      const validCategory = this.categories.find(c =>
        c.visitor_ctg_id === categoryToMatch ||
        String(c.visitor_ctg_id) === String(categoryToMatch) ||
        c.visitor_ctg_code === categoryToMatch ||
        String(c.visitor_ctg_code) === String(categoryToMatch)
      );
      if (validCategory) {
        // Use the numeric visitor_ctg_id for downstream APIs
        this.selectedCategory = validCategory.visitor_ctg_id;
        this.onCategoryChange(this.selectedCategory);
      }
    }
  }

  async onBranchChange(newValue: any) {
    this.isLoading = true;
    let lsBranchName = this.getBranchName(newValue);

    // Don't reset category in appointment flow, query param flow, or back-nav restore
    if (!this.isAppointmentFlow && !this.isCategoryFromQuery && this._backNavRestoreCategory == null) {
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

      const branchLogoUrl = environment.proURL + "Handler/PortalImageHandler.ashx?ScreenType=20&RefSlno=" + newValue;
      this.logo = branchLogoUrl;
      this.title = lsBranchName;
      this.sharedService.updateHeader(lsBranchName, branchLogoUrl);
    } catch (error) {
      console.error('Error in branch change:', error);
    } finally {
      // Ensure loading is always turned off
      setTimeout(() => {
        this.isLoading = false;
        if (this.selectedBranch == null && this.initializePageSettings) {
          // SRWelcomeTitle and ShowWelcomeTitle
          if (this.initializePageSettings.ShowWelcomeTitle !== undefined) {
            this.showWelcomeTitle = this.initializePageSettings.ShowWelcomeTitle === '1' || this.initializePageSettings.ShowWelcomeTitle === 1 || this.initializePageSettings.ShowWelcomeTitle === true;
          }
          if (this.initializePageSettings.SRWelcomeTitle) {
            this.pageTitle = this.initializePageSettings.SRWelcomeTitle;
            this.wizardService.pageTitle = this.initializePageSettings.SRWelcomeTitle;
          }

          this.branchTranslation = {
            caption: this.initializePageSettings.branchSelectionCaption || 'Branch',
            placeholder: this.initializePageSettings.branchSelectionPlaceHolder || 'Select Branch'
          };

          if (this.initializePageSettings.OrgLogo) {
            this.logo = this.initializePageSettings.OrgLogo;
            this.sharedService.updateHeader(this.title, this.logo);
          }

        }
      }, 300);
    }
  }

  onCategoryChange(newValue: any) {
    this.isLoading = true;
    // Reset terms state so the scroll-to-enable check reruns for the new category
    this.termsScrolledToBottom = false;
    this.termsAccepted = false;
    this.termsAutoChecked = false;

    // Don't call GetVisitorDeclarationSettings if category is null or empty
    if (!newValue) {
      this.isLoading = false;
      return;
    }

    this.api.GetVisitorDeclarationSettings(this.selectedBranch, newValue, this.wizardService.refCode || undefined, this.wizardService.refCatCode || undefined)
      .subscribe({
        next: (allSettings: any) => {
          // Validate that settings have required data (Table = settingDetails, Table2 = configuration details)
          const hasSettingDetails = allSettings?.Table && Array.isArray(allSettings.Table) && allSettings.Table.length > 0;
          const hasTable2Data = allSettings?.Table2 && Array.isArray(allSettings.Table2) && allSettings.Table2.length > 0;

          // If either settingDetails or Table2 is empty, show alert and don't proceed
          if (!hasSettingDetails || !hasTable2Data) {
            this.isLoading = false;
            this.messageHelper.error(
              this.labelService.getLabel('home_page_category_config_missing_alert_description') || 'This category is not configured to proceed. Please contact admin.',
              5000
            );
            // Reset selected category and terms state
            this.selectedCategory = null;
            this.termsScrolledToBottom = false;
            this.termsAccepted = false;
            this.termsAutoChecked = false;
            return;
          }

          // Merge selfRegistrationSettings if already available (synchronous check).
          // If not yet loaded, step-general's getSelfRegistrationSettings$() subscription
          // will merge SearchExistingVisitor etc. as soon as they arrive.
          const selfRegSettings = this.wizardService.getSelfRegistrationSettings();
          if (selfRegSettings) {
            allSettings = {
              ...allSettings,
              SearchExistingVisitor: selfRegSettings.SearchExistingVisitor ?? allSettings.SearchExistingVisitor,
              EnableWhitelistValidation: selfRegSettings.EnableWhitelistValidation ?? allSettings.EnableWhitelistValidation,
              AptEndTime: selfRegSettings.AptEndTime ?? allSettings.AptEndTime ?? ''
            };
          }
          this.wizardService.setSettings(allSettings);

          // Check if terms are disabled - if so, auto-proceed to wizard
          // _suppressAutoProceed is set during back-nav category restore to prevent jumping.
          if (!this.shouldShowTerms() && !this._suppressAutoProceed) {
            console.log('Terms disabled - auto-proceeding to wizard');
            setTimeout(() => {
              this.proceedToWizard();
            }, 300);
          } else {
            // Add small delay to ensure smooth loading transition
            setTimeout(() => {
              this.isLoading = false;
            }, 300);
          }
        },
        error: (error) => {
          console.error('Error loading category settings:', error);
          this.isLoading = false;
          this.messageHelper.error(
            this.labelService.getLabel('home_page_category_config_missing_alert_description') || 'This category is not configured to proceed. Please contact admin.',
            5000
          );
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

          const pageLogoUrl = environment.proURL + "Handler/PortalImageHandler.ashx?ScreenType=20&RefSlno=" + this.selectedBranch;
          this.logo = pageLogoUrl;
          this.title = pageSettings.Table[0].SchoolName || this.title;
          this.sharedService.updateHeader(this.title, pageLogoUrl);

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
    const template = this.labelService.getLabel('terms_and_conditions_tc', 'caption') || '';
    if (template !== this._cachedTermsTemplate) {
      this._cachedTermsTemplate = template;
      this._cachedTermsHtml = template
        ? this.sanitizer.bypassSecurityTrustHtml(template)
        : '';
    }
    return this._cachedTermsHtml;
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
      this.wizardService.selectedVisitCategoryName = this.getCategoryName(this.selectedCategory);
      this.wizardService.isNavigatedFromHome = true;
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
    this.termsAccepted = false;
    this.termsScrolledToBottom = false;
    this.termsAutoChecked = false;
    // Clear any stored settings related to category
    this.wizardService.setSettings(null);
  }
}

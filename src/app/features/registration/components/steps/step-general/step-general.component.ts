import { Component, OnDestroy, OnInit, Sanitizer, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, ValidatorFn, FormArray, FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { WizardService } from '../../../../../core/services/wizard.service';
import { InputTextModule } from 'primeng/inputtext';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { DatePickerModule } from 'primeng/datepicker';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { SelectChangeEvent, SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { DividerModule } from 'primeng/divider';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { filter, Subject, takeUntil } from 'rxjs';
import { ApiService } from '../../../../../core/services/api.service';
import { TranslatePipe } from '../../../../../shared/pipes/translate.pipe';
import { GENDER_OPTIONS } from '../../../../../shared/app.constants';
import { SharedService } from '../../../../../shared/shared.service';


@Component({
  selector: 'app-step-general',
  standalone: true,
  imports: [DatePickerModule, SelectModule, ReactiveFormsModule, FormsModule, InputTextModule, AutoCompleteModule, TranslatePipe, MultiSelectModule, DividerModule, CheckboxModule, ButtonModule, TableModule, DialogModule],
  templateUrl: './step-general.component.html',
  styleUrls: ['./step-general.component.scss']
})
export class StepGeneralComponent implements OnInit, OnDestroy {
  generalForm: FormGroup = new FormGroup({});
  profileImage: SafeUrl | string = "";
  hosts: any[] = [];
  departmentList: any[] = [];
  hostNameList: any[] = [];
  hostDepartmentList: any[] = [];
  facilityList: any[] = [];
  titleList: any[] = [];
  idTypeList: any[] = [];
  companyList: any[] = [];
  meetingLocList: any[] = [];
  countryList: any[] = [];
  purposeList: any[] = [];
  meetingFloorList: any[] = [];
  genderOptions = GENDER_OPTIONS;

  settings: any = {};
  minDate = new Date();
  showIdExpiryField = false;
  selectedIdTypeData: any = null;
  gbShowMemberId = false;
  showTime = true;
  masterData: any = {};
  isLoading = true;
  pageSettings: any[] = [];
  udfSettings: any[] = [];
  udfOptions: any[] = [];
 title = 'Company Title';
  logo = 'assets/logo.png';
  // New properties for VIMS appointment and facility booking
  localSettings: any = {};
  enableVimsApptTimeSlot = false;
  enableSelfRegistrationHostPreload = false;

  // Default host settings
  defaultHostEnabled = false;
  defaultHostId: any = null;
  shouldHideHostControl = false;

  // Visitor acknowledgment data
  visitorAckData: any = null;
  isAppointmentFlow = false;
  shouldFilterHostByQueryParam = false; // Flag to indicate if host should be filtered for query param flow
  // Fields that are allowed to be edited in appointment flow (visitor acknowledgment)
  allowedEditableFields = ['fullName', 'visitor_id', 'email', 'phone', 'gender', 'host']; // Temporarily enable host for testing

  // Fields that should be hidden in appointment flow
  hiddenFieldsInAppointmentFlow: string[] = []; // Temporarily enable host to test auto-selection

  // Singapore PDPA settings
  isSingaporePDPARequired = false;

  // Visitor table view properties
  showVisitorTable = false;
  editingVisitorIndex = -1;

  // Dialog and popup properties
  showAddVisitorDialog = false;
  currentEditingVisitor: any = null;
  showVisitorDialog = false;
  dialogTitle = 'add_visitor'; // Translation key instead of hardcoded text
  dialogVisitorForm: FormGroup = new FormGroup({});
  enableFBInSelfReg = false;
  timeSlotList: any[] = [];
  facilityPurposeList: any[] = [];
  facilityMasterList: any[] = [];
  facilityBookingSlots: any[] = [];
  selectedBookingSlot: any = null;
  bookedSlotIds: string = ''; // Track selected slot IDs

  // Host search functionality
  hostSearchText: string = '';
  showReturningVisitorPopup = false;
  searchQuery = '';
  isHostSearching: boolean = false;

  // Original host data for filtering
  originalHostData: any[] = [];

  // Multiple visitors functionality
  visitors: any[] = [];
  currentVisitorIndex = 0;
  isMultipleVisitorMode = false;

  // Saved visitors for single visitor mode
  savedVisitors: any[] = [];
  currentStepIndex = 0;
  totalSteps = 4;
  isLastStep = false;
  submitted = false;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private wizardService: WizardService,
    private messageService: MessageService,
    private sanitizer: DomSanitizer,
        private sharedService: SharedService,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {
        this.sharedService.currentTitle.subscribe(title => {
      this.title = title;
    });
    this.sharedService.currentLogo.subscribe(logo => {
      this.logo = logo;
    });
  }

  ngOnInit(): void {
    console.log('=== STEP-GENERAL INIT START ===');

    this.wizardService.getSettings$().pipe(
      filter(settings => settings !== null),
      takeUntil(this.destroy$)
    ).subscribe(settings => {
      console.log('Settings loaded:', settings);
      this.settings = settings;
      this.isSingaporePDPARequired = settings?.IsSingaporePDPARequired === true;
      this.loadUdfSettings();
      this.loadLocalSettings(); // Load local settings for VIMS features
      // Note: isLoading will be set to false in loadUdfSettings after UDF settings are loaded
    });

    // Load page settings for gbShowMemberId and other configurations
    this.wizardService.getPageSettings$().pipe(
      filter(pageSettings => pageSettings !== null),
      takeUntil(this.destroy$)
    ).subscribe((pageSettings: any) => {
      console.log('Page settings loaded:', pageSettings);
      this.pageSettings = pageSettings;
      this.processPageSettings(pageSettings);
    });

    this.masterData = this.wizardService.getmasterData();
    console.log('Master data:', this.masterData);

    // Check for visitor acknowledgment data (appointment flow)
    this.visitorAckData = this.wizardService.getIncomingVisitorAckData();
    if (this.visitorAckData) {
      this.isAppointmentFlow = this.visitorAckData.isAppointmentFlow;
      console.log('Visitor acknowledgment data found:', this.visitorAckData);
    }

    if (!this.masterData) {
      console.log('No master data found, redirecting to home page');
      this.wizardService.gotoHomePage();
      /*this.api.getMasterDetails().subscribe((data: any) => {
        if (data?.Table?.length && data.Table[0].Code == '10') {
          this.wizardService.setmasterData(data);
          this.masterData = data;
        }
      });*/
    }

    if (this.masterData) {
      this.meetingFloorList = this.masterData.Table2 || [];
      this.purposeList = this.masterData.Table3 || [];
      this.departmentList = this.masterData.Table5 || [];
      this.hostDepartmentList = this.masterData.Table5 || [];
      // Note: meetingLocList and titleList will be loaded from GetBranchHostDataTable12      this.countryList = this.masterData.Table13 || [];

      // Table12 Type list from Table12 correct field mapping
      if (this.masterData && this.masterData.Table12 && this.masterData.Table12.length > 0) {
        this.idTypeList = [...this.masterData.Table12];
        console.log('ID Type list loaded from master data:', this.idTypeList.length);
        console.log('Sample ID Type data:', this.idTypeList[0]);
      }
      else {
        this.idTypeList = [];
      }

      // Set Company list from Table7
      if (this.masterData && this.masterData.Table7 && this.masterData.Table7.length > 0) {
        this.companyList = [...this.masterData.Table7.filter((item: any) => {
          return item.visitor_comp_name !== undefined && item.visitor_comp_name !== null && item.visitor_comp_name !== "";
        })];
        console.log('Company list loaded from master data:', this.companyList.length);
      }
      else {
        this.companyList = [];
      }

      // Conditionally load hosts based on EnableSelfRegistrationHostPreload setting
      // This will be handled after local settings are loaded
    } else {
      // Initialize empty arrays if no master data
      this.meetingFloorList = [];
      this.purposeList = [];
      this.departmentList = [];
      this.hostDepartmentList = [];
      this.countryList = [];
      this.idTypeList = [];
      this.companyList = [];
      this.titleList = [];
      this.meetingLocList = [];
      this.hosts = [];
      this.hostNameList = [];
    }

    this.generalForm.valueChanges.subscribe(() => {
      // Auto-save form data including saved visitors
      this.saveFormDataToWizard();
    });

    // Watch for facility booking changes to update validation
    this.generalForm.get('facilityBooking')?.valueChanges.subscribe((value: boolean) => {
      if (this.enableFBInSelfReg) {
        // Keep controls enabled but update validation requirements
        this.setupControl('facilityPurpose', true, value);
        this.setupControl('facilitySelection', true, value);

        // Handle shared date validation
        if (this.enableVimsApptTimeSlot && this.enableFBInSelfReg) {
          this.setupControl('sharedDate', true, true);
          // Time slot is only required when not doing facility booking
          this.setupControl('timeSlot', true, !value);
        }
      }
    });

    this.wizardService.onValidationRequest.subscribe(() => {
      this.validateForm();
    });

    this.currentStepIndex = this.wizardService.getCurrentStepIndex();
    this.totalSteps = this.wizardService.getTotalSteps();
    this.isLastStep = this.currentStepIndex === this.totalSteps - 1;
  }



  onStartDateSelect(selectedDate: Date) {
    const endDateControl = this.generalForm.get('endDate');

    if (endDateControl?.value && endDateControl.value < selectedDate) {
      endDateControl.reset();
    }

    const defaultEndDate = new Date(selectedDate);
    defaultEndDate.setHours(defaultEndDate.getHours() + 1);
    endDateControl?.setValue(defaultEndDate);

    endDateControl?.markAsTouched();
  }

  onAppointmentDateSelect(selectedDate: Date) {
    const branchId = this.wizardService.currentBranchID;
    const categoryId = this.wizardService.selectedVisitCategory;

    if (selectedDate && branchId && categoryId) {
      const formattedDate = this.formatDateToYYYYMMDD(selectedDate);
      this.loadTimeSlots(formattedDate, branchId, categoryId);
    }

    // Clear time slot when date changes
    this.generalForm.patchValue({ timeSlot: '' });
  }

  onFacilityBookingChange(event: any) {
    const checked = event.target ? event.target.checked : (typeof event === 'boolean' ? event : event.checked);
    if (checked) {
      // Load facility data when checkbox is checked
      this.loadFacilityData();
    } else {
      // Clear facility related fields when unchecked
      this.generalForm.patchValue({
        facilityPurpose: '',
        facilitySelection: ''
      });
      this.facilityBookingSlots = [];
      this.bookedSlotIds = '';
      this.selectedBookingSlot = null;
    }
  }

  onFacilitySelectionChange(facilityCode: string) {
    console.log('Facility selected:', facilityCode);
    const sharedDate = this.generalForm.get('sharedDate')?.value;

    if (facilityCode && sharedDate) {
      this.loadFacilityBookingSlots(facilityCode, sharedDate);
    }
  }

  onSharedDateSelect(selectedDate: Date) {
    if (!selectedDate) return;

    const facilityBookingEnabled = this.generalForm.get('facilityBooking')?.value;

    if (facilityBookingEnabled) {
      // Handle facility booking flow
      const facilityCode = this.generalForm.get('facilitySelection')?.value;
      if (facilityCode) {
        this.loadFacilityBookingSlots(facilityCode, selectedDate);
      }
    } else if (this.enableVimsApptTimeSlot) {
      // Handle regular appointment time slot flow
      const branchId = this.wizardService.currentBranchID;
      const categoryId = this.wizardService.selectedVisitCategory;

      if (branchId && categoryId) {
        const formattedDate = this.formatDateToYYYYMMDD(selectedDate);
        this.loadTimeSlots(formattedDate, branchId, categoryId);
      }
    }

    // Clear related fields when date changes
    this.generalForm.patchValue({ timeSlot: '' });
    this.facilityBookingSlots = [];
    this.bookedSlotIds = '';
    this.selectedBookingSlot = null;
  }

  private loadFacilityBookingSlots(facilityCode: string, selectedDate: Date) {
    const dateString = selectedDate.toISOString();

    this.api.VimsAppGetBookingSlot(facilityCode, dateString).subscribe((response: any) => {
      console.log('Facility booking slots response:', response);
      if (response?.Table?.length) {
        console.log('Sample slot data:', response.Table[0]);
        this.facilityBookingSlots = this.groupBookingSlotsByTime(response.Table);
      } else {
        this.facilityBookingSlots = [];
      }
    });
  }


  private groupBookingSlotsByTime(slots: any[]): any[] {
    const grouped = slots.reduce((acc, slot) => {
      const startTime = slot.StartTime;
      if (!acc[startTime]) {
        acc[startTime] = [];
      }
      acc[startTime].push(slot);
      return acc;
    }, {});

    return Object.keys(grouped).map(startTime => ({
      startTime,
      slots: grouped[startTime]
    }));
  }

  getSlotCssClass(slot: any): string {
    const dataRef = `${slot.StartTime},${slot.EndTime}`;

    // Check if slot is just booked (selected by user)
    if (this.bookedSlotIds.includes(dataRef + '_')) {
      return 'clsbookslot clsJustBooked';
    }

    // Use the original logic: getValidateTime(StartTime, ServerTime, bookingId)
    return this.getValidateTime(slot.StartTime, slot.ServerTime, slot.BookingID);
  }

  // Replicate the original getValidateTime function
  getValidateTime(startTime: string, serverTime: string, bookingId: any): string {
    if (bookingId) {
      return 'clsbookslot clsBooked';
    } else {
      // Handle different date formats and potential null/undefined values
      let currentTime: Date;
      let startDate: Date;

      try {
        // If no serverTime provided or invalid, use current time
        if (!serverTime || serverTime === 'null' || serverTime === 'undefined') {
          currentTime = new Date();
        } else {
          currentTime = new Date(serverTime);
          // Check if date is valid
          if (isNaN(currentTime.getTime())) {
            currentTime = new Date();
          }
        }

        startDate = new Date(startTime);
        // Check if start date is valid
        if (isNaN(startDate.getTime())) {
          console.warn('Invalid start time:', startTime);
          return 'clsbookslot clsExpired';
        }

        // Debug logging (remove this after testing)
        console.log('Time comparison:', {
          serverTime: serverTime,
          currentTime: currentTime.toISOString(),
          startTime: startDate.toISOString(),
          isAvailable: currentTime < startDate,
          bookingId: bookingId
        });

        return currentTime < startDate ? 'clsbookslot clsAvail' : 'clsbookslot clsExpired';

      } catch (error) {
        console.error('Error parsing dates:', error, { startTime, serverTime });
        // Default to expired if there's an error
        return 'clsbookslot clsExpired';
      }
    }
  }

  // Replicate the original BookingSlotClick function
  bookingSlotClick(event: Event, slot: any): void {
    const element = event.target as HTMLElement;

    // Find the actual slot element (could be nested)
    const slotElement = element.closest('.clsbookslot') as HTMLElement || element;

    if (!slotElement || !slotElement.className) return;

    const className = slotElement.className;

    if (className.indexOf('clsAvail') > -1) {
      const dataRef = slotElement.getAttribute('data-ref');
      if (dataRef) {
        this.bookedSlotIds += dataRef + '_';
        slotElement.setAttribute('class', 'clsbookslot clsJustBooked');
        this.selectedBookingSlot = slot;
        console.log('Slot selected:', slot);
      }
    } else if (className.indexOf('clsJustBooked') > -1) {
      const dataRef = slotElement.getAttribute('data-ref');
      if (dataRef) {
        this.bookedSlotIds = this.bookedSlotIds.replace(dataRef + '_', '');
        slotElement.setAttribute('class', 'clsbookslot clsAvail');
        this.selectedBookingSlot = null;
        console.log('Slot deselected');
      }
    }
    // Do nothing for booked or expired slots
  }

  getSelectedBookingSlots(): string[] {
    // Return array of selected slot references
    return this.bookedSlotIds.split('_').filter(id => id.length > 0);
  }

  // Replicate the original getSlotTime function
  getSlotTimeDisplay(startTime: string, endTime: string): string {
    const start = new Date(startTime);
    const end = new Date(endTime);

    // Format time as "hh:mm tt" (12-hour format with AM/PM) like the original
    const formatTime = (date: Date) => {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    };

    return `${formatTime(start)} - ${formatTime(end)}`;
  }

  private formatDateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private loadTimeSlots(currentDate: string, branchId: string, categoryId: string) {
    this.api.GetApptTimeSlot(currentDate, branchId, categoryId).subscribe((response: any) => {
      if (response?.Table?.length) {
        this.timeSlotList = response.Table;
      } else {
        this.timeSlotList = [];
      }
    });
  }

  private loadUdfSettings() {
    this.wizardService.getUdfSettings$().pipe(
      filter(udfSettings => udfSettings !== null),
      takeUntil(this.destroy$)
    ).subscribe((udfSettings: any) => {
      this.udfSettings = udfSettings.Table;
      this.udfOptions = udfSettings.Table1;
      this.initializeForm();
      this.setupConditionalControls();

      // Set loading to false after everything is initialized
      this.isLoading = false;
    });
  }

  private loadLocalSettings() {
    const branchId = this.wizardService.currentBranchID;
    console.log('Loading local settings for branch:', branchId);

    if (branchId) {
      this.api.GetLocalSettingsDataByBranch(branchId).subscribe((response: any) => {
        if (response?.length) {
          this.localSettings = typeof response[0].LocalSettings === 'string' ? JSON.parse(response[0].LocalSettings) : response[0].LocalSettings;
          this.enableVimsApptTimeSlot = this.localSettings.EnableVimsApptTimeSlot === true;
          this.enableFBInSelfReg = this.localSettings.EnableFBInSelfReg === true;
          this.enableSelfRegistrationHostPreload = this.localSettings.EnableSelfRegistrationHostPreload === true;

          // Handle default host settings
          this.defaultHostEnabled = this.localSettings.DefaultHostEnabled === true;
          this.defaultHostId = this.localSettings.DefaultHostId;
          this.shouldHideHostControl = this.defaultHostEnabled && this.defaultHostId;

          console.log('Local settings loaded:', {
            enableVimsApptTimeSlot: this.enableVimsApptTimeSlot,
            enableFBInSelfReg: this.enableFBInSelfReg,
            enableSelfRegistrationHostPreload: this.enableSelfRegistrationHostPreload,
            defaultHostEnabled: this.defaultHostEnabled,
            shouldHideHostControl: this.shouldHideHostControl
          });

          // Load hosts immediately when proceeding from homepage (not lazy loading)
          this.loadBranchData();

          // Reinitialize form with new controls
          this.initializeForm();
          this.setupConditionalControls();
        } else {
          console.log('No local settings found, loading branch data anyway');
          // Load branch data even if no local settings
          this.loadBranchData();
        }
      }, (error) => {
        console.error('Error loading local settings:', error);
        // Load branch data even if local settings fail
        this.loadBranchData();
      });
    } else {
      console.log('No branch ID found, loading branch data with default settings');
      // Load branch data even if no branch ID
      this.loadBranchData();
    }
  }

  private loadFacilityData() {
    // Only load facility data if facility booking is enabled
    if (!this.enableFBInSelfReg) {
      console.log('Facility booking is disabled, skipping facility data loading');
      return;
    }

    console.log('Loading facility data...');

    // Load facility purpose list
    this.api.VimsAppFacilityPurposeList().subscribe((response: any) => {
      if (response?.Table1?.length) {
        this.facilityPurposeList = response.Table1;
        console.log('Facility purpose list loaded:', this.facilityPurposeList.length);
      }
    });

    // Load facility master list  
    this.api.VimsAppFacilityMasterList().subscribe((response: any) => {
      if (response?.Table1?.length) {
        this.facilityMasterList = response.Table1;
        this.facilityList = response.Table1; // Use the same data for facilityList
        console.log('Facility master list loaded:', this.facilityMasterList.length);
      }
    });
  }

  private loadBranchData() {
    const branchId = this.wizardService.currentBranchID;
    console.log('Loading branch data with branch ID:', branchId, 'EnableSelfRegistrationHostPreload:', this.enableSelfRegistrationHostPreload, 'IsAppointmentFlow:', this.isAppointmentFlow);

    // First check if branch host data is already pre-loaded from home page
    const preLoadedBranchData = this.wizardService.getBranchHostData();
    if (preLoadedBranchData) {
      console.log('Using pre-loaded branch host data from home page');
      this.processBranchHostData(preLoadedBranchData);
      return;
    }

    // Only skip host loading in appointment flow when host preload is enabled
    // In normal flow, always load hosts regardless of the preload setting
    if (this.enableSelfRegistrationHostPreload && this.isAppointmentFlow) {
      // Don't preload hosts - they will be loaded via search (only for appointment flow)
      console.log('Host preload enabled for appointment flow, hosts will be loaded via search');
      this.hosts = [];
      this.hostNameList = [];
      // Still load other data like titles and rooms
      this.loadOtherBranchData();
    } else {
      // Load complete branch data from GetBranchHostData API (for normal flow or when preload is disabled)
      if (branchId) {
        console.log('Calling GetBranchHostData API for branch:', branchId);

        // Pass the inverse of enableSelfRegistrationHostPreload as PreloadHostData
        // If enableSelfRegistrationHostPreload is true, we DON'T want to preload (PreloadHostData = false)
        // If enableSelfRegistrationHostPreload is false, we DO want to preload (PreloadHostData = true)
        const preloadHostData = !this.enableSelfRegistrationHostPreload;

        this.api.GetBranchHostData(branchId, preloadHostData).subscribe({
          next: (response: any) => {
            this.processBranchHostData(response);
          },
          error: (error) => {
            console.error('Error loading GetBranchHostData:', error);
            this.hosts = [];
            this.hostNameList = [];
            this.originalHostData = [];
          }
        });
      } else {
        console.log('No branch ID available');
        this.hosts = [];
        this.hostNameList = [];
        this.originalHostData = [];
      }
    }
  }

  /**
   * Process branch host data response (extracted from API call for reusability)
   */
  private processBranchHostData(response: any): void {
    console.log('GetBranchHostData response:', response);

    // Process hosts from main Table (similar to JavaScript uiGetBranchHostDataResponse)
    if (response && response.Table && response.Table.length > 0) {
      console.log('Processing hosts from Table, count:', response.Table.length);

      // Store original host data for filtering
      this.originalHostData = [...response.Table];

      // Map hosts with proper field names (use HOSTNAME and HOSTIC like JavaScript)
      this.hosts = response.Table.map((host: any) => {
        let formattedHost = { ...host };

        // Ensure HOSTNAME field exists for dropdown display
        if (!host.HOSTNAME && host.Name) {
          formattedHost.HOSTNAME = host.Name;
        }

        // Ensure HOSTIC field exists for dropdown value
        if (!host.HOSTIC && host.HostIC) {
          formattedHost.HOSTIC = host.HostIC;
        } else if (!host.HOSTIC && host.SeqId) {
          formattedHost.HOSTIC = host.SeqId;
        }

        // Format with member ID if enabled (like JavaScript gbShowMemberId logic)
        if (this.gbShowMemberId && host.MemberID) {
          formattedHost.HOSTNAME = `${host.Name || host.HOSTNAME || ''} (${host.MemberID})`.trim();
        }

        return formattedHost;
      });

      this.hostNameList = [...this.hosts];
      console.log('Hosts processed successfully, count:', this.hosts.length);
      console.log('Sample host data:', this.hosts[0]);

      // Create department list from host data for bidirectional filtering
      const uniqueDepartments = [...new Set(response.Table
        .filter((host: any) => host.Department)
        .map((host: any) => host.Department))];

      if (uniqueDepartments.length > 0) {
        console.log('Creating department list from host data:', uniqueDepartments.length);

        // Create department objects with proper structure for filtering
        const hostDepartments = uniqueDepartments.map(dept => ({
          Department: dept,
          DName: dept,
          DepartmentSeqId: dept // Use department name as ID for filtering
        }));

        // Combine with existing Table5 departments (if any)
        this.departmentList = [
          ...(this.masterData?.Table5 || []),
          ...hostDepartments
        ];

        // Remove duplicates based on DName
        this.departmentList = this.departmentList.filter((dept, index, self) =>
          index === self.findIndex(d => d.DName === dept.DName)
        );

        console.log('Final department list:', this.departmentList);
      }
    } else {
      console.log('No hosts found in GetBranchHostData response Table');
      this.hosts = [];
      this.hostNameList = [];
      this.originalHostData = [];
    }

    // Process Room data from Table1 (similar to JavaScript logic)
    if (response && response.Table1 && response.Table1.length > 0) {
      let filteredRooms = [...response.Table1.filter((item: any) => {
        return !item.IsForPatientVisit;
      })];
      this.meetingLocList = filteredRooms;
      console.log('Rooms loaded from GetBranchHostData Table1:', filteredRooms.length);
    }

    // Process Title data from Table8 or Table9 (exactly like JavaScript logic)
    if (response && response.Table8 && response.Table8.length > 0 && response.Table8[0].Title) {
      this.titleList = [...response.Table8];
      console.log('Titles loaded from GetBranchHostData Table8:', this.titleList.length);
    }
    else if (response && response.Table9 && response.Table9.length > 0 && response.Table9[0].Title) {
      this.titleList = [...response.Table9];
      console.log('Titles loaded from GetBranchHostData Table9:', this.titleList.length);
    }
    else {
      this.titleList = [];
      console.log('No titles found in GetBranchHostData response');
    }

    // Set department for default host if enabled after hosts are loaded
    if (this.shouldHideHostControl && this.defaultHostId) {
      this.setDepartmentForDefaultHost();
    }

    // Apply query parameter host filtering for appointment flow
    this.applyQueryParamHostFiltering();
  }

  /**
   * Process only titles and rooms from branch data response
   */
  private processBranchTitlesAndRooms(response: any): void {
    // Only process non-host data
    if (response && response.Table1 && response.Table1.length > 0) {
      let filteredRooms = [...response.Table1.filter((item: any) => {
        return !item.IsForPatientVisit;
      })];
      this.meetingLocList = filteredRooms;
      console.log('Rooms loaded for host preload mode:', filteredRooms.length);
    }

    if (response && response.Table8 && response.Table8.length > 0 && response.Table8[0].Title) {
      this.titleList = [...response.Table8];
      console.log('Titles loaded for host preload mode (Table8):', this.titleList.length);
    }
    else if (response && response.Table9 && response.Table9.length > 0 && response.Table9[0].Title) {
      this.titleList = [...response.Table9];
      console.log('Titles loaded for host preload mode (Table9):', this.titleList.length);
    }
  }

  private loadOtherBranchData() {
    // Load only titles and rooms when host preload is disabled
    const branchId = this.wizardService.currentBranchID;

    // First check if we have pre-loaded branch data
    const preLoadedBranchData = this.wizardService.getBranchHostData();
    if (preLoadedBranchData) {
      console.log('Using pre-loaded branch data for titles and rooms');
      this.processBranchTitlesAndRooms(preLoadedBranchData);
      return;
    }

    if (branchId) {
      // When loading other branch data, we don't need host data, so set PreloadHostData to false
      this.api.GetBranchHostData(branchId, false).subscribe({
        next: (response: any) => {
          this.processBranchTitlesAndRooms(response);
        },
        error: (error) => {
          console.error('Error loading other branch data:', error);
        }
      });
    }
  }

  // Apply query parameter host filtering for appointment flow
  private applyQueryParamHostFiltering() {
    // Only apply filtering if we're in appointment flow and have visitor ack data
    if (!this.isAppointmentFlow || !this.visitorAckData?.visitorData?.hostId) {
      console.log('Not in appointment flow or no hostId found, skipping host filtering');
      return;
    }

    const hostId = this.visitorAckData.visitorData.hostId;
    console.log('Applying query parameter host filtering for HostId:', hostId);

    // Find the host that matches the HostId from visitor ack data
    const matchingHost = this.hosts.find((host: any) => {
      return host.HOSTIC === hostId ||
        host.HostIC === hostId ||
        host.SeqId === hostId;
    });

    if (matchingHost) {
      console.log('Found matching host for HostId:', hostId, matchingHost);

      // Filter hosts to only show the matching host
      this.hosts = [matchingHost];
      this.hostNameList = [matchingHost];
      this.shouldFilterHostByQueryParam = true;

      // Auto-select the host in the form
      this.generalForm.get('host')?.setValue(matchingHost.HOSTIC || matchingHost.HostIC || matchingHost.SeqId);

      // Disable the host control since it should be fixed for appointment flow (don't hide it)
      this.shouldFilterHostByQueryParam = true;

      console.log('Host filtered and auto-selected for appointment flow');
    } else {
      console.warn('No matching host found for HostId:', hostId, 'Available hosts:', this.hosts);
      // If no matching host found, keep all hosts but log the issue
      this.shouldFilterHostByQueryParam = false;
    }
  }

  searchExistHost(searchText: string): void {
    if (!this.enableSelfRegistrationHostPreload || !searchText || searchText.trim().length < 2) {
      return;
    }

    const branchId = this.wizardService.currentBranchID;
    if (!branchId) {
      return;
    }

    this.isHostSearching = true;

    const loParams = {
      "SearchString": searchText.trim(),
      "OffSet": "0",
      "Rows": "10",
      "Branch": branchId
    };

    // Add device parameters if available
    // Object.assign(loParams, DeviveParam); // Uncomment when DeviveParam is available

    this.api.SearchExistHost(loParams).subscribe({
      next: (response: any) => {
        this.isHostSearching = false;
        if (response?.Table?.length) {
          // Map search results with proper field names for consistency
          this.hosts = response.Table.map((host: any) => {
            let formattedHost = { ...host };

            // Ensure HOSTNAME field exists for dropdown display
            if (!host.HOSTNAME && host.Name) {
              formattedHost.HOSTNAME = host.Name;
            }

            // Ensure HOSTIC field exists for dropdown value
            if (!host.HOSTIC && host.HostIC) {
              formattedHost.HOSTIC = host.HostIC;
            } else if (!host.HOSTIC && host.SeqId) {
              formattedHost.HOSTIC = host.SeqId;
            }

            // Format with member ID if enabled
            if (this.gbShowMemberId && host.MemberID) {
              formattedHost.HOSTNAME = `${host.Name || host.HOSTNAME || ''} (${host.MemberID})`.trim();
            }

            return formattedHost;
          });

          this.hostNameList = [...this.hosts];

          // Apply query parameter host filtering for appointment flow even on search results
          this.applyQueryParamHostFiltering();
        } else {
          this.hosts = [];
          this.hostNameList = [];
        }
      },
      error: (error: any) => {
        this.isHostSearching = false;
        console.error('Error searching hosts:', error);
        this.hosts = [];
        this.hostNameList = [];
      }
    });
  }

  onHostSearch(searchText: string): void {
    this.hostSearchText = searchText;
    if (this.enableSelfRegistrationHostPreload) {
      // Debounce the search to avoid too many API calls
      if (this.hostSearchTimeout) {
        clearTimeout(this.hostSearchTimeout);
      }
      this.hostSearchTimeout = setTimeout(() => {
        this.searchExistHost(searchText);
      }, 500);
    }
  }

  private hostSearchTimeout: any;

  private formatVisitorIdForPDPA(visitorId: string, fullName: string): string {
    if (!this.isSingaporePDPARequired || !visitorId || !fullName) {
      return visitorId;
    }

    // Get first name (everything before the first space) and convert to uppercase
    const firstName = fullName.trim().split(' ')[0].toUpperCase();

    // Ensure visitor ID is maximum 4 characters
    const truncatedId = visitorId.substring(0, 4);

    // Format: 4chars + '_' + firstname
    return `${truncatedId}_${firstName}`;
  }

  get isHostPreloadDisabled(): boolean {
    return this.enableSelfRegistrationHostPreload;
  }

  get isVisitorIdMaxLengthRestricted(): boolean {
    return this.isSingaporePDPARequired;
  }

  get visitorIdMaxLength(): number {
    return this.isSingaporePDPARequired ? 4 : 50; // Default max length when not restricted
  }

  private processPageSettings(pageSettings: any[]): void {
    if (pageSettings && Array.isArray(pageSettings)) {
      // Find gbShowMemberId setting
      const showMemberIdSetting = pageSettings.find(setting => setting.SettingType === "SM");
      if (showMemberIdSetting) {
        this.gbShowMemberId = showMemberIdSetting.Caption !== null &&
          showMemberIdSetting.Caption !== "" &&
          showMemberIdSetting.Caption !== "false";
      }

      console.log('gbShowMemberId setting:', this.gbShowMemberId);
    }
  }

  /**
   * Set department for default host when default host is enabled
   */
  private setDepartmentForDefaultHost(): void {
    if (this.defaultHostId && this.hosts && this.hosts.length > 0) {
      const defaultHost = this.hosts.find((h: any) => h.HOSTIC == this.defaultHostId);
      if (defaultHost && (defaultHost as any).DEPARTMENT_REFID) {
        this.generalForm.patchValue({ department: (defaultHost as any).DEPARTMENT_REFID });
      }
    }
  }

  /**
   * Check if a field should be disabled in appointment flow
   * @param fieldName The name of the field to check
   * @returns true if field should be disabled, false otherwise
   */
  isFieldDisabled(fieldName: string): boolean {
    // Special case: disable host field when filtered for query parameters
    if (fieldName === 'host' && this.shouldFilterHostByQueryParam) {
      return true;
    }

    if (!this.isAppointmentFlow) {
      return false; // In normal flow, no fields are disabled
    }

    // In appointment flow, disable fields that are not in the allowed editable list
    return !this.allowedEditableFields.includes(fieldName);
  }

  /**
   * Check if a field should be hidden in appointment flow
   * @param fieldName The name of the field to check
   * @returns true if field should be hidden, false otherwise
   */
  isFieldHiddenInAppointmentFlow(fieldName: string): boolean {
    return this.isAppointmentFlow && this.hiddenFieldsInAppointmentFlow.includes(fieldName);
  }

  /**
   * Parse date string from API to Date object for form controls
   */
  private parseDate(dateString: string): Date | null {
    if (!dateString) return null;

    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date;
    } catch (error) {
      console.error('Error parsing date:', dateString, error);
      return null;
    }
  }

  private initializeForm(): void {
    const savedData = this.wizardService.getFormData('general') || {};

    // Check if multiple visitor mode is enabled
    this.isMultipleVisitorMode = this.settings?.MultipleVisitorEnabled || false;

    // For multiple visitor mode, if we have saved visitors, don't pre-fill individual fields
    // This prevents showing previous visitor data when navigating back
    const shouldClearVisitorFields = this.isMultipleVisitorMode && this.savedVisitors && this.savedVisitors.length > 0;

    // Get visitor acknowledgment data if available
    const visitorData = this.visitorAckData?.visitorData;
    const isPreFilledData = this.isAppointmentFlow && visitorData;

    // Debug logging
    if (isPreFilledData) {
      console.log('Initializing form with visitor acknowledgment data:', visitorData);
      console.log('Host ID from visitor data:', visitorData.hostId);
      console.log('Start time from visitor data:', visitorData.startTime);
      console.log('End time from visitor data:', visitorData.endTime);
      console.log('Department ID from visitor data:', visitorData.departmentId);
    }

    const formControls: any = {
      profile: [shouldClearVisitorFields ? null : (isPreFilledData ? null : (savedData.profile || null))],
      title: [shouldClearVisitorFields ? '' : (isPreFilledData ? (visitorData.titleId || '') : (savedData.title || ''))],
      fullName: [shouldClearVisitorFields ? '' : (isPreFilledData ? (visitorData.fullName || '') : (savedData.fullName || ''))],
      email: [shouldClearVisitorFields ? '' : (isPreFilledData ? (visitorData.email || '') : (savedData.email || ''))],
      phone: [shouldClearVisitorFields ? '' : (isPreFilledData ? (visitorData.phone || '') : (savedData.phone || ''))],
      visitor_id_type: [shouldClearVisitorFields ? '' : (isPreFilledData ? (visitorData.idType || '') : (savedData.visitor_id_type || ''))],
      visitor_id: [shouldClearVisitorFields ? '' : (isPreFilledData ? (visitorData.identityNo || '') : (savedData.visitor_id || ''))],
      id_expired_date: [shouldClearVisitorFields ? null : (isPreFilledData ? (visitorData.expiredDate ? this.parseDate(visitorData.expiredDate) : null) : (savedData.id_expired_date || null))],
      gender: [shouldClearVisitorFields ? '' : (isPreFilledData ? (visitorData.genderId || '') : (savedData.gender || ''))],
      visitor_company: [shouldClearVisitorFields ? '' : (isPreFilledData ? (visitorData.company || '') : (savedData.visitor_company || ''))],
      vehicle_number: [isPreFilledData ? (visitorData.vehicleNumber || '') : (savedData.vehicle_number || '')], // Keep vehicle info as it's shared
      vehicle_brand: [isPreFilledData ? (visitorData.vehicleBrand || '') : (savedData.vehicle_brand || '')],
      vehicle_model: [isPreFilledData ? (visitorData.vehicleModel || '') : (savedData.vehicle_model || '')],
      vehicle_color: [isPreFilledData ? (visitorData.vehicleColor || '') : (savedData.vehicle_color || '')],
      expired_date: [savedData.expired_date || ''],
      Reason: [isPreFilledData ? (visitorData.remarks || '') : (savedData.Reason || '')], // Keep reason as it's shared
      meeting_location: [isPreFilledData ? (visitorData.meetingLocation || '') : (savedData.meeting_location || '')],
      floor: [isPreFilledData ? (visitorData.floorId || '') : (savedData.floor || '')],
      visitor_address: [shouldClearVisitorFields ? '' : (isPreFilledData ? (visitorData.address || '') : (savedData.visitor_address || ''))],
      country: [shouldClearVisitorFields ? '' : (isPreFilledData ? (visitorData.countryId || '') : (savedData.country || ''))],
      work_permit_ref: [savedData.work_permit_ref || ''],
      remarks: [isPreFilledData ? (visitorData.remarks || '') : (savedData.remarks || '')],
      host: [isPreFilledData ? (visitorData.hostId || '') : (this.shouldHideHostControl ? this.defaultHostId : (savedData.host || ''))], // Prioritize visitor ack data over default host
      startDate: [isPreFilledData ? (this.parseDate(visitorData.startTime) || '') : (savedData.startDate || '')], // Use appointment start time
      visitDate: [isPreFilledData ? (this.parseDate(visitorData.startTime) || '') : (savedData.visitDate || '')],
      visitTime: [isPreFilledData ? (this.parseDate(visitorData.startTime) || '') : (savedData.visitTime || '')],
      endDate: [isPreFilledData ? (this.parseDate(visitorData.endTime) || '') : (savedData.endDate || '')], // Use appointment end time
      department: [isPreFilledData ? (visitorData.departmentId || '') : (savedData.department || '')], // Use appointment department
      appointmentDate: [savedData.appointmentDate || ''],
      timeSlot: [savedData.timeSlot || ''],
      facilityBooking: [savedData.facilityBooking || false],
      facilityPurpose: [savedData.facilityPurpose || ''],
      facilitySelection: [savedData.facilitySelection || ''],
      sharedDate: [savedData.sharedDate || '']
    };

    // Add UDF controls to main form (now applies to both single and multiple visitor modes)
    if (this.udfSettings && this.udfSettings.length > 0) {
      console.log('Adding UDF controls to main form:', this.udfSettings);
      this.udfSettings.forEach((udf: any) => {
        if (udf.Enabled) {
          const controlName = udf.UDFName;

          // Get value priority: visitor ack data > saved data > empty
          let controlValue = '';
          if (shouldClearVisitorFields) {
            controlValue = '';
          } else if (isPreFilledData && visitorData) {
            // Try to get UDF value from visitor acknowledgment data
            const udfKey = controlName.toLowerCase();
            controlValue = visitorData[udfKey] || savedData[controlName] || '';
          } else {
            controlValue = savedData[controlName] || '';
          }

          const validators = [];
          if (udf.UDFCtrlType === 10 && udf.MinLength) {
            validators.push(Validators.minLength(udf.MinLength));
          }
          if (udf.UDFCtrlType === 10 && udf.MaxLength) {
            validators.push(Validators.maxLength(udf.MaxLength));
          }
          if (this.settings && this.settings[udf.UDFName + "Required"]) {
            validators.push(Validators.required);
          }

          formControls[controlName] = [controlValue, validators];
          console.log(`Added UDF control: ${controlName} with value:`, controlValue);
        }
      });
    } else {
      console.log('No UDF settings available or empty array');
    }

    // Add visitors array for multiple visitor mode (if needed for backward compatibility)
    if (this.isMultipleVisitorMode) {
      formControls.visitors = this.fb.array([]);
    }

    this.generalForm = this.fb.group(formControls);

    // Disable fields in appointment flow that shouldn't be editable
    if (isPreFilledData) {
      // Disable all non-editable fields
      Object.keys(this.generalForm.controls).forEach(controlName => {
        if (!this.allowedEditableFields.includes(controlName)) {
          const control = this.generalForm.get(controlName);
          if (control) {
            control.disable();
          }
        }
      });

      console.log('Disabled non-editable fields in appointment flow');
    }

    // Trigger ID Type change for appointment flow if ID Type is pre-filled
    if (isPreFilledData && visitorData.idType) {
      setTimeout(() => {
        this.onIdTypeChange({ value: visitorData.idType });
      }, 100);
    }

    // Set department for default host if enabled (but not in appointment flow)
    if (this.shouldHideHostControl && this.defaultHostId && !isPreFilledData) {
      this.setDepartmentForDefaultHost();
    }

    // Restore saved visitors for display in table
    if (this.isMultipleVisitorMode && savedData.savedVisitors) {
      this.savedVisitors = savedData.savedVisitors;
    }

    // Clear profile image display in multiple visitor mode if visitors exist
    if (shouldClearVisitorFields) {
      this.profileImage = '';
    }

    // Initialize visitors after form is created
    if (this.isMultipleVisitorMode) {
      this.initializeVisitors(savedData);
    }

    // Sync visitDate and visitTime to startDate
    this.generalForm.get('visitDate')?.valueChanges.subscribe(() => this.syncStartDate());
    this.generalForm.get('visitTime')?.valueChanges.subscribe(() => this.syncStartDate());
  }

  private syncStartDate(): void {
    const visitDate = this.generalForm.get('visitDate')?.value;
    const visitTime = this.generalForm.get('visitTime')?.value;

    if (visitDate && visitTime) {
      const combined = new Date(visitDate);
      const time = new Date(visitTime);
      combined.setHours(time.getHours());
      combined.setMinutes(time.getMinutes());
      combined.setSeconds(0);
      this.generalForm.get('startDate')?.setValue(combined, { emitEvent: false });
    } else if (visitDate) {
      this.generalForm.get('startDate')?.setValue(visitDate, { emitEvent: false });
    }
  }

  // Multiple visitors functionality
  private initializeVisitors(savedData: any): void {
    const visitorsArray = this.generalForm.get('visitors') as FormArray;

    // Initialize with saved visitors or create first visitor
    const savedVisitors = savedData.visitors || [{}];

    savedVisitors.forEach((visitor: any, index: number) => {
      visitorsArray.push(this.createVisitorForm(visitor, index === 0));
    });

    if (visitorsArray.length === 0) {
      // Add first visitor if none exist
      visitorsArray.push(this.createVisitorForm({}, true));
    }
  }

  private createVisitorForm(visitorData: any = {}, isMyself: boolean = false): FormGroup {
    const visitorFormControls: any = {
      title: [visitorData.title || ''],
      fullName: [visitorData.fullName || '', this.settings?.NameRequired ? [Validators.required] : []],
      email: [visitorData.email || '', this.settings?.EmailRequired ? [Validators.required, Validators.email] : []],
      phone: [visitorData.phone || '', this.settings?.ContactNumberRequired ? [Validators.required] : []],
      idType: [visitorData.idType || '', this.settings?.IdProofRequired ? [Validators.required] : []],
      visitor_id: [visitorData.visitor_id || '', this.settings?.IdProofRequired ? [Validators.required] : []],
      id_expired_date: [visitorData.id_expired_date || null, this.settings?.IdExpiredRequired ? [Validators.required] : []],
      gender: [visitorData.gender || '', this.settings?.GenderRequired ? [Validators.required] : []],
      visitor_company: [visitorData.visitor_company || '', this.settings?.CompanyRequired ? [Validators.required] : []],
      vehicle_number: [visitorData.vehicle_number || '', this.settings?.VehicleNumberRequired ? [Validators.required] : []],
      vehicle_brand: [visitorData.vehicle_brand || '', this.settings?.VehicleBrandModelRequired ? [Validators.required] : []],
      vehicle_model: [visitorData.vehicle_model || '', this.settings?.VehicleBrandModelRequired ? [Validators.required] : []],
      vehicle_color: [visitorData.vehicle_color || '', this.settings?.VehicleColorRequired ? [Validators.required] : []],
      visitor_address: [visitorData.visitor_address || '', this.settings?.AddressRequired ? [Validators.required] : []],
      country: [visitorData.country || '', this.settings?.CountryRequired ? [Validators.required] : []],
      work_permit_ref: [visitorData.work_permit_ref || ''],
      remarks: [visitorData.remarks || '', this.settings?.RemarksRequired ? [Validators.required] : []],
      profile: [visitorData.profile || null]
    };

    return this.fb.group(visitorFormControls);
  }

  get visitorsArray(): FormArray {
    return this.generalForm.get('visitors') as FormArray;
  }

  get udfList(): any[] {
    return this.udfSettings || [];
  }

  addVisitor(): void {
    const newVisitor = this.createVisitorForm();
    this.visitorsArray.push(newVisitor);
  }

  addVisitorToTable(): void {
    console.log('=== ADD VISITOR START ===');
    console.log('MultipleVisitorEnabled:', this.settings?.MultipleVisitorEnabled);
    console.log('savedVisitors before:', this.savedVisitors);
    console.log('savedVisitors.length before:', this.savedVisitors.length);

    // Only allow adding visitors to table if multi-visitor setting is enabled
    if (!this.settings?.MultipleVisitorEnabled) {
      console.log('Multiple visitor not enabled, returning');
      return;
    }

    this.submitted = true;
    const currentForm = this.getCurrentVisitorForm();
    console.log('Current form value:', currentForm.value);
    console.log('Is form valid:', this.isCurrentVisitorFormValid());

    if (this.isCurrentVisitorFormValid()) {
      // Save to savedVisitors array for multiple visitor functionality
      const visitorData = { ...currentForm.value };

      console.log('Visitor data before processing:', visitorData);

      // Initialize Visitor_IC and IdentityNo fields
      visitorData.Visitor_IC = visitorData.visitor_id || '';
      visitorData.IdentityNo = visitorData.visitor_id || '';

      // Apply Singapore PDPA formatting for visitor_id if enabled
      if (this.isSingaporePDPARequired && visitorData.visitor_id && visitorData.fullName) {
        const formattedId = this.formatVisitorIdForPDPA(visitorData.visitor_id, visitorData.fullName);
        visitorData.visitor_id = formattedId;
        visitorData.Visitor_IC = formattedId;
        visitorData.IdentityNo = formattedId;
      }

      // Automatically set "myself" flag based on safety briefing and first visitor
      if (this.settings?.Visitor?.[0]?.SafetyBriefingEnabled && this.savedVisitors.length === 0) {
        visitorData.myself = true;
      } else {
        visitorData.myself = false;
      }

      console.log('Visitor data after processing:', visitorData);
      console.log('Editing index:', this.editingVisitorIndex);

      if (this.editingVisitorIndex >= 0) {
        // Update existing visitor
        this.savedVisitors[this.editingVisitorIndex] = visitorData;
        this.editingVisitorIndex = -1;

        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Visitor updated successfully'
        });
      } else {
        // Add new visitor - use spread to create new array reference
        this.savedVisitors = [...this.savedVisitors, visitorData];

        console.log('savedVisitors after adding:', this.savedVisitors);
        console.log('savedVisitors.length after:', this.savedVisitors.length);

        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Visitor saved successfully'
        });
      }

      // Force change detection
      console.log('Calling detectChanges');
      this.cdr.detectChanges();

      // Save form data immediately after visitor modification
      this.saveFormDataToWizard();

      // Clear only main visitor identification fields: fullName, visitor_id, profile
      // Keep other information (email, phone, company, vehicle info, UDF fields, etc.)
      const fieldsToReset = ['fullName', 'visitor_id', 'profile'];

      fieldsToReset.forEach(field => {
        if (currentForm.get(field)) {
          currentForm.get(field)?.reset();
        }
      });

      // Reset profile image display
      this.profileImage = '';

      // Reset form touched state for the cleared fields only
      fieldsToReset.forEach(field => {
        if (currentForm.get(field)) {
          currentForm.get(field)?.markAsUntouched();
          currentForm.get(field)?.markAsPristine();
        }
      });

      console.log('=== ADD VISITOR END ===');

    } else {
      // Mark only visitor-related required fields as touched to show validation errors
      const requiredFields = this.getRequiredVisitorFields();

      // Mark only required visitor fields as touched
      requiredFields.forEach(field => {
        currentForm.get(field)?.markAsTouched();
      });

      this.messageService.add({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Please fill all required visitor fields'
      });
    }
  }

  removeVisitor(index: number): void {
    if (this.visitorsArray.length > 1) {
      this.visitorsArray.removeAt(index);
    }
  }

  isDuplicateVisitor(currentIndex: number): boolean {
    const currentVisitor = this.visitorsArray.at(currentIndex);
    const currentIdentity = currentVisitor.get('visitor_id')?.value;
    const currentName = currentVisitor.get('fullName')?.value;

    if (!currentIdentity && !currentName) return false;

    return this.visitorsArray.controls.some((control, index) => {
      if (index === currentIndex) return false;

      const identity = control.get('visitor_id')?.value;
      const name = control.get('fullName')?.value;

      return (currentIdentity && identity === currentIdentity) ||
        (currentName && name === currentName);
    });
  }

  getVisitorsList(): any[] {
    return this.visitorsArray.value.map((visitor: any) => ({
      ...visitor,
      // Add any additional visitor-specific data transformation here
    }));
  }

  getVisitorProfileImage(index: number): string {
    // Return profile image for specific visitor
    const visitor = this.visitorsArray.at(index);
    return visitor?.get('profile')?.value || '';
  }

  // Helper method to get required visitor fields based on settings
  private getRequiredVisitorFields(): string[] {
    const requiredFields = [];

    if (this.settings) {
      if (this.settings.NameEnabled && this.settings.NameRequired) requiredFields.push('fullName');
      if (this.settings.EmailEnabled && this.settings.EmailRequired) requiredFields.push('email');
      if (this.settings.ContactNumberEnabled && this.settings.ContactNumberRequired) requiredFields.push('phone');
      if (this.settings.IdProofEnabled && this.settings.IdProofRequired) requiredFields.push('visitor_id');
      if (this.settings.GenderEnabled && this.settings.GenderRequired) requiredFields.push('gender');
      if (this.settings.CompanyEnabled && this.settings.CompanyRequired) requiredFields.push('visitor_company');
      if (this.settings.VehicleNumberEnabled && this.settings.VehicleNumberRequired) requiredFields.push('vehicle_number');
      if (this.settings.AddressEnabled && this.settings.AddressRequired) requiredFields.push('visitor_address');
      if (this.settings.CountryEnabled && this.settings.CountryRequired) requiredFields.push('country');
      if (this.settings.HostNameEnabled && this.settings.HostNameRequired) requiredFields.push('host');
      if (this.settings.ImageUploadEnabled && this.settings.ImageUploadRequired) requiredFields.push('profile');

      // Add UDF required fields
      if (this.udfSettings) {
        this.udfSettings.forEach((udf: any) => {
          if (udf.Enabled && this.settings[udf.UDFName + "Required"]) {
            requiredFields.push(udf.UDFName);
          }
        });
      }
    }

    return requiredFields;
  }

  // Methods for saved visitors in single visitor mode
  isCurrentVisitorFormValid(): boolean {
    const currentForm = this.getCurrentVisitorForm();
    const requiredFields = this.getRequiredVisitorFields();

    // Check if all required fields are valid and have values
    const invalidFields = [];
    for (const fieldName of requiredFields) {
      const control = currentForm.get(fieldName);
      if (control) {
        // Check if field is invalid AND has required error specifically
        if (control.invalid && (control.hasError('required') || control.hasError('email') || control.hasError('minlength') || control.hasError('maxlength'))) {
          invalidFields.push({
            field: fieldName,
            errors: control.errors,
            value: control.value
          });
        }
      }
    }

    // Additional custom validation for visitor ID
    if (invalidFields.length === 0) {
      const idValidation = this.validateVisitorIdAndExpiry();
      if (!idValidation.isValid) {
        return false;
      }
    }

    return invalidFields.length === 0;
  }

  // Check if the form has meaningful data (at least name and visitor_id)
  hasFormData(): boolean {
    const currentForm = this.getCurrentVisitorForm();
    const fullName = currentForm.get('fullName')?.value?.trim();
    const visitorId = currentForm.get('visitor_id')?.value?.trim();

    return !!(fullName && visitorId);
  }

  editSavedVisitor(index: number): void {
    // Only allow editing if multi-visitor setting is enabled
    if (!this.settings?.MultipleVisitorEnabled) {
      return;
    }

    if (index >= 0 && index < this.savedVisitors.length) {
      const visitor = this.savedVisitors[index];
      const currentForm = this.getCurrentVisitorForm();

      // Populate the form with the selected visitor's data
      currentForm.patchValue(visitor);

      // Store the index for updating later
      this.editingVisitorIndex = index;

      this.messageService.add({
        severity: 'info',
        summary: 'Edit Mode',
        detail: 'Visitor loaded for editing. Update and click "Add Visitor" to save changes.'
      });
    }
  }

  deleteSavedVisitor(index: number): void {
    // Only allow deleting if multi-visitor setting is enabled
    if (!this.settings?.MultipleVisitorEnabled) {
      return;
    }

    if (index >= 0 && index < this.savedVisitors.length) {
      // If we're deleting the visitor currently being edited, reset editing state
      if (this.editingVisitorIndex === index) {
        this.editingVisitorIndex = -1;
        // Reset the form as well
        const currentForm = this.getCurrentVisitorForm();
        currentForm.reset();
      } else if (this.editingVisitorIndex > index) {
        // If we're editing a visitor after the deleted one, adjust the index
        this.editingVisitorIndex--;
      }

      this.savedVisitors.splice(index, 1);

      // Save form data immediately after visitor deletion
      this.saveFormDataToWizard();

      this.messageService.add({
        severity: 'success',
        summary: 'Deleted',
        detail: 'Visitor removed successfully'
      });
    }
  }

  // Optional: Add a method to cancel editing
  cancelEdit(): void {
    if (this.editingVisitorIndex >= 0) {
      this.editingVisitorIndex = -1;
      const currentForm = this.getCurrentVisitorForm();
      currentForm.reset();

      this.messageService.add({
        severity: 'info',
        summary: 'Cancelled',
        detail: 'Edit cancelled'
      });
    }
  }

  private setupConditionalControls(): void {
    if (!this.settings) return;

    // Setup each control based on settings
    this.setupControl('fullName', this.settings.NameEnabled, this.settings.NameRequired, this.settings.NameMinLength);
    this.setupControl('email', this.settings.EmailEnabled, this.settings.EmailRequired);
    this.setupControl('phone', this.settings.ContactNumberEnabled, this.settings.ContactNumberRequired);

    // Setup visitor_id with PDPA max length restriction if enabled
    const visitorIdMaxLength = this.isSingaporePDPARequired ? 4 : undefined;
    this.setupControl('visitor_id', this.settings.IdProofEnabled, this.settings.IdProofRequired, undefined, visitorIdMaxLength);

    this.setupControl('gender', this.settings.GenderEnabled, this.settings.GenderRequired);
    this.setupControl('visitor_company', this.settings.CompanyEnabled, this.settings.CompanyRequired);
    this.setupControl('vehicle_number', this.settings.VehicleNumberEnabled, this.settings.VehicleNumberRequired);
    this.setupControl('vehicle_brand', this.settings.VehicleBrandModelEnabled, this.settings.VehicleBrandModelRequired);
    this.setupControl('vehicle_model', this.settings.VehicleBrandModelEnabled, this.settings.VehicleBrandModelRequired);
    this.setupControl('vehicle_color', this.settings.VehicleColorEnabled, this.settings.VehicleColorRequired);
    this.setupControl('visitor_address', this.settings.AddressEnabled, this.settings.AddressRequired);
    this.setupControl('country', this.settings.CountryEnabled, this.settings.CountryRequired);
    this.setupControl('work_permit_ref', this.settings.WorkPermitRefEnabled, false);
    this.setupControl('remarks', this.settings.RemarksEnabled, this.settings.RemarksRequired);
    this.setupControl('host', this.settings.HostNameEnabled, this.settings.HostNameRequired);
    this.setupControl('startDate', this.settings.StartEndDtEnabled, true);
    this.setupControl('visitDate', this.settings.StartEndDtEnabled, true);
    this.setupControl('visitTime', this.settings.StartEndDtEnabled, false);
    this.setupControl('endDate', this.settings.StartEndDtEnabled, true);

    this.setupControl('profile', this.settings.ImageUploadEnabled, this.settings.ImageUploadRequired);

    this.udfSettings.forEach((udf: any) => {
      if (udf.Enabled) {
        this.setupControl(
          udf.UDFName,
          true,
          this.settings[udf.UDFName + "Required"],
          udf.UDFCtrlType === 10 ? udf.MinLength : undefined,
          udf.UDFCtrlType === 10 ? udf.MaxLength : undefined
        );
      }
    });

    // Setup VIMS controls
    if (this.enableVimsApptTimeSlot && !this.enableFBInSelfReg) {
      // Only appointment flow - use separate date picker
      this.setupControl('appointmentDate', true, true);
      this.setupControl('timeSlot', true, true);
    }

    if (this.enableFBInSelfReg) {
      this.setupControl('facilityBooking', true, false);
      const facilityBookingValue = this.generalForm.get('facilityBooking')?.value;
      this.setupControl('facilityPurpose', true, facilityBookingValue);
      this.setupControl('facilitySelection', true, facilityBookingValue);
    }

    // Setup shared date when both features are enabled or facility booking is active
    if ((this.enableVimsApptTimeSlot && this.enableFBInSelfReg) ||
      (this.enableFBInSelfReg && this.generalForm.get('facilityBooking')?.value)) {
      this.setupControl('sharedDate', true, true);
    }

    // Setup time slot for VIMS when both features are enabled and facility booking is not checked
    if (this.enableVimsApptTimeSlot && this.enableFBInSelfReg && !this.generalForm.get('facilityBooking')?.value) {
      this.setupControl('timeSlot', true, true);
    }
  }

  getUdfOptions(apptUDFSetSeqId: number): any[] {
    return this.udfOptions
      .filter((item: any) => item.RefApptUDFSetSeqId === apptUDFSetSeqId)
      .map((item: any) => ({
        value: item.ApptUDFDetSetSeqId,
        label: item.Name
      }));
  }

  getUDFOptions(udfId: number): any[] {
    return this.getUdfOptions(udfId);
  }

  private setupControl(
    controlName: string,
    enabled: boolean,
    required: boolean,
    minLength?: number,
    maxLength?: number
  ): void {
    const control = this.generalForm.get(controlName);
    if (!control) return;

    const validators = [];
    if (enabled && required) {
      validators.push(Validators.required);
    }
    if (enabled && minLength && minLength > 0) {
      validators.push(Validators.minLength(minLength));
    }
    if (enabled && maxLength && maxLength > 0) {
      validators.push(Validators.maxLength(maxLength));
    }

    control.setValidators(validators);
    enabled ? control.enable() : control.disable();

    if (!enabled) {
      control.reset();
    }

    control.updateValueAndValidity();
  }

  validateForm(): boolean {
    this.submitted = true;
    // Handle validation based on multiple visitor setting
    if (this.settings?.MultipleVisitorEnabled) {
      // Multiple visitor mode: Check if at least one visitor is saved, or if current form can be auto-added
      let isValid = this.savedVisitors.length > 0;

      // If no visitors saved yet, check if current form is valid and has data
      if (isValid && this.isCurrentVisitorFormValid() && this.hasFormData()) {
        console.log('Auto-adding visitor before proceeding to next step');
        this.addVisitorToTable();
        isValid = this.savedVisitors.length > 0;
      }

      if (isValid) {
        this.messageService.add({
          severity: 'error',
          summary: 'Validation Error',
          detail: 'Please add at least one visitor to proceed'
        });
      } else {
        // Save the form data including saved visitors when validation passes
        this.saveFormDataToWizard();
      }

      console.log('Multi-visitor validation - Saved visitors count:', this.savedVisitors.length);
      console.log('Multi-visitor validation result:', isValid);

      // Set step validity for wizard service
      this.wizardService.setStepValid(isValid);
      return isValid;
    } else {
      // Single visitor mode: Validate current form only (normal wizard behavior)
      // Only validate enabled controls
      Object.keys(this.generalForm.controls).forEach(controlName => {
        const control = this.generalForm.get(controlName);
        if (control?.enabled) {
          control.markAsTouched();
          control.markAsDirty();
          control.updateValueAndValidity({ onlySelf: true });
        }
      });

      // Force parent form to recalculate validity after all controls updated
      this.generalForm.updateValueAndValidity();

      const isValid = this.generalForm.valid;

      if (!isValid) {
        const invalidControls: Record<string, any> = {};
        Object.keys(this.generalForm.controls).forEach(name => {
          const c = this.generalForm.get(name);
          if (c && c.invalid && c.enabled) {
            invalidControls[name] = {
              errors: c.errors,
              value: c.value,
              validators: c.validator ? 'has validators' : 'no validators'
            };
          }
        });
        console.log('validateForm() - invalid controls:', invalidControls);
      }

      // Additional custom validation for visitor ID and expiry
      if (isValid) {
        const idValidation = this.validateVisitorIdAndExpiry();
        if (!idValidation.isValid) {
          this.messageService.add({
            severity: 'error',
            summary: 'Validation Error',
            detail: idValidation.errorMessage
          });
          this.wizardService.setStepValid(false);
          return false;
        }
      }

      if (isValid) {
        // For appointment flow with single visitor, ensure visitor is added to savedVisitors
        if (this.isAppointmentFlow && this.hasFormData() && this.savedVisitors.length === 0) {
          console.log('Auto-adding visitor for appointment flow');
          this.addVisitorToTable();
        }

        // Save the form data when validation passes
        this.saveFormDataToWizard();
      }

      console.log('Single visitor validation result:', isValid);
      console.log('Form errors:', this.generalForm.errors);

      // Set step validity for wizard service
      this.wizardService.setStepValid(isValid);

      if (!isValid) {
        this.scrollToFirstError();
        this.messageService.add({
          severity: 'error',
          summary: 'Validation Error',
          detail: 'Please fill all required fields correctly'
        });
      }

      return isValid;
    }
  }

  private saveFormDataToWizard(): void {
    // Save current form data and saved visitors to wizard service
    // In appointment flow, include disabled field values too
    let formData: any;

    if (this.isAppointmentFlow) {
      // Get both enabled and disabled values for appointment flow
      formData = { ...this.generalForm.getRawValue() }; // getRawValue includes disabled controls
    } else {
      formData = { ...this.generalForm.value }; // Normal flow only includes enabled controls
    }

    // Combine visitDate and visitTime into startDate if they exist
    if (formData.visitDate && formData.visitTime) {
      const combined = new Date(formData.visitDate);
      const time = new Date(formData.visitTime);
      combined.setHours(time.getHours());
      combined.setMinutes(time.getMinutes());
      combined.setSeconds(0);
      formData.startDate = combined;
    } else if (formData.visitDate) {
      formData.startDate = formData.visitDate;
    }

    if (this.settings?.MultipleVisitorEnabled) {
      // Include saved visitors when multiple visitor is enabled
      formData.visitors = this.savedVisitors;
      formData.savedVisitors = this.savedVisitors; // Keep both for compatibility
    }

    console.log('=== STEP-GENERAL SAVE DEBUG ===');
    console.log('Form data being saved:', formData);
    console.log('Is appointment flow:', this.isAppointmentFlow);
    console.log('MultipleVisitorEnabled:', this.settings?.MultipleVisitorEnabled);
    console.log('savedVisitors:', this.savedVisitors);
    console.log('savedVisitors length:', this.savedVisitors?.length);
    console.log('================================');

    this.wizardService.updateFormData('general', formData);
    console.log('Form data saved to wizard:', formData);
  }

  private scrollToFirstError(): void {
    setTimeout(() => {
      const firstInvalidElement = document.querySelector('.ng-invalid');
      if (firstInvalidElement) {
        firstInvalidElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }, 100);
  }

  onExistingGuestClick(): void {
    this.showReturningVisitorPopup = true;
  }

  searchProfile(): void {
    console.log('Searching for profile with query:', this.searchQuery);
    // Add actual search logic here if backend is ready
    this.messageService.add({
      severity: 'info',
      summary: 'Searching',
      detail: `Looking for profile: ${this.searchQuery}`
    });
  }

  isFieldInvalid(field: string): boolean {
    const control = this.generalForm.get(field);
    if (!control || !control.enabled) {
      return false;
    }

    // Show error if: field is invalid AND (submitted OR touched OR dirty)
    const hasBeenInteracted = control.dirty || control.touched;

    return control.invalid && (this.submitted || hasBeenInteracted);
  }

  isFieldRequired(field: string): boolean {
    const control = this.generalForm.get(field);
    if (!control || !control.enabled) {
      return false;
    }

    const hasBeenInteracted = control.dirty || control.touched;
    const isRequiredAndEmpty = control.hasError('required') && !control.value;

    return control.invalid && isRequiredAndEmpty && (this.submitted || hasBeenInteracted);
  }

  isFieldInvalidRequired(field: string): boolean {
    const control = this.generalForm.get(field);
    if (!control || !control.enabled) {
      return false;
    }

    // Show error if: field is invalid AND (submitted OR touched OR dirty)
    const hasBeenInteracted = control.dirty || control.touched;

    return control.invalid && (this.submitted || hasBeenInteracted);
  }

  handleFileUpload(event: any, visitorIndex?: number): void {
    const file = event.target.files[0];
    if (file) {
      // Validate file
      if (!file.type.match('image.*')) {
        this.showError('Only image files are allowed');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        this.showError('Maximum file size is 2MB');
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const imageUrl = this.sanitizer.bypassSecurityTrustUrl(e.target.result);

        if (this.isMultipleVisitorMode && visitorIndex !== undefined) {
          // Update specific visitor's profile
          this.visitorsArray.at(visitorIndex).get('profile')?.setValue(file);
        } else {
          // Single visitor mode
          this.profileImage = imageUrl;
          this.generalForm.patchValue({ profile: file });
        }
      };
      reader.readAsDataURL(file);
    }
  }

  private showError(message: string): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: message
    });
  }

  ngOnDestroy(): void {
    this.saveFormDataToWizard();

    // Clear host search timeout
    if (this.hostSearchTimeout) {
      clearTimeout(this.hostSearchTimeout);
    }

    this.destroy$.next();
    this.destroy$.complete();
  }

  // Method to check which visitor is marked as 'myself' for safety briefing
  getMyselfVisitor(): any {
    if (this.isMultipleVisitorMode) {
      return this.visitorsArray.value.find((visitor: any) => visitor.myself);
    } else {
      // In single visitor mode, the visitor is always 'myself'
      return this.generalForm.value;
    }
  }

  // Table view methods
  toggleTableView(): void {
    this.showVisitorTable = !this.showVisitorTable;
  }

  editVisitor(index: number): void {
    this.editingVisitorIndex = index;
    this.showVisitorTable = false;
  }

  saveVisitorEdit(): void {
    this.editingVisitorIndex = -1;
    this.showVisitorTable = true;
  }

  cancelVisitorEdit(): void {
    this.editingVisitorIndex = -1;
    this.showVisitorTable = true;
  }

  deleteVisitor(index: number): void {
    if (this.visitorsArray.length > 1) {
      this.visitorsArray.removeAt(index);
      if (this.editingVisitorIndex === index) {
        this.editingVisitorIndex = -1;
      } else if (this.editingVisitorIndex > index) {
        this.editingVisitorIndex--;
      }
    }
  }

  getVisitorDisplayName(visitor: any): string {
    return `${visitor.first_name || visitor.fullName || ''} ${visitor.last_name || ''}`.trim() || 'Unnamed Visitor';
  }

  getVisitorUid(visitor: any): string {
    return visitor.visitor_id || visitor.email || 'No ID';
  }

  // Helper methods for form validation and field checking
  /*isFieldRequired(fieldName: string): boolean {
    return this.settings?.[fieldName + 'Required'] || false;
  }*/

  // Event handler methods for form controls
  onHostChange(event: any): void {
    const selectedHostId = event.value;
    console.log('Host changed to:', selectedHostId);

    if (!selectedHostId || !this.originalHostData || this.originalHostData.length === 0) {
      return;
    }

    // Find the selected host in original data
    const selectedHost = this.originalHostData.find((host: any) =>
      host.HOSTIC === selectedHostId ||
      host.HostIC === selectedHostId ||
      host.SeqId === selectedHostId
    );

    if (selectedHost) {
      // Get department value from various possible fields
      const hostDepartment = selectedHost.Department ||
        selectedHost.DName ||
        selectedHost.DEPARTMENT_REFID ||
        selectedHost.DepartmentSeqId;

      if (hostDepartment) {
        const currentDepartment = this.generalForm.get('department')?.value;

        // Update department if it's different (bidirectional filtering)
        if (currentDepartment !== hostDepartment) {
          console.log('Updating department to match host:', hostDepartment);
          this.generalForm.get('department')?.setValue(hostDepartment);

          // Filter hosts by the host's department
          this.onDepartmentChange({ value: hostDepartment });
        }
      }
    }
  }

  onDepartmentChange(event: any): void {
    const selectedDepartment = event.value;
    console.log('Department changed to:', selectedDepartment);

    if (!selectedDepartment || !this.originalHostData || this.originalHostData.length === 0) {
      // Reset to all hosts if no department selected or no original data
      this.hosts = [...this.hostNameList];
      console.log('No department filter applied, showing all hosts');
      return;
    }

    // Filter hosts by selected department (handle both formats)
    const filteredHosts = this.originalHostData.filter((host: any) => {
      // Check multiple possible department field names and values
      return host.Department === selectedDepartment ||
        host.DName === selectedDepartment ||
        host.DEPARTMENT_REFID === selectedDepartment ||
        host.DepartmentSeqId === selectedDepartment;
    });

    console.log('Filtered hosts by department:', filteredHosts.length, 'out of', this.originalHostData.length);

    // Map filtered hosts with proper formatting
    this.hosts = filteredHosts.map((host: any) => {
      let formattedHost = { ...host };

      // Ensure HOSTNAME field exists for dropdown display
      if (!host.HOSTNAME && host.Name) {
        formattedHost.HOSTNAME = host.Name;
      }

      // Ensure HOSTIC field exists for dropdown value
      if (!host.HOSTIC && host.HostIC) {
        formattedHost.HOSTIC = host.HostIC;
      } else if (!host.HOSTIC && host.SeqId) {
        formattedHost.HOSTIC = host.SeqId;
      }

      // Format with member ID if enabled
      if (this.gbShowMemberId && host.MemberID) {
        formattedHost.HOSTNAME = `${host.Name || host.HOSTNAME || ''} (${host.MemberID})`.trim();
      }

      return formattedHost;
    });

    // Clear current host selection if it's not in the filtered list
    const currentHostId = this.generalForm.get('host')?.value;
    if (currentHostId) {
      const hostStillAvailable = this.hosts.find(h =>
        h.HOSTIC === currentHostId || h.HostIC === currentHostId || h.SeqId === currentHostId
      );

      if (!hostStillAvailable) {
        console.log('Current host not in filtered department, clearing selection');
        this.generalForm.get('host')?.setValue(null);
      }
    }
  }

  onStartDateChange(event: any): void {
    const startDate = event;
    // Handle start date change logic here
    console.log('Start date changed:', startDate);
  }

  onEndDateChange(event: any): void {
    const endDate = event;
    // Handle end date change logic here
    console.log('End date changed:', endDate);
  }

  // Facility booking related methods (using existing methods)
  onFacilityChange(event: any): void {
    const facilityCode = event.value;
    this.onFacilitySelectionChange(facilityCode);
  }

  onDateChange(event: any): void {
    this.onAppointmentDateSelect(event);
  }

  onIdTypeChange(event: any, visitorIndex?: number): void {
    const idTypeCode = event.value;
    console.log('ID Type changed:', idTypeCode);

    if (this.settings?.IdExpiredEnabled) {
      if (idTypeCode) {
        const selectedIdType = this.idTypeList.find(item => item.ID_TYPECODE === idTypeCode);
        if (selectedIdType) {
          this.selectedIdTypeData = selectedIdType;

          if (selectedIdType.ID_EXPIRED_DATE === true) {
            // Show ID expired date field
            this.showIdExpiryField = true;

            // Set validation for expiry date if required
            if (this.settings?.IdExpiredRequired) {
              this.generalForm.get('id_expired_date')?.setValidators([Validators.required]);
            }
          } else {
            // Hide ID expired date field and clear value
            this.showIdExpiryField = false;
            this.generalForm.get('id_expired_date')?.setValue(null);
            this.generalForm.get('id_expired_date')?.clearValidators();
          }

          // Update validators
          this.generalForm.get('id_expired_date')?.updateValueAndValidity();
        }
      } else {
        // No ID type selected, hide expiry field
        this.showIdExpiryField = false;
        this.selectedIdTypeData = null;
        this.generalForm.get('id_expired_date')?.setValue(null);
        this.generalForm.get('id_expired_date')?.clearValidators();
        this.generalForm.get('id_expired_date')?.updateValueAndValidity();
      }
    }
  }

  searchCompany(event: any): void {
    const query = event.query.toLowerCase();
    if (query.length === 0) {
      // Show all companies when dropdown is opened without typing
      this.companyList = [...this.masterData?.Table7?.filter((item: any) => {
        return item.visitor_comp_name !== undefined && item.visitor_comp_name !== null && item.visitor_comp_name !== "";
      }) || []];
    } else {
      // Filter companies based on typed text
      const allCompanies = this.masterData?.Table7?.filter((item: any) => {
        return item.visitor_comp_name !== undefined && item.visitor_comp_name !== null && item.visitor_comp_name !== "";
      }) || [];

      this.companyList = allCompanies.filter((company: any) =>
        company.visitor_comp_name.toLowerCase().includes(query)
      );
    }
  }

  onCompanySelect(event: any): void {
    // Handle company selection if any additional logic is needed
    console.log('Company selected:', event);
  }

  onTimeslotChange(event: any): void {
    const selectedCode = event.value;
    console.log('Timeslot changed:', selectedCode);

    if (selectedCode) {
      const selectedSlot = this.timeSlotList.find(slot => slot.Code === selectedCode && slot.availableCount > 0);
      if (!selectedSlot) {
        // Clear the selection and show alert
        this.generalForm.get('timeSlot')?.setValue('');
        // Show alert message - you might want to use a proper alert service
        alert('Oops.. This slots appointment is full or not available now');
        console.log('Selected timeslot is not available');
      }
    }
  }

  validateVisitorIdAndExpiry(): { isValid: boolean; errorMessage?: string } {
    const visitorId = this.generalForm.get('visitor_id')?.value?.trim() || '';
    const idTypeCode = this.generalForm.get('visitor_id_type')?.value;
    const expiryDate = this.generalForm.get('id_expired_date')?.value;
    const endDate = this.generalForm.get('endDate')?.value;

    // ID Proof validation
    if (this.settings?.IdProofEnabled) {
      if (this.settings?.IdProofRequired && visitorId === '') {
        return { isValid: false, errorMessage: 'Identity Number is required' };
      }

      // ID Expiry validation
      if (this.selectedIdTypeData?.ID_EXPIRED_DATE === true) {
        if (this.settings?.IdExpiredEnabled && this.settings?.IdExpiredRequired) {
          if (!expiryDate) {
            return { isValid: false, errorMessage: 'ID expiry date is required' };
          }
          if (endDate && new Date(expiryDate) < new Date(endDate)) {
            return { isValid: false, errorMessage: 'ID expiry date cannot be before appointment end date' };
          }
        } else {
          if (expiryDate && endDate && new Date(expiryDate) < new Date(endDate)) {
            return { isValid: false, errorMessage: 'ID expiry date cannot be before appointment end date' };
          }
        }
      }

      // Singapore PDPA specific validation
      if (this.isSingaporePDPARequired) {
        if (visitorId && visitorId.indexOf('_') === -1 && visitorId.length !== 4) {
          return { isValid: false, errorMessage: 'Invalid Singapore PDPA format' };
        }
      } else {
        // ID Type specific validation
        if (visitorId !== '' && this.settings?.IdTypeEnabled && idTypeCode && this.selectedIdTypeData) {
          const idTypeData = this.selectedIdTypeData;

          // Check input type (Numeric or Alphanumeric)
          if (idTypeData.INPUT_TYPE === 'N') {
            if (isNaN(Number(visitorId))) {
              return { isValid: false, errorMessage: 'Visitor NRIC/Passport should be number only' };
            }
          }

          // Check maximum length
          if (visitorId.length > idTypeData.INPUT_MAX_LENGTH) {
            const typeText = idTypeData.INPUT_TYPE === 'N' ? 'digits' : 'characters';
            return {
              isValid: false,
              errorMessage: `Visitor NRIC/Passport cannot contain more than ${idTypeData.INPUT_MAX_LENGTH} ${typeText}`
            };
          }

          // Check minimum length
          if (visitorId.length < idTypeData.INPUT_MIN_LENGTH) {
            const typeText = idTypeData.INPUT_TYPE === 'N' ? 'digits' : 'characters';
            return {
              isValid: false,
              errorMessage: `Visitor NRIC/Passport should contain atleast ${idTypeData.INPUT_MIN_LENGTH} ${typeText}`
            };
          }
        } else {
          // Generic minimum length validation when no ID type is selected
          if (visitorId && this.settings?.IdProofMinLength &&
            parseInt(this.settings.IdProofMinLength) > 0 &&
            visitorId.length < parseInt(this.settings.IdProofMinLength)) {
            return {
              isValid: false,
              errorMessage: `Identity Number should contain atleast ${this.settings.IdProofMinLength} characters`
            };
          }
        }
      }
    }

    return { isValid: true };
  }

  onFacilityDateChange(event: any): void {
    this.onSharedDateSelect(event);
  }

  // Slot selection methods
  selectSlot(slot: any): void {
    this.selectedBookingSlot = slot;
    // Add logic to handle slot selection
  }

  isSlotSelected(slot: any): boolean {
    return this.selectedBookingSlot === slot;
  }

  getSlotClass(slot: any): string {
    return this.getSlotCssClass(slot);
  }

  // File upload method
  onFileSelect(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.getCurrentVisitorForm().get('profileImage')?.setValue(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  }

  // New unified form methods
  getCurrentVisitorForm(): FormGroup {
    // Since visitor fields are now part of the main form, always return the main form
    return this.generalForm || this.fb.group({});
  }

  getCurrentVisitorIndex(): number {
    return this.isMultipleVisitorMode ? 0 : -1;
  }

  openAddVisitorDialog(): void {
    if (this.isMultipleVisitorMode) {
      // For now, just add a visitor directly (will add popup later)
      this.addVisitor();
    }
  }

  editVisitorInDialog(index: number): void {
    // For now, just edit directly (will add popup later)
    this.editVisitor(index);
  }

  closeVisitorDialog(): void {
    this.showVisitorDialog = false;
    this.dialogVisitorForm.reset();
  }

  saveVisitorFromDialog(): void {
    if (this.dialogVisitorForm.valid) {
      // Implementation for saving visitor from dialog
      this.showVisitorDialog = false;
    }
  }



}
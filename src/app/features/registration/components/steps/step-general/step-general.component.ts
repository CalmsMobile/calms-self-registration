import { Component, OnDestroy, OnInit, Sanitizer, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators, ValidatorFn, FormArray, FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { WizardService } from '../../../../../core/services/wizard.service';
import { MessageHelperService } from '../../../../../core/services/message-helper.service';
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
import { ProgressBarModule } from 'primeng/progressbar';
import { filter, Subject, takeUntil } from 'rxjs';
import { ApiService } from '../../../../../core/services/api.service';
import { LabelService } from '../../../../../core/services/label.service';
import { TranslatePipe } from '../../../../../shared/pipes/translate.pipe';
import { LanguageSelectorComponent } from '../../../../../shared/components/language-selector/language-selector.component';
import { SharedService } from '../../../../../shared/shared.service';
import { GENDER_OPTIONS } from '../../../../../shared/app.constants';


@Component({
  selector: 'app-step-general',
  standalone: true,
  imports: [DatePickerModule, SelectModule, ReactiveFormsModule, FormsModule, InputTextModule, AutoCompleteModule, TranslatePipe, MultiSelectModule, DividerModule, CheckboxModule, ButtonModule, TableModule, DialogModule, LanguageSelectorComponent, ProgressBarModule],
  templateUrl: './step-general.component.html',
  styleUrls: ['./step-general.component.scss']
})
export class StepGeneralComponent implements OnInit, OnDestroy {
  @ViewChild('cameraVideo') cameraVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('captureCanvas') captureCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  generalForm: FormGroup = new FormGroup({});
  profileImage: SafeUrl | string = "";
  logo = 'assets/logo.png';
  companyTitle = '';

  get formattedPageTitle(): { first: string; rest: string } {
    const text = this.labelService.getLabel('registration_page_page_title', 'caption') || this.wizardService.pageTitle || 'Visitor Registration';
    const i = text.indexOf(' ');
    return i === -1 ? { first: text, rest: '' } : { first: text.substring(0, i), rest: text.substring(i + 1) };
  }

  // Photo capture dialog
  showPhotoCaptureDialog = false;
  isCameraOn = false;
  useFlash = false;
  cameraFacingMode: 'user' | 'environment' = 'user';
  cameraStream: MediaStream | null = null;
  capturedImage: string | null = null;
  dialogPreviousImage: string | null = null; // existing photo shown in dialog before camera starts
  dialogMode: 'preview' | 'camera' = 'camera'; // 'preview' when existing photo is present
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
  minVisitTime: Date | undefined = undefined;
  minEndTime: Date | undefined = undefined;
  endBeforeStartError = false;
  scheduleEndBeforeStartError = false;
  showIdExpiryField = false;

  // Schedule dialog
  showScheduleDialog = false;
  scheduleCalendarDate: Date = new Date();
  scheduleStartDate: Date | null = null;
  scheduleEndDate: Date | null = null;
  scheduleStartTime = '09:00';
  scheduleEndTime = '10:00';
  scheduleActiveField: 'start' | 'end' = 'start';
  selectedIdTypeData: any = null;
  gbShowMemberId = false;
  showTime = true;
  masterData: any = {};
  isLoading = true;
  pageSettings: any[] = [];
  udfSettings: any[] = [];
  udfOptions: any[] = [];
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
  isVisitorBlacklisted = false;
  isVisitorNotWhitelisted = false;
  shouldFilterHostByQueryParam = false; // Flag to indicate if host should be filtered for query param flow
  // Fields that are LOCKED (non-editable) in appointment flow — everything else remains editable
  lockedFieldsInAppointmentFlow = ['startDate', 'endDate'];
  // Keep allowedEditableFields for backward compat with isFieldDisabled() references
  get allowedEditableFields(): string[] { return []; }

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
  timeSlotsLoaded = false;
  timeSlotStartTime: string | null = null;
  timeSlotEndTime: string | null = null;
  facilityPurposeList: any[] = [];
  facilityMasterList: any[] = [];
  facilityBookingSlots: any[] = [];
  selectedBookingSlot: any = null;
  bookedSlotIds: string = ''; // Track selected slot IDs

  // Host search functionality
  hostSearchText: string = '';
  showReturningVisitorPopup = false;
  searchQuery = '';
  visitorNotFound = false;
  isHostSearching: boolean = false;

  // Original host data for filtering
  originalHostData: any[] = [];

  // Multiple visitors functionality
  visitors: any[] = [];
  currentVisitorIndex = 0;
  isMultipleVisitorMode = false;

  // Saved visitors for single visitor mode
  savedVisitors: any[] = [];
  showSavedVisitorsModal = false;

  // Pending action after photo capture dialog resolves
  pendingAction: 'goNext' | 'addVisitor' | null = null;

  private destroy$ = new Subject<void>();
  private _activeMessageKeys = new Set<string>();

  /** Adds a toast only when an identical message is not already visible. */
  private showMessage(msg: { severity: string; summary?: string; detail?: string; life?: number }): void {
    const key = `${msg.severity}|${msg.summary ?? ''}|${msg.detail ?? ''}`;
    if (this._activeMessageKeys.has(key)) return;
    this._activeMessageKeys.add(key);
    const life = msg.life ?? 3000;
    
    if (msg.summary) {
      this.messageHelper.showWithTitle(msg.severity as any, msg.summary, msg.detail || '', life);
    } else {
      this.messageHelper.show(msg.severity as any, msg.detail || '', life);
    }
    
    setTimeout(() => this._activeMessageKeys.delete(key), life + 200);
  }

  get canGoBackToHome(): boolean {
    return !this.wizardService.appointmentCode &&
      !this.wizardService.refCatCode &&
      !this.wizardService.categoryCodeFromQuery;
  }

  constructor(
    private fb: FormBuilder,
    private wizardService: WizardService,
    private messageHelper: MessageHelperService,
    private sanitizer: DomSanitizer,
    private api: ApiService,
    private labelService: LabelService,
    private sharedService: SharedService,
    private router: Router
  ) {
    this.sharedService.currentLogo.subscribe(logo => this.logo = logo);
    this.sharedService.currentTitle.subscribe(title => this.companyTitle = title);
  }

  private getAlert(key: string): { summary: string; detail: string } {
    const caption = this.labelService.getLabel(key, 'caption');
    const idx = caption.indexOf(' / ');
    return idx !== -1
      ? { summary: caption.substring(0, idx), detail: caption.substring(idx + 3) }
      : { summary: '', detail: caption };
  }

  ngOnInit(): void {
    console.log('=== STEP-GENERAL INIT START ===');

    // Set up validation request handler once (not inside initializeForm which may be called multiple times)
    this.wizardService.onValidationRequest.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.validateForm();
    });

    this.wizardService.getSettings$().pipe(
      filter(settings => settings !== null),
      takeUntil(this.destroy$)
    ).subscribe(settings => {
      console.log('Settings loaded:', settings);
      this.settings = { ...settings };
      // Merge flags from selfRegistrationSettings (loaded separately via label service)
      const selfRegSettings = this.wizardService.getSelfRegistrationSettings();
      if (selfRegSettings) {
        this.settings.SearchExistingVisitor = selfRegSettings.SearchExistingVisitor ?? this.settings.SearchExistingVisitor;
        this.settings.EnableWhitelistValidation = selfRegSettings.EnableWhitelistValidation ?? this.settings.EnableWhitelistValidation;
        this.settings.AptEndTime = selfRegSettings.AptEndTime ?? this.settings.AptEndTime ?? '';
      }
      this.isSingaporePDPARequired = settings?.IsSingaporePDPARequired === true;
      this.loadUdfSettings();
      this.loadLocalSettings(); // Load local settings for VIMS features
      // Note: isLoading will be set to false in loadUdfSettings after UDF settings are loaded
    });

    // selfRegistrationSettings is loaded asynchronously (label service call) and may arrive
    // AFTER settings$ has already fired (race condition on back-navigation, because the home
    // page constructor resets both BehaviorSubjects to null).  Subscribe here so that flags
    // like SearchExistingVisitor are always applied as soon as the data becomes available.
    this.wizardService.getSelfRegistrationSettings$().pipe(
      filter(sr => sr !== null),
      takeUntil(this.destroy$)
    ).subscribe((sr: any) => {
      if (sr.SearchExistingVisitor !== undefined) {
        this.settings = { ...this.settings, SearchExistingVisitor: sr.SearchExistingVisitor };
      }
      if (sr.EnableWhitelistValidation !== undefined) {
        this.settings = { ...this.settings, EnableWhitelistValidation: sr.EnableWhitelistValidation };
      }
      if (sr.AptEndTime !== undefined) {
        this.settings = { ...this.settings, AptEndTime: sr.AptEndTime };
      }
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
      console.log('No master data found, continuing with empty lists');
    }

    if (this.masterData) {
      this.meetingFloorList = this.masterData.Table2 || [];
      this.purposeList = this.masterData.Table3 || [];
      this.departmentList = (this.masterData.Table5 || []).map((d: any) => ({
        ...d,
        DName: d.DName || d.dept_desc || d.Department || '',
        DepartmentSeqId: d.DepartmentSeqId ?? d.dept_id ?? d.DName ?? d.Department ?? ''
      }));
      this.hostDepartmentList = [...this.departmentList];
      this.countryList = this.masterData.Table13 || [];

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

  }



  openScheduleDialog(): void {
    const startVal: Date | null = this.generalForm.get('startDate')?.value ?? null;
    const endVal: Date | null = this.generalForm.get('endDate')?.value ?? null;
    if (startVal) {
      this.scheduleStartDate = new Date(startVal);
      this.scheduleCalendarDate = new Date(startVal);
      this.scheduleStartTime = `${startVal.getHours().toString().padStart(2, '0')}:${startVal.getMinutes().toString().padStart(2, '0')}`;
    } else {
      this.scheduleStartDate = null;
      this.scheduleCalendarDate = new Date();
      this.scheduleStartTime = '09:00';
    }
    if (endVal) {
      this.scheduleEndDate = new Date(endVal);
      this.scheduleEndTime = `${endVal.getHours().toString().padStart(2, '0')}:${endVal.getMinutes().toString().padStart(2, '0')}`;
    } else {
      this.scheduleEndDate = null;
      this.scheduleEndTime = '10:00';
    }
    this.scheduleActiveField = 'start';
    this.showScheduleDialog = true;
  }

  closeScheduleDialog(): void {
    this.showScheduleDialog = false;
  }

  onScheduleCalendarSelect(date: Date): void {
    if (this.scheduleActiveField === 'start') {
      this.scheduleStartDate = new Date(date);
      this.scheduleActiveField = 'end';
      if (!this.scheduleEndDate) this.scheduleEndDate = new Date(date);
    } else {
      this.scheduleEndDate = new Date(date);
    }
    this.checkScheduleTimes();
  }

  applySchedule(): void {
    if (!this.scheduleStartDate || !this.scheduleEndDate) return;
    const [sh, sm] = this.scheduleStartTime.split(':').map(Number);
    const [eh, em] = this.scheduleEndTime.split(':').map(Number);
    const start = new Date(this.scheduleStartDate);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(this.scheduleEndDate);
    end.setHours(eh, em, 0, 0);
    if (end <= start) {
      this.scheduleEndBeforeStartError = true;
      return;
    }
    this.scheduleEndBeforeStartError = false;
    this.generalForm.get('startDate')?.setValue(start);
    this.generalForm.get('startDate')?.markAsTouched();
    this.generalForm.get('endDate')?.setValue(end);
    this.generalForm.get('endDate')?.markAsTouched();
    this.showScheduleDialog = false;
  }

  formatScheduleDate(date: Date | null): string {
    if (!date) return 'Select date';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  get scheduleStartDateStr(): string {
    if (!this.scheduleStartDate) return '';
    const d = this.scheduleStartDate;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  set scheduleStartDateStr(val: string) {
    if (!val) { this.scheduleStartDate = null; return; }
    const [y, m, d] = val.split('-').map(Number);
    this.scheduleStartDate = new Date(y, m - 1, d);
    this.checkScheduleTimes();
  }

  get scheduleEndDateStr(): string {
    if (!this.scheduleEndDate) return '';
    const d = this.scheduleEndDate;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  set scheduleEndDateStr(val: string) {
    if (!val) { this.scheduleEndDate = null; return; }
    const [y, m, d] = val.split('-').map(Number);
    this.scheduleEndDate = new Date(y, m - 1, d);
    this.checkScheduleTimes();
  }

  get minDateStr(): string {
    const d = this.minDate;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  formatTime12(time: string): string {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
  }

  checkScheduleTimes(): void {
    if (!this.scheduleStartDate || !this.scheduleEndDate) {
      this.scheduleEndBeforeStartError = false;
      return;
    }
    const [sh, sm] = this.scheduleStartTime.split(':').map(Number);
    const [eh, em] = this.scheduleEndTime.split(':').map(Number);
    const start = new Date(this.scheduleStartDate);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(this.scheduleEndDate);
    end.setHours(eh, em, 0, 0);
    this.scheduleEndBeforeStartError = end <= start;
  }

  getScheduleDisplayText(): string {
    const start: Date | null = this.generalForm.get('startDate')?.value ?? null;
    const end: Date | null = this.generalForm.get('endDate')?.value ?? null;
    if (!start && !end) return 'Click to schedule appointment';
    const pad = (d: Date) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    const s = start ? `${this.formatScheduleDate(start)} ${this.formatTime12(pad(start))}` : 'Select start';
    const e = end ? `${this.formatScheduleDate(end)} ${this.formatTime12(pad(end))}` : 'Select end';
    return `${s}  →  ${e}`;
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
    this.timeSlotsLoaded = false;
    this.timeSlotList = [];
    this.timeSlotStartTime = null;
    this.timeSlotEndTime = null;
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

    // Booked by someone else
    if (slot.BookingID) {
      return 'clsbookslot clsBooked';
    }

    // Use API-provided expiry flag if available, fallback to time comparison
    if (slot.Is_Expired === true) {
      return 'clsbookslot clsExpired';
    }

    if (slot.Is_Expired === false) {
      return 'clsbookslot clsAvail';
    }

    // Fallback: compare ServerTime vs StartTime
    return this.getValidateTime(slot.StartTime, slot.ServerTime);
  }

  getValidateTime(startTime: string, serverTime: string): string {
    try {
      const currentTime = (serverTime && serverTime !== 'null')
        ? new Date(serverTime)
        : new Date();

      const startDate = new Date(startTime);

      if (isNaN(startDate.getTime())) {
        return 'clsbookslot clsExpired';
      }

      return currentTime < startDate ? 'clsbookslot clsAvail' : 'clsbookslot clsExpired';
    } catch {
      return 'clsbookslot clsExpired';
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
    this.timeSlotsLoaded = false;
    const catCodeEnc = this.wizardService.refCatCode || undefined;
    this.api.GetApptTimeSlot(currentDate, branchId, categoryId, catCodeEnc).subscribe((response: any) => {
      if (response?.Table?.length) {
        this.timeSlotList = response.Table;
        this.setupControl('timeSlot', true, true);
      } else {
        this.timeSlotList = [];
        this.setupControl('timeSlot', true, false);
        this.messageHelper.warn(
          this.labelService.getLabel('registration_page_no_time_slots_available', 'caption') || 'No time slots available for the selected date',
          5000
        );
      }
      this.timeSlotsLoaded = true;
    });
  }

  private loadUdfSettings() {
    this.wizardService.getUdfSettings$().pipe(
      filter(udfSettings => udfSettings !== null),
      takeUntil(this.destroy$)
    ).subscribe((udfSettings: any) => {
      this.udfSettings = (udfSettings.Table || []).map((udf: any) => ({
        ...udf,
        Enabled: !!this.settings?.[udf.udfPrefix === 'v' ? udf.formControlName + 'Enabled' : udf.UDFName + 'Enabled'],
        Required: !!this.settings?.[udf.udfPrefix === 'v' ? udf.formControlName + 'Required' : udf.UDFName + 'Required'],
        translateKey: 'registration_page_' + (udf.udfPrefix || 'a') + udf.UDFName.toLowerCase()
      }));
      this.udfOptions = udfSettings.Table1;
      // If the form was already shown to the user, save their input so it survives reinit
      if (!this.isLoading) {
        this.saveFormDataToWizard();
      }
      this.initializeForm();
      this.setupConditionalControls();
      this.applyDefaultDateTimes();

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

          // If the form was already shown to the user, save their input so it survives reinit
          if (!this.isLoading) {
            this.saveFormDataToWizard();
          }
          // Reinitialize form with new controls
          this.initializeForm();
          this.setupConditionalControls();
          this.applyDefaultDateTimes();
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

        // Normalize first — Table5 uses dept_id/dept_desc; hostDepartments use DName/DepartmentSeqId.
        // Map all to consistent DName + DepartmentSeqId so p-select never writes undefined.
        this.departmentList = this.departmentList.map((d: any) => ({
          ...d,
          DName: d.DName || d.dept_desc || d.Department || d.DeptName || d.Name || '',
          DepartmentSeqId: d.DepartmentSeqId ?? d.dept_id ?? d.DName ?? d.Department ?? ''
        }));

        // Remove duplicates based on normalized DName
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

    // Process Country list from Table13
    if (response && response.Table13 && response.Table13.length > 0) {
      this.countryList = [...response.Table13];
    }

    // Process visit purposes from Table10 (or Table3 as fallback)
    const purposes = response?.Table10 || response?.Table3 || [];
    if (purposes.length > 0) {
      // Normalize to ensure visitpurpose_id and visitpurpose_desc are always present
      // regardless of the field names used by the API (PurposeCode/PurposeName or visitpurpose_id/visitpurpose_desc)
      this.purposeList = purposes.map((p: any) => ({
        ...p,
        visitpurpose_id: p.visitpurpose_id ?? p.PurposeCode ?? p.purpose_id ?? '',
        visitpurpose_desc: p.visitpurpose_desc ?? p.PurposeName ?? p.purpose_name ?? '',
      }));
      console.log('Visit purposes loaded from branch data:', this.purposeList.length);
    } else if (this.settings?.PurposeEnabled) {
      // Fallback: load from VimsAppFacilityPurposeList if no purposes in branch data
      this.api.VimsAppFacilityPurposeList().subscribe((purposeResponse: any) => {
        if (purposeResponse?.Table1?.length) {
          this.purposeList = purposeResponse.Table1.map((p: any) => ({
            visitpurpose_id: p.PurposeCode,
            visitpurpose_desc: p.PurposeName
          }));
          console.log('Visit purposes loaded from VimsAppFacilityPurposeList:', this.purposeList.length);
        }
      });
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

  // Apply query parameter host filtering for appointment flow or hc query param
  private applyQueryParamHostFiltering() {
    // Handle isHostFromQuery: auto-select and disable host from hc query param
    if (this.wizardService.isHostFromQuery && this.wizardService.hostCodeFromQuery) {
      const hostCode = this.wizardService.hostCodeFromQuery;
      console.log('Applying host filtering for hc query param, hostCodeFromQuery:', hostCode);

      const matchingHost = this.hosts.find((host: any) =>
        host.HOSTIC === hostCode ||
        host.HostIC === hostCode ||
        String(host.HOSTIC) === String(hostCode)
      );

      if (matchingHost) {
        console.log('Found matching host for hc param:', matchingHost);
        this.hosts = [matchingHost];
        this.hostNameList = [matchingHost];
        this.shouldFilterHostByQueryParam = true;
        this.generalForm.get('host')?.setValue(matchingHost.HOSTIC || matchingHost.HostIC || matchingHost.SeqId);
        console.log('Host auto-selected and disabled for hc query param flow');
        return;
      } else {
        console.warn('No matching host found for hostCodeFromQuery:', hostCode, 'Available hosts:', this.hosts);
      }
    }

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

      // Persist immediately so future initializeForm() re-runs (race condition with udfSettings$)
      // always restore the correct host value from savedData.host instead of resetting to null.
      this.saveFormDataToWizard();

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

    // Reflect the Angular form control's disabled state (set by setupConditionalControls)
    // so PrimeNG [disabled] binding stays in sync for conditionally locked fields.
    const control = this.generalForm?.get(fieldName);
    if (control?.disabled) {
      return true;
    }

    return this.lockedFieldsInAppointmentFlow.includes(fieldName);
  }

  /**
   * Check if a field should be hidden in appointment flow
   * @param fieldName The name of the field to check
   * @returns true if field should be hidden, false otherwise
   */
  isFieldHiddenInAppointmentFlow(fieldName: string): boolean {
    return this.isAppointmentFlow && this.hiddenFieldsInAppointmentFlow.includes(fieldName);
  }

  onNumericInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cleaned = input.value.replace(/[^0-9]/g, '');
    if (input.value !== cleaned) {
      input.value = cleaned;
      this.generalForm.get('phone')?.setValue(cleaned, { emitEvent: false });
    }
  }

  clearField(controlName: string): void {
    const control = this.generalForm.get(controlName);
    if (control) {
      control.setValue(null);
      control.markAsTouched();
      control.markAsDirty();
    }
    switch (controlName) {
      case 'host': this.onHostChange({ value: null }); break;
      case 'department': this.onDepartmentChange({ value: null }); break;
      case 'visitor_id_type': this.onIdTypeChange({ value: null }); break;
      case 'purpose': this.onPurposeChange({ value: null }); break;
      case 'facilitySelection': this.onFacilitySelectionChange(''); break;
    }
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

  /**
   * Apply default start (now) and end datetime based on AptEndTime setting.
   * startDate always defaults to now when StartEndDtEnabled is true.
   * endDate default depends on AptEndTime:
   *   AptEndTime = 'Category'    → end = now + time_permit parsed from CategoryTimePermit
   *   AptEndTime = 'DefaultEOD'  → end = today at 23:59:59
   *   AptEndTime = '' / unset    → end = now + 1 hour (safe fallback)
   */
  private applyDefaultDateTimes(): void {
    // Skip if in appointment flow — dates are pre-filled from visitor ack
    if (this.isAppointmentFlow) return;

    // Only apply when start/end date fields are actually shown
    const showStartEnd = this.settings?.StartEndDtEnabled && !this.enableVimsApptTimeSlot;
    if (!showStartEnd) return;

    const savedData = this.wizardService.getFormData('general') || {};
    const now = new Date();

    // Always default start to now if not already saved
    if (!savedData.startDate) {
      this.generalForm.get('startDate')?.setValue(now);
    }

    if (savedData.endDate) return; // already saved — don't overwrite

    const aptEndTime = this.settings?.AptEndTime;
    let endDate: Date | null = null;

    if (aptEndTime === 'DefaultEOD') {
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (aptEndTime === 'Category') {
      const timePermit: string = this.settings?.CategoryTimePermit || '';
      endDate = this.parseTimePermit(timePermit, now);
    }

    // Fallback: default end to 1 hour after start when AptEndTime is not configured
    if (!endDate) {
      endDate = new Date(now.getTime() + 60 * 60 * 1000);
    }

    this.generalForm.get('endDate')?.setValue(endDate);
  }

  /**
   * Parse a time_permit string like "18 Hours", "2 Days", "1 Month", "3 Months" and
   * return a Date offset from the given base date.
   */
  private parseTimePermit(timePermit: string, base: Date): Date | null {
    if (!timePermit) return null;
    const match = timePermit.trim().match(/^(\d+)\s*(hour|hours|day|days|week|weeks|month|months)$/i);
    if (!match) return null;

    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const result = new Date(base);

    if (unit.startsWith('hour')) {
      result.setHours(result.getHours() + amount);
    } else if (unit.startsWith('day')) {
      result.setDate(result.getDate() + amount);
    } else if (unit.startsWith('week')) {
      result.setDate(result.getDate() + amount * 7);
    } else if (unit.startsWith('month')) {
      result.setMonth(result.getMonth() + amount);
    }

    return result;
  }

  private initializeForm(): void {
    const savedData = this.wizardService.getFormData('general') || {};

    // Check if multiple visitor mode is enabled (check both flat and nested path)
    this.isMultipleVisitorMode = this.settings?.MultipleVisitorEnabled || this.settings?.Visitor?.[0]?.MultipleVisitorEnabled || false;

    // Get visitor acknowledgment data if available
    const visitorData = this.visitorAckData?.visitorData;
    const isPreFilledData = this.isAppointmentFlow && visitorData;

    // Resolve the ID type code for the dropdown (optionValue="ID_TYPECODE").
    // The API may return ID_TYPE as a description string (e.g. "Passport") rather than the
    // internal code — look up the matching entry in idTypeList and use its ID_TYPECODE instead.
    let resolvedIdType: string | null = isPreFilledData
      ? (visitorData.idType || savedData.visitor_id_type || null)
      : (savedData.visitor_id_type || null);
    if (isPreFilledData && resolvedIdType && this.idTypeList.length > 0) {
      const codeMatch = this.idTypeList.find((t: any) => t.ID_TYPECODE === resolvedIdType);
      if (!codeMatch) {
        const descMatch = this.idTypeList.find((t: any) =>
          t.IDTYPEDESCRIPTION?.toLowerCase() === resolvedIdType!.toLowerCase() ||
          t.IDTYPEDESCRIPTION?.toLowerCase().includes(resolvedIdType!.toLowerCase())
        );
        if (descMatch) resolvedIdType = descMatch.ID_TYPECODE;
      }
    }

    // If the appointment fullName contains a title prefix (e.g. "Mr.Aravind"), extract and
    // resolve it against titleList so the title dropdown gets pre-selected correctly.
    let resolvedTitle: string | null = savedData.title || null;
    let resolvedFullName: string = isPreFilledData ? (visitorData.fullName || savedData.fullName || '') : (savedData.fullName || '');
    if (isPreFilledData && visitorData.fullName && this.titleList.length > 0) {
      const dotIndex = visitorData.fullName.indexOf('.');
      if (dotIndex > 0) {
        const prefix = visitorData.fullName.substring(0, dotIndex).trim();   // e.g. "Mr"
        const nameAfter = visitorData.fullName.substring(dotIndex + 1).trim(); // e.g. "Aravind"
        // Match against titleList — try exact (with or without trailing dot)
        const match = this.titleList.find((t: any) => {
          const tVal: string = (t.Title || '').replace(/\.+$/, '').trim();
          return tVal.toLowerCase() === prefix.toLowerCase();
        });
        if (match) {
          resolvedTitle = match.Title;   // use the exact value from titleList (e.g. "Mr.")
          resolvedFullName = nameAfter;
        }
      }
    }

    const formControls: any = {
      profile: [savedData.profile || null],
      profilePreview: [savedData.profilePreview || ''],
      title: [resolvedTitle],
      fullName: [resolvedFullName],
      email: [isPreFilledData ? (visitorData.email || savedData.email || '') : (savedData.email || '')],
      phone: [isPreFilledData ? (visitorData.phone || savedData.phone || '') : (savedData.phone || '')],
      visitor_id_type: [resolvedIdType],
      visitor_id: [isPreFilledData ? (visitorData.identityNo || savedData.visitor_id || '') : (savedData.visitor_id || '')],
      id_expired_date: [isPreFilledData ? (visitorData.expiredDate ? new Date(visitorData.expiredDate) : (savedData.id_expired_date || null)) : (savedData.id_expired_date || null)],
      gender: [isPreFilledData ? (visitorData.genderId || savedData.gender || null) : (savedData.gender || null)],
      visitor_company: [isPreFilledData ? (visitorData.company || savedData.visitor_company || '') : (savedData.visitor_company || '')],
      vehicle_number: [isPreFilledData ? (visitorData.vehicleNumber || savedData.vehicle_number || '') : (savedData.vehicle_number || '')],
      vehicle_brand: [isPreFilledData ? (visitorData.vehicleBrand || savedData.vehicle_brand || '') : (savedData.vehicle_brand || '')],
      vehicle_model: [isPreFilledData ? (visitorData.vehicleModel || savedData.vehicle_model || '') : (savedData.vehicle_model || '')],
      vehicle_color: [isPreFilledData ? (visitorData.vehicleColor || savedData.vehicle_color || '') : (savedData.vehicle_color || '')],
      expired_date: [savedData.expired_date || ''],
      Reason: [savedData.Reason || ''],
      meeting_location: [savedData.meeting_location || ''],
      floor: [isPreFilledData ? (visitorData.floorId || savedData.floor || null) : (savedData.floor || null)],
      visitor_address: [isPreFilledData ? (visitorData.address || savedData.visitor_address || '') : (savedData.visitor_address || '')],
      country: [isPreFilledData ? (visitorData.countryId || savedData.country || null) : (savedData.country || null)],
      work_permit_ref: [savedData.work_permit_ref || ''],
      event_name: [savedData.event_name || ''],
      remarks: [isPreFilledData ? (visitorData.remarks || savedData.remarks || '') : (savedData.remarks || '')],
      host: [savedData.host || (isPreFilledData ? (visitorData.hostId || null) : null) || (this.shouldHideHostControl ? this.defaultHostId : null) || (this.wizardService.isHostFromQuery && this.wizardService.hostCodeFromQuery ? this.wizardService.hostCodeFromQuery : null)],
      startDate: [isPreFilledData ? (this.parseDate(visitorData.startTime) || '') : (savedData.startDate || '')],
      endDate: [isPreFilledData ? (this.parseDate(visitorData.endTime) || '') : (savedData.endDate || '')],
      department: [savedData.department || null],
      appointmentDate: [savedData.appointmentDate || null],
      timeSlot: [savedData.timeSlot || null],
      facilityBooking: [savedData.facilityBooking || false],
      facilityPurpose: [savedData.facilityPurpose || null],
      facilitySelection: [savedData.facilitySelection || null],
      sharedDate: [savedData.sharedDate || null],
      purpose: [savedData.purpose || null],
      purposeDesc: [savedData.purposeDesc || ''],
      hostName: [savedData.hostName || ''],
      roomDesc: [savedData.roomDesc || ''],
      visitType: [savedData.visitType || '']
    };

    // Add UDF controls to main form (now applies to both single and multiple visitor modes)
    if (this.udfSettings && this.udfSettings.length > 0) {
      console.log('Adding UDF controls to main form:', this.udfSettings);
      this.udfSettings.forEach((udf: any) => {
        if (udf.Enabled) {
          const controlName = udf.formControlName;  // e.g. 'AUDF1' or 'VUDF1'

          // Get value from saved data, fall back to visitorData in appointment flow
          const appointmentValue = isPreFilledData ? (visitorData[controlName] ?? null) : null;
          const controlValue = udf.UDFCtrlType === 10
            ? (savedData[controlName] || appointmentValue || '')
            : (savedData[controlName] ?? appointmentValue ?? null);

          const validators = [];
          if (udf.UDFCtrlType === 10 && udf.MinLength) {
            validators.push(Validators.minLength(udf.MinLength));
          }
          if (udf.UDFCtrlType === 10 && udf.MaxLength) {
            validators.push(Validators.maxLength(udf.MaxLength));
          }
          if (udf.Required) {
            validators.push(Validators.required);
          }
          if (udf.UDFCtrlType === 40 && udf.IsAnyDateRange === 20) {
            validators.push(this.dateRangeValidator);
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

    // Restore saved visitors for display in table
    if (this.isMultipleVisitorMode && savedData.savedVisitors) {
      this.savedVisitors = savedData.savedVisitors;
    }

    // If only 1 visitor, reload it into the form so user can review/edit on back navigation
    if (this.isMultipleVisitorMode && this.savedVisitors.length === 1) {
      this.generalForm.patchValue(this.savedVisitors[0]);
      this.editingVisitorIndex = 0;
      if (this.savedVisitors[0].profilePreview) {
        this.profileImage = this.sanitizer.bypassSecurityTrustUrl(this.savedVisitors[0].profilePreview);
      } else {
        this.profileImage = '';
      }
    } else if (this.isMultipleVisitorMode && this.savedVisitors.length > 1) {
      // Clear profile image display in multiple visitor mode if multiple visitors exist
      this.profileImage = '';
    } else if (savedData.profilePreview) {
      // Restore profile image preview when navigating back
      this.profileImage = savedData.profilePreview;
    }

    // Initialize visitors after form is created
    if (this.isMultipleVisitorMode) {
      this.initializeVisitors(savedData);
    }

    // Subscriptions for combined date-time logic
    this.generalForm.get('startDate')?.valueChanges.subscribe((startDate) => {
      this.updateMinVisitTime(startDate);
      this.updateMinEndTime(startDate);
      this.checkEndBeforeStart();

      if (startDate) {
        // Default endDate based on startDate if not set
        const endDateCtrl = this.generalForm.get('endDate');
        if (endDateCtrl && !endDateCtrl.value) {
          const oneHourLater = new Date(startDate.getTime() + (60 * 60 * 1000));
          endDateCtrl.setValue(oneHourLater);
        }
      }
    });

    this.generalForm.get('endDate')?.valueChanges.subscribe(() => {
      this.checkEndBeforeStart();
    });
  }

  private checkEndBeforeStart(): void {
    const startDate = this.generalForm.get('startDate')?.value;
    const endDate = this.generalForm.get('endDate')?.value;

    if (!startDate || !endDate) {
      this.endBeforeStartError = false;
      return;
    }

    const startDt = new Date(startDate);
    const endDt = new Date(endDate);

    // End must be at least 1 hour after start
    this.endBeforeStartError = endDt.getTime() < startDt.getTime() + (60 * 60 * 1000);
  }

  private updateMinVisitTime(startDate: Date | null): void {
    if (!startDate) {
      this.minVisitTime = undefined;
      return;
    }
    const today = new Date();
    const isToday =
      startDate.getFullYear() === today.getFullYear() &&
      startDate.getMonth() === today.getMonth() &&
      startDate.getDate() === today.getDate();
    this.minVisitTime = isToday ? new Date() : undefined;
  }

  private updateMinEndTime(startDate: Date | null): void {
    if (!startDate) {
      this.minEndTime = undefined;
      return;
    }

    const endDateCtrl = this.generalForm.get('endDate');

    if (!endDateCtrl) {
      this.minEndTime = undefined;
      return;
    }

    const minEndDateTime = new Date(startDate.getTime() + (60 * 60 * 1000));

    // In same day as start, min selectable time is the start time
    // Primeng p-datepicker minDate handles the date part. For the same day,
    // minDate set to startDate will also restrict time if the date matches.

    const currentEndDate = endDateCtrl.value ? new Date(endDateCtrl.value) : null;
    const isSameDayAsStart = currentEndDate &&
      currentEndDate.getFullYear() === startDate.getFullYear() &&
      currentEndDate.getMonth() === startDate.getMonth() &&
      currentEndDate.getDate() === startDate.getDate();

    if (isSameDayAsStart) {
      this.minEndTime = startDate;
    } else {
      this.minEndTime = undefined;
    }

    // Defaulting: if current end is less than 1 hour after start, update it
    if (currentEndDate && currentEndDate.getTime() < minEndDateTime.getTime()) {
      endDateCtrl.setValue(minEndDateTime);
      endDateCtrl.markAsTouched();
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
    // Only allow adding visitors to table if multi-visitor setting is enabled
    if (!this.isMultipleVisitorMode) {
      return;
    }

    if (this.isVisitorBlacklisted) {
      this.showMessage({ severity: 'error', ...this.getAlert('registration_page_blacklisted_alert'), life: 5000 });
      return;
    }

    if (this.isVisitorNotWhitelisted) {
      this.showMessage({ severity: 'error', summary: this.labelService.getLabel('registration_page_not_whitelisted_alert_title', 'caption') || 'Not Whitelisted', detail: this.labelService.getLabel('registration_page_not_whitelisted_alert_description', 'caption') || 'Visitor not whitelisted. Please contact admin.', life: 5000 });
      return;
    }

    const currentForm = this.getCurrentVisitorForm();

    if (this.isCurrentVisitorFormValid()) {
      // If image upload is enabled, show the photo dialog before saving.
      // After the user captures/uploads/skips, performAddVisitor() will be called.
      if (this.settings?.ImageUploadEnabled) {
        this.pendingAction = 'addVisitor';
        this.openPhotoCaptureDialog();
        return;
      }
      this.performAddVisitor();
    } else {
      // Mark only visitor-related required fields as touched to show validation errors
      const requiredFields = this.getRequiredVisitorFields();
      requiredFields.forEach(field => {
        currentForm.get(field)?.markAsTouched();
      });
      this.scrollToFirstError();
      this.showMessage({ severity: 'error', ...this.getAlert('registration_page_all_visitor_fields_required') });
    }
  }

  private performAddVisitor(): void {
    if (!this.isMultipleVisitorMode) return;
    const currentForm = this.getCurrentVisitorForm();

    // Save to savedVisitors array for multiple visitor functionality
    const visitorData = { ...currentForm.value };

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
      visitorData.myself = true; // First visitor is always "myself" when safety briefing is enabled
    } else {
      visitorData.myself = false; // Subsequent visitors are not "myself"
    }

    if (this.editingVisitorIndex >= 0) {
      // Update existing visitor
      this.savedVisitors[this.editingVisitorIndex] = visitorData;
      this.editingVisitorIndex = -1; // Reset editing index

      this.showMessage({ severity: 'success', ...this.getAlert('registration_page_visitor_update_message') });
    } else {
      // Check for duplicate visitor by visitor_id or fullName
      const isDuplicate = this.savedVisitors.some(v =>
        (visitorData.visitor_id && v.visitor_id === visitorData.visitor_id) ||
        (visitorData.fullName && v.fullName?.toLowerCase() === visitorData.fullName?.toLowerCase())
      );

      if (isDuplicate) {
        this.showMessage({ severity: 'warn', ...this.getAlert('registration_page_duplicate_visitor_alert') });
        return;
      }

      // Add new visitor
      this.savedVisitors.push(visitorData);

      this.showMessage({ severity: 'success', ...this.getAlert('registration_page_visitor_save_message') });
    }

    // Save form data immediately after visitor modification
    this.saveFormDataToWizard();

    // Clear visitor identification fields including the profile preview so the next
    // visitor doesn't accidentally inherit the previous visitor's photo.
    const fieldsToReset = ['fullName', 'visitor_id', 'profile', 'profilePreview'];

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
      if (this.settings.RoomEnabled && this.settings.RoomRequired) requiredFields.push('meeting_location');
      if (this.settings.HostNameEnabled && this.settings.HostNameRequired) requiredFields.push('host');
      if (this.settings.ImageUploadEnabled && this.settings.ImageUploadRequired) requiredFields.push('profile');

      // Add UDF required fields
      if (this.udfSettings) {
        this.udfSettings.forEach((udf: any) => {
          if (udf.Enabled && udf.Required) {
            requiredFields.push(udf.formControlName);
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
    if (!this.isMultipleVisitorMode) {
      return;
    }

    if (index >= 0 && index < this.savedVisitors.length) {
      const visitor = this.savedVisitors[index];
      const currentForm = this.getCurrentVisitorForm();

      // Populate the form with the selected visitor's data
      currentForm.patchValue(visitor);

      // Restore profile image display from saved base64 preview
      if (visitor.profilePreview) {
        this.profileImage = this.sanitizer.bypassSecurityTrustUrl(visitor.profilePreview);
      } else {
        this.profileImage = '';
      }

      // Store the index for updating later
      this.editingVisitorIndex = index;

      this.showMessage({ severity: 'info', ...this.getAlert('registration_page_edit_mode_message') });
    }
  }

  deleteSavedVisitor(index: number): void {
    // Only allow deleting if multi-visitor setting is enabled
    if (!this.isMultipleVisitorMode) {
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

      this.showMessage({ severity: 'success', ...this.getAlert('registration_page_visitor_delete_message') });
    }
  }

  // Optional: Add a method to cancel editing
  cancelEdit(): void {
    if (this.editingVisitorIndex >= 0) {
      this.editingVisitorIndex = -1;
      const currentForm = this.getCurrentVisitorForm();
      currentForm.reset();
      this.profileImage = ''; // Clear photo preview when cancelling edit

      this.showMessage({ severity: 'info', ...this.getAlert('registration_page_cancellation_message') });
    }
  }

  getVisitorInitials(name: string): string {
    if (!name?.trim()) return '?';
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  }

  private setupConditionalControls(): void {
    if (!this.settings) return;

    // Setup each control based on settings
    this.setupControl('title', this.settings.TitleEnabled, this.settings.TitleRequired);
    this.setupControl('fullName', this.settings.NameEnabled, this.settings.NameRequired, this.settings.NameMinLength);
    this.setupControl('email', this.settings.EmailEnabled, this.settings.EmailRequired);
    if (this.settings.EmailEnabled) {
      this.generalForm.get('email')?.addValidators(Validators.email);
      this.generalForm.get('email')?.updateValueAndValidity();
    }
    this.setupControl('phone', this.settings.ContactNumberEnabled, this.settings.ContactNumberRequired, this.settings.ContactNumberMinLength);

    // Setup visitor_id with PDPA max length restriction if enabled
    const visitorIdMaxLength = this.isSingaporePDPARequired ? 4 : undefined;
    this.setupControl('visitor_id', this.settings.IdProofEnabled, this.settings.IdProofRequired, undefined, visitorIdMaxLength);
    this.setupControl('visitor_id_type', this.settings.IdTypeEnabled, this.settings.IdTypeRequired);

    this.setupControl('gender', this.settings.GenderEnabled, this.settings.GenderRequired);
    this.setupControl('department', this.settings.HostDepartmentEnabled, this.settings.HostDepartmentRequired);
    this.setupControl('floor', this.settings.FloorEnabled, this.settings.FloorRequired);
    this.setupControl('purpose', this.settings.PurposeEnabled, this.settings.PurposeRequired);
    this.setupControl('visitor_company', this.settings.CompanyEnabled, this.settings.CompanyRequired, this.settings.CompanyMinLength);
    this.setupControl('vehicle_number', this.settings.VehicleNumberEnabled, this.settings.VehicleNumberRequired, this.settings.VehicleNumberMinLength);
    this.setupControl('vehicle_brand', this.settings.VehicleBrandModelEnabled, this.settings.VehicleBrandModelRequired);
    this.setupControl('vehicle_model', this.settings.VehicleBrandModelEnabled, this.settings.VehicleBrandModelRequired);
    this.setupControl('vehicle_color', this.settings.VehicleColorEnabled, this.settings.VehicleColorRequired);
    this.setupControl('visitor_address', this.settings.AddressEnabled, this.settings.AddressRequired);
    this.setupControl('country', this.settings.CountryEnabled, this.settings.CountryRequired);
    this.setupControl('meeting_location', this.settings.RoomEnabled, this.settings.RoomRequired);
    this.setupControl('work_permit_ref', this.settings.WorkPermitRefEnabled, this.settings.WorkPermitRefRequired);
    this.setupControl('event_name', this.settings.EventEnabled, this.settings.EventRequired);
    this.setupControl('remarks', this.settings.RemarksEnabled, this.settings.RemarksRequired);
    // Don't require host when it's auto-selected from the hc query param
    const hostRequired = this.settings.HostNameRequired && !(this.wizardService.isHostFromQuery && this.wizardService.hostCodeFromQuery);
    this.setupControl('host', this.settings.HostNameEnabled, hostRequired);
    // In appointment flow, always show date/time fields (they carry pre-filled data)
    const showStartEnd = this.isAppointmentFlow || (this.settings.StartEndDtEnabled && !this.enableVimsApptTimeSlot);
    this.setupControl('startDate', showStartEnd, true);
    this.setupControl('endDate', showStartEnd, true);

    // profile is handled by the photo-capture dialog — never mark it required here
    this.setupControl('profile', this.settings.ImageUploadEnabled, false);

    this.udfSettings.forEach((udf: any) => {
      if (udf.Enabled) {
        this.setupControl(
          udf.formControlName,
          true,
          udf.Required,
          udf.UDFCtrlType === 10 ? udf.MinLength : undefined,
          udf.UDFCtrlType === 10 ? udf.MaxLength : undefined
        );
        if (udf.UDFCtrlType === 40 && udf.IsAnyDateRange === 20) {
          const ctrl = this.generalForm.get(udf.formControlName);
          if (ctrl) {
            ctrl.addValidators(this.dateRangeValidator);
            ctrl.updateValueAndValidity();
          }
        }
      }
    });

    // Setup VIMS controls
    if (this.enableVimsApptTimeSlot && !this.enableFBInSelfReg) {
      // Only appointment flow - use separate date picker
      this.setupControl('appointmentDate', true, true);
      // timeSlot is only required when slots have been loaded (user must pick a date first)
      this.setupControl('timeSlot', true, this.timeSlotList.length > 0);
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
      // timeSlot is only required when slots have been loaded (user must pick a date first)
      this.setupControl('timeSlot', true, this.timeSlotList.length > 0);
    }

    // Restore ID type UI state first (showIdExpiryField, selectedIdTypeData, id_expired_date
    // validators) — must run before locking so onIdTypeChange doesn't re-enable id_expired_date
    // after we lock it.
    const preFilledIdType = this.generalForm.get('visitor_id_type')?.value;
    if (preFilledIdType) {
      const savedExpiryDate = this.generalForm.get('id_expired_date')?.value;
      this.onIdTypeChange({ value: preFilledIdType });
      if (savedExpiryDate && this.showIdExpiryField) {
        this.generalForm.get('id_expired_date')?.setValue(savedExpiryDate, { emitEvent: false });
      }
    }

    // In appointment flow, lock all fields pre-filled by the admin/host.
    // startDate/endDate are always locked; all other pre-filled fields are locked only when they
    // carry a value (empty fields can still be filled in by the visitor).
    // host is intentionally NOT locked — visitor should be able to change it.
    if (this.isAppointmentFlow) {
      this.lockedFieldsInAppointmentFlow.forEach(controlName => {
        const control = this.generalForm.get(controlName);
        if (control) {
          control.disable({ emitEvent: false });
        }
      });

      const conditionallyLockedFields = [
        'title', 'fullName', 'email', 'phone',
        'visitor_id_type', 'visitor_id', 'id_expired_date',
        'gender', 'visitor_company',
        'vehicle_number', 'vehicle_brand', 'vehicle_model', 'vehicle_color',
        'visitor_address', 'country', 'remarks',
        'department', 'meeting_location', 'floor', 'purpose'
      ];
      conditionallyLockedFields.forEach(controlName => {
        const control = this.generalForm.get(controlName);
        if (control && control.value) {
          control.disable({ emitEvent: false });
        }
      });
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

    if (!enabled && !this.isAppointmentFlow) {
      // Only reset value when not in appointment flow — in appointment flow we
      // must preserve pre-filled values even for settings-disabled fields so
      // the appointment data is retained in the API payload.
      control.reset();
    }

    control.updateValueAndValidity();
  }

  validateForm(): boolean {
    // Mark all enabled non-FormArray controls as touched/dirty to trigger error display.
    // FormArrays (e.g. visitors) are validated separately — skip them here.
    Object.keys(this.generalForm.controls).forEach(controlName => {
      const control = this.generalForm.get(controlName);
      if (control?.enabled && !(control instanceof FormArray)) {
        control.markAsTouched();
        control.markAsDirty();
        control.updateValueAndValidity({ onlySelf: true });
      }
    });

    // Compute validity across non-FormArray controls only.
    // The visitors FormArray validity depends on its children (visitor sub-forms),
    // which are validated separately via isCurrentVisitorFormValid().
    // The 'profile' field is excluded here — it is collected via the photo dialog
    // which fires after this check, so it is never filled at this point.
    const isValid = Object.keys(this.generalForm.controls).every(name => {
      const c = this.generalForm.get(name);
      if (!c || c instanceof FormArray) return true; // Skip FormArrays
      if (name === 'profile') return true; // Validated by photo-capture dialog, not here
      return !c.enabled || c.valid;
    });

    // ── DIAGNOSTIC DUMP (always runs) ──────────────────────────────────────
    const failingFields: any[] = [];
    Object.keys(this.generalForm.controls).forEach(name => {
      const c = this.generalForm.get(name);
      if (c && !(c instanceof FormArray) && c.enabled && c.invalid) {
        failingFields.push({ field: name, value: c.value, errors: c.errors });
      }
    });
    console.group(`[step-general] validateForm — isValid=${isValid} | multiVisitor=${this.isMultipleVisitorMode} | savedVisitors=${this.savedVisitors.length} | editingIndex=${this.editingVisitorIndex}`);
    console.log('Settings snapshot:', {
      StartEndDtEnabled: this.settings?.StartEndDtEnabled,
      AptEndTime: this.settings?.AptEndTime,
      HostNameEnabled: this.settings?.HostNameEnabled,
      HostNameRequired: this.settings?.HostNameRequired,
      IdProofEnabled: this.settings?.IdProofEnabled,
      IdProofRequired: this.settings?.IdProofRequired,
      NameEnabled: this.settings?.NameEnabled,
      NameRequired: this.settings?.NameRequired,
    });
    if (failingFields.length) {
      console.warn('Failing fields:', failingFields);
    } else {
      console.log('All enabled fields valid');
    }
    console.groupEnd();
    // ───────────────────────────────────────────────────────────────────────

    if (this.isVisitorBlacklisted) {
      this.showMessage({ severity: 'error', ...this.getAlert('registration_page_blacklisted_alert'), life: 5000 });
      this.wizardService.setStepValid(false);
      return false;
    }

    // Block if visitor failed whitelist validation
    if (this.isVisitorNotWhitelisted) {
      this.showMessage({ severity: 'error', summary: this.labelService.getLabel('registration_page_not_whitelisted_alert_title', 'caption') || 'Not Whitelisted', detail: this.labelService.getLabel('registration_page_not_whitelisted_alert_description', 'caption') || 'Visitor not whitelisted. Please contact admin.', life: 5000 });
      this.wizardService.setStepValid(false);
      return false;
    }

    // Block if time slot is enabled but no slots available for selected date
    if (this.enableVimsApptTimeSlot && this.timeSlotsLoaded && this.timeSlotList.length === 0) {
      const dateField = this.enableFBInSelfReg ? 'sharedDate' : 'appointmentDate';
      const hasDate = !!this.generalForm.get(dateField)?.value;
      if (hasDate) {
        this.showMessage({
          severity: 'warn',
          summary: this.labelService.getLabel('registration_page_no_slots_available_alert', 'caption') || 'No Slots Available',
          detail: this.labelService.getLabel('registration_page_no_time_slots_available', 'caption') || 'No time slots available for the selected date'
        });
        this.wizardService.setStepValid(false);
        return false;
      }
    }

    // Validate end datetime is after start datetime
    this.checkEndBeforeStart();
    if (this.endBeforeStartError) {
      this.showMessage({ severity: 'error', ...this.getAlert('registration_page_end_date_validation') });
      this.wizardService.setStepValid(false);
      return false;
    }

    // Additional custom validation for visitor ID and expiry
    if (isValid) {
      const idValidation = this.validateVisitorIdAndExpiry();
      if (!idValidation.isValid) {
        this.showMessage({
          severity: 'error',
          summary: 'Validation Error',
          detail: idValidation.errorMessage
        });
        this.wizardService.setStepValid(false);
        return false;
      }
    }

    if (this.isMultipleVisitorMode) {
      // Rule 1: No saved visitors yet — form must be fully valid to auto-add as single visitor
      if (this.savedVisitors.length === 0) {
        if (!isValid) {
          this.scrollToFirstError();
          this.showMessage({ severity: 'error', ...this.getAlert('registration_page_all_fields_required') });
          this.wizardService.setStepValid(false);
          return false;
        }
        // Auto-save current form as the first (single) visitor
        const visitorData = { ...this.generalForm.getRawValue() };
        visitorData.Visitor_IC = visitorData.visitor_id || '';
        visitorData.IdentityNo = visitorData.visitor_id || '';
        if (this.settings?.Visitor?.[0]?.SafetyBriefingEnabled) {
          visitorData.myself = true;
        }
        this.savedVisitors.push(visitorData);

        // Clear the form so that back-navigation shows the chip without also
        // pre-filling the form with the same visitor's data (which looks like a duplicate).
        ['fullName', 'visitor_id', 'profile', 'profilePreview'].forEach(f => {
          this.generalForm.get(f)?.reset();
          this.generalForm.get(f)?.markAsUntouched();
          this.generalForm.get(f)?.markAsPristine();
        });
        this.profileImage = '';

        this.saveFormDataToWizard();
        this.wizardService.setStepValid(true);
        return true;
      }

      // Rule 2: Editing an existing visitor — commit the changes before proceeding
      if (this.editingVisitorIndex >= 0) {
        if (!isValid) {
          this.scrollToFirstError();
          this.showMessage({ severity: 'error', ...this.getAlert('registration_page_all_fields_required') });
          this.wizardService.setStepValid(false);
          return false;
        }
        const visitorData = { ...this.generalForm.getRawValue() };
        visitorData.Visitor_IC = visitorData.visitor_id || '';
        visitorData.IdentityNo = visitorData.visitor_id || '';
        this.savedVisitors[this.editingVisitorIndex] = visitorData;
        this.editingVisitorIndex = -1;
        ['fullName', 'visitor_id', 'profile', 'profilePreview'].forEach(f => {
          this.generalForm.get(f)?.reset();
          this.generalForm.get(f)?.markAsUntouched();
          this.generalForm.get(f)?.markAsPristine();
        });
        this.profileImage = '';
        this.saveFormDataToWizard();
        this.wizardService.setStepValid(true);
        return true;
      }

      // Rule 3: Visitors already added — allow proceeding if the current form is blank
      const currentFormHasData = this.isCurrentVisitorFormValid() || this.hasFormData();
      if (!currentFormHasData) {
        this.saveFormDataToWizard();
        this.wizardService.setStepValid(true);
        return true;
      }

      // Current form has partial/complete data — require it to be fully valid before proceeding
      if (!isValid) {
        this.scrollToFirstError();
        this.showMessage({ severity: 'error', ...this.getAlert('registration_page_all_fields_required') });
        this.wizardService.setStepValid(false);
        return false;
      }

      // Form is valid — auto-save as an additional visitor before proceeding
      const visitorData = { ...this.generalForm.getRawValue() };
      visitorData.Visitor_IC = visitorData.visitor_id || '';
      visitorData.IdentityNo = visitorData.visitor_id || '';
      const isDuplicate = this.savedVisitors.some(v =>
        (visitorData.visitor_id && v.visitor_id === visitorData.visitor_id) ||
        (visitorData.fullName && v.fullName?.toLowerCase() === visitorData.fullName?.toLowerCase())
      );
      if (!isDuplicate) {
        this.savedVisitors.push(visitorData);
        ['fullName', 'visitor_id', 'profile', 'profilePreview'].forEach(f => {
          this.generalForm.get(f)?.reset();
          this.generalForm.get(f)?.markAsUntouched();
          this.generalForm.get(f)?.markAsPristine();
        });
        this.profileImage = '';
      }

      this.saveFormDataToWizard();
      this.wizardService.setStepValid(true);
      return true;
    }

    // Non-multiple visitor mode
    if (isValid) {
      this.saveFormDataToWizard();
    }

    this.wizardService.setStepValid(isValid);

    if (!isValid) {
      this.scrollToFirstError();
      this.showMessage({ severity: 'error', ...this.getAlert('registration_page_all_fields_required') });
    }

    return isValid;
  }

  private saveFormDataToWizard(): void {
    const formData = { ...this.generalForm.getRawValue() };
    // Always persist savedVisitors so they survive back navigation
    if (this.isMultipleVisitorMode) {
      formData.savedVisitors = this.savedVisitors;
    }
    // Include slot times and flag for submit payload
    formData.timeSlotStartTime = this.timeSlotStartTime;
    formData.timeSlotEndTime = this.timeSlotEndTime;
    formData.enableVimsApptTimeSlot = this.enableVimsApptTimeSlot;
    this.wizardService.updateFormData('general', formData);
  }

  private scrollToFirstError(): void {
    setTimeout(() => {
      // Scroll within the correct scrollable container to the first invalid field
      const containers = [
        { container: '.form-section', field: '.form-field' },
        { container: '.m-form-scroll', field: '.m-form-field' },
      ];
      for (const { container, field } of containers) {
        const containerEl = document.querySelector(container) as HTMLElement;
        if (!containerEl) continue;
        const fields = containerEl.querySelectorAll(field);
        for (let i = 0; i < fields.length; i++) {
          if (fields[i].querySelector('.ng-invalid')) {
            fields[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }
        }
      }
    }, 100);
  }

  onExistingGuestClick(): void {
    this.showReturningVisitorPopup = true;
  }

  private applyVisitorToForm(visitor: any): void {
    const matchedCountry = this.countryList.find((c: any) =>
      c.CountrySeqId === visitor.Country || c.Code === visitor.Country ||
      c.CountryCode === visitor.Country || c.ShortName === visitor.Country ||
      c.Name === visitor.Country || c.CountryName === visitor.Country
    );
    const countryValue = matchedCountry?.CountrySeqId ?? visitor.Country ?? '';
    const idExpired = visitor.IDExpired ? new Date(visitor.IDExpired) : null;

    this.generalForm.patchValue({
      fullName: visitor.VisitorName || '',
      title: visitor.Title || visitor.Title1 || '',
      visitor_id: visitor.att_visitor_id || '',
      visitor_company: visitor.VisitorCompany || '',
      email: visitor.Email || '',
      phone: visitor.ContactNo || '',
      country: countryValue,
      vehicle_number: visitor.VehicleNo || '',
      id_expired_date: idExpired,
      visitor_id_type: visitor.IDType || ''
    });

    this.udfSettings.forEach((udf: any) => {
      if (udf.udfPrefix !== 'v') return;
      const apiValue = visitor[udf.UDFName];
      if (udf.Enabled && apiValue != null && apiValue !== '') {
        let value: any = apiValue;
        if (udf.UDFCtrlType === 40 && typeof apiValue === 'string') {
          const parts = apiValue.split(/[\/\-]/);
          if (parts.length === 3) value = new Date(+parts[2], +parts[1] - 1, +parts[0]);
        } else if (udf.UDFCtrlType === 30 && typeof apiValue === 'string') {
          value = apiValue.split(',').map((v: string) => v.trim()).filter(Boolean);
        }
        this.generalForm.patchValue({ [udf.formControlName]: value });
      }
    });
  }

  searchProfile(): void {
    const query = this.searchQuery?.trim();
    if (!query) return;

    const branchId = this.wizardService.currentBranchID;
    this.api.SearchVisitor(query, branchId).subscribe({
      next: (response: any) => {
        const visitor = response?.Table1?.[0];
        if (!visitor) {
          this.visitorNotFound = true;
          this.showMessage({ severity: 'warn', ...this.getAlert('registration_page_no_visitor_found_alert') });
          return;
        }

        this.isVisitorBlacklisted = visitor.visitor_blacklist === 1;
        if (this.isVisitorBlacklisted) {
          this.showMessage({ severity: 'error', ...this.getAlert('registration_page_blacklisted_alert'), life: 5000 });
          return;
        }

        // Extract and store safety briefing data from API response
        if (visitor.SafetyBriefing_Date !== undefined) {
          this.wizardService.SafetyBriefing_Date = visitor.SafetyBriefing_Date;
        }
        if (visitor.SafetyBriefVideoViewed !== undefined) {
          this.wizardService.SafetyBriefVideoViewed = visitor.SafetyBriefVideoViewed;
        }

        console.log('Safety briefing data from visitor:', {
          SafetyBriefing_Date: visitor.SafetyBriefing_Date,
          SafetyBriefVideoViewed: visitor.SafetyBriefVideoViewed
        });

        this.visitorNotFound = false;
        this.applyVisitorToForm(visitor);
        this.showReturningVisitorPopup = false;
      },
      error: () => {
        this.visitorNotFound = true;
        this.showMessage({ severity: 'error', ...this.getAlert('registration_page_search_failed_message') });
      }
    });
  }

  isFieldInvalid(field: string): boolean {
    const control = this.generalForm.get(field);
    if (!control || !control.enabled) {
      return false;
    }

    // Show error if: field is invalid AND (touched OR dirty OR has required error and is empty)
    const hasBeenInteracted = control.dirty || control.touched;
    //const isRequiredAndEmpty = control.hasError('required') && !control.value;

    return control.invalid && (hasBeenInteracted);
  }

  isFieldRequired(field: string): boolean {
    const control = this.generalForm.get(field);
    if (!control || !control.enabled) {
      return false;
    }

    const isEmpty = !control.value || (Array.isArray(control.value) && control.value.length === 0);
    const isRequiredAndEmpty = control.hasError('required') && isEmpty;
    return control.invalid && isRequiredAndEmpty;
  }

  isFieldInvalidRequired(field: string): boolean {
    const control = this.generalForm.get(field);
    if (!control || !control.enabled) {
      return false;
    }
    // Required+empty fields highlight immediately from load.
    // Other validation errors (format, length) only show after interaction.
    const isRequiredAndEmpty = control.hasError('required') && !control.value;
    const hasBeenInteracted = control.dirty || control.touched;
    return control.invalid && (isRequiredAndEmpty || hasBeenInteracted);
  }

  private readonly dateRangeValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value || !Array.isArray(value)) return null;
    if (value[0] && !value[1]) {
      return { dateRange: true };
    }
    return null;
  };

  isDateRangeIncomplete(field: string): boolean {
    const ctrl = this.generalForm.get(field);
    if (!ctrl || !ctrl.enabled) return false;
    return ctrl.hasError('dateRange') && (ctrl.dirty || ctrl.touched);
  }

  isEmailFormatError(): boolean {
    const ctrl = this.generalForm.get('email');
    if (!ctrl || !ctrl.enabled) return false;
    return ctrl.hasError('email') && (ctrl.dirty || ctrl.touched);
  }

  isFieldMinLengthError(field: string): boolean {
    const control = this.generalForm.get(field);
    if (!control || !control.enabled) return false;
    if (control.hasError('required')) return false; // required error takes priority
    return control.hasError('minlength') && (control.dirty || control.touched);
  }

  isFieldMaxLengthError(field: string): boolean {
    const control = this.generalForm.get(field);
    if (!control || !control.enabled) return false;
    return control.hasError('maxlength') && (control.dirty || control.touched);
  }

  getRequiredError(fieldKey: string): string {
    const key = fieldKey?.trim()?.toLowerCase().replace(/\s+/g, '_') || '';
    const template = this.labelService.getLabel('registration_page_error_required', 'caption') || '{Field} is required';
    // Try with registration_page_ prefix first (matches label translation keys), then fall back to the key as-is
    const fieldLabel = this.labelService.getLabel('registration_page_' + key, 'caption')
      || this.labelService.getLabel(key, 'caption')
      || fieldKey;
    return template.replace('{Field}', fieldLabel);
  }

  getUdfRequiredError(udf: any): string {
    const template = this.labelService.getLabel('registration_page_error_required', 'caption') || '{Field} is required';
    const key = udf.translateKey?.trim()?.toLowerCase() || '';
    // Use same fallback logic: if translation matches formatted key, use udf.Caption instead
    const translation = this.labelService.getLabel(key, 'caption');
    const label = (translation && translation !== this.formatKeyAsReadable(key))
      ? translation
      : (udf.Caption || udf.UDFName || '');
    return template.replace('{Field}', label);
  }

  getMinLengthError(min: number): string {
    const template = this.labelService.getLabel('registration_page_error_min_length', 'caption') || 'Minimum {udf.MinLength} characters required';
    return template.replace('{MinLength}', String(min));
  }

  getMaxLengthError(max: number): string {
    const template = this.labelService.getLabel('registration_page_error_max_length', 'caption') || 'Maximum {udf.MaxLength} characters required';
    return template.replace('{MaxLength}', String(max));
  }

  /**
   * Get translated label with fallback to caption
   * If translation doesn't exist, returns the caption instead of formatted key
   */
  getTranslatedLabelWithFallback(translateKey: string | undefined, fallback: string): string {
    if (!translateKey || !fallback) {
      return fallback;
    }
    
    const translation = this.labelService.getLabel(translateKey.toLowerCase().trim(), 'caption');
    // If translation exists (not the formatted-key fallback), return it
    if (translation && translation !== this.formatKeyAsReadable(translateKey)) {
      return translation;
    }
    
    // Otherwise, return the fallback
    return fallback;
  }

  /**
   * Get translated placeholder with fallback to placeholder text
   * If translation doesn't exist, returns the placeholder instead of formatted key
   */
  getTranslatedPlaceholderWithFallback(translateKey: string | undefined, fallback: string): string {
    if (!translateKey || !fallback) {
      return fallback;
    }
    
    const translation = this.labelService.getLabel(translateKey.toLowerCase().trim(), 'placeholder');
    // If translation exists (not the formatted-key fallback), return it
    if (translation && translation !== this.formatKeyAsReadable(translateKey)) {
      return translation;
    }
    
    // Otherwise, return the fallback
    return fallback;
  }

  /**
   * Format a translation key to readable text (same logic as TranslatePipe)
   */
  private formatKeyAsReadable(text: string): string {
    const parts = text?.split(/[\s._-]+/) || [];
    return parts
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  handleFileUpload(event: any, visitorIndex?: number, closeDialog = false): void {
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
          // Update specific visitor's profile (legacy FormArray path)
          this.visitorsArray.at(visitorIndex).get('profile')?.setValue(file);
          // Also store base64 preview for display and payload
          this.profileImage = imageUrl;
          this.generalForm.patchValue({ profile: file, profilePreview: e.target.result });
        } else {
          // Main form (both single and multi-visitor current-form)
          this.profileImage = imageUrl;
          this.generalForm.patchValue({ profile: file, profilePreview: e.target.result });
        }

        if (closeDialog) {
          // In multi-visitor mode, sync the uploaded photo to the latest savedVisitor
          // so back-navigation can restore it correctly (same as useCapture).
          if (this.isMultipleVisitorMode && this.savedVisitors.length > 0) {
            const targetIdx = this.savedVisitors.length - 1;
            this.savedVisitors[targetIdx] = { ...this.savedVisitors[targetIdx], profile: file, profilePreview: e.target.result };
            this.saveFormDataToWizard();
          }
          this.closePhotoCaptureDialog();
          this.executePendingAction();
        }
      };
      reader.readAsDataURL(file);
    }
  }

  // ─── Photo Capture Dialog ────────────────────────────────────────────────

  openPhotoCaptureDialog(): void {
    this.capturedImage = null;
    const existingPreview = this.generalForm.get('profilePreview')?.value as string | null;
    this.dialogPreviousImage = existingPreview || null;
    // If there is an existing photo, show it first so user can decide to keep or change it
    if (this.dialogPreviousImage) {
      this.dialogMode = 'preview';
      this.showPhotoCaptureDialog = true;
    } else {
      this.dialogMode = 'camera';
      this.showPhotoCaptureDialog = true;
      setTimeout(() => this.startCamera(), 300);
    }
  }

  switchToCamera(): void {
    this.dialogMode = 'camera';
    this.capturedImage = null;
    setTimeout(() => this.startCamera(), 150);
  }

  clearPhoto(): void {
    this.profileImage = '';
    this.generalForm.patchValue({ profile: null, profilePreview: '' });
    // Mark touched+dirty so the required error border shows immediately after removal
    const ctrl = this.generalForm.get('profile');
    ctrl?.markAsTouched();
    ctrl?.markAsDirty();
    ctrl?.updateValueAndValidity();
  }

  closePhotoCaptureDialog(): void {
    this.stopCamera();
    this.capturedImage = null;
    this.dialogPreviousImage = null;
    this.dialogMode = 'camera';
    this.showPhotoCaptureDialog = false;
  }

  cancelPhotoCaptureDialog(): void {
    this.pendingAction = null;
    this.closePhotoCaptureDialog();
  }

  keepExistingPhoto(): void {
    this.closePhotoCaptureDialog();
    this.executePendingAction();
  }

  private executePendingAction(): void {
    const action = this.pendingAction;
    this.pendingAction = null;
    if (action === 'goNext') {
      this.wizardService.navigateToNextStep();
    } else if (action === 'addVisitor') {
      this.performAddVisitor();
    }
  }

  async startCamera(): Promise<void> {
    this.stopCamera();
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: this.cameraFacingMode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      };
      // Torch/flash is part of advanced track constraints
      this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoEl = this.cameraVideoRef?.nativeElement;
      if (videoEl) {
        videoEl.srcObject = this.cameraStream;
        videoEl.play();
      }
      this.isCameraOn = true;
    } catch {
      this.isCameraOn = false;
      this.showError('Could not access camera. Please use "Upload from Device".');
    }
  }

  stopCamera(): void {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(t => t.stop());
      this.cameraStream = null;
    }
    this.isCameraOn = false;
  }

  async flipCamera(): Promise<void> {
    this.cameraFacingMode = this.cameraFacingMode === 'user' ? 'environment' : 'user';
    await this.startCamera();
  }

  toggleFlash(): void {
    this.useFlash = !this.useFlash;
    if (this.cameraStream) {
      const track = this.cameraStream.getVideoTracks()[0];
      if (track) {
        (track.applyConstraints as any)({ advanced: [{ torch: this.useFlash }] }).catch(() => { });
      }
    }
  }

  capturePhoto(): void {
    const video = this.cameraVideoRef?.nativeElement;
    const canvas = this.captureCanvasRef?.nativeElement;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw the raw video frame — no canvas-level mirroring.
    // The live preview is mirrored via CSS (scaleX(-1)) for selfie UX,
    // but the saved photo should be the natural/correct orientation.
    ctx.drawImage(video, 0, 0);
    this.capturedImage = canvas.toDataURL('image/jpeg', 0.85);
    this.stopCamera();
  }

  retakePhoto(): void {
    this.capturedImage = null;
    setTimeout(() => this.startCamera(), 100);
  }

  useCapture(): void {
    if (!this.capturedImage) return;
    const base64 = this.capturedImage;
    const imageUrl = this.sanitizer.bypassSecurityTrustUrl(base64);
    this.profileImage = imageUrl;
    // Convert base64 to a File object
    const byteString = atob(base64.split(',')[1]);
    const mimeType = base64.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const file = new File([ab], 'photo.jpg', { type: mimeType });
    this.generalForm.patchValue({ profile: file, profilePreview: base64 });
    // In multi-visitor mode, sync the captured photo back to the corresponding savedVisitor
    // so back-navigation can restore it and show 'preview' mode in the dialog.
    if (this.isMultipleVisitorMode && this.savedVisitors.length > 0) {
      const targetIdx = this.savedVisitors.length - 1;
      this.savedVisitors[targetIdx] = { ...this.savedVisitors[targetIdx], profile: file, profilePreview: base64 };
      this.saveFormDataToWizard();
    }
    this.closePhotoCaptureDialog();
    this.executePendingAction();
  }

  skipPhoto(): void {
    // If photo is mandatory, do not allow skipping
    if (this.settings?.ImageUploadRequired) {
      this.showMessage({
        severity: 'warn',
        summary: '',
        detail: this.labelService.getLabel('registration_page_photo_required', 'caption') || 'A photo is required. Please capture or upload one.'
      });
      return;
    }
    this.closePhotoCaptureDialog();
    this.executePendingAction();
  }

  private showError(message: string): void {
    this.showMessage({
      severity: 'error',
      summary: 'Error',
      detail: message
    });
  }

  ngOnDestroy(): void {
    this.stopCamera();
    if (this.wizardService.currentBranchID) {
      this.saveFormDataToWizard();
    }

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
      // Save host name for summary
      this.generalForm.get('hostName')?.setValue(selectedHost.HOSTNAME || selectedHost.Name || '', { emitEvent: false });

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

  onPurposeChange(event: any): void {
    const selectedId = event.value;
    const selected = this.purposeList.find((p: any) => p.visitpurpose_id === selectedId);
    this.generalForm.get('purposeDesc')?.setValue(selected?.visitpurpose_desc || '', { emitEvent: false });
    this.saveFormDataToWizard();
  }

  onRoomChange(event: any): void {
    const selectedId = event.value;
    const selected = this.meetingLocList.find((r: any) => r.MeetingRoomSeqId === selectedId);
    this.generalForm.get('roomDesc')?.setValue(selected?.MeetingRoomDesc || selected?.Name || '', { emitEvent: false });
    this.saveFormDataToWizard();
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

    // Filter hosts by selected department — case-insensitive to handle mismatches
    // between Table5 dept_id (e.g. "ADMIN") and host DEPARTMENT_REFID (e.g. "admin")
    const deptLower = selectedDepartment.toLowerCase();
    const filteredHosts = this.originalHostData.filter((host: any) => {
      return (host.Department || '').toLowerCase() === deptLower ||
        (host.DName || '').toLowerCase() === deptLower ||
        (host.DEPARTMENT_REFID || '').toLowerCase() === deptLower ||
        (host.DepartmentSeqId || '').toLowerCase() === deptLower;
    });

    // If no hosts match the department, fall back to showing all hosts
    // so the user can still select a host (and the previous selection is preserved)
    if (filteredHosts.length === 0) {
      console.log('No hosts found for department, showing all hosts');
      this.hosts = [...this.hostNameList];
      return;
    }

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

  onVisitorIdBlur(): void {
    const visitorId = this.generalForm.get('visitor_id')?.value?.trim();
    if (!visitorId) { this.isVisitorBlacklisted = false; this.isVisitorNotWhitelisted = false; return; }

    const branchId = this.wizardService.currentBranchID;
    this.api.SearchVisitor(visitorId, branchId).subscribe({
      next: (response: any) => {
        const visitor = response?.Table1?.[0];
        if (!visitor) return;

        this.isVisitorBlacklisted = visitor.visitor_blacklist === 1;
        if (this.isVisitorBlacklisted) {
          this.showMessage({ severity: 'error', ...this.getAlert('registration_page_blacklisted_alert'), life: 5000 });
          return;
        }

        // Extract and store safety briefing data from API response
        if (visitor.SafetyBriefing_Date !== undefined) {
          this.wizardService.SafetyBriefing_Date = visitor.SafetyBriefing_Date;
        }
        if (visitor.SafetyBriefVideoViewed !== undefined) {
          this.wizardService.SafetyBriefVideoViewed = visitor.SafetyBriefVideoViewed;
        }

        console.log('Safety briefing data from visitor:', {
          SafetyBriefing_Date: visitor.SafetyBriefing_Date,
          SafetyBriefVideoViewed: visitor.SafetyBriefVideoViewed
        });
      },
      error: () => { }
    });

    // Trigger whitelist check when both name and ID are present
    const fullName = this.generalForm.get('fullName')?.value?.trim();
    if (fullName) {
      this.checkWhitelistValidation(visitorId);
    }
  }

  onFullNameBlur(): void {
    const visitorId = this.generalForm.get('visitor_id')?.value?.trim();
    const fullName = this.generalForm.get('fullName')?.value?.trim();
    if (visitorId && fullName) {
      this.checkWhitelistValidation(visitorId);
    }
  }

  private checkWhitelistValidation(visitorId: string): void {
    if (!this.settings?.EnableWhitelistValidation) {
      this.isVisitorNotWhitelisted = false;
      return;
    }

    const branchId = this.wizardService.currentBranchID;
    this.api.SearchVisitorWhitelist(visitorId, branchId).subscribe({
      next: (response: any) => {
        // Response: [ { Data: { Table: [ { Code: 10|20, Description: '...' } ] }, Status: true } ]
        const result = Array.isArray(response) ? response[0] : response;
        const code = result?.Table?.[0]?.Code;
        if (code === 10) {
          // Whitelisted — allow to proceed
          this.isVisitorNotWhitelisted = false;
        } else {
          // Code 20 or unexpected — not whitelisted
          this.isVisitorNotWhitelisted = true;
          const description = this.labelService.getLabel('registration_page_not_whitelisted_alert_description', 'caption')
            || result?.Table?.[0]?.Description
            || 'Visitor not whitelisted. Please contact admin.';
          this.showMessage({
            severity: 'error',
            summary: this.labelService.getLabel('registration_page_not_whitelisted_alert_title', 'caption') || 'Not Whitelisted',
            detail: description,
            life: 5000
          });
        }
      },
      error: () => { this.isVisitorNotWhitelisted = false; }
    });
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

  selectTimeSlot(slot: any): void {
    if (slot.availableCount === 0) {
      const alert = this.getAlert('registration_page_slot_fully_booked');
      this.showMessage({
        severity: 'warn',
        detail: alert.detail || this.labelService.getLabel('registration_page_slot_fully_booked_alert', 'caption') || 'This appointment slot is fully booked or currently unavailable.',
        life: 5000
      });
      return;
    }
    this.generalForm.get('timeSlot')?.setValue(slot.Code);
    this.generalForm.get('timeSlot')?.markAsTouched();
  }

  onTimeSlotDropdownChange(code: string | null): void {
    if (!code) {
      this.timeSlotStartTime = null;
      this.timeSlotEndTime = null;
      return;
    }
    const slot = this.timeSlotList.find(s => s.Code === code);
    if (slot && slot.availableCount === 0) {
      const alert = this.getAlert('registration_page_slot_fully_booked');
      this.showMessage({
        severity: 'warn',
        detail: alert.detail || this.labelService.getLabel('registration_page_slot_fully_booked_alert', 'caption') || 'This appointment slot is fully booked or currently unavailable.',
        life: 5000
      });
      setTimeout(() => this.generalForm.get('timeSlot')?.setValue(null));
      this.timeSlotStartTime = null;
      this.timeSlotEndTime = null;
    } else {
      this.generalForm.get('timeSlot')?.markAsTouched();
      // Code format: "10:30-12:30" — parse start and end times
      const parts = (slot?.Code || '').split('-');
      this.timeSlotStartTime = parts[0]?.trim() || null;
      this.timeSlotEndTime = parts[1]?.trim() || null;
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

  goBack(): void {
    if (this.canGoBackToHome) {
      const queryParams: any = {};
      if (this.wizardService.refCode) {
        queryParams['bc'] = this.wizardService.refCode;
      }
      if (this.wizardService.hcParam) {
        queryParams['hc'] = this.wizardService.hcParam;
      }
      // Pass current branch/category so home page can restore selections
      if (!this.wizardService.refCode && this.wizardService.currentBranchID) {
        queryParams['_branchId'] = this.wizardService.currentBranchID;
      }
      if (!this.wizardService.refCatCode && this.wizardService.selectedVisitCategory) {
        queryParams['_catId'] = this.wizardService.selectedVisitCategory;
      }
      this.router.navigate(['/'], Object.keys(queryParams).length > 0 ? { queryParams } : {});
    } else {
      const prev = this.wizardService.getCurrentStepIndex() - 1;
      if (prev >= 0) this.wizardService.requestStepChange(prev);
    }
  }

  goNext(): void {
    // Capture whether the current form has an active visitor BEFORE validateForm() auto-saves
    // and resets it. Used below to decide if a photo dialog is needed for a new visitor.
    const formHadActiveVisitor = this.isMultipleVisitorMode ? this.hasFormData() : false;

    // validateForm() handles markAllAsTouched, setStepValid, and toast errors internally
    const isValid = this.validateForm();
    if (!isValid) return;

    // If image upload is enabled, show the photo capture dialog before proceeding.
    if (this.settings?.ImageUploadEnabled) {
      // In multi-visitor mode where all visitors were already saved (and photographed) via
      // "Save and Add", the current form is blank — no new visitor to photograph. Skip the
      // dialog and navigate directly.
      if (this.isMultipleVisitorMode && this.savedVisitors.length > 0 && !formHadActiveVisitor) {
        this.wizardService.navigateToNextStep();
        return;
      }

      this.pendingAction = 'goNext';
      // validateForm() auto-saves the visitor and clears profilePreview from the form before
      // this runs. Restore the photo from savedVisitors so the dialog shows 'preview' mode
      // instead of opening the camera again.
      if (this.isMultipleVisitorMode && !this.generalForm.get('profilePreview')?.value && this.savedVisitors.length > 0) {
        const lastVisitor = this.savedVisitors[this.savedVisitors.length - 1];
        if (lastVisitor?.profilePreview) {
          this.generalForm.patchValue({ profilePreview: lastVisitor.profilePreview }, { emitEvent: false });
          this.profileImage = this.sanitizer.bypassSecurityTrustUrl(lastVisitor.profilePreview);
        }
      }
      this.openPhotoCaptureDialog();
      return;
    }

    this.wizardService.navigateToNextStep();
  }

}

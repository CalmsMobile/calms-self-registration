import { Injectable } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SharedService } from '../../shared/shared.service';
import { Router } from '@angular/router';
import { VisitorAck, VisitorSelfData } from '../models/visitor-ack.model';
import { getEnabledSteps, StepConfig } from '../models/step-config.model';

@Injectable({
  providedIn: 'root'
})
export class WizardService {
  private currentStep$ = new BehaviorSubject<number>(0);
  private stepValidity$ = new BehaviorSubject<boolean>(false);
  private validationRequested$ = new Subject<void>();
  private stepChangeRequested$ = new Subject<number>();
  private skipRequested$ = new Subject<number>();
  private submissionRequested$ = new Subject<void>();
  private totalSteps = 5;
  private enabledSteps: MenuItem[] = [];

  pageTitle = 'Visitor Registration';

  public currentStep = this.currentStep$.asObservable();
  public canProceed$ = this.stepValidity$.asObservable();
  public onValidationRequest = this.validationRequested$.asObservable();
  public onStepChangeRequest = this.stepChangeRequested$.asObservable();
  public onSkipRequest = this.skipRequested$.asObservable();
  public onSubmitRequest = this.submissionRequested$.asObservable();
  private settings$ = new BehaviorSubject<any>(null);
  private attachmentSetting$ = new BehaviorSubject<any>(null);
  private questionsSetting$ = new BehaviorSubject<any>(null);
  private pagesSetting$ = new BehaviorSubject<any>(null);
  private selfRegistrationSetting$ = new BehaviorSubject<any>(null);
  private udfSetting$ = new BehaviorSubject<any>(null);
  getSettings$(): Observable<any> {
    return this.settings$.asObservable();
  }
  getPageSettings$(): Observable<any> {
    return this.pagesSetting$.asObservable();
  }
  getSelfRegistrationSettings$(): Observable<any> {
    return this.selfRegistrationSetting$.asObservable();
  }
  getUdfSettings$(): Observable<any> {
    return this.udfSetting$.asObservable();
  }

  private formDataStore = new BehaviorSubject<any>({});
  public formData$ = this.formDataStore.asObservable();

  currentBranchID = '';
  selectedVisitCategory = '';
  private masterData: any | null = null;
  private visitorAckData: any | null = null;
  private branchHostData: any | null = null;
  currentBranchName = '';

  // Raw encrypted query params from the URL
  refCode = '';      // encrypted branch code (bc param)
  refCatCode = '';    // encrypted category code (vc param)
  appointmentCode = ''; // appointment code (q param)
  hcParam = '';       // raw hc query param value (persisted so step-general can resolve it)
  hostCodeFromQuery = ''; // host IC resolved from hc param (GetSelfRegShareURLData response)
  categoryCodeFromQuery = ''; // category code resolved from vc+hc params (GetSelfRegShareURLData response)
  isHostFromQuery = false; // true when hc query param was used to pre-fill host
  /** True only when the wizard was reached via proceedToWizard() — reset on page refresh. */
  isNavigatedFromHome = false;
  /** The original query string from the home page URL (e.g. "?bc=ABC&vc=XYZ"). */
  originalQueryString = '';

  // Static variables for safety brief - will be replaced with dynamic data later
  SafetyBriefing_Date = "2026-03-03T14:02:43.957";
  SafetyBriefVideoViewed = false;

  constructor(private sharedService: SharedService, private router: Router) {
    if (!this.currentBranchID) {
      this.currentBranchID = sessionStorage.getItem('currentBranchID') || '';
    }
    if (!this.selectedVisitCategory) {
      this.selectedVisitCategory = sessionStorage.getItem('selectedVisitCategory') || '';
    }
    if (!this.currentBranchName) {
      this.currentBranchName = sessionStorage.getItem('currentBranchName') || '';
    }
    if (!this.refCode) {
      this.refCode = sessionStorage.getItem('refCode') || '';
    }
    if (!this.refCatCode) {
      this.refCatCode = sessionStorage.getItem('refCatCode') || '';
    }
    if (!this.appointmentCode) {
      this.appointmentCode = sessionStorage.getItem('appointmentCode') || '';
    }
    if (!this.hcParam) {
      this.hcParam = sessionStorage.getItem('hcParam') || '';
    }
    if (this.hcParam) {
      this.isHostFromQuery = true;
    }
    if (!this.originalQueryString) {
      this.originalQueryString = sessionStorage.getItem('originalQueryString') || '';
    }

    if (this.currentBranchID && this.currentBranchName) {
      this.updateHeader(20, this.currentBranchID);
    }
  }

  gotoHomePage() {
    this.router.navigate(['/']);
  }

  updateHeader(type = 10, RefId = '10001'): void {
    this.sharedService.updateHeader(
      this.currentBranchName,
      environment.proURL + "Handler/PortalImageHandler.ashx?ScreenType=" + type + "&RefSlno=" + RefId
    );
  }

  setDataToSessionStorage() {
    sessionStorage.setItem('currentBranchID', this.currentBranchID);
    sessionStorage.setItem('selectedVisitCategory', this.selectedVisitCategory);
    sessionStorage.setItem('currentBranchName', this.currentBranchName);
    if (this.refCode) sessionStorage.setItem('refCode', this.refCode);
    if (this.refCatCode) sessionStorage.setItem('refCatCode', this.refCatCode);
    if (this.appointmentCode) sessionStorage.setItem('appointmentCode', this.appointmentCode);
    if (this.hcParam) sessionStorage.setItem('hcParam', this.hcParam);
    if (this.originalQueryString) sessionStorage.setItem('originalQueryString', this.originalQueryString);
  }

  clearSessionStorage() {
    sessionStorage.removeItem('currentBranchID');
    sessionStorage.removeItem('selectedVisitCategory');
    sessionStorage.removeItem('currentBranchName');
    sessionStorage.removeItem('refCode');
    sessionStorage.removeItem('refCatCode');
    sessionStorage.removeItem('appointmentCode');
    sessionStorage.removeItem('hcParam');
    sessionStorage.removeItem('originalQueryString');
    this.currentBranchID = '';
    this.selectedVisitCategory = '';
    this.currentBranchName = '';
    this.refCode = '';
    this.refCatCode = '';
    this.appointmentCode = '';
    this.hcParam = '';
    this.hostCodeFromQuery = '';
    this.categoryCodeFromQuery = '';
    this.isHostFromQuery = false;
    this.isNavigatedFromHome = false;
    this.originalQueryString = '';
    this.formDataStore.next({});
    this.settings$.next(null);
    this.attachmentSetting$.next(null);
    this.questionsSetting$.next(null);
    this.pagesSetting$.next(null);
    this.selfRegistrationSetting$.next(null);
    this.udfSetting$.next(null);
    this.currentStep$.next(0);
    this.stepValidity$.next(false);
    this.enabledSteps = [];
    this.visitorAckData = null;
    this.masterData = null;
    this.branchHostData = null;
    this.updateHeader();
  }

  getmasterData() {
    return this.masterData;
  }

  /**
   * Stores master data from the GetBranchHostDataForSelf API response.
   * The response Data object uses the following table mapping:
   *   Table   → hosts (HOSTIC, HOSTNAME, HostFloor, DEPARTMENT_REFID)
   *   Table1  → meeting rooms (MeetingRoomSeqId, MeetingRoomDesc)
   *   Table2  → visitor categories (visitor_ctg_id, visitor_ctg_desc)
   *   Table3  → visit purposes (empty placeholder)
   *   Table4  → ID types (ID_TYPECODE, IDTYPEDESCRIPTION)
   *   Table5  → visitor IC
   *   Table6  → SelfVisitorCategories setting
   *   Table7  → patient name
   *   Table8  → floors (floor_id, floor_desc)
   *   Table9  → titles (TitleSeqId, Title)
   *   Table10 → purposes with details (visitpurpose_id, visitpurpose_desc)
   *   Table11 → departments (dept_id, dept_desc)
   *   Table12 → companies (visitor_comp_code, visitor_comp_name)
   *   Table13 → countries (CountrySeqId, ShortName, Name)
   *
   * The stored masterData remaps these so downstream consumers (e.g. step-general) can
   * access data through the stable table keys they already use:
   *   masterData.Table  → hosts
   *   masterData.Table1 → meeting rooms / locations
   *   masterData.Table2 → floors       (previously Table8)
   *   masterData.Table3 → purposes     (previously Table10)
   *   masterData.Table4 → ID types     (unchanged)
   *   masterData.Table5 → departments  (previously Table11)
   *   masterData.Table6 → SelfVisitorCategories setting
   *   masterData.Table7 → companies    (previously Table12)
   *   masterData.Table8 → floors raw   (unchanged)
   *   masterData.Table9 → titles       (unchanged)
   *   masterData.Table10 → purposes raw (unchanged)
   *   masterData.Table11 → departments raw (unchanged)
   *   masterData.Table12 → ID types    (previously Table4)
   *   masterData.Table13 → countries   (unchanged)
   */
  setmasterData(data: any) {
    if (!data) {
      this.masterData = null;
      return;
    }

    // Store the raw response and add remapped aliases so existing consumers
    // that reference Table2/Table3/Table5/Table7/Table12 still work correctly.
    this.masterData = {
      ...data,
      // meetingFloorList ← Table8 (floors)
      Table2: data.Table8 || data.Table2 || [],
      // purposeList ← Table10 (purposes with details)
      Table3: data.Table10 || data.Table3 || [],
      // departmentList ← Table11 (departments)
      Table5: data.Table11 || data.Table5 || [],
      // companyList ← Table12 (companies)
      Table7: data.Table12 || data.Table7 || [],
      // idTypeList ← Table4 (ID types)
      Table12: data.Table4 || data.Table12 || [],
      // Keep Table13 (countries) as-is
      Table13: data.Table13 || [],
    };
  }

  setVisitorAckData(data: any) {
    this.visitorAckData = data;
  }

  getIncomingVisitorAckData() {
    return this.visitorAckData;
  }

  setBranchHostData(data: any) {
    this.branchHostData = data;
    // Also populate masterData so step-general and other consumers
    // can access the full table set via getmasterData().
    this.setmasterData(data);
  }

  getBranchHostData() {
    return this.branchHostData;
  }

  setSettings(allSettings: any): void {
    console.log(allSettings);
    let settingsData: any = {};
    if (allSettings.Table?.length) {
      const table1 = allSettings.Table1[0] || {};
      const settingDetail = allSettings.Table2?.length ? JSON.parse(allSettings.Table2[0].SettingDetail) : {};
      const localSettings = typeof table1.LocalSettings === 'string' ? JSON.parse(table1.LocalSettings) : (table1.LocalSettings || {});
      settingsData = { ...table1, ...settingDetail, ...localSettings };
    }
    if (allSettings.Table5?.length) {
      settingsData.VideoUrl = allSettings.Table5[0]?.VideoUrl;
    }

    // Store time_permit from Table8 for AptEndTime=Category mode
    if (allSettings.Table8?.length) {
      settingsData.CategoryTimePermit = allSettings.Table8[0]?.time_permit || '';
    }
    /* debugger
    if (allSettings.Table6?.length) {
      
      settingsData.NdaTemplate = allSettings.Table6[0]?.NdaTemplate || '';
      settingsData.NDAEnabled = allSettings.Table6[0]?.NDAEnabled ?? settingsData.NDAEnabled;
    } */

    // Apply defaults for field-enable flags so core fields are visible when the branch
    // settings haven't been fully configured. API-returned values always take precedence.
    const fieldEnableDefaults: Record<string, any> = {
      NameEnabled: true,
      ContactNumberEnabled: true,
      HostNameEnabled: true,
      EmailEnabled: true,
      IdProofEnabled: true,
      IdTypeEnabled: true,
      StartEndDtEnabled: true,
      // Optional fields default to hidden — enable via settings configuration
      TitleEnabled: false,
      GenderEnabled: false,
      HostDepartmentEnabled: false,
      CompanyEnabled: false,
      VehicleNumberEnabled: false,
      VehicleBrandModelEnabled: false,
      VehicleColorEnabled: false,
      AddressEnabled: false,
      CountryEnabled: false,
      ImageUploadEnabled: false,
      WorkPermitRefEnabled: false,
      RemarksEnabled: false,
      RoomEnabled: false,
      NDAEnabled: false,
      EventEnabled: false,
    };
    settingsData = { ...fieldEnableDefaults, ...settingsData };

    this.settings$.next(settingsData);
    console.log(settingsData);

    this.attachmentSetting$.next(allSettings.Table4);

    this.questionsSetting$.next(allSettings.Table3);
  }

  getSettings(): any {
    return this.settings$.value;
  }

  getAttachmentSettings(): any {
    return this.attachmentSetting$.value;
  }

  getQuestionnaireSettings(): any {
    return this.questionsSetting$.value;
  }

  setPageSettings(pageSettings: any) {
    this.pagesSetting$.next(pageSettings);
  }

  setSelfRegistrationSettings(selfRegSettings: any) {
    this.selfRegistrationSetting$.next(selfRegSettings);
  }

  getSelfRegistrationSettings(): any {
    return this.selfRegistrationSetting$.value;
  }

  getPageSettings() {
    return this.pagesSetting$.value;
  }

  setUdfSettings(udfSettings: any) {
    this.udfSetting$.next(udfSettings);
  }

  getUdfSettings() {
    return this.udfSetting$.value;
  }

  updateEnabledSteps(settings: any): void {
    if (!settings) return;

    const enabledConfigs: StepConfig[] = getEnabledSteps(settings);

    this.enabledSteps = enabledConfigs.map(step => ({
      label: step.defaultLabel,
      routerLink: step.routerLink
    }));

    this.totalSteps = this.enabledSteps.length;
  }

  getEnabledSteps(): MenuItem[] {
    return this.enabledSteps;
  }

  getTotalSteps(): number {
    return this.totalSteps;
  }

  isStepEnabled(stepName: string): boolean {
    return this.enabledSteps.some(step => step.routerLink === stepName);
  }

  updateFormData(step: string, data: any): void {
    const currentData = this.formDataStore.value;
    const updatedData = {
      ...currentData,
      [step]: data
    };
    this.formDataStore.next(updatedData);
  }

  getFormData(step?: string): any {
    return step ? this.formDataStore.value[step] : this.formDataStore.value;
  }

  getFinalRegistrationData(): any {
    const formData = this.formDataStore.value;
    const settings = this.getSettings();
    const masterData = this.getmasterData();

    let loFinalData: any = {};

    // Branch Information
    loFinalData.Branch = this.currentBranchID;
    loFinalData.RefBranchDesc = this.currentBranchName;

    // Category Information
    loFinalData.CategoryId = this.selectedVisitCategory;
    loFinalData.CategoryDesc = this.getCategoryDescription(this.selectedVisitCategory);

    // Host Information (from settings)
    if (settings?.Visitor?.length > 0) {
      const visitorSettings = settings.Visitor[0];

      const masterData = this.getmasterData();
      const deptId = formData.general?.department?.toString() || '';
      const deptDesc = masterData?.Table5?.find((d: any) => (d.DepartmentSeqId ?? d.dept_id)?.toString() === deptId)?.dept_desc || deptId;
      loFinalData.HostDeptId = visitorSettings.HostDepartmentEnabled ? deptId : '';
      loFinalData.HostDeptDesc = visitorSettings.HostDepartmentEnabled ? deptDesc : '';

      const hostId = formData.general?.host?.toString() || '';
      const hostDesc = masterData?.Table?.find((h: any) => h.HOSTIC === hostId)?.HOSTNAME || '';
      loFinalData.HostId = visitorSettings.HostNameEnabled ? hostId : (visitorSettings.DefaultHostId?.toString() || '');
      loFinalData.HostDesc = visitorSettings.HostNameEnabled ? hostDesc : '';

      loFinalData.WorkPermitRef = visitorSettings.WorkPermitRefEnabled ? (formData.general?.workPermitRef || null) : null;
    }

    // General Information (from settings)
    if (settings?.General?.length > 0) {
      const generalSettings = settings.General[0];

      loFinalData.PurposeId = generalSettings.PurposeEnabled ? (formData.general?.purpose || '') : '';
      loFinalData.PurposeDesc = generalSettings.PurposeEnabled ? (formData.general?.purposeDesc || '') : '';

      loFinalData.FloorId = generalSettings.FloorEnabled ? (formData.general?.floor || '') : '';
      loFinalData.FloorDesc = generalSettings.FloorEnabled ? (formData.general?.floorDesc || '') : '';

      const roomId = formData.general?.meeting_location?.toString() || formData.general?.room?.toString() || '';
      const roomDesc = masterData?.Table1?.find((r: any) => (r.MeetingRoomSeqId || r.SeqId)?.toString() === roomId)?.MeetingRoomDesc || formData.general?.roomDesc || '';
      loFinalData.RoomId = generalSettings.RoomEnabled ? roomId : '';
      loFinalData.RoomDesc = generalSettings.RoomEnabled ? roomDesc : '';

      loFinalData.Remarks = generalSettings.RemarksEnabled ? (formData.general?.remarks || '') : '';

      loFinalData.allowSMS = generalSettings.EnableAppointmentSMSAlert ? true : false;
    }

    // Date/Time Information
    loFinalData.StartDateTime = formData.general?.startDateTime || this.getDefaultDateTime();
    loFinalData.EndDateTime = formData.general?.endDateTime || this.getDefaultDateTime(1); // +1 hour
    loFinalData.StartDate = formData.general?.startDate || this.getDefaultDate();
    loFinalData.EndDate = formData.general?.endDate || this.getDefaultDate();

    loFinalData.NoApptSave = false;
    loFinalData.allowEmail = true;

    // Image settings
    loFinalData.IsSelfRegistrationImageRectangle = settings?.Visitor?.length > 0 ?
      settings.Visitor[0].IsSelfRegistrationImageRectangle : false;

    // Facility Booking (if enabled)
    loFinalData.EnableFb = false; // Set based on your requirements

    // Visitor Information
    if (settings?.Visitor?.[0]?.MultipleVisitorEnabled) {
      loFinalData.VisitorsList = formData.visitors || [];
    } else {
      this.loadVisitorInfo(loFinalData, formData);
    }

    // Lists for different sections
    loFinalData.CheckList = formData.checkList || [];
    loFinalData.AttachmentList = formData.attachments || [];
    loFinalData.AnswerList = formData.questionnaire || [];
    loFinalData.SafetyBriefViewed = formData.safetyBrief?.videoWatched || false;

    return loFinalData;
  }

  // New method to prepare data for VisitorAckSave API
  getVisitorAckData(): VisitorAck {
    const formData = this.formDataStore.value;
    const settings = this.getSettings();
    const generalData = formData.general || {};

    // Format dates to match API expectation: "MM-dd-yyyy HH:mm"
    const formatDateForAPI = (date: any): string => {
      if (!date) return this.getDefaultDateTimeForAPI();

      const d = new Date(date);
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');

      return `${month}-${day}-${year} ${hours}:${minutes}`;
    };

    // Combine an appointment date with a slot time string "HH:mm"
    const formatSlotDateTime = (date: any, timeStr: string | null): string => {
      if (!date || !timeStr) return formatDateForAPI(date);
      const d = new Date(date);
      if (isNaN(d.getTime())) return this.getDefaultDateTimeForAPI();
      const [h, m] = timeStr.split(':').map(Number);
      d.setHours(h, m, 0, 0);
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const year = d.getFullYear();
      return `${month}-${day}-${year} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };
    // Strip data URL prefix — send raw base64 only
    const stripBase64Prefix = (src: string): string => {
      if (!src) return '';
      const idx = src.indexOf(';base64,');
      return idx >= 0 ? src.substring(idx + 8) : src;
    };

    // Basic VisitorAck structure matching the expected format
    let visitorAck: any = {
      Branch: this.currentBranchID?.toString() || '',
      RefBranchDesc: this.currentBranchName || '',
      CategoryId: this.selectedVisitCategory?.toString() || '',
      HostDeptId: generalData.department?.toString() || '',
      HostId: generalData.host?.toString() || settings?.DefaultHostId?.toString() || '',
      WorkPermitRef: generalData.work_permit_ref || null,
      EventName: generalData.event_name || '',
      PurposeId: generalData.purpose?.toString() || '',
      PurposeDesc: generalData.purposeDesc || '',
      FloorId: generalData.floor?.toString() || '',
      RoomId: generalData.meeting_location?.toString() || '',
      NoApptSave: false,
      StartDateTime: generalData.enableVimsApptTimeSlot
        ? formatSlotDateTime(generalData.appointmentDate, generalData.timeSlotStartTime)
        : formatDateForAPI(generalData.startDate),
      EndDateTime: generalData.enableVimsApptTimeSlot
        ? formatSlotDateTime(generalData.appointmentDate, generalData.timeSlotEndTime)
        : formatDateForAPI(generalData.endDate),
      Remarks: generalData.remarks || '',
      IsSelfRegistrationImageRectangle: settings?.Visitor?.[0]?.IsSelfRegistrationImageRectangle || false,
      allowSMS: false,
      allowEmail: true,
      EnableFb: generalData.facilityBooking || false,

      // Main visitor info - get from the first visitor in the list
      FullName: this.getPrimaryVisitorFullName(formData),
      IdentityNo: this.getPrimaryVisitorIdentityNo(formData),

      // Lists as JSON strings
      VisitorsList: this.getVisitorsList(formData),
      CheckList: JSON.stringify(
        (formData.prohibitedItems?.declaredItems || []).map((item: any) => ({
          MaterialDesc: item.description || item.MaterialDesc || '',
          SerialNo: item.serialNumber || item.SerialNo || '',
          MovementType: item.direction || item.MovementType || '',
          ChecklistSeqId: item.ChecklistSeqId || ''
        }))
      ),
      AttachmentList: this.formatAttachmentList(formData.attachments || {}),
      AnswerList: this.formatAnswerList(formData.questionnaire || {}),
      SafetyBriefViewed: formData.safetyBrief?.videoWatched || false,
      SEQ_ID: 0, // Will be generated by backend

      // Pass encrypted query params from URL
      RefCode: this.refCode || '',
      RefCatCode: this.refCatCode || '',
      q: this.appointmentCode || '',

      // NDA Agreement signature (base64 PNG)
      NDASignature: stripBase64Prefix(formData['nda-agreement']?.ndaSignature || ''),
      NDAAccepted: formData['nda-agreement']?.ndaAccepted || false
    };

    return visitorAck;
  }

  private getDefaultDateTimeForAPI(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    return `${month}-${day}-${year} ${hours}:${minutes}`;
  }

  private formatAnswerList(questionnaireData: any): string {
    // Convert questionnaire data to expected format
    const answers: any[] = [];
    const questions = this.getQuestionnaireSettings(); // Get questions to determine validation requirements

    if (questionnaireData && typeof questionnaireData === 'object') {
      Object.keys(questionnaireData).forEach(key => {
        if (key.startsWith('q')) {
          const questionId = key.replace('q', '');
          const value = questionnaireData[key];

          // Find the question to get ValidationRequired
          const question = questions.find((q: any) => q.QuestionariesSeqId.toString() === questionId);

          // Always store value as a string; arrays (multiple checkbox answers) become comma-separated
          const valueStr = Array.isArray(value)
            ? value.join(',')
            : (value !== null && value !== undefined ? String(value) : '');

          answers.push({
            id: questionId,
            value: valueStr,
            ValidationRequired: question?.ValidationRequired || false
          });
        }
      });
    }

    return JSON.stringify(answers);
  }

  private getVisitorsList(formData: any): any[] {
    const settings = this.getSettings();
    const generalData = formData.general || {};

    console.log('getVisitorsList - generalData:', generalData);

    const generateUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    const extractId = (obj: any, codeKey: string, idKey: string) => {
      if (typeof obj === 'object' && obj !== null) return obj[codeKey] || obj[idKey] || '';
      return obj?.toString() || '';
    };

    const stripPhotoPrefix = (src: string): string => {
      if (!src) return '';
      const idx = src.indexOf(';base64,');
      return idx >= 0 ? src.substring(idx + 8) : src;
    };

    const buildVisitorEntry = (data: any, isSelf: boolean) => {
      const companyId = extractId(data.visitor_company, 'visitor_comp_code', 'id');
      const companyDesc = (typeof data.visitor_company === 'object' && data.visitor_company !== null)
        ? (data.visitor_company.visitor_comp_name || '') : '';
      const countryId = extractId(data.country, 'CountrySeqId', 'id');
      const genderId = extractId(data.gender, 'Value', 'id');
      const genderDesc = (typeof data.gender === 'object' && data.gender !== null)
        ? (data.gender.Name || '') : (data.gender || '');
      const rawPhoto = data.profilePreview || (typeof data.profile === 'string' ? data.profile : '') || '';
      return {
        MySelf: isSelf,
        Photo: stripPhotoPrefix(rawPhoto),
        TitleId: data.title || '',
        TitleDesc: data.title || '',
        FullName: data.fullName || '',
        IdentityNo: data.visitor_id || '',
        Visitor_IC: data.visitor_id || '',
        GenderId: genderId,
        GenderDesc: genderDesc,
        Email: data.email || '',
        ID_TYPE: data.visitor_id_type || '',
        ID_EXPIRED_DATE: data.id_expired_date || data.expired_date || '',
        CompanyId: companyId,
        CompanyDesc: companyDesc,
        Contact: data.phone || '',
        VehicleNo: data.vehicle_number || '',
        VehicleBrand: data.vehicle_brand || '',
        VehicleModel: data.vehicle_model || '',
        VehicleColor: data.vehicle_color || '',
        CountryId: countryId,
        CountryDesc: this.getCountryName(countryId) || '',
        Address: data.visitor_address || '',
        VUDF1: data.VUDF1 || '',
        VUDF2: data.VUDF2 || '',
        VUDF3: data.VUDF3 || '',
        VUDF4: data.VUDF4 || '',
        VUDF5: data.VUDF5 || '',
        VUDF6: data.VUDF6 || '',
        VUDF7: data.VUDF7 || '',
        VUDF8: data.VUDF8 || '',
        VUDF9: data.VUDF9 || '',
        VUDF10: data.VUDF10 || '',
        AUDF1: data.AUDF1 || '',
        AUDF2: data.AUDF2 || '',
        AUDF3: data.AUDF3 || '',
        AUDF4: data.AUDF4 || '',
        AUDF5: data.AUDF5 || '',
        AUDF6: data.AUDF6 || '',
        AUDF7: data.AUDF7 || '',
        AUDF8: data.AUDF8 || '',
        AUDF9: data.AUDF9 || '',
        AUDF10: data.AUDF10 || '',
        uid: generateUID()
      };
    };

    // Check MultipleVisitorEnabled from both top-level and nested path
    const isMultipleVisitor = settings?.MultipleVisitorEnabled || settings?.Visitor?.[0]?.MultipleVisitorEnabled;
    if (isMultipleVisitor) {
      const savedVisitors = generalData.savedVisitors || generalData.visitors || [];
      console.log('getVisitorsList - MultipleVisitor mode, savedVisitors count:', savedVisitors.length);
      if (savedVisitors.length > 0) {
        return savedVisitors.map((visitor: any, index: number) =>
          buildVisitorEntry(visitor, visitor.myself ?? (index === 0))
        );
      }
      // No saved visitors — fall through to use current form data
      console.log('getVisitorsList - no saved visitors, using form data');
    }

    // Single visitor or multi-visitor with no explicitly saved visitors
    console.log('getVisitorsList - using form data as single visitor');
    return [buildVisitorEntry(generalData, true)];
  }

  private loadVisitorInfo(finalData: any, formData: any): void {
    const visitorData = formData.general || {};

    finalData.VisitorFullName = visitorData.fullName || '';
    finalData.VisitorEmail = visitorData.email || '';
    finalData.VisitorContact = visitorData.phone || '';
    finalData.VisitorCompany = visitorData.company || '';
    finalData.VisitorIdNumber = visitorData.visitorId || '';
    finalData.VisitorIdType = visitorData.visitorIdType || '';
    finalData.VisitorDepartment = visitorData.department || '';

    // Add other visitor fields as needed
    finalData.VisitorAddress = visitorData.address || '';
    finalData.VisitorCity = visitorData.city || '';
    finalData.VisitorState = visitorData.state || '';
    finalData.VisitorCountry = visitorData.country || '';
    finalData.VisitorPostalCode = visitorData.postalCode || '';
  }

  private getCategoryDescription(categoryId: any): string {
    const masterData = this.getmasterData();
    if (masterData?.Table4?.length) {
      const category = masterData.Table4.find((cat: any) => cat.VCategorySeqId === categoryId);
      return category?.Name || '';
    }
    return '';
  }

  private getDefaultDateTime(hoursToAdd = 0): string {
    const now = new Date();
    now.setHours(now.getHours() + hoursToAdd);
    return now.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace(',', '');
  }

  private getDefaultDate(): string {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  }

  clearFormData(): void {
    this.formDataStore.next({});
  }

  /**
   * Builds a human-readable summary from the current form data + master data.
   * Call this BEFORE clearSessionStorage() so all lookups still work.
   */
  buildRegistrationSummary(): {
    visitorName: string; email: string;
    visitFrom: string; visitTo: string;
    meetingWith: string; meetingLocation: string;
    visitType: string; visitPurpose: string;
    branch: string;
  } {
    const formData  = this.formDataStore.value;
    const general   = formData.general || {};
    const master    = this.getmasterData();

    const fmt = (date: any): string => {
      if (!date) return '';
      const d = new Date(date);
      if (isNaN(d.getTime())) return String(date);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    // Host name
    const hostId = general.host?.toString() || '';
    const hostRow = master?.Table?.find((h: any) =>
      (h.HOSTIC || h.HostIC || h.SeqId)?.toString() === hostId
    );
    const meetingWith = hostRow?.HOSTNAME || hostRow?.Name || general.hostName || '';

    // Meeting room / location
    const roomId = general.meeting_location?.toString() || general.room?.toString() || '';
    const roomRow = master?.Table1?.find((r: any) =>
      (r.MeetingRoomSeqId || r.SeqId)?.toString() === roomId
    );
    const meetingLocation = roomRow?.MeetingRoomDesc || roomRow?.Name || general.roomDesc || '';

    // Category name (visit type)
    const catDesc = this.getCategoryDescription(this.selectedVisitCategory);

    // Purpose name
    const purposeId = general.purpose?.toString() || '';
    const purposeRow = master?.Table3?.find((p: any) =>
      (p.visitpurpose_id || p.SeqId)?.toString() === purposeId
    );
    const visitPurpose = purposeRow?.visitpurpose_desc || purposeRow?.Name || general.purposeDesc || '';

    // Primary visitor name + email
    const visitorName = this.getPrimaryVisitorFullName(formData);
    const email = general.email || '';

    return {
      visitorName,
      email,
      visitFrom: fmt(general.startDate),
      visitTo:   fmt(general.endDate),
      meetingWith,
      meetingLocation,
      visitType: catDesc,
      visitPurpose,
      branch: this.currentBranchName,
    };
  }

  setCurrentStep(step: number): void {
    this.currentStep$.next(step);
  }

  requestValidation(): void {
    this.validationRequested$.next();
  }

  requestStepChange(step: number): void {
    this.stepChangeRequested$.next(step);
  }

  setStepValid(isValid: boolean): void {
    this.stepValidity$.next(isValid);
  }

  getCurrentStepIndex(): number {
    return this.currentStep$.value;
  }

  isLastStep(): boolean {
    return this.currentStep$.value === this.totalSteps - 1;
  }

  resetWizard(): void {
    this.currentStep$.next(0);
    this.stepValidity$.next(false);
  }

  canNavigateToStep(requestedStep: number): boolean {
    const currentStep = this.getCurrentStepIndex();
    // Allow backward navigation without validation
    if (requestedStep < currentStep) return true;

    // For forward navigation, require validation
    this.requestValidation();
    return false;
  }

  /**
   * Check if the SafetyBriefing_Date has expired (older than current date/time)
   */
  private isSafetyBriefingExpired(): boolean {
    const briefingDate = new Date(this.SafetyBriefing_Date);
    const currentDate = new Date();
    return briefingDate < currentDate;
  }

  /**
   * Determine if safety brief step should be skipped
   * - If SafetyBriefVideoViewed is false → show step
   * - If SafetyBriefVideoViewed is true AND SafetyBriefing_Date expired → show step
   * - Otherwise → skip step
   */
  shouldSkipSafetyBrief(stepRoute: string): boolean {
    // Only apply logic to safety-brief step
    if (stepRoute !== 'safety-brief') {
      return false;
    }

    // Show step if video not viewed
    if (!this.SafetyBriefVideoViewed) {
      return false;
    }

    // Show step if viewed but expired
    if (this.SafetyBriefVideoViewed && this.isSafetyBriefingExpired()) {
      return false;
    }

    // Skip step if viewed and not expired
    return true;
  }

  navigateToNextStep(): void {
    const nextStep = this.currentStep$.value + 1;
    if (nextStep < this.totalSteps) {
      this.requestStepChange(nextStep);
    } else {
      // Current step is the last step — trigger submission
      this.requestSubmission();
    }
  }

  skipToNextStep(): void {
    const nextStep = this.currentStep$.value + 1;
    if (nextStep < this.totalSteps) {
      this.skipRequested$.next(nextStep);
    } else {
      this.requestSubmission();
    }
  }

  requestSubmission(): void {
    this.submissionRequested$.next();
  }

  private formatAttachmentList(attachmentData: any): string {
    // Handle the attachment data structure from step-attachments
    if (!attachmentData || typeof attachmentData !== 'object') {
      return JSON.stringify([]);
    }

    // Structure saved by step-attachments: { attachments: { "docId": { fileName, trackerId, ... } } }
    if (attachmentData.attachments && typeof attachmentData.attachments === 'object') {
      const attachmentArray: any[] = [];

      Object.keys(attachmentData.attachments).forEach(docId => {
        const attachment = attachmentData.attachments[docId];
        if (attachment.fileName && attachment.trackerId) {
          const fileExtension = attachment.fileName.includes('.')
            ? attachment.fileName.substring(attachment.fileName.lastIndexOf('.'))
            : '';

          attachmentArray.push({
            VisitorAttachSeqId: parseInt(docId),
            src: '',
            extension: fileExtension,
            filename: attachment.fileName,
            uid: attachment.trackerId,
            trackerId: attachment.trackerId,
            primary: '1'
          });
        }
      });

      return JSON.stringify(attachmentArray);
    }

    // Fallback: if it's already an array, stringify it
    if (Array.isArray(attachmentData)) {
      return JSON.stringify(attachmentData);
    }

    // Default: empty array
    return JSON.stringify([]);
  }

  private getPrimaryVisitorFullName(formData: any): string {
    const settings = this.getSettings();
    const generalData = formData.general || {};
    const isMultipleVisitor = settings?.MultipleVisitorEnabled || settings?.Visitor?.[0]?.MultipleVisitorEnabled;
    if (isMultipleVisitor) {
      const savedVisitors = generalData.savedVisitors || generalData.visitors || [];
      if (savedVisitors.length > 0) return savedVisitors[0].fullName || '';
    }
    return generalData.fullName || '';
  }

  private getPrimaryVisitorIdentityNo(formData: any): string {
    const settings = this.getSettings();
    const generalData = formData.general || {};
    const isMultipleVisitor = settings?.MultipleVisitorEnabled || settings?.Visitor?.[0]?.MultipleVisitorEnabled;
    if (isMultipleVisitor) {
      const savedVisitors = generalData.savedVisitors || generalData.visitors || [];
      if (savedVisitors.length > 0) return savedVisitors[0].visitor_id || '';
    }
    return generalData.visitor_id || '';
  }

  private getCountryName(countryId: any): string {
    if (!countryId) return '';

    const masterData = this.getmasterData();
    if (masterData && masterData.Table13) {
      const country = masterData.Table13.find((c: any) => c.CountrySeqId.toString() === countryId.toString());
      return country ? country.Name : '';
    }

    return '';
  }
}
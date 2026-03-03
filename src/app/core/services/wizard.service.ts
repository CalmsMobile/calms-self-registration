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
  }

  clearSessionStorage() {
    sessionStorage.removeItem('currentBranchID');
    sessionStorage.removeItem('selectedVisitCategory');
    sessionStorage.removeItem('currentBranchName');
    sessionStorage.removeItem('refCode');
    sessionStorage.removeItem('refCatCode');
    sessionStorage.removeItem('appointmentCode');
    this.currentBranchID = '';
    this.selectedVisitCategory = '';
    this.currentBranchName = '';
    this.refCode = '';
    this.refCatCode = '';
    this.appointmentCode = '';
    this.formDataStore.next({});
    this.visitorAckData = null;
    this.masterData = null;
    this.updateHeader();
  }

  getmasterData() {
    return this.masterData;
  }

  setmasterData(data: any) {
    this.masterData = data;
  }

  setVisitorAckData(data: any) {
    this.visitorAckData = data;
  }

  getIncomingVisitorAckData() {
    return this.visitorAckData;
  }

  setBranchHostData(data: any) {
    this.branchHostData = data;
  }

  getBranchHostData() {
    return this.branchHostData;
  }

  setSettings(allSettings: any): void {
    console.log(allSettings);
    let settingsData: any = {};
    if (allSettings.Table?.length) {
      settingsData = { ...allSettings.Table1[0], ...allSettings.Table2?.length ? JSON.parse(allSettings.Table2[0].SettingDetail) : {} };
    }
    if (allSettings.Table5?.length) {
      settingsData.VideoUrl = allSettings.Table5[0]?.VideoUrl;
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
      NDAEnabled: false,
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

      loFinalData.HostDeptId = visitorSettings.HostDepartmentEnabled ? (formData.general?.hostDepartment || '') : '';
      loFinalData.HostDeptDesc = visitorSettings.HostDepartmentEnabled ? (formData.general?.hostDepartmentDesc || '') : '';

      loFinalData.HostId = visitorSettings.HostNameEnabled ? (formData.general?.hostName || '') : '';
      loFinalData.HostDesc = visitorSettings.HostNameEnabled ? (formData.general?.hostNameDesc || '') : '';

      loFinalData.WorkPermitRef = visitorSettings.WorkPermitRefEnabled ? (formData.general?.workPermitRef || null) : null;
    }

    // General Information (from settings)
    if (settings?.General?.length > 0) {
      const generalSettings = settings.General[0];

      loFinalData.PurposeId = generalSettings.PurposeEnabled ? (formData.general?.purpose || '') : '';
      loFinalData.PurposeDesc = generalSettings.PurposeEnabled ? (formData.general?.purposeDesc || '') : '';

      loFinalData.FloorId = generalSettings.FloorEnabled ? (formData.general?.floor || '') : '';
      loFinalData.FloorDesc = generalSettings.FloorEnabled ? (formData.general?.floorDesc || '') : '';

      loFinalData.RoomId = generalSettings.RoomEnabled ? (formData.general?.room || '') : '';
      loFinalData.RoomDesc = generalSettings.RoomEnabled ? (formData.general?.roomDesc || '') : '';

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
    loFinalData.SafetyBriefViewed = formData.safetyBriefViewed || false;

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

    // Basic VisitorAck structure matching the expected format
    let visitorAck: any = {
      Branch: this.currentBranchID?.toString() || '',
      RefBranchDesc: this.currentBranchName || '',
      CategoryId: this.selectedVisitCategory?.toString() || '',
      HostDeptId: generalData.department?.toString() || '',
      HostId: generalData.host?.toString() || '',
      WorkPermitRef: generalData.work_permit_ref || null,
      PurposeId: generalData.Reason?.toString() || '',
      PurposeDesc: '', // Will be populated from master data
      FloorId: generalData.floor?.toString() || '',
      RoomId: generalData.meeting_location?.toString() || '',
      NoApptSave: false,
      StartDateTime: formatDateForAPI(generalData.startDate),
      EndDateTime: formatDateForAPI(generalData.endDate),
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
      CheckList: JSON.stringify(formData.checkList || []),
      AttachmentList: this.formatAttachmentList(formData.attachments || {}),
      AnswerList: this.formatAnswerList(formData.questionnaire || {}),
      SafetyBriefViewed: formData.safetyBriefViewed || false,
      SEQ_ID: 0, // Will be generated by backend

      // Pass encrypted query params from URL
      RefCode: this.refCode || '',
      RefCatCode: this.refCatCode || '',
      q: this.appointmentCode || '',

      // NDA Agreement signature (base64 PNG)
      NDASignature: formData['nda-agreement']?.ndaSignature || '',
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

          answers.push({
            id: questionId,
            value: value || 0,
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

    const buildVisitorEntry = (data: any, isSelf: boolean) => {
      const companyId = extractId(data.visitor_company, 'visitor_comp_code', 'id');
      const countryId = extractId(data.country, 'CountrySeqId', 'id');
      const genderId = extractId(data.gender, 'Value', 'id');
      return {
        MySelf: isSelf,
        Photo: data.profile || '',
        FullName: data.fullName || '',
        IdentityNo: data.visitor_id || '',
        Visitor_IC: data.visitor_id || '',
        GenderId: genderId,
        GenderDesc: genderId,
        Email: data.email || '',
        ID_TYPE: data.visitor_id_type || '',
        ID_EXPIRED_DATE: data.expired_date || '',
        CompanyId: companyId,
        CompanyDesc: '',
        Contact: data.phone || '',
        VehicleNo: data.vehicle_number || '',
        VehicleBrand: data.vehicle_brand || '',
        VehicleModel: data.vehicle_model || '',
        VehicleColor: data.vehicle_color || '',
        CountryId: countryId,
        CountryDesc: this.getCountryName(countryId) || '',
        Address: data.visitor_address || '',
        UDF1: data.udf1 || '',
        UDF2: data.udf2 || '',
        UDF3: data.udf3 || '',
        UDF4: data.udf4 || '',
        UDF5: data.udf5 || '',
        UDF6: data.udf6 || '',
        UDF7: data.udf7 || '',
        UDF8: data.udf8 || '',
        UDF9: data.udf9 || '',
        UDF10: data.udf10 || '',
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

    // Check if it has the expected structure from step-attachments component
    if (attachmentData.nothingToDeclare !== undefined) {
      // This is the structure from step-attachments component
      const attachmentArray: any[] = [];

      // If nothing to declare, return empty array
      if (attachmentData.nothingToDeclare) {
        return JSON.stringify([]);
      }

      // Add declared items if any (for items being brought in/out)
      if (attachmentData.declaredItems && Array.isArray(attachmentData.declaredItems)) {
        attachmentData.declaredItems.forEach((item: any) => {
          attachmentArray.push({
            description: item.description,
            serialNumber: item.serialNumber,
            direction: item.direction,
            type: 'declared_item'
          });
        });
      }

      // Add attachment files if any (uploaded documents)
      if (attachmentData.attachments && typeof attachmentData.attachments === 'object') {
        Object.keys(attachmentData.attachments).forEach(docId => {
          const attachment = attachmentData.attachments[docId];
          if (attachment.fileName && attachment.trackerId) {
            // Format according to the expected structure
            const fileExtension = attachment.fileName.includes('.') ?
              attachment.fileName.substring(attachment.fileName.lastIndexOf('.')) : '';

            attachmentArray.push({
              VisitorAttachSeqId: parseInt(docId),
              src: "",
              extension: fileExtension,
              filename: attachment.fileName,
              uid: attachment.trackerId,
              trackerId: attachment.trackerId,
              primary: "1" // Assuming all attachments are primary for now
            });
          }
        });
      }

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
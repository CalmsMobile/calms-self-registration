import { Injectable } from '@angular/core';
import { map } from 'rxjs/operators';
import { ApiBaseService } from './api-base.service';
import { environment } from '../../../environments/environment';
import { VisitorAck, VisitorAckResponse } from '../models/visitor-ack.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = environment.apiURL;
  private deviceParams = { "Authorize": { "AuDeviceUID": "WEB", "AuHostSeqId": "291" } };
  constructor(private apiBase: ApiBaseService) { }

  GetSelfRegistrationWelcomePageData() {
    return this.apiBase.post(`${this.baseUrl}/GetSelfRegistrationWelcomePageData`, '');
  }

  GetVisitorDeclarationSettings(psBranch: string, psVisitorCtg: string, refCode?: string, refCatCode?: string) {
    const loParam = refCode
      ? { ...this.deviceParams, "RefCode": refCode, ...(refCatCode ? { "RefCatCode": refCatCode } : { "RefVisitorCateg": psVisitorCtg }) }
      : { ...this.deviceParams, "Branch": psBranch, "RefVisitorCateg": psVisitorCtg };
    return this.apiBase.post(`${this.baseUrl}/GetVisitorDeclarationSettings`, loParam);
  }

  GetVisitorSelfRegistrationPageSetup(psBranch: string, refCode?: string) {
    const loParam = refCode
      ? { "RefCode": refCode }
      : { "RefBranchSeqId": psBranch };
    return this.apiBase.post(`${this.baseUrl}/GetVisitorSelfRegistrationPageSetup`, loParam);
  }

  GetSelfRegistrationPageSettingData(psBranch: string, psLanguage?: number, refCode?: string) {
    const loParam = refCode
      ? { "RefCode": refCode, "RefLanguageId": psLanguage }
      : { "RefBranchSeqId": psBranch, "RefLanguageId": psLanguage };
    return this.apiBase.post(`${this.baseUrl}/GetSelfRegistrationPageSettingData`, loParam);
  }

  GetEnabledAppointmentUDFCtrlData(psBranch: string) {
    const loParam = { "RefBranchSeqId": psBranch };
    return this.apiBase.post(`${this.baseUrl}/GetEnabledAppointmentUDFCtrlData`, loParam);
  }

  GetUDFDetails(psBranch: string) {
    const loParam = { "RefBranchSeqId": psBranch };
    return this.apiBase.post(`${this.baseUrl}/GetUDFDetails`, loParam).pipe(
      map((data: any) => {
        const table: any[] = [];
        const table1: any[] = [];
        let globalIndex = 0;

        const processUDFs = (udfs: any[], udfPrefix: string) => {
          const sorted = (udfs || []).slice().sort((a: any, b: any) => {
            const n = (s: string) => parseInt(s.replace(/\D/g, ''), 10) || 0;
            return n(a.UDFName) - n(b.UDFName);
          });
          sorted.forEach((udf: any) => {
            table.push({
              UDFName: udf.UDFName,
              UDFCtrlType: udf.UDFCtrlType,
              MinLength: udf.MinLength,
              MaxLength: udf.MaxLength,
              IsAnyDateRange: udf.IsAnyDateRange || 0,
              Caption: udf.Caption || udf.UDFName,
              Placeholder: udf.Placeholder || '',
              apptUDFSetSeqId: globalIndex,
              udfPrefix: udfPrefix,
              formControlName: udfPrefix.toUpperCase() + udf.UDFName  // e.g. 'AUDF1' or 'VUDF1'
            });

            if (udf.dropdown) {
              udf.dropdown.split(',').forEach((opt: string, optIndex: number) => {
                table1.push({
                  RefApptUDFSetSeqId: globalIndex,
                  ApptUDFDetSetSeqId: optIndex + 1,
                  Name: opt.trim()
                });
              });
            }
            globalIndex++;
          });
        };

        processUDFs(data.AppointmentUDFSettings, 'a');
        processUDFs(data.VisitorUDFSettings, 'v');

        return { Table: table, Table1: table1 };
      })
    );
  }

  GetActiveLanguages() {
    return this.apiBase.post(`${environment.portalApiURL}/GetLanguages`, '');
  }

  SaveVisitorRegistration(registrationData: any) {
    const loParam = { ...this.deviceParams, ...registrationData };
    return this.apiBase.post(`${this.baseUrl}/SaveVisitorRegistration`, loParam);
  }

  // New method for VisitorAckSave API
  VisitorAckSave(visitorAckData: VisitorAck) {
    const loParam = { ...this.deviceParams, ...visitorAckData };
    return this.apiBase.post<VisitorAckResponse>(`${this.baseUrl}/VisitorAckSave`, loParam);
  }

  GetLocalSettingsDataByBranch(psBranch: string) {
    const loParam = { ...this.deviceParams, "RefBranchSeqId": psBranch };
    return this.apiBase.post(`${this.baseUrl}/GetLocalSettingsDataByBranch`, loParam);
  }

  /**
   * Get visitor acknowledgment data using the encrypted appointment code
   * @param encryptedAppointmentCode The encrypted appointment code from query parameter
   */
  getAppointmentData(encryptedAppointmentCode: string) {
    // Format current date as "MM/dd/yyyy HH:mm:ss"
    const now = new Date();
    const formattedCurrentDate = this.formatCurrentDate(now);

    const loParam = {
      SEQ_ID: encryptedAppointmentCode,
      CurrentDate: formattedCurrentDate
    };
    return this.apiBase.post(`${this.baseUrl}/GetVisitorAck`, loParam);
  }

  SearchExistHost(searchParams: any) {
    const loParam = { ...this.deviceParams, ...searchParams };
    return this.apiBase.post(`${this.baseUrl}/SearchExistHost`, loParam);
  }

  SearchVisitor(searchText: string, branchSeqId: string) {
    const loParam = {
      SearchText: searchText,
      CheckBlackList: true,
      RefBranchSeqId: branchSeqId
    };
    return this.apiBase.post(`${this.baseUrl}/SearchVisitor`, loParam);
  }

  SearchVisitorWhitelist(searchText: string, branchSeqId: string) {
    const loParam = {
      SearchText: searchText,
      CheckWhiteList: true,
      RefBranchSeqId: branchSeqId
    };
    return this.apiBase.post(`${this.baseUrl}/SearchVisitor`, loParam);
  }

  GetBranchHostData(psBranch: string, preloadHostData: boolean = true, refCode?: string) {
    const loParam = refCode
      ? {
          ...this.deviceParams,
          "RefCode": refCode,
          "PreloadHostData": preloadHostData ? 1 : 0
        }
      : {
          ...this.deviceParams,
          "SEQ_ID": psBranch,
          "PreloadHostData": preloadHostData ? 1 : 0
        };
    return this.apiBase.post(`${this.baseUrl}/GetBranchHostDataForSelf`, loParam);
  }

  GetApptTimeSlot(CurrentDate: string, psBranch: string, CategoryId: string) {
    const loParam = { ...this.deviceParams, "Branch": psBranch, "CurrentDate": CurrentDate, "CategoryId": CategoryId };
    return this.apiBase.post(`${this.baseUrl}/GetApptTimeSlot`, loParam);
  }

  VimsAppFacilityPurposeList() {
    const loParam = { ...this.deviceParams, "RefSchoolSeqId": "", "RefBranchSeqId": "" };
    return this.apiBase.post(`${this.baseUrl}/VimsAppFacilityPurposeList`, loParam);
  }

  VimsAppFacilityMasterList() {
    const loParam = { ...this.deviceParams, "RefSchoolSeqId": "", "RefBranchSeqId": "" };
    return this.apiBase.post(`${this.baseUrl}/VimsAppFacilityMasterList`, loParam);
  }

  VimsAppGetBookingSlot(facilityCode: string, slotTime: string) {
    // Convert date to required formats
    const selectedDate = new Date(slotTime);
    const yyyy_MM_dd = this.formatDate(selectedDate, 'yyyy-MM-dd');
    const dd_MM_yyyy = this.formatDate(selectedDate, 'dd/MM/yyyy');

    const loParams = {
      "RefSchoolSeqId": "",
      "RefBranchSeqId": "",
      "FacilityCode": facilityCode,
      "Recurring": "10",
      "FromDate": yyyy_MM_dd,
      "ToDate": yyyy_MM_dd,
      "BookFromDate": dd_MM_yyyy,
      "BookToDate": dd_MM_yyyy
    };
    const loParam = { ...this.deviceParams, ...loParams };
    return this.apiBase.post(`${this.baseUrl}/VimsAppGetBookingSlot`, loParam);
  }

  private formatDate(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    if (format === 'yyyy-MM-dd') {
      return `${year}-${month}-${day}`;
    } else if (format === 'dd/MM/yyyy') {
      return `${day}/${month}/${year}`;
    }
    return date.toISOString().split('T')[0]; // fallback
  }

  /**
   * Format current date as "MM/dd/yyyy HH:mm:ss"
   * @param date The date to format
   * @returns Formatted date string
   */
  private formatCurrentDate(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Get QR code data for visitor
   * @param loParam Parameters including SEQ_ID, SeqIdEncrypted, and CurrentDate
   */
  GetVisitorDataForQRCode(loParam: any) {
    const finalParam = { ...this.deviceParams, ...loParam };
    return this.apiBase.post(`${this.baseUrl}/GetVisitorDataForQRCode`, finalParam);
  }

  /**
   * Get QR code data for dynamic/refreshing QR codes
   * @param loParam Parameters including SEQ_ID and SeqIdEncrypted
   */
  GetVisitorDataForQRCodeDynamic(loParam: any) {
    const finalParam = { ...this.deviceParams, ...loParam };
    return this.apiBase.post(`${this.baseUrl}/GetVisitorDataForQRCodeDynamic`, finalParam);
  }

  /**
   * Get host data from a shared/short URL host code
   * @param refHostCode The host code from the hc query parameter
   * @param refCatCode Optional encrypted category code from the vc query parameter
   */
  GetSelfRegShareURLData(refHostCode: string, refCatCode?: string) {
    const loParam: any = { RefHostCode: refHostCode };
    if (refCatCode) {
      loParam.RefCatCode = refCatCode;
    }
    return this.apiBase.post(`${this.baseUrl}/GetSelfRegShareURLData`, loParam);
  }

  GetCustomClientConfigData(hostSeqId: string | number = 123) {
    const loParam = { "Authorize": { "AuDeviceUID": "WEB", "AuHostSeqId": hostSeqId } };
    return this.apiBase.post(`${this.baseUrl}/GetCustomClientConfigData`, loParam);
  }

  GetAppointmentDetailBySeqId(seqIdEnc: string) {
    const loParam = { "SEQ_ID_ENC": seqIdEnc };
    return this.apiBase.post(`${this.baseUrl}/GetAppointmentDetailBySeqId`, loParam);
  }

  AppointmentApprovalByVisitor(seqId: string, status: string, hostIc: string, cancelRemarks: string, actualStatus: string, hostSeqId: string | number, createdBy?: number | null, refApptApprovalLevelSeqId?: number | null) {
    const loParam: any = {
      "SEQ_ID": seqId,
      "Status": status,
      "HOSTIC": hostIc,
      "CancelRemarks": cancelRemarks,
      "ActualStatus": actualStatus,
      "Authorize": { "AuDeviceUID": "WEB", "AuHostSeqId": hostSeqId }
    };
    if (createdBy != null) loParam["CreatedBy"] = createdBy;
    if (refApptApprovalLevelSeqId != null) loParam["RefApptApprovalLevelSeqId"] = refApptApprovalLevelSeqId;
    return this.apiBase.post(`${this.baseUrl}/AppointmentApprovalByVisitor`, loParam);
  }

  RequestResubmitAppointmentData(seqId: string, hostSeqId: string | number) {
    const loParam = {
      "CancelRemarks": "Request for Resubmitting your Appointment details",
      "SEQ_ID": seqId,
      "Authorize": { "AuDeviceUID": "WEB", "AuHostSeqId": hostSeqId }
    };
    return this.apiBase.post(`${this.baseUrl}/RequestResubmitAppointmentData`, loParam);
  }

  GetVisitorDocsBySeqId(seqId: string) {
    return this.apiBase.post(`${this.baseUrl}/GetVisitorDocsBySeqId`, { "SEQ_ID": seqId });
  }

  GetVisitorQuestionariesByAppointmentId(seqId: string) {
    return this.apiBase.post(`${this.baseUrl}/GetVisitorQuestionariesByAppointmentId`, { "SEQ_ID": seqId });
  }

  GetVisitorItemChecklistBySeqId(seqId: string) {
    return this.apiBase.post(`${this.baseUrl}/GetVisitorItemChecklistBySeqId`, { "SEQ_ID": seqId });
  }

  GetVisitorNDABySeqId(seqId: string) {
    return this.apiBase.post(`${this.baseUrl}/GetVisitorNDABySeqId`, { "SEQ_ID": seqId });
  }

}

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

  getMasterDetails() {
    const loParam = { ...this.deviceParams, "RefBranchSeqId": "" };
    return this.apiBase.post(`${this.baseUrl}/GetMasterDetails`, loParam);
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
        const visitorSettings: any[] = data.WalkinUDFSettings || [];

        const table: any[] = [];
        const table1: any[] = [];

        visitorSettings.forEach((udf: any, index: number) => {
          table.push({
            UDFName: udf.UDFName,
            UDFCtrlType: udf.UDFCtrlType,
            Enabled: true,
            MinLength: udf.MinLength,
            MaxLength: udf.MaxLength,
            Required: udf.Required || false,
            IsAnyDateRange: udf.IsAnyDateRange || 0,
            Caption: udf.UDFName,
            Placeholder: '',
            apptUDFSetSeqId: index
          });

          if (udf.dropdown) {
            udf.dropdown.split(',').forEach((opt: string, optIndex: number) => {
              table1.push({
                RefApptUDFSetSeqId: index,
                ApptUDFDetSetSeqId: optIndex + 1,
                Name: opt.trim()
              });
            });
          }
        });

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

}

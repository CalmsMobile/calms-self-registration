// TypeScript interfaces for VisitorAck API models

export interface Authentication {
  UserId: string;
  AuDeviceUID: string;
  AuHostSeqId: string;
  AuMAppDevSeqId: string;
  RefBranchSeqId: string;
}

export interface FacilityInfo {
  Authorize: Authentication;
  ParentPortalRegKey: string;
  FacilityCode: string;
  Recurring: string;
  FromDate: string;
  ToDate: string;
  BookFromDate: string;
  BookToDate: string;
  HostSeqId: string;
  BookingID: string;
  PurposeCode: string;
  Remarks: string;
  StartDate: string;
  EndDate: string;
  DateSelect: string;
  Frequently: string;
  StaffSeqId: string;
  IsVimsAppointment: string;
  OffSet: string;
  Rows: string;
  UpdatedBy: string;
  StartTime: string;
  EndTime: string;
  LoginRegKey: string;
  CreatedBy: string;
  StaffList: string;
  IsFacilityBooking: string;
  FBRemarks: string;
  PinNumber: string;
  RefUserSeqId: string;
  FromWeb: string;
  RefSchoolSeqId: string;
  RefBranchSeqId: string;
}

export interface VisitorSelfData {
  FullName: string;
  GenderId: string;
  VehicleBrand: string;
  VehicleModel: string;
  VehicleColor: string;
  IdentityNo: string;
  Photo: string;
  CompanyId: string;
  Contact: string;
  CountryId: string;
  Email: string;
  VehicleNo: string;
  Address: string;
  UDF1: string;
  UDF2: string;
  UDF3: string;
  UDF4: string;
  UDF5: string;
  UDF6: string;
  UDF7: string;
  UDF8: string;
  UDF9: string;
  UDF10: string;
  MySelf: boolean;
}

export interface VisitorAck {
  Authorize: Authentication | null;
  SEQ_ID: string;
  Address: string;
  CategoryId: string;
  CompanyId: string;
  Contact: string;
  CountryId: string;
  Email: string;
  EndDateTime: string;
  FloorId: string;
  FullName: string;
  GenderId: string;
  HostDeptId: string;
  HostId: string;
  IdentityNo: string;
  Photo: string;
  PurposeId: string;
  Remarks: string;
  RoomId: string;
  WardRoomId: string;
  StartDateTime: string;
  VehicleNo: string;
  AnswerList: string;
  AttachmentList: string;
  CheckList: string;
  VehicleBrand: string;
  VehicleModel: string;
  VehicleColor: string;
  CurrentDate: string;
  SeqIdEncrypted: boolean;
  Branch: string;
  PatientName: string;
  RefAppTimeSlotSeqId: string;
  allowSMS: string;
  allowEmail: string;
  FacilityBooking: FacilityInfo | null;
  EnableFb: boolean;
  NoApptSave: boolean;
  StartDate: string;
  EndDate: string;
  FBRemarks: string;
  WorkPermitRef: string;
  UDF1: string;
  UDF2: string;
  UDF3: string;
  UDF4: string;
  UDF5: string;
  UDF6: string;
  UDF7: string;
  UDF8: string;
  UDF9: string;
  UDF10: string;
  SafetyBriefViewed: boolean;
  VisitorsList: VisitorSelfData[];
  ID_TYPE: string;
  ID_EXPIRED_DATE: string;
  PurposeDesc: string;
  RefBranchDesc: string;
  IsSelfRegistrationImageRectangle: boolean;
  Visitor_IC: string;
}

export interface VisitorAckResponse {
  SEQ_ID: string;
  HexCode: string;
  AutoApprove: boolean;
  IsDynamicQR: boolean;
  appointment_group_id: string;
  Approval_Status: string;
  // Keep existing properties that might be used
  IsAutoApproved?: boolean;
  VisitorId?: string;
  ID?: string;
  QRCodeData?: string;
  RegistrationNumber?: string;
  RefNo?: string;
  Message?: string;
  Success?: boolean;
}

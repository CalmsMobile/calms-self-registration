export interface RegistrationSettings {
  AddVisitorsSeqId: number;
  // Standard Fields
  NameEnabled: boolean;
  NameRequired: boolean;
  NameMinLength: number;
  IdProofEnabled: boolean;
  IdProofRequired: boolean;
  // ... all other standard fields from your JSON
  
  // UDF Fields
  UDF1Enabled: boolean;
  UDF1Required: boolean;
  // ... up to UDF10
  
  // Other Configurations
  VisitorCategories: string[];
  MaterialDeclareDesc: string;
  MaterialDeclarationCheckboxText: string;
  ProhibitedItemsCheckboxText: string;
  SafetyBriefVideoEnabled: boolean;
  QuestionnaireEnabled: boolean;
}

export interface FieldLabels {
  [key: string]: string;
  'Visitor Registration': string;
  'General Information': string;
  // ... all other label mappings
}
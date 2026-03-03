/**
 * Central configuration for all wizard steps.
 * Controls order, visibility, routing, labels, and translation keys.
 * 
 * To reorder steps: change the `order` value.
 * To disable a step permanently: set `alwaysEnabled` to false and ensure
 *   the corresponding `settingsKey` is not enabled in the backend settings.
 * To add a new step: add a new entry here, create the component, and it will
 *   automatically appear in the wizard, routes, and navigation.
 */

export interface StepConfig {
  /** Unique identifier for the step */
  id: string;
  /** Display order (lower = first). Steps are sorted by this value. */
  order: number;
  /** Route path segment under /register/ */
  routerLink: string;
  /** Default label shown in the wizard stepper */
  defaultLabel: string;
  /** LabelService key used for translation */
  translationKey: string;
  /** 
   * Backend settings property that controls whether this step is enabled.
   * If null, the step is always enabled (e.g. general-info).
   */
  settingsKey: string | null;
  /** If true, the step is always shown regardless of settings */
  alwaysEnabled: boolean;
}

/**
 * Master step configuration array.
 * This is the SINGLE SOURCE OF TRUTH for all wizard steps.
 */
export const STEP_CONFIG: StepConfig[] = [
  {
    id: 'general-info',
    order: 1,
    routerLink: 'general-info',
    defaultLabel: 'General Info',
    translationKey: 'general_information',
    settingsKey: null,
    alwaysEnabled: true
  },
  {
    id: 'attachments',
    order: 2,
    routerLink: 'attachments',
    defaultLabel: 'Attachments',
    translationKey: 'additional_documents',
    settingsKey: 'AttachmentUploadEnabled',
    alwaysEnabled: false
  },
  {
    id: 'prohibited-items',
    order: 3,
    routerLink: 'prohibited-items',
    defaultLabel: 'Prohibited Items',
    translationKey: 'prohibited_items',
    settingsKey: 'MaterialDeclareEnabled',
    alwaysEnabled: false
  },
  {
    id: 'safety-brief',
    order: 4,
    routerLink: 'safety-brief',
    defaultLabel: 'Safety Brief',
    translationKey: 'safety_briefing',
    settingsKey: 'SafetyBriefVideoEnabled',
    alwaysEnabled: false
  },
  {
    id: 'questionnaire',
    order: 5,
    routerLink: 'questionnaire',
    defaultLabel: 'Questionnaire',
    translationKey: 'questionnaire',
    settingsKey: 'QuestionnaireEnabled',
    alwaysEnabled: false
  },
  {
    id: 'nda-agreement',
    order: 6,
    routerLink: 'nda-agreement',
    defaultLabel: 'NDA Agreement',
    translationKey: 'nda_agreement',
    settingsKey: 'NDAEnabled',
    alwaysEnabled: false
  }
];

/** Returns steps sorted by order */
export function getSortedSteps(): StepConfig[] {
  return [...STEP_CONFIG].sort((a, b) => a.order - b.order);
}

/** Returns steps that are enabled based on backend settings */
export function getEnabledSteps(settings: any): StepConfig[] {
  return getSortedSteps().filter(step => {
    if (step.alwaysEnabled) return true;
    if (!step.settingsKey) return true;
    return !!settings?.[step.settingsKey];
  });
}

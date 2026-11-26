import type { BowingService, FieldError, FileError, LessonPlan } from "@shared/schema";

export type FieldCopy = {
  label: string;
  help?: string;
  placeholder?: string;
  options?: Record<string, string>;
};

export type ServiceFormCopy = {
  title: string;
  lead: string;
  steps: Record<string, string>;
  fields: Record<string, FieldCopy>;
};

export type FormsDictionary = {
  common: {
    required: string;
    optional: string;
    next: string;
    back: string;
    toConfirm: string;
    stepOf: (current: number, total: number) => string;
    confirmTitle: string;
    confirmLead: string;
    edit: string;
    submit: string;
    submitting: string;
    uploading: string;
    doneTitle: string;
    receiptLabel: string;
    doneLead: string;
    notContract: string;
    applicantEmailDisabled: string;
    applicantEmailSent: string;
    uploadFailed: (names: string) => string;
    retryUpload: string;
    errorSummary: string;
    errors: Record<FieldError, string>;
    fileErrors: Record<FileError, string>;
    notConnectedTitle: string;
    notConnectedBody: string;
    networkError: string;
    rateLimited: string;
    captcha: string;
    serverError: string;
    privacyLink: string;
    agree: string;
    noValue: string;
    yes: string;
    filesLabel: string;
    filesHelp: (maxFiles: number, maxMb: number) => string;
    filesChoose: string;
    filesRemove: string;
    filesPageHint: (pages: number) => string;
    filesUseHint: string;
    backToService: string;
    honeypotLabel: string;
  };
  lesson: ServiceFormCopy & {
    priceTitle: string;
    priceNote: string;
    plans: Record<LessonPlan, { name: string; detail: string }>;
    datetimeHelp: string;
  };
  bowing: ServiceFormCopy & {
    priceTitle: string;
    unit: Record<BowingService, string>;
    breakdown: (pages: number, unit: string, total: string) => string;
    consult: string;
    tax: { undecided: string; included: string; excluded: string };
    estimateNote: string;
    filesNotice: readonly string[];
    pagesPrompt: string;
  };
};

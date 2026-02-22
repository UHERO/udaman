export type UploadRecord = {
  id: number;
  uploadAt: string | null;
  active: boolean;
  status: string | null;
  filename: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
};

export type ParseValidationError = {
  sheet: string;
  row: number;
  field: string;
  message: string;
};

export type SummaryStat = {
  label: string;
  value: string;
};

export type ParseWorkerOutput =
  | { success: true; summary: SummaryStat[]; footnote?: string }
  | {
      success: false;
      errors: ParseValidationError[];
      summary: SummaryStat[];
    }
  | { success: false; error: string };

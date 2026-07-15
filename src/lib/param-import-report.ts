import type { AppMode } from "@/types/custom-tray";

export type ImportAdjustmentCategory =
  | "default"
  | "migration"
  | "value-adjustment"
  | "behavior";

export interface ImportAdjustment {
  category: ImportAdjustmentCategory;
  path: string;
  label: string;
  previousValue?: unknown;
  normalizedValue?: unknown;
  reason: string;
  technical?: boolean;
  count?: number;
}

export interface RetiredImportField {
  path: string;
  label: string;
  previousValue: unknown;
  reason: string;
}

export interface ImportModeResolutionReport {
  kind: "declared" | "inferred" | "selected";
  targetMode: AppMode;
  message: string;
}

export interface ImportNormalizationReport {
  modeResolution: ImportModeResolutionReport;
  adjustments: ImportAdjustment[];
  retiredFields: RetiredImportField[];
}

export interface ImportNormalizationRecorder {
  record: (adjustment: ImportAdjustment) => void;
  retire: (field: RetiredImportField) => void;
}

export function createImportNormalizationRecorder(): {
  recorder: ImportNormalizationRecorder;
  adjustments: ImportAdjustment[];
  retiredFields: RetiredImportField[];
} {
  const adjustments: ImportAdjustment[] = [];
  const retiredFields: RetiredImportField[] = [];

  return {
    adjustments,
    retiredFields,
    recorder: {
      record(adjustment) {
        adjustments.push(adjustment);
      },
      retire(field) {
        retiredFields.push(field);
      },
    },
  };
}

export function recordDefault(
  recorder: ImportNormalizationRecorder | undefined,
  input: Omit<ImportAdjustment, "category" | "previousValue">,
) {
  recorder?.record({
    category: "default",
    previousValue: undefined,
    ...input,
  });
}

export function recordMigration(
  recorder: ImportNormalizationRecorder | undefined,
  input: Omit<ImportAdjustment, "category">,
) {
  recorder?.record({ category: "migration", ...input });
}

export function recordValueAdjustment(
  recorder: ImportNormalizationRecorder | undefined,
  input: Omit<ImportAdjustment, "category">,
) {
  recorder?.record({ category: "value-adjustment", ...input });
}

export function recordBehaviorChange(
  recorder: ImportNormalizationRecorder | undefined,
  input: Omit<ImportAdjustment, "category">,
) {
  recorder?.record({ category: "behavior", ...input });
}

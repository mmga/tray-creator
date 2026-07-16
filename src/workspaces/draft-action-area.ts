export type Availability =
  | { state: "available" }
  | { state: "busy"; label: string }
  | { state: "blocked"; reason: string };

export type DraftActionResult =
  | { status: "success" }
  | { status: "error"; message: string };

interface DraftActionAreaStateBase {
  currentDraftId: string | null;
  hasUnsavedChanges: boolean;
  stale: boolean;
  generate: Availability;
  exportWhole: Availability;
}

export type StandardDraftActionIntent =
  | { type: "generate" }
  | { type: "export-whole" }
  | { type: "save-draft" }
  | { type: "open-drafts" }
  | { type: "export-params" }
  | { type: "import-params"; file: File }
  | { type: "reset" };

export interface ManualDraftActionAreaAdapter {
  kind: "manual";
  state: DraftActionAreaStateBase & { preview: { kind: "manual" } };
  perform(intent: StandardDraftActionIntent): Promise<DraftActionResult>;
}

export interface AutomaticDraftActionAreaAdapter {
  kind: "automatic";
  state: DraftActionAreaStateBase & {
    preview: { kind: "automatic"; enabled: boolean };
  };
  perform(
    intent:
      | StandardDraftActionIntent
      | { type: "set-auto-preview"; enabled: boolean },
  ): Promise<DraftActionResult>;
}

export interface SteppedCadDraftActionAreaAdapter {
  kind: "stepped-cad";
  state: DraftActionAreaStateBase & {
    preview: { kind: "manual" };
    exportSplit: Availability;
  };
  perform(
    intent: StandardDraftActionIntent | { type: "export-split" },
  ): Promise<DraftActionResult>;
}

export type DraftActionAreaAdapter =
  | ManualDraftActionAreaAdapter
  | AutomaticDraftActionAreaAdapter
  | SteppedCadDraftActionAreaAdapter;

export const available: Availability = { state: "available" };

export function generatingAvailability(isGenerating: boolean): Availability {
  return isGenerating
    ? { state: "busy", label: "锻造中" }
    : available;
}

export function modelGenerationAvailability(
  isGenerating: boolean,
  blockingReason: string | null,
): Availability {
  return blockingReason
    ? { state: "blocked", reason: blockingReason }
    : generatingAvailability(isGenerating);
}

export function modelExportAvailability(
  blockingReason: string | null,
): Availability {
  return blockingReason
    ? { state: "blocked", reason: blockingReason }
    : available;
}

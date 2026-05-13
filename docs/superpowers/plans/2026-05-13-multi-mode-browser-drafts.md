# Multi-Mode Browser Drafts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add browser-stored draft management for `grid`, `custom`, `simple-stepped`, and `stepped`, with per-mode draft lists, load/save/rename/delete/export flows, dirty-state tracking, and compatibility for existing stepped drafts.

**Architecture:** Generalize the current stepped-only `localStorage` draft stack into a mode-aware storage layer plus a generic draft hook and dialog. Keep the current two-layer storage model: a shared draft index for list rendering and per-draft full records keyed by mode. Bind each mode's editor state to its own draft controller so draft identity, dirty state, import/reset unbinding, and save/update behavior remain local to that mode.

**Tech Stack:** Next.js client components, React hooks, TypeScript discriminated unions, Vitest, Testing Library, browser `localStorage`

---

## File Structure

**Create**
- `src/lib/draft-summary.ts`
  Builds mode-specific draft summaries from `TrayParams | CustomLayoutParams | SimpleSteppedLayoutParams | SteppedLayoutParams`.
- `src/hooks/useModeDrafts.ts`
  Generic mode-aware draft hook replacing the stepped-only binding logic.
- `src/components/DraftManagerDialog.tsx`
  Shared draft dialog with mode-specific summary rendering and dirty-state UI.
- `src/components/DraftManagerDialog.test.tsx`
  Dialog behavior and summary rendering regression coverage.

**Modify**
- `src/lib/local-drafts.ts`
  Generalize storage types and CRUD helpers from stepped-only to all modes while preserving old stepped keys.
- `src/lib/local-drafts.test.ts`
  Add per-mode storage, limit enforcement, and stepped compatibility coverage.
- `src/hooks/useSteppedDrafts.integration.test.ts`
  Replace with generic hook coverage or port its cases to the new hook test file.
- `src/app/page.tsx`
  Instantiate one draft controller per mode and drive a shared dialog from the active mode.
- `src/components/PanelActionSection.tsx`
  Add shared draft action controls and binding/dirty-state display.
- `src/components/ParameterPanel.tsx`
- `src/components/CustomPanel.tsx`
- `src/components/SimpleSteppedPanel.tsx`
- `src/components/SteppedPanel.tsx`
  Remove stepped-only draft special casing and wire consistent reset/import/draft actions.
- `src/components/panels.test.tsx`
  Cover shared draft action area wiring across all modes.
- `src/app/page.test.tsx`
  Replace stepped-only draft dialog/hook wiring assertions with mode-agnostic coverage.

**Possibly Delete or Inline-Replace**
- `src/hooks/useSteppedDrafts.ts`
- `src/components/SteppedDraftDialog.tsx`
- `src/components/SteppedDraftDialog.test.tsx`

These can either be deleted after migration or left as thin wrappers during the transition. Prefer deleting after call sites are fully moved, to avoid parallel abstractions.

---

### Task 1: Generalize the Draft Storage Layer

**Files:**
- Create: `src/lib/draft-summary.ts`
- Modify: `src/lib/local-drafts.ts`
- Test: `src/lib/local-drafts.test.ts`

- [ ] **Step 1: Write the failing storage tests**

Add targeted tests to `src/lib/local-drafts.test.ts` for:

```ts
it("stores and lists drafts independently per mode", () => {
  const grid = createDraft("grid-1", "grid", createGridParams());
  const custom = createDraft("custom-1", "custom", createCustomParams());

  expect(listDrafts("grid").map((item) => item.id)).toEqual([grid.item.id]);
  expect(listDrafts("custom").map((item) => item.id)).toEqual([custom.item.id]);
});

it("keeps reading legacy stepped records through the generic API", () => {
  const record = createDraft("旧阶梯草稿", "stepped", createSteppedParams());
  expect(getDraft("stepped", record.item.id)?.paramFile.mode).toBe("stepped");
});

it("enforces draft limits per mode instead of globally", () => {
  for (let i = 0; i < MAX_DRAFTS_PER_MODE; i += 1) {
    createDraft(`草稿 ${i}`, "grid", createGridParams());
  }
  expect(() => createDraft("超限", "grid", createGridParams())).toThrow();
  expect(() => createDraft("custom still ok", "custom", createCustomParams())).not.toThrow();
});
```

- [ ] **Step 2: Run the targeted storage test**

Run:

```bash
pnpm exec vitest run src/lib/local-drafts.test.ts
```

Expected: FAIL with stepped-only type or signature errors around `DraftMode`, record keys, or summary generation.

- [ ] **Step 3: Implement generic storage and summary builders**

In `src/lib/draft-summary.ts`, add discriminated summary builders:

```ts
export type DraftSummary =
  | {
      mode: "grid";
      rows: number;
      columns: number;
      structureMode: "full" | "half-circle" | "base-plate-only";
      baseSizeLabel: string;
      trayWidth: number;
      trayDepth: number;
    }
  | {
      mode: "custom";
      slotCount: number;
      trayWidth: number;
      trayDepth: number;
    }
  | {
      mode: "simple-stepped";
      rowCount: number;
      slotCount: number;
      trayWidth: number;
      trayDepth: number;
    }
  | {
      mode: "stepped";
      groupCount: number;
      slotCount: number;
      trayWidth: number;
      trayDepth: number;
    };

export function buildDraftSummary(
  mode: AppMode,
  params: ExportableParams,
): DraftSummary {
  // switch by mode and derive the agreed summary fields
}
```

In `src/lib/local-drafts.ts`, generalize the API:

```ts
export type DraftMode = AppMode;

export interface DraftListItem {
  id: string;
  mode: DraftMode;
  title: string;
  createdAt: string;
  updatedAt: string;
  summary: DraftSummary;
}

export interface DraftRecord {
  storageVersion: 1;
  item: DraftListItem;
  paramFile: {
    version: 1;
    mode: DraftMode;
    params: ExportableParams;
  };
}

const draftRecordKey = (mode: DraftMode, id: string) =>
  `tray-creator:drafts:${mode}:${id}:v1`;
```

Keep the shared index key unchanged:

```ts
const DRAFT_INDEX_KEY = "tray-creator:drafts:index:v1";
```

Preserve stepped compatibility by ensuring the generic stepped record key stays exactly:

```ts
tray-creator:drafts:stepped:${id}:v1
```

- [ ] **Step 4: Re-run the storage test**

Run:

```bash
pnpm exec vitest run src/lib/local-drafts.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/draft-summary.ts src/lib/local-drafts.ts src/lib/local-drafts.test.ts
git commit -m "feat: generalize browser draft storage across modes"
```

---

### Task 2: Introduce a Generic Draft Binding Hook

**Files:**
- Create: `src/hooks/useModeDrafts.ts`
- Modify: `src/hooks/useSteppedDrafts.integration.test.ts`
- Possibly Delete: `src/hooks/useSteppedDrafts.ts`
- Test: `src/hooks/useSteppedDrafts.integration.test.ts`

- [ ] **Step 1: Write failing hook tests for binding and dirty state**

Port the existing stepped-only hook tests into generic cases:

```ts
it("tracks unsaved changes by comparing current params with the bound draft snapshot", () => {
  const { result, rerender } = renderHook(
    ({ params }) =>
      useModeDrafts({
        mode: "grid",
        params,
        setParams,
      }),
    { initialProps: { params: createGridParams() } },
  );

  act(() => result.current.bindLoadedDraft(record));
  expect(result.current.hasUnsavedChanges).toBe(false);

  rerender({ params: createGridParams({ spacing: 7 }) });
  expect(result.current.hasUnsavedChanges).toBe(true);
});

it("clears draft binding after external import or reset", () => {
  act(() => result.current.clearBinding());
  expect(result.current.currentDraftId).toBeNull();
  expect(result.current.hasUnsavedChanges).toBe(false);
});

it("rebinds to the newly created draft after save-as-new", () => {
  act(() => result.current.saveAsNewDraft("新草稿"));
  expect(result.current.currentDraftId).toBe("draft-2");
});
```

- [ ] **Step 2: Run the hook integration test**

Run:

```bash
pnpm exec vitest run src/hooks/useSteppedDrafts.integration.test.ts
```

Expected: FAIL because `useSteppedDrafts` does not expose generic mode handling, binding snapshots, or `hasUnsavedChanges`.

- [ ] **Step 3: Implement `useModeDrafts`**

Add a generic hook interface:

```ts
export interface UseModeDraftsOptions<TParams extends ExportableParams> {
  mode: AppMode;
  params: TParams;
  setParams: React.Dispatch<React.SetStateAction<TParams>>;
  onAfterLoad?: () => void;
}

export interface UseModeDraftsReturn {
  currentDraftId: string | null;
  isDialogOpen: boolean;
  draftNameInput: string;
  hasUnsavedChanges: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  clearBinding: () => void;
  getDraftList: () => DraftListItem[];
  saveCurrentDraft: () => void;
  saveAsNewDraft: (title?: string) => void;
  loadDraft: (id: string) => void;
  renameDraftItem: (id: string, newTitle: string) => void;
  deleteDraftItem: (id: string) => void;
  exportDraftItem: (id: string) => void;
}
```

Use serialized param snapshots to compute dirty state:

```ts
const currentSerialized = useMemo(
  () => serializeParamFile(mode, params),
  [mode, params],
);
const hasUnsavedChanges =
  currentDraftId !== null &&
  boundDraftSerialized !== null &&
  currentSerialized !== boundDraftSerialized;
```

When loading or saving:

```ts
setCurrentDraftId(record.item.id);
setBoundDraftSerialized(serializeParamFile(mode, record.paramFile.params));
```

When clearing binding:

```ts
setCurrentDraftId(null);
setBoundDraftSerialized(null);
```

`saveCurrentDraft()` must keep the same draft id bound after overwrite. `saveAsNewDraft()` must switch binding to the new draft id.

- [ ] **Step 4: Re-run the hook integration test**

Run:

```bash
pnpm exec vitest run src/hooks/useSteppedDrafts.integration.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useModeDrafts.ts src/hooks/useSteppedDrafts.integration.test.ts
git commit -m "feat: add generic mode draft binding hook"
```

---

### Task 3: Replace the Stepped-Only Dialog with a Shared Draft Manager

**Files:**
- Create: `src/components/DraftManagerDialog.tsx`
- Create: `src/components/DraftManagerDialog.test.tsx`
- Possibly Delete: `src/components/SteppedDraftDialog.tsx`
- Possibly Delete: `src/components/SteppedDraftDialog.test.tsx`

- [ ] **Step 1: Write the failing dialog test**

Add tests for:

```ts
it("renders mode title, current binding, dirty-state badge, and mode-specific summaries", () => {
  render(
    <DraftManagerDialog
      mode="grid"
      open
      drafts={[gridDraft]}
      currentDraftId="draft-1"
      hasUnsavedChanges
      draftNameInput="新草稿"
      renderSummary={renderDraftSummary}
      {...handlers}
    />,
  );

  expect(screen.getByText("网格模式草稿")).toBeInTheDocument();
  expect(screen.getByText("有未保存修改")).toBeInTheDocument();
  expect(screen.getByText("2×3")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the dialog test**

Run:

```bash
pnpm exec vitest run src/components/DraftManagerDialog.test.tsx
```

Expected: FAIL because the generic dialog does not exist.

- [ ] **Step 3: Implement the shared dialog**

Create a mode-aware dialog:

```ts
interface DraftManagerDialogProps {
  mode: AppMode;
  open: boolean;
  drafts: DraftListItem[];
  currentDraftId: string | null;
  hasUnsavedChanges: boolean;
  draftNameInput: string;
  onDraftNameInputChange: (value: string) => void;
  onSaveAsNew: () => void;
  onSaveCurrent: () => void;
  onLoad: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  renderSummary: (item: DraftListItem) => React.ReactNode;
}
```

Mode title map:

```ts
const modeDialogTitle: Record<AppMode, string> = {
  grid: "网格模式草稿",
  custom: "自定义模式草稿",
  "simple-stepped": "简易阶梯草稿",
  stepped: "阶梯模式草稿",
};
```

Use the existing lightweight delete confirmation behavior from `SteppedDraftDialog`.

- [ ] **Step 4: Re-run the dialog test**

Run:

```bash
pnpm exec vitest run src/components/DraftManagerDialog.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/DraftManagerDialog.tsx src/components/DraftManagerDialog.test.tsx
git commit -m "feat: add shared draft manager dialog"
```

---

### Task 4: Move Draft Actions into the Shared Panel Action Area

**Files:**
- Modify: `src/components/PanelActionSection.tsx`
- Modify: `src/components/ParameterPanel.tsx`
- Modify: `src/components/CustomPanel.tsx`
- Modify: `src/components/SimpleSteppedPanel.tsx`
- Modify: `src/components/SteppedPanel.tsx`
- Test: `src/components/panels.test.tsx`

- [ ] **Step 1: Add failing panel wiring tests**

Extend `src/components/panels.test.tsx` with expectations like:

```ts
it("renders draft action state in the shared action area", () => {
  render(
    <PanelActionSection
      {...baseProps}
      draftState={{
        currentDraftId: "draft-1",
        hasUnsavedChanges: true,
        onSaveDraft: onSaveDraft,
        onOpenDraftDialog: onOpenDraftDialog,
      }}
    />,
  );

  expect(screen.getByText("更新草稿")).toBeInTheDocument();
  expect(screen.getByText("有未保存修改")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run panel tests**

Run:

```bash
pnpm exec vitest run src/components/panels.test.tsx
```

Expected: FAIL because `PanelActionSection` does not yet accept shared draft props.

- [ ] **Step 3: Implement the shared draft action area**

Add an optional draft state block to `PanelActionSection`:

```ts
interface DraftActionState {
  currentDraftId: string | null;
  hasUnsavedChanges: boolean;
  currentDraftTitle?: string | null;
  onSaveDraft: () => void;
  onOpenDraftDialog: () => void;
}
```

Render:

```tsx
{draftState ? (
  <div className="rounded border border-[#2e2a24] bg-[#16140e] p-3">
    <div className="text-xs text-muted-foreground">
      {draftState.currentDraftTitle ?? "未绑定草稿"}
    </div>
    {draftState.hasUnsavedChanges ? (
      <div className="text-[10px] text-[#c8a84e]">有未保存修改</div>
    ) : null}
    <div className="mt-2 flex gap-2">
      <Button onClick={draftState.onSaveDraft}>{
        draftState.currentDraftId ? "更新草稿" : "保存草稿"
      }</Button>
      <Button onClick={draftState.onOpenDraftDialog}>草稿列表</Button>
    </div>
  </div>
) : null}
```

Remove stepped-only draft controls from `SteppedPanel` once the shared area renders them.

- [ ] **Step 4: Re-run panel tests**

Run:

```bash
pnpm exec vitest run src/components/panels.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/PanelActionSection.tsx src/components/ParameterPanel.tsx src/components/CustomPanel.tsx src/components/SimpleSteppedPanel.tsx src/components/SteppedPanel.tsx src/components/panels.test.tsx
git commit -m "feat: unify draft actions across mode panels"
```

---

### Task 5: Wire All Four Mode Controllers in `page.tsx`

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/ParamIOButtons.tsx`
- Test: `src/app/page.test.tsx`

- [ ] **Step 1: Write failing page integration tests**

Replace the stepped-only draft expectations with mode-aware routing:

```ts
it("opens the active mode draft dialog and refreshes only that mode's draft list", async () => {
  render(<Home />);

  await user.click(screen.getByText("自定义模式"));
  await user.click(screen.getByText("草稿列表"));

  expect(customDraftsMock.openDialog).toHaveBeenCalledTimes(1);
  expect(steppedDraftsMock.openDialog).not.toHaveBeenCalled();
});

it("clears draft binding after import or reset for the active mode", async () => {
  await user.click(screen.getByText("重置参数"));
  expect(gridDraftsMock.clearBinding).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the page test**

Run:

```bash
pnpm exec vitest run src/app/page.test.tsx
```

Expected: FAIL because `page.tsx` still hardcodes a stepped-only hook and dialog.

- [ ] **Step 3: Implement active-mode draft orchestration**

In `src/app/page.tsx`, create one controller per mode:

```ts
const gridDrafts = useModeDrafts({ mode: "grid", params: gridModel.params, setParams: gridModel.replaceParams });
const customDrafts = useModeDrafts({ mode: "custom", params: customModel.params, setParams: customModel.setParams });
const simpleSteppedDrafts = useModeDrafts({ mode: "simple-stepped", params: simpleSteppedModel.params, setParams: simpleSteppedModel.setParams });
const steppedDrafts = useModeDrafts({ mode: "stepped", params: steppedModel.params, setParams: steppedModel.setParams, onAfterLoad: handleAfterDraftLoad });
```

Select the active controller:

```ts
const activeDrafts =
  mode === "grid"
    ? gridDrafts
    : mode === "custom"
      ? customDrafts
      : mode === "simple-stepped"
        ? simpleSteppedDrafts
        : steppedDrafts;
```

Wrap import/reset flows so they clear bindings:

```ts
const resetGrid = () => {
  gridDrafts.clearBinding();
  gridModel.resetParams();
};

const importCustom = (next: CustomLayoutParams) => {
  customDrafts.clearBinding();
  customModel.setParams(next);
};
```

Update `ParamIOButtons` call sites to go through these wrappers.

- [ ] **Step 4: Re-run the page test**

Run:

```bash
pnpm exec vitest run src/app/page.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/components/ParamIOButtons.tsx src/app/page.test.tsx
git commit -m "feat: wire multi-mode draft controllers into the page shell"
```

---

### Task 6: Full Regression Pass and Cleanup

**Files:**
- Modify: any follow-up cleanup from previous tasks
- Test: all touched suites

- [ ] **Step 1: Run the focused regression suites**

Run:

```bash
pnpm exec vitest run \
  src/lib/local-drafts.test.ts \
  src/hooks/useSteppedDrafts.integration.test.ts \
  src/components/DraftManagerDialog.test.tsx \
  src/components/panels.test.tsx \
  src/app/page.test.tsx
```

Expected: PASS

- [ ] **Step 2: Run the full project test suite**

Run:

```bash
pnpm test
```

Expected: PASS

- [ ] **Step 3: Run typecheck and lint**

Run:

```bash
pnpm typecheck
pnpm lint
```

Expected: PASS

- [ ] **Step 4: Remove obsolete stepped-only files if still present**

If all call sites and tests are migrated, delete:

```text
src/hooks/useSteppedDrafts.ts
src/components/SteppedDraftDialog.tsx
src/components/SteppedDraftDialog.test.tsx
```

If deleting now would create churn, leave wrappers temporarily but ensure only the generic path is used by `page.tsx`.

- [ ] **Step 5: Final commit**

```bash
git add src docs
git commit -m "feat: add browser draft management for all modes"
```

---

## Self-Review

**Spec coverage**
- Per-mode independent storage: covered by Task 1.
- Shared index plus mode-scoped full records: covered by Task 1.
- Existing stepped compatibility: covered by Task 1.
- Manual drafts only: no autosave tasks added.
- Binding persistence and dirty state: covered by Task 2.
- Import/reset/delete/load/save-as binding transitions: covered by Tasks 2 and 5.
- Shared dialog and action area: covered by Tasks 3 and 4.
- Mode-specific summaries: covered by Tasks 1 and 3.
- Current-mode-only dialog scope: covered by Task 5.
- Delete confirmation: preserved in Task 3.

**Placeholder scan**
- No `TODO` or `TBD`.
- Every task names exact files and commands.
- Each task includes a behavioral test before implementation.

**Type consistency**
- Draft storage continues to key off `AppMode`.
- Full draft payloads stay aligned with `ExportableParams`.
- Binding hook compares serialized parameter files rather than ad hoc mutable flags.

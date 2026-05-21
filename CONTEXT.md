# Tray Creator Context

This context describes the domain language for configuring miniature base trays and the slots that locate bases inside them.

## Language

**Slot Definition**:
A reusable definition of a supported base shape, nominal dimensions, and the final slot geometry needed to generate a tray slot.
_Avoid_: Preset, base preset, hole preset when referring to the complete slot geometry.

**Slot Instance**:
A placed slot in a tray layout that stores the slot definition geometry needed to reproduce the model.
_Avoid_: Treating a slot instance as only a diameter or position.

**Slot Definition ID**:
A stable identifier for the slot definition a slot instance was created from.
_Avoid_: Inferring slot identity only from width, height, or diameter.

**Slot Geometry Snapshot**:
The generated slot geometry values copied onto a slot instance when it is created, so saved or imported trays remain reproducible even if a slot definition changes later.
_Avoid_: Recomputing old saved slots from the latest definition without an explicit migration.

**Slot Instance Factory**:
A module that creates or normalizes slot instances from slot definitions or legacy slot geometry, and writes the slot geometry snapshot needed for reproducible model generation.
_Avoid_: Reimplementing slot definition matching or snapshot fields separately in each mode.

**Tolerance**:
The extra clearance included in a slot definition so the generated slot fits the physical base.
_Avoid_: Mode-specific tolerance, hidden tolerance.

**Final Slot Size**:
The exact generated slot dimension after tolerance has already been applied.
_Avoid_: Recomputing final slot size from base size in each mode.

**Ellipse Outer Offset**:
The outward expansion distance applied to an ellipse slot profile, in millimetres. This is the ellipse slot's built-in clearance.
_Avoid_: Treating ellipse clearance as a mode-specific runtime tolerance.

**Ellipse Profile Exponent**:
The shape parameter for an ellipse slot profile. A value near 2 is close to a standard ellipse; higher values create a fuller superellipse-like profile while keeping the long and short axis endpoints stable.
_Avoid_: Treating ellipse profile shape as a UI-only adjustment.

**Base Size**:
The nominal size of the miniature base the slot is intended to hold.
_Avoid_: Using base size to mean the final generated slot size.

**Mode**:
One tray editing workflow such as grid, custom, simple stepped, or stepped.
_Avoid_: Using "feature" when the meaning is the editor mode.

**Draft**:
A named browser-stored snapshot of one mode's tray configuration that can be listed, loaded, renamed, deleted, or exported.
_Avoid_: Mixing draft with imported file, autosave state, or cross-mode shared preset.

**Manual Draft Save**:
Draft persistence that happens only when the user explicitly saves or updates a draft.
_Avoid_: Treating ordinary editing as implicit draft persistence.

**Draft Binding**:
The relationship between the current editor state and the draft it was last loaded from or saved into.
_Avoid_: Clearing draft identity on every unsaved edit.

**Unsaved Draft Changes**:
Edits made after the current draft binding was established, before the user explicitly updates or saves a draft again.
_Avoid_: Assuming a bound draft always matches the current editor state.

**Draft Summary**:
A concise, mode-specific set of fields stored with a draft list item so users can identify a draft without loading it.
_Avoid_: Requiring the full draft payload to render the draft list.

**Draft Index**:
The browser-stored list of draft list items used to render draft lists quickly without loading each full draft record.
_Avoid_: Treating the draft index as the full source of editable configuration data.

**Draft Compatibility**:
The requirement that existing browser-stored drafts remain usable after draft system changes.
_Avoid_: Treating stored drafts as disposable implementation detail.

**Draft Manager Dialog**:
A reusable draft management UI that supports listing, saving, loading, renaming, deleting, and exporting drafts across modes.
_Avoid_: Duplicating the same draft management interaction separately for each mode.

**Draft Action Area**:
The mode-local action section where draft save/open controls live alongside import, export, reset, and generate actions.
_Avoid_: Hiding draft entry points in mode-specific one-off locations unless the interaction is materially different.

**Mode Workspace**:
The mode-local orchestration layer for the active editor workflow, including parameter panel wiring, draft binding, draft actions, and reset/import side effects.
_Avoid_: Treating the page component as the owner of every mode-specific draft and parameter-panel rule.

**Mode Workspace Adapter**:
A mode-specific adapter that implements the shared **Mode Workspace** interface for one Mode.
_Avoid_: Putting all mode-specific workspace orchestration into one central switch.

**Mode Workspace Registry**:
The registry seam that selects the active **Mode Workspace Adapter** for the current Mode.
_Avoid_: Making the registry own mode-specific workflow rules instead of just selecting an adapter.

**Mode Viewport Workspace**:
The mode-local orchestration layer for the active viewport workflow, including 2D/3D view selection, canvas wiring, preview wiring, and viewport-only transient state.
_Avoid_: Treating the page component as the owner of every mode-specific viewport rule.

**Mode Viewport Workspace Adapter**:
A mode-specific adapter that implements the shared **Mode Viewport Workspace** interface for one Mode.
_Avoid_: Putting all mode-specific viewport orchestration into one central switch.

**Mode Viewport Workspace Registry**:
The registry seam that selects the active **Mode Viewport Workspace Adapter** for the current Mode.
_Avoid_: Making the registry own mode-specific viewport rules instead of just selecting an adapter.

**Layout Editor Viewport**:
The canonical 2D editing view consumed by the layout canvas, including tray frame, canvas-ready slot instances, overlays, interaction capabilities, and edit commands.
_Avoid_: Making the canvas infer mode semantics from raw Mode params.

**Layout Editor Viewport Adapter**:
A mode-specific adapter that projects Mode-local layout state into a **Layout Editor Viewport**.
_Avoid_: Passing mode-specific canvas exceptions directly through the page or viewport shell.

## Relationships

- A **Slot Definition** includes its **Tolerance**.
- A circular **Slot Definition** records its **Final Slot Size** directly.
- An ellipse **Slot Definition** includes base width, base height, **Ellipse Outer Offset**, and **Ellipse Profile Exponent**.
- A **Slot Instance** is created from exactly one **Slot Definition** and records its **Slot Definition ID**.
- A **Slot Instance** keeps a **Slot Geometry Snapshot** for reproducible generation.
- A **Slot Instance Factory** is the shared creation seam for writing **Slot Geometry Snapshots** onto new or imported **Slot Instances**.
- Existing **Slot Instances** do not silently change when a **Slot Definition** changes.
- Updating an existing slot to the latest **Slot Definition** must be an explicit action.
- Model generation uses the **Slot Geometry Snapshot**, not the **Slot Definition ID**.
- The **Slot Definition ID** is for creation, identity, and UI selection state.
- Legacy data without a **Slot Definition ID** may be conservatively matched to a definition.
- Circular legacy slots match by nominal diameter.
- Ellipse legacy slots match only when width, height, **Ellipse Outer Offset**, and **Ellipse Profile Exponent** all match.
- Legacy slots that do not match a definition remain valid geometry snapshots without a definition identity.
- A slot definition display name must reflect the actual geometry values in the definition.
- A **Draft** belongs to exactly one **Mode**.
- Each **Mode** may have its own independent **Draft** list and storage space.
- A **Manual Draft Save** does not imply autosave or session recovery.
- The current editor state may keep a **Draft Binding** even when there are unsaved edits.
- **Unsaved Draft Changes** may exist while a **Draft Binding** still exists.
- A **Draft Summary** belongs to the same **Mode** as its **Draft**.
- A **Draft Summary** may be mode-specific rather than globally uniform across all modes.
- A grid **Draft Summary** may show row/column count, structure mode, base size, and resulting width/depth.
- A custom **Draft Summary** may show slot count and resulting width/depth.
- A simple stepped **Draft Summary** may show row count, slot count, and resulting width/depth.
- A stepped **Draft Summary** may show group count, slot count, and resulting width/depth.
- Draft titles may be duplicated within the same **Mode**.
- A **Draft Index** stores **Draft Summary** entries, while full draft records store full mode parameters.
- Draft limits may be enforced per **Mode**, not only globally.
- **Draft Compatibility** applies to already-saved browser drafts, especially existing stepped drafts.
- A draft record key may be mode-scoped while the **Draft Index** remains shared.
- A **Draft Manager Dialog** may be shared across modes while rendering mode-specific summaries.
- A **Draft Manager Dialog** may show drafts for the current **Mode** only.
- A **Draft Action Area** should remain broadly consistent across modes.
- A **Mode Workspace** may own a **Mode**'s **Draft Binding**, **Draft Action Area** inputs, parameter panel inputs, and reset/import side effects.
- A **Mode Workspace** should not own viewport-specific 2D/3D editing details unless those details become shared across modes.
- A **Mode Workspace Adapter** implements the shared **Mode Workspace** interface for one **Mode**.
- A **Mode Workspace Registry** selects the active **Mode Workspace Adapter** for the current **Mode**.
- A **Mode Viewport Workspace** may own a **Mode**'s viewport wiring, preview-view switching, and viewport-only transient state.
- A **Mode Viewport Workspace** should not own left-panel parameter editing or **Draft Binding** rules.
- A **Mode Viewport Workspace Adapter** implements the shared **Mode Viewport Workspace** interface for one **Mode**.
- A **Mode Viewport Workspace Registry** selects the active **Mode Viewport Workspace Adapter** for the current **Mode**.
- A **Layout Editor Viewport** is the shape consumed by the layout canvas for 2D editing.
- A **Layout Editor Viewport Adapter** projects a **Mode**'s local layout state into a **Layout Editor Viewport**.
- A layout canvas should consume a **Layout Editor Viewport** instead of inferring **Mode** behavior from raw parameters.
- Loading a different draft replaces the current **Draft Binding**.
- Saving as a new draft replaces the current **Draft Binding** with the new draft.
- Deleting the currently bound draft clears the current **Draft Binding**.
- Deleting a draft should use an explicit confirmation step.
- Resetting to default parameters clears the current **Draft Binding**.
- Importing an external parameter file clears the current **Draft Binding**.
- Multiple layout modes may expose different subsets of **Slot Definitions**.
- When two modes expose the same **Slot Definition**, they must use the same geometry.
- A **Base Size** is not enough to reproduce a slot unless its **Tolerance** and shape-specific geometry are also known.

## Example Dialogue

> **Dev:** "Can grid mode and stepped mode both offer a 40mm circular slot?"
> **Domain expert:** "Yes, and if they do, both must use the same slot definition, including the same clearance."

## Flagged Ambiguities

- "凹槽定义" previously meant either a visible UI option or the generated hole geometry. Resolved: **Slot Definition** means the complete reusable geometry definition, including tolerance.

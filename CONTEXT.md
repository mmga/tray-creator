# Tray Creator Context

This context describes the domain language for configuring miniature base trays and the slots that locate bases inside them.

## Language

**Slot Definition**:
A reusable definition of a supported base shape, nominal dimensions, and the final slot geometry needed to generate a tray slot.
_Avoid_: Preset, base preset, hole preset when referring to the complete slot geometry.

**Old World Rectangular Slot Definition**:
A Slot Definition for a Warhammer: The Old World square or rectangular base, storing nominal width and depth plus final slot dimensions with 0.4mm total tolerance on each axis.
_Avoid_: Calling the whole family “方底盘模式”, because it also includes rectangular bases.

**Old World Grid Orientation**:
The fixed grid convention where an Old World Rectangular Slot Definition’s first dimension follows the X-axis columns and its second dimension follows the Y-axis rows, with no per-layout rotation option.
_Avoid_: Interpreting `30×60` as a rotatable or orientation-free size.

**Old World Full-Slot Grid**:
A grid of Old World Rectangular Slot Definitions that permits only complete rectangular slots and never exposes the circular half-slot structure.
_Avoid_: Half rectangular slot, rectangular half-slot mode.

**Old World Magnetic Hole Rule**:
The magnet-hole rule for an Old World Rectangular Slot Definition that selects the large magnet only when its shorter nominal side is greater than 40mm.
_Avoid_: Selecting the magnet from the longer side or treating a 40mm short side as large.

**Old World Preset Set**:
The fixed first-release set of Old World Rectangular Slot Definitions: 25×25, 30×30, 30×60, 40×40, 50×50, 50×75, and 60×100mm, without custom width-and-depth entry.
_Avoid_: Treating this release as a general custom rectangular-slot editor.

**Grid Slot Definition Switch**:
A grid-mode change that replaces the active Slot Definition while preserving row count, column count, spacing, boundary spacing, and base structure parameters.
_Avoid_: Resetting the whole grid configuration when only the Slot Definition changes.

**Uniform Grid Slot Definition**:
The rule that every cell in one grid tray uses the same active Slot Definition, whether circular or Old World rectangular.
_Avoid_: Mixed-size grid, mixed-shape grid.

**Grid Draft Shape Compatibility**:
The rule that a grid draft or import without an explicit non-circular Slot Definition remains a circular grid when loaded.
_Avoid_: Inferring an Old World rectangular Slot Definition from legacy diameter fields.

**Old World Rectangular Slot Corners**:
The straight 90-degree internal corners of an Old World Rectangular Slot Definition, without an additional slot-corner radius.
_Avoid_: Applying the tray’s outer corner radius to a rectangular slot.

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

**Param Normalization Pipeline**:
A module that converts imported, legacy, or draft Mode params into current runtime params through a fixed sequence: validate required fields, migrate legacy shape, normalize Slot Instances, then clamp and fill derived fields.
_Avoid_: Mixing parameter file wrapper parsing, browser draft storage, or UI side effects into parameter normalization.

**Legacy Param Migration**:
The compatibility step inside the **Param Normalization Pipeline** that repairs older Mode parameter shapes before Slot Instance normalization and derived-field clamping run.
_Avoid_: Duplicating old-shape repair logic across import parsing, Draft loading, and runtime editors.

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

**Mode Interaction State**:
Mode-local transient editor state shared by a **Mode Workspace** and a **Mode Viewport Workspace**, such as selected slot ids or preview focus ids.
_Avoid_: Treating shared editor interaction state as page-owned state or as registry-owned state.

**CAD Stepped Construction**:
The CAD stepped-mode modeling contract where each height band is generated from its own 2D sketch and then extruded before cuts are applied.
_Avoid_: Treating CAD stepped mode as an arbitrary union of per-group solids.

**Stepped Layout Core**:
The shared stepped editing module that owns group and slot editing, undo history, outline preview, whole-model preview/export, base-hole derived fields, and layout optimization for both `stepped` and `stepped-cad`, while excluding split assembly behavior.
_Avoid_: Letting the shared stepped editing module own CAD-only split preview, split export, split assembly groove, Locator Pin, or split merge rules.

**Stepped CAD Split Orchestration**:
The `stepped-cad`-only workflow that owns split-preview lifecycle and split-part export while reusing group editing from the **Stepped Layout Core**.
_Avoid_: Exposing CAD-only split preview or split export through the ordinary `stepped` runtime interface.

**Simple Stepped Layout Core**:
The simple stepped editing module that owns row and slot relationship repair, simple stepped tray size normalization, outer margin synchronization, and canvas-to-row slot update projection for `simple-stepped` mode.
_Avoid_: Reimplementing simple stepped row membership repair or tray size normalization separately in import normalization, hooks, and viewport adapters.

**Split Assembly Groove Type**:
The mutually exclusive stepped CAD choice that decides which contact-face outline becomes the male/female split assembly groove profile.
_Avoid_: Treating groove types as stackable toggles.

**Profile Recess**:
A split assembly groove type where the upper male tenon uses the full upper contact-face outline, and the lower female recess uses that outline with assembly clearance clipped to the lower contact face.
_Avoid_: Locator recess, circular recess.

**Inset Recess**:
A split assembly groove type where the upper male tenon uses the upper contact-face outline inset inward by a fixed 1mm before the lower female recess is generated from that inset profile with assembly clearance.
_Avoid_: Treating it as profile recess plus an extra toggle.

**Split Interface Profile**:
The derived 2D split-interface contract for one stepped CAD contact height, including a contact footprint plus the corresponding male and female footprints used to build assembly geometry before 3D extrusion.
_Avoid_: Re-deriving male/female assembly geometry separately from finished 3D solids.

**Locator Pin**:
A local split assembly aid that can be combined with a split assembly groove type without changing that groove type's outline semantics.
_Avoid_: Treating locators as a groove type.

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

**Effective Baseplate**:
The actual baseplate footprint derived from placed slots and boundary spacing, rather than the raw tray width/depth inputs.
_Avoid_: Using baseplate, tray size, or tray width/depth to mean the derived printable footprint in custom mode.

**Tray Sizing Mode**:
The custom-mode choice between deriving the tray footprint from placed slots or keeping the tray footprint at the configured width and depth.
_Avoid_: Calling a fixed tray an auto-sized effective baseplate.

**Fixed Tray Outer Footprint**:
The bottom outer dimensions of a fixed custom tray, which remain unchanged when slots are added or moved.
_Avoid_: Using the upper edge size as the fixed size when a side bevel is present.

**Fixed Tray Footprint Area**:
The width-by-depth area of a **Fixed Tray Outer Footprint**, used as the custom tray's business footprint while fixed sizing is active.
_Avoid_: Pricing, naming, or summarizing a fixed tray from only its occupied slot bounds.

**Slot Boundary Violation**:
A fixed-mode state where a slot's final profile crosses the usable upper footprint after side-bevel and boundary-spacing insets are applied.
_Avoid_: Treating a boundary violation as an automatic position correction or an export-blocking error.

**Random Slot Arrangement**:
A fixed custom tray operation that assigns new positions to all existing slot instances without changing their count, identity, geometry, or rotation.
_Avoid_: Treating random arrangement as adding, deleting, or redefining slots.

**Random Arrangement Result**:
An all-or-nothing candidate layout produced by a **Random Slot Arrangement** that either relocates every slot successfully or leaves the current layout unchanged.
_Avoid_: Applying a partially placed random layout.

**Side Bevel**:
The continuous side-wall slope from the tray's bottom edge footprint to its top edge footprint. Its width is the horizontal inset from the lower edge to the upper edge.
_Avoid_: Treating it as a corner radius, slot clearance, stepped split groove, or a decorative 2D-only annotation.

**Effective Baseplate Area**:
The footprint area of the **Effective Baseplate**, calculated as derived width multiplied by derived depth.
_Avoid_: Using model volume or raw tray area when the meaning is the derived custom-mode footprint used for pricing.

**Slot Count**:
The number of placed slot instances in the current tray layout.
_Avoid_: Mixing slot count with magnet-hole count or with distinct slot-size types.

**Custom Quote Baseline**:
The current custom-mode quoting rule used as the adjustable pricing baseline before later recalibration from representative layouts, with the final quote rounded up to the next integer yuan.
_Avoid_: Treating one-off historical prices as an exact formula fit when they are only reference points.

**Per-Slot Increment**:
The fixed amount added to a custom-mode quote for each placed slot instance.
_Avoid_: Folding this fixed increment into the area coefficient when the meaning is a separate per-slot charge.

**Legacy Grid Quote Ladder**:
The previous grid-mode quoting rule that priced trays from slot-diameter tiers plus optional magnet-hole surcharges.
_Avoid_: Mixing the retired grid ladder with the newer area-and-slot-count baseline once grid pricing is migrated.

**Grid Footprint Area**:
The grid-mode tray footprint area calculated from the displayed theoretical outer width and depth, including actual slot size, spacing, and boundary spacing.
_Avoid_: Using nominal hole diameter alone when the meaning is the printed footprint shown to the user.

**Grid Quote Baseline**:
The grid-mode quoting rule after migration, reusing the same coefficients and final upward-integer rounding rule as the custom quote baseline.
_Avoid_: Maintaining a separate grid-only coefficient set when grid and custom are intentionally aligned.

## Relationships

- A **Slot Definition** includes its **Tolerance**.
- A circular **Slot Definition** records its **Final Slot Size** directly.
- An ellipse **Slot Definition** includes base width, base height, **Ellipse Outer Offset**, and **Ellipse Profile Exponent**.
- An **Old World Rectangular Slot Definition** records nominal width and depth, with each **Final Slot Size** axis 0.4mm larger than its nominal axis.
- An **Old World Grid Orientation** maps a rectangular slot’s width to grid columns and depth to grid rows.
- An **Old World Full-Slot Grid** uses complete **Old World Rectangular Slot Definitions** only.
- An **Old World Magnetic Hole Rule** uses the shorter nominal axis of an **Old World Rectangular Slot Definition**.
- The **Old World Preset Set** contains exactly seven **Old World Rectangular Slot Definitions** in its first release.
- A **Grid Slot Definition Switch** preserves grid and base parameters while changing the selected Slot Definition and derived footprint.
- A grid tray has exactly one **Uniform Grid Slot Definition**.
- An **Old World Full-Slot Grid** uses the existing **Grid Quote Baseline** without a rectangular-slot surcharge.
- **Grid Draft Shape Compatibility** preserves circular geometry for legacy grid drafts and imports.
- An **Old World Rectangular Slot Definition** uses **Old World Rectangular Slot Corners**.
- A **Slot Instance** is created from exactly one **Slot Definition** and records its **Slot Definition ID**.
- A **Slot Instance** keeps a **Slot Geometry Snapshot** for reproducible generation.
- A **Slot Instance Factory** is the shared creation seam for writing **Slot Geometry Snapshots** onto new or imported **Slot Instances**.
- A **Param Normalization Pipeline** runs before imported or loaded params become runtime **Mode** params.
- **Legacy Param Migration** runs inside the **Param Normalization Pipeline** after required-field validation and before **Slot Instance** normalization.
- **Legacy Param Migration** owns old-shape compatibility repair, while the rest of the **Param Normalization Pipeline** owns validation, Slot Instance normalization, and derived-field clamping.
- A **Param Normalization Pipeline** uses the **Slot Instance Factory** when it writes or repairs **Slot Geometry Snapshots**.
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
- **Mode Interaction State** belongs to one active **Mode** editing workflow, not to the page shell or a registry.
- A **Mode Workspace** and **Mode Viewport Workspace** may share **Mode Interaction State** when left-panel controls and viewport interactions both read or write the same transient editor state.
- A **Stepped Layout Core** may be shared by both `stepped` and `stepped-cad` when the behavior is not split-assembly-specific.
- A **Stepped Layout Core** should not expose CAD-only split assembly behavior through the ordinary `stepped` runtime interface.
- **Stepped CAD Split Orchestration** composes the **Stepped Layout Core** rather than being owned by it.
- **Stepped CAD Split Orchestration** owns split-preview generation, invalidation, disposal, and split-part export for `stepped-cad`.
- **Stepped CAD Split Orchestration** reuses the **Stepped Layout Core** group action when it changes a group's split-part target.
- A **Simple Stepped Layout Core** may allow the derived tray size to exceed the maximum build size when row and slot content requires it.
- In simple stepped mode, the maximum build size is a user warning threshold, not a hard normalization cap.
- Imported, draft-loaded, and runtime-edited simple stepped params should pass through the same **Simple Stepped Layout Core** normalization rules.
- A **Simple Stepped Layout Core** should call the **Slot Instance Factory** when repairing simple stepped **Slot Geometry Snapshots**, rather than owning slot definition matching rules itself.
- A **Mode Viewport Workspace** may own a **Mode**'s viewport wiring, preview-view switching, and viewport-only transient state.
- A **Mode Viewport Workspace** should not own left-panel parameter editing or **Draft Binding** rules.
- A **Mode Viewport Workspace Adapter** implements the shared **Mode Viewport Workspace** interface for one **Mode**.
- A **Mode Viewport Workspace Registry** selects the active **Mode Viewport Workspace Adapter** for the current **Mode**.
- A **Layout Editor Viewport** is the shape consumed by the layout canvas for 2D editing.
- A **Layout Editor Viewport Adapter** projects a **Mode**'s local layout state into a **Layout Editor Viewport**.
- A layout canvas should consume a **Layout Editor Viewport** instead of inferring **Mode** behavior from raw parameters.
- In custom mode, the **Effective Baseplate** is derived from placed **Slot Instances** plus boundary spacing.
- A custom **Tray Sizing Mode** is either automatic, which uses the **Effective Baseplate**, or fixed, which uses the configured tray width and depth as the final tray footprint.
- In fixed custom **Tray Sizing Mode**, **Slot Instances** use the fixed tray's lower-left corner as their layout origin.
- Changing a custom **Tray Sizing Mode** preserves each **Slot Instance** position and does not silently reflow the layout.
- A custom tray retains configured width and depth while in automatic **Tray Sizing Mode**, so switching back to fixed mode restores the chosen size.
- A custom configuration that does not record a **Tray Sizing Mode** is treated as automatic to preserve legacy behavior.
- A **Tray Sizing Mode** is an optional additive custom configuration field and does not require a parameter-file version change.
- **Tray Sizing Mode** applies only to custom **Mode** and does not alter grid, simple stepped, stepped, or CAD stepped size rules.
- A fixed custom tray's configured width and depth define its **Fixed Tray Outer Footprint**.
- A **Side Bevel** reduces the fixed tray's upper usable footprint inward from its **Fixed Tray Outer Footprint**, while boundary spacing is measured from that upper edge.
- A fixed tray's upper usable footprint follows its rounded-corner geometry, so a **Slot Boundary Violation** may occur at a corner even when a slot fits within the enclosing rectangle.
- A fixed-mode **Slot Boundary Violation** is visibly reported but does not prevent model generation or export.
- A **Slot Boundary Violation** is shown as persistent canvas status and error count feedback, not as an interrupting confirmation or transient message.
- A **Fixed Tray Footprint Area** belongs to exactly one **Fixed Tray Outer Footprint**.
- A fixed custom tray's quote, displayed dimensions, exported file name, and **Draft Summary** use its **Fixed Tray Outer Footprint** and **Fixed Tray Footprint Area**.
- A fixed custom tray may have zero **Slot Instances** and can still be generated or exported as an empty tray using its **Fixed Tray Outer Footprint**.
- A **Random Slot Arrangement** applies only to the existing **Slot Instances** of a fixed custom tray and preserves each slot's identity, geometry, and rotation.
- A successful **Random Slot Arrangement** has no **Slot Boundary Violations** and no slot-overlap or slot-spacing collision.
- A **Random Slot Arrangement** searches positions at 0.1mm precision, placing larger slot footprints before smaller ones.
- A **Random Arrangement Result** is atomic: failure preserves every current slot position, while success replaces every slot position as one undoable edit.
- Repeating a successful **Random Slot Arrangement** produces a fresh candidate layout; no random seed is stored in a Draft or exported parameter file.
- A **Random Slot Arrangement** reports its success or capacity failure as action feedback, while ordinary **Slot Boundary Violations** remain persistent canvas status rather than transient feedback.
- A **Side Bevel** keeps the upper edge as the slot boundary-spacing reference and expands the lower edge outward by the configured bevel width.
- A 2D view that displays a **Side Bevel** should keep the ordinary tray outline for the lower edge and mark only the inset upper edge.
- An **Effective Baseplate Area** belongs to exactly one **Effective Baseplate**.
- A tray quote may use **Effective Baseplate Area** and **Slot Count** instead of model volume.
- The current **Custom Quote Baseline** computes `2 + 0.2 × Slot Count + Effective Baseplate Area / 2560`, then rounds the final quote up to the next integer yuan.
- A **Per-Slot Increment** belongs to each placed **Slot Instance** in the quote calculation.
- Grid pricing may fully replace the **Legacy Grid Quote Ladder** with the same area-and-slot-count baseline used by custom pricing.
- A **Grid Footprint Area** belongs to exactly one grid tray footprint derived from the displayed outer width and depth.
- The current **Grid Quote Baseline** reuses the custom coefficients and final rounding rule: compute `2 + 0.2 × Slot Count + Grid Footprint Area / 2560`, then round the final quote up to the next integer yuan.
- Loading a different draft replaces the current **Draft Binding**.
- Saving as a new draft replaces the current **Draft Binding** with the new draft.
- Deleting the currently bound draft clears the current **Draft Binding**.
- Deleting a draft should use an explicit confirmation step.
- Resetting to default parameters clears the current **Draft Binding**.
- Importing an external parameter file clears the current **Draft Binding**.
- Multiple layout modes may expose different subsets of **Slot Definitions**.
- When two modes expose the same **Slot Definition**, they must use the same geometry.
- Grid, custom, simple stepped, and stepped modes all expose the 100mm circular **Slot Definition**.
- The 100mm circular **Slot Definition** has a 100mm **Base Size** and a 100.4mm **Final Slot Size**.
- A **Base Size** is not enough to reproduce a slot unless its **Tolerance** and shape-specific geometry are also known.
- **CAD Stepped Construction** builds one extruded body per height band.
- **CAD Stepped Construction** applies slot holes and magnetic base holes after the stepped height bands are assembled.
- A stepped CAD split part has at most one active **Split Assembly Groove Type**.
- A **Profile Recess** uses the full upper contact-face outline as the male tenon profile.
- The user-facing label for **Profile Recess** is "轮廓凹槽".
- An **Inset Recess** uses the upper contact-face outline after a fixed 1mm inward inset as the male tenon profile.
- The user-facing label for **Inset Recess** is "内缩凹槽".
- A **Split Interface Profile** belongs to exactly one stepped CAD contact height.
- A **Split Interface Profile** includes a contact footprint, a male footprint, and a female footprint.
- A stepped CAD split body must consume profile-derived body, recess-shell, and tenon bands instead of re-deriving male or female geometry from finished 3D solids.
- **Split Interface Profile** is the sole source of male and female footprint geometry used by stepped CAD split body generation.
- A **Profile Recess** derives its male footprint from the full contact footprint.
- An **Inset Recess** derives its male footprint from the contact footprint after a fixed 1mm inward inset.
- If an **Inset Recess** profile becomes empty after inset, that interface generates no male tenon or female recess.
- If an **Inset Recess** profile separates into multiple islands after inset, each island remains part of the split assembly profile.
- Imported stepped CAD data with split assembly enabled but no explicit **Split Assembly Groove Type** uses **Profile Recess**.
- A **Locator Pin** may be enabled alongside either **Profile Recess** or **Inset Recess**.

## Example Dialogue

> **Dev:** "Can grid mode and stepped mode both offer a 40mm circular slot?"
> **Domain expert:** "Yes, and if they do, both must use the same slot definition, including the same clearance."
>
> **Dev:** "Does the 100mm option generate a 100mm hole?"
> **Domain expert:** "No. It fits a 100mm base and generates a 100.4mm final slot after tolerance."
>
> **Dev:** "Can CAD stepped mode generate each group as a full-height solid and union them?"
> **Domain expert:** "No. CAD stepped mode should generate the sketch for each height band, extrude that band, then apply the holes."
>
> **Dev:** "Can profile recess and inset recess both be enabled on the same split part?"
> **Domain expert:** "No. They are alternative split assembly groove types; locator pins are the optional add-on."
>
> **Dev:** "Should ordinary stepped mode expose split preview because it shares its editor with CAD stepped mode?"
> **Domain expert:** "No. Split preview and split-part export belong to Stepped CAD Split Orchestration, which composes the shared Stepped Layout Core."

## Flagged Ambiguities

- "凹槽定义" previously meant either a visible UI option or the generated hole geometry. Resolved: **Slot Definition** means the complete reusable geometry definition, including tolerance.
- "方底盘" was used for both square and rectangular Old World bases. Resolved: use **Old World Rectangular Slot Definition** for the family, including square dimensions as a special case.
- "30×60" could mean either grid orientation. Resolved: the first dimension follows X-axis columns and the second follows Y-axis rows.
- "半圆槽" could be mistaken for a generic grid feature. Resolved: it applies only to circular Slot Definitions, never to an **Old World Full-Slot Grid**.
- "矩形磁吸孔规格" could be chosen from either side. Resolved: use the shorter nominal side, and select the large magnet only above 40mm.
- "旧世界方底盘模式" might imply arbitrary rectangular dimensions. Resolved: the first release exposes only the seven-size **Old World Preset Set**.
- "切换底盘类型" could imply resetting the layout. Resolved: a **Grid Slot Definition Switch** preserves grid and base parameters.
- "网格模式" could imply arbitrary mixed base layouts. Resolved: a grid tray has one **Uniform Grid Slot Definition**; mixed layouts belong to custom mode.
- "旧世界矩形凹槽" could imply a new quote tier. Resolved: an **Old World Full-Slot Grid** uses the existing **Grid Quote Baseline** without a surcharge.
- "旧版网格配置" could be interpreted as an Old World layout after the feature is added. Resolved: **Grid Draft Shape Compatibility** keeps it circular unless it explicitly selects a non-circular Slot Definition.
- "矩形凹槽圆角" could be conflated with the tray’s outer corner radius. Resolved: **Old World Rectangular Slot Corners** are straight 90-degree corners.
- "底盘" was ambiguous between raw tray width/depth inputs and the derived printable footprint in custom mode. Resolved: use **Effective Baseplate** for the derived custom-mode footprint used in pricing.
- "固定托盘大小" could mean a canvas-only frame or the generated model footprint. Resolved: fixed **Tray Sizing Mode** uses the configured width and depth as the final generated tray footprint.
- "固定尺寸" could mean the bottom outer edge or the side-bevel-inset upper edge. Resolved: it means the **Fixed Tray Outer Footprint**.
- "凹槽越界" could mean a hard editing constraint or a warning-only state. Resolved: use **Slot Boundary Violation** for a red, warning-only state that keeps generation and export available.
- "随机排列" could mean arbitrary positions that may require manual repair. Resolved: use **Random Slot Arrangement** only for an all-valid layout that satisfies both fixed-boundary and slot-spacing constraints.
- Historical custom-mode prices may be used as reference points, not as an exact fitted law. Resolved: treat them as sanity checks around the **Custom Quote Baseline**, then adjust after reviewing representative layouts.
- Grid mode previously mixed a diameter-tier quote ladder with a newer area-based custom quote baseline. Resolved: when grid pricing migrates, it fully replaces the old ladder rather than combining both rules.
- Grid-mode "面积" could have meant nominal hole layout size or the displayed outer dimensions. Resolved: use **Grid Footprint Area**, derived from the displayed width and depth, for migrated grid pricing.
- "CAD 阶梯模式生成" could mean either per-group solid union or band-by-band CAD construction. Resolved: use **CAD Stepped Construction**, which generates each height band from a sketch before extrusion.
- "内缩凹槽" could mean an extra toggle layered on top of "轮廓浅槽". Resolved: use **Inset Recess** as a mutually exclusive **Split Assembly Groove Type**.

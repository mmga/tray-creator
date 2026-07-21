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

**Old World Ranked Base Spacing**:
The edge-to-edge gap between nominal Old World base footprints, whose centre pitch excludes Slot Definition tolerance so clearance is applied only around the whole ranked array.
_Avoid_: Repeating each slot's tolerance inside the grid pitch or treating this value as the gap between final slot edges.

**Old World Full-Slot Grid**:
A grid of Old World Rectangular Slot Definitions that permits only complete rectangular slots and never exposes the circular half-slot structure.
_Avoid_: Half rectangular slot, rectangular half-slot mode.

**Old World Magnetic Hole Rule**:
The magnet-hole rule for an Old World Rectangular Slot Definition that selects a 20mm diameter × 0.8mm magnetic sheet for a 25mm shorter nominal side, the standard magnet through 40mm, and the large magnet above 40mm.
_Avoid_: Selecting the magnet from the longer side, treating a 40mm short side as large, or using the standard magnet for a 25mm short side.

**Old World Preset Set**:
The fixed set of eleven official Old World Rectangular Slot Definitions: 25×25, 25×50, 30×30, 30×60, 40×40, 40×60, 50×50, 50×75, 50×100, 60×100, and 100×150mm, without custom width-and-depth entry.
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

**Import Normalization Report**:
A user-visible account of the defaults, legacy-field migrations, value adjustments, and behavior changes between imported parameters and their normalized candidate parameters.
_Avoid_: Calling it a version mapping when the parameter file version does not change.

**Import Candidate**:
The normalized parameters and Import Normalization Report produced from an imported parameter file before the user accepts or cancels the import.
_Avoid_: Mutating the active editor state while the import is still awaiting confirmation.

**Import Mode Resolution**:
The determination of an imported parameter file's Mode from its declared Mode, an unambiguous legacy shape, or an explicit user choice when the legacy shape is ambiguous.
_Avoid_: Treating Mode identification as parameter conversion.

**Retired Import Field**:
A recognized legacy parameter field with no current equivalent, retained only as an import-reporting identifier and excluded from normalized parameters.
_Avoid_: Preserving a retired field in current runtime params or letting it affect current behavior.

**Tolerance**:
The extra clearance included in a slot definition so the generated slot fits the physical base.
_Avoid_: Mode-specific tolerance, hidden tolerance.

**Base-hole Structure**:
The mutually exclusive tray choice between no base hole, an automatically matched Magnetic Base Hole, and an explicitly sized Magnet Post Hole.
_Avoid_: Independent boolean switches that allow multiple base-hole structures to be active together.

**Magnetic Base Hole**:
A preset-driven cylindrical cavity centred beneath a slot and separated from the slot floor by a top wall.
_Avoid_: Magnet Post Hole, or treating its automatically selected dimensions as editable final dimensions.

**Magnetic Base Hole Matching Rule**:
The shape-aware rule that selects the 20mm Magnetic Base Hole for a 25mm shortest nominal dimension, the large Magnetic Base Hole for a circular slot at 60mm diameter or above, and for another non-circular slot only when its shorter nominal dimension is greater than 40mm.
_Avoid_: Selecting a non-circular slot's magnet from its longer dimension.

**Magnet Post Hole**:
A cylindrical recess centred on a Slot Instance of any supported shape, opening at the slot floor and terminating at its explicitly configured depth without penetrating the tray underside or adding built-in tolerance.
_Avoid_: Magnet post when referring to a solid protrusion, or Magnetic Base Hole when referring to the automatically matched enclosed baseplate cavity.

**Base-hole Supporting Thickness**:
The material thickness between a Slot Instance floor and the tray underside that contains the selected Base-hole Structure.
_Avoid_: Using the tray's total height or slot depth as the available supporting thickness.

**Magnetic Base Plate Only**:
The grid-only structure that omits upper slot recesses and produces a base plate containing enclosed Magnetic Base Holes.
_Avoid_: Treating it as a generic plate for Magnet Post Holes or exposing it in another Mode.

**Magnet Post Hole Fit Violation**:
The invalid state where the configured Magnet Post Hole diameter exceeds a Slot Instance's shortest Final Slot Size.
_Avoid_: Silently shrinking the configured magnet diameter or omitting only the incompatible hole.

**Magnetic Base Hole Fit Violation**:
The invalid state where a Magnetic Base Hole cannot retain at least 0.6mm of enclosing tray material laterally throughout its cavity depth.
_Avoid_: Treating a side-opening cavity as a valid magnetic hole, silently selecting another preset, or omitting only the incompatible hole.

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

**Conversion Base**:
A printable adapter with a round or oval outer footprint and a centered shallow recess that locates an existing square or rectangular miniature base.
_Avoid_: Tray slot, through-hole adapter, four independent clips.

**Source Base Standard**:
One supported nominal square or rectangular miniature-base size selected as the object held by a Conversion Base.
_Avoid_: Binding a source size permanently to one target footprint.

**Target Base Standard**:
One supported nominal round or oval footprint selected as the resulting footprint of a Conversion Base.
_Avoid_: Treating the target footprint as a recess size or as part of a fixed source-target pair.

**Conversion Recess**:
The centered, axis-aligned, non-through rectangular lowered area of a Conversion Base, bounded where material exists by four arc-shaped retaining sectors.
_Avoid_: Through hole, fully enclosed rectangular pocket, removable insert.

**Conversion Clearance**:
The fixed per-side spacing added around a Source Base Standard to derive the final Conversion Recess width and depth.
_Avoid_: Baking print clearance into the nominal source-base sizes or applying it only once across a whole axis.

**Mode**:
One tray editing workflow such as grid, custom, Conversion Base, or stepped.
_Avoid_: Using "feature" when the meaning is the editor mode.

**Mode Param Snapshot**:
An indivisible, read-only pairing of one actual Mode and a copied value of that Mode's current normalized runtime parameters, captured by a Mode Workspace Adapter as the stable source for one persistence operation.
_Avoid_: Retaining a mutable editor-state reference, passing Mode and params as independently selectable writer arguments, inferring Mode from parameter shape, or making the snapshot own storage and download behavior.

**Persisted Param Artifact**:
A newly written parameter-bearing artifact whose declared Mode identifies the editor workflow that owns its parameters, including exported parameter files, model companion parameter files, split-part companion parameter files, Draft records, and Draft Summaries.
_Avoid_: Writing the historical `stepped-cad` alias, inferring Mode from parameter shape, deriving Mode independently in each writer, or treating a split-manifest file type as a Mode.

**Model Artifact Bundle**:
The complete ordered set of separately named model files prepared from one Mode Param Snapshot for one export operation, including STL files and any companion parameter or manifest files.
_Avoid_: Triggering downloads while later bundle files are still being generated, treating a partially prepared set as success, or requiring a ZIP container.

**Model Geometry Fingerprint**:
A deterministic transient identity derived from the Mode parameters used to generate one cached model geometry, compared with an export's Mode Param Snapshot before that geometry may be reused.
_Avoid_: Persisting the fingerprint in parameter files or Drafts, treating a generic stale flag as proof of parameter identity, or reusing geometry after a fingerprint mismatch.

**Current Param Artifact Encoder**:
The write-side module that converts a Mode Param Snapshot into the current persisted parameter envelope, JSON, or Blob without applying historical compatibility rules.
_Avoid_: Owning browser storage, filenames, downloads, legacy Mode ambiguity, migration, or normalization.

**Historical Param Artifact Reader**:
The read-side module that recognizes historical parameter wrappers and Mode ambiguity, then routes imported files or stored Drafts through their required compatibility and normalization flow.
_Avoid_: Reusing historical downgrade rules when writing a new Persisted Param Artifact.

**Param Artifact Read Error**:
A Historical Param Artifact Reader failure with a stable semantic code, a user-readable message, and an optional underlying normalization cause.
_Avoid_: Requiring callers or tests to parse localized error text, or representing a required Import Mode choice as an error.

**Mode Interaction State**:
Mode-local transient editor state shared by a **Mode Workspace** and a **Mode Viewport Workspace**, such as selected slot ids or preview focus ids.
_Avoid_: Treating shared editor interaction state as page-owned state or as registry-owned state.

**Stepped Tray**:
A tray whose manually placed Slot Instances are assigned to height groups that form one user-visible stepped modeling workflow.
_Avoid_: Presenting the internal solid-construction algorithm as a user-selectable tray kind.

**Custom Stepped Tray**:
The user-facing name “自定义阶梯底座” for the Stepped Tray workflow, emphasizing its manual slot placement and height-group editing.
_Avoid_: CAD 阶梯底座, ordinary stepped mode, or using “custom” to imply a separate construction backend.

**CAD Stepped Construction**:
The Custom Stepped Tray modeling contract where each height band is generated from its own 2D sketch and then extruded before cuts are applied.
_Avoid_: Treating the unified stepped model as an arbitrary union of per-group solids or exposing this contract as a Mode choice.

**Stepped Layout Core**:
The stepped editing module that owns group and slot editing, undo history, outline preview, whole-model preview/export, base-hole derived fields, and layout optimization for `stepped`, while excluding split assembly orchestration.
_Avoid_: Letting the layout core own split preview, split export, split assembly groove, Locator Pin, or split merge lifecycle.

**Stepped Split Orchestration**:
The optional `stepped` capability that owns split-preview lifecycle and split-part export while composing the **Stepped Layout Core**.
_Avoid_: Treating split assembly as a separate Mode or making the layout core own its lifecycle.

**Split Assembly Capability**:
The optional, default-off Custom Stepped Tray capability that reveals split grouping, assembly features, split preview, and split-part export when enabled.
_Avoid_: A separate Mode, hiding ellipse slots with the capability, or showing its advanced controls in the default workflow.

**Dormant Split Configuration**:
The preserved split grouping and assembly settings that remain stored but have no effect while Split Assembly Capability is disabled.
_Avoid_: Clearing advanced settings when the capability is toggled off or applying hidden split settings to whole-model generation.

**Historical Simple Stepped Artifact**:
A legacy `simple-stepped` parameter file or Draft that remains readable only by conversion into the Stepped Tray workflow.
_Avoid_: A current runtime Mode, writing new `simple-stepped` artifacts, or retaining a separate simple-stepped modeling backend.

**Simple Stepped Model Capability**:
The ability to generate a Stepped Tray equivalent to the former row-based rectangular stepped model without preserving its row-management or automatic-layout workflow.
_Avoid_: Using “保留简易阶梯功能” to imply that row creation, automatic row placement, or uniform height progression must remain user-facing features.

**Rectangular Stepped Footprint**:
A Stepped Tray footprint whose lowest height layer is one continuous rectangle around all Slot Instances while each higher height band uses the rectangular envelopes of the groups that continue above it.
_Avoid_: Independent disconnected rectangles at the lowest layer, one full-size rectangle at every height, or treating the choice as only a visual edge treatment.

**Rectangular Footprint**:
A baseplate footprint bounded by one rectangular envelope, with an optional corner radius on its outer boundary.
_Avoid_: Using the term for each independent stepped height-group rectangle or assuming that every upper stepped band inherits the outer corner radius.

**Axis-aligned Rectangular Envelope**:
The tray-coordinate-aligned rectangle that contains the rotated final Slot Geometry Snapshots in scope plus Boundary Spacing.
_Avoid_: A minimum-area rotated rectangle, nominal unrotated base dimensions, or a rectangle whose orientation changes with Slot Instance rotation.

**Baseplate Footprint Style**:
The model-wide choice between a slot-following Contoured Footprint and a Rectangular Footprint for a custom or stepped tray.
_Avoid_: Per-group footprint styles, mixing rectangular and contoured groups in one tray, or calling the choice merely an edge shape.

**Contoured Footprint**:
A baseplate footprint derived from and following the placed Slot Instances rather than enclosing them in one rectangular boundary.
_Avoid_: Curved edge, rounded rectangle, or assuming that the footprint must remain connected across explicitly disconnected slot clusters.

**Contour Body Count**:
The number of disconnected printable bodies produced by a Contoured Footprint after its smoothing and disconnection rules are applied.
_Avoid_: Silently forcing distant slot clusters together or treating every multi-body result as invalid.

**Contoured Footprint Construction**:
The shared derivation of 2D contoured bodies from final Slot Geometry Snapshots, Boundary Spacing, smoothing radius, and disconnection distance.
_Avoid_: Mode-specific contour algorithms or independently re-deriving contours for preview, modeling, dimensions, body count, and validation.

**Dormant Fixed Tray Configuration**:
The preserved custom-tray fixed sizing choice and dimensions that have no effect while Contoured Footprint is selected and become active again when Rectangular Footprint is restored.
_Avoid_: Discarding fixed dimensions when switching footprint style or applying hidden fixed bounds to a contoured tray.

**Slot Spacing**:
The minimum intended edge-to-edge distance between Slot Instances, independently of their distance to the baseplate boundary.
_Avoid_: Using Slot Spacing as the only name for both inter-slot clearance and footprint margin.

**Boundary Spacing**:
The distance added from the outer Slot Instance profiles to the generated baseplate footprint, optionally configured independently from Slot Spacing.
_Avoid_: Row outer margin as a separate concept, or changing Slot Spacing when only the footprint margin should change.

**Split Assembly Groove Type**:
The mutually exclusive Custom Stepped Tray choice that decides which contact-face outline becomes the male/female split assembly groove profile.
_Avoid_: Treating groove types as stackable toggles.

**Profile Recess**:
A split assembly groove type where the upper male tenon uses the full upper contact-face outline, and the lower female recess uses that outline with assembly clearance clipped to the lower contact face.
_Avoid_: Locator recess, circular recess.

**Inset Recess**:
A split assembly groove type where the upper male tenon uses the upper contact-face outline inset inward by a fixed 1mm before the lower female recess is generated from that inset profile with assembly clearance.
_Avoid_: Treating it as profile recess plus an extra toggle.

**Split Interface Profile**:
The derived 2D split-interface contract for one Custom Stepped Tray contact height, including a contact footprint plus the corresponding male and female footprints used to build assembly geometry before 3D extrusion.
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
_Avoid_: Treating stored drafts as disposable implementation detail, or inferring a different Mode when their stored identity is ambiguous.

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

**Tray Result Projection**:
A read-only, mode-specific result derived once from normalized tray state for both the fixed result summary and its expanded details.
_Avoid_: Recomputing dimensions, weight, slot count, or mode-specific footprint semantics separately in summary and detail views.

**Effective Baseplate**:
The actual baseplate footprint derived from placed slots and boundary spacing, rather than the raw tray width/depth inputs.
_Avoid_: Using baseplate, tray size, or tray width/depth to mean the derived printable footprint in custom mode.

**Tray Sizing Mode**:
The Rectangular Footprint choice between deriving the lowest tray footprint from placed slots or keeping it at the configured width and depth.
_Avoid_: Applying fixed sizing to a Contoured Footprint or expanding stepped upper height bands to the fixed lowest-layer dimensions.

**Fixed Tray Outer Footprint**:
The bottom outer dimensions of a fixed custom tray, which remain unchanged when slots are added or moved.
_Avoid_: Using the upper edge size as the fixed size when a side bevel is present.

**Fixed Tray Footprint Area**:
The width-by-depth area of a **Fixed Tray Outer Footprint**, used as the custom tray's business footprint while fixed sizing is active.
_Avoid_: Naming or summarizing a fixed tray from only its occupied slot bounds.

**Slot Boundary Violation**:
A fixed-mode state where a slot's final profile crosses the usable upper footprint after side-bevel and boundary-spacing insets are applied.
_Avoid_: Treating a boundary violation as an automatic position correction or an export-blocking error.

**Random Slot Arrangement**:
A fixed custom tray operation that assigns new positions to all existing slot instances without changing their count, identity, geometry, or rotation.
_Avoid_: Treating random arrangement as adding, deleting, or redefining slots.

**Random Arrangement Result**:
An all-or-nothing candidate layout produced by a **Random Slot Arrangement** that either relocates every slot successfully or leaves the current layout unchanged.
_Avoid_: Applying a partially placed random layout.

**Layout Arrangement Proposal（布局编排建议）**:
A previewable candidate that aesthetically rearranges the tray's existing Slot Instances within the owning Mode's structural constraints before the user explicitly applies it.
_Avoid_: Random placement, silently reflowing slots after an ordinary add or manual edit, or treating the proposal as already committed editor state.

**Layout Arrangement Quality（布局编排质量）**:
The ordered business evaluation of a Layout Arrangement Proposal by validity, alignment rhythm, visual balance, compact whitespace, edge regularity, then original-position displacement.
_Avoid_: Treating minimum area, minimum movement, or one fixed aspect ratio as the sole meaning of an attractive layout.

**Height-band Footprint Cost**:
The footprint area, enclosed whitespace, and estimated material volume contributed by every height band under the active Baseplate Footprint Style.
_Avoid_: Evaluating a stepped arrangement only from the bounding box of all Slot Instances.

**Side Bevel**:
The continuous side-wall slope from the tray's bottom edge footprint to its top edge footprint. Its width is the horizontal inset from the lower edge to the upper edge.
_Avoid_: Treating it as a corner radius, slot clearance, stepped split groove, or a decorative 2D-only annotation.

**Effective Baseplate Area**:
The footprint area of the **Effective Baseplate**, calculated as derived width multiplied by derived depth.
_Avoid_: Using model volume or raw tray area when the meaning is the derived custom-mode footprint.

**Slot Count**:
The number of placed slot instances in the current tray layout.
_Avoid_: Mixing slot count with magnet-hole count or with distinct slot-size types.

**Grid Footprint Area**:
The grid-mode tray footprint area calculated from the displayed theoretical outer width and depth, including actual slot size, spacing, and boundary spacing.
_Avoid_: Using nominal hole diameter alone when the meaning is the printed footprint shown to the user.

## Relationships

- A **Slot Definition** includes its **Tolerance**.
- A circular **Slot Definition** records its **Final Slot Size** directly.
- An ellipse **Slot Definition** includes base width, base height, **Ellipse Outer Offset**, and **Ellipse Profile Exponent**.
- The `base-converter` **Mode** owns one editable **Conversion Base** at a time.
- A Conversion Base independently selects exactly one **Source Base Standard** and exactly one **Target Base Standard**.
- The first **Source Base Standard** set contains `20×20`, `25×25`, `40×40`, `25×50`, `50×75`, and `50×100` millimetres.
- The first **Target Base Standard** set contains `Ø25`, `Ø32`, `Ø50`, `35×60`, `42×75`, and `70×105` millimetres.
- Source and target standards are not stored as seven fixed pairs; a geometrically compatible source-target combination forms a Conversion Base.
- A source-target combination is compatible only when the final Conversion Recess remains smaller than the target footprint on both principal axes, preserving retaining material in all four cardinal directions.
- Equal outer width and depth produce a round **Conversion Base**; unequal dimensions produce an oval Conversion Base.
- A **Conversion Recess** preserves a floor and never cuts through the **Conversion Base**.
- A **Conversion Recess** may meet the outer footprint at its corners, leaving four separate arc-shaped retaining sectors as shown in the reference drawing instead of forcing a continuous rectangular wall.
- **Conversion Clearance** is `0.2mm` per side in the first release.
- Final **Conversion Recess** width and depth equal the selected Source Base Standard dimensions plus `0.4mm` per axis.
- A Conversion Base's total height equals its floor thickness plus its Conversion Recess depth.
- **Custom Stepped Tray** exposes all seven ellipse **Slot Definitions** already used by custom mode in addition to its circular definitions.
- A Custom Stepped Tray ellipse **Slot Instance** is created from the shared definition and snapshots its width, height, **Ellipse Outer Offset**, **Ellipse Profile Exponent**, and **Slot Definition ID** without maintaining a separate preset copy.
- A newly added Custom Stepped Tray ellipse starts at 0 degrees and uses the existing canvas rotation interaction; rotation changes placement geometry but does not redefine its **Slot Definition**.
- Custom Stepped Tray automatic placement uses the ellipse's final profile bounds and does not automatically rotate the ellipse to make it fit.
- Duplicating or symmetry-inserting a Custom Stepped Tray ellipse preserves its complete **Slot Geometry Snapshot** and rotation.
- Custom Stepped Tray preview, complete-model generation, and split-part generation consume the snapshot's **Ellipse Outer Offset** and **Ellipse Profile Exponent**, so their final ellipse profile matches custom mode.
- An **Old World Rectangular Slot Definition** records nominal width and depth, with each **Final Slot Size** axis 0.4mm larger than its nominal axis.
- An **Old World Grid Orientation** maps a rectangular slot’s width to grid columns and depth to grid rows.
- **Old World Ranked Base Spacing** derives centre pitch from nominal base dimensions while Final Slot Size supplies clearance around the ranked array.
- An **Old World Full-Slot Grid** uses complete **Old World Rectangular Slot Definitions** only.
- An **Old World Magnetic Hole Rule** uses the shorter nominal axis of an **Old World Rectangular Slot Definition**, including the dedicated 20mm hole for a 25mm short side.
- The **Old World Preset Set** contains exactly eleven official **Old World Rectangular Slot Definitions**.
- A **Grid Slot Definition Switch** preserves grid and base parameters while changing the selected Slot Definition and derived footprint.
- A grid tray has exactly one **Uniform Grid Slot Definition**.
- **Grid Draft Shape Compatibility** preserves circular geometry for legacy grid drafts and imports.
- An **Old World Rectangular Slot Definition** uses **Old World Rectangular Slot Corners**.
- A **Slot Instance** is created from exactly one **Slot Definition** and records its **Slot Definition ID**.
- A **Slot Instance** keeps a **Slot Geometry Snapshot** for reproducible generation.
- A **Slot Instance Factory** is the shared creation seam for writing **Slot Geometry Snapshots** onto new or imported **Slot Instances**.
- A **Param Normalization Pipeline** runs before imported or loaded params become runtime **Mode** params.
- **Legacy Param Migration** runs inside the **Param Normalization Pipeline** after required-field validation and before **Slot Instance** normalization.
- **Legacy Param Migration** owns old-shape compatibility repair, while the rest of the **Param Normalization Pipeline** owns validation, Slot Instance normalization, and derived-field clamping.
- A successful parameter-file parse produces exactly one **Import Candidate** before changing the active editor state.
- Only an external parameter-file import produces an **Import Candidate**; loading a Draft continues through **Draft Compatibility** without this confirmation flow.
- **Import Mode Resolution** runs before an **Import Candidate** is normalized.
- An external parameter-file import may start from any Mode's **Draft Action Area**, independently of the file's resolved target Mode.
- Every newly exported parameter file records its actual Mode as its declared Mode.
- New **Custom Stepped Tray** parameter files declare `stepped`; `stepped-cad` is read only as a historical Mode alias.
- Every newly written **Persisted Param Artifact** records exactly one actual **Mode** matching the editor workflow that owns its parameters.
- A **Mode Workspace Adapter** supplies the actual **Mode** for newly written **Persisted Param Artifacts**; downstream persistence Implementations do not infer it from parameter structure.
- A **Mode Workspace Adapter** captures one **Mode Param Snapshot** for a persistence operation.
- Capturing a **Mode Param Snapshot** copies the current normalized runtime parameters so later editor changes cannot alter an in-progress persistence operation.
- Model generation and its companion parameter encoding consume the same **Mode Param Snapshot**.
- A model export prepares one complete **Model Artifact Bundle** from one **Mode Param Snapshot** before triggering any browser download.
- Cached model geometry records a **Model Geometry Fingerprint** for the parameters that generated it.
- A complete-model export reuses cached geometry only when its **Model Geometry Fingerprint** matches the export's **Mode Param Snapshot**; otherwise it regenerates geometry from that Snapshot.
- A **Model Geometry Fingerprint** is transient model-lifecycle state and is not part of a **Persisted Param Artifact**.
- If any file in a **Model Artifact Bundle** cannot be prepared, the export triggers no downloads.
- A **Model Artifact Bundle** keeps its files separate and downloads them in a deterministic order after preparation succeeds.
- A **Model Artifact Bundle** owns companion parameter encoding, complete-file collection, preparation success, deterministic download triggering, and aggregated download-trigger failure reporting.
- Mode-specific model Implementations own geometry generation, STL serialization, model filenames, and optional companion content, then contribute their named files to the **Model Artifact Bundle**.
- A **Model Artifact Bundle** does not own model geometry algorithms, Mode-specific naming rules, companion artifact semantics, or preview-cache lifecycle.
- If a browser download trigger fails after bundle preparation, remaining files are still attempted because earlier browser downloads cannot be rolled back; the export reports the collected trigger failures afterward.
- Capturing a **Mode Param Snapshot** does not migrate, normalize, or perform business validation; an uncopyable runtime value is a program error rather than a compatibility error.
- Parameter export, model companion export, split-part companion export, Draft persistence, and Draft Summary construction consume a **Mode Param Snapshot** instead of independently selectable Mode and params arguments.
- A **Mode Param Snapshot** does not own browser storage, file naming, downloads, or historical read compatibility.
- A **Current Param Artifact Encoder** consumes a **Mode Param Snapshot** and writes only the current parameter format.
- A **Current Param Artifact Encoder** does not apply historical compatibility or change the Snapshot's Mode identity.
- A **Historical Param Artifact Reader** owns historical wrapper recognition and ambiguous Mode handling.
- A **Historical Param Artifact Reader** never converts parameter semantics between Modes; it may canonicalize the historical `stepped-cad` alias to the current `stepped` Mode.
- A **Historical Param Artifact Reader** consumes already-parsed unknown data and does not own browser File reading, JSON text parsing, or Draft storage access.
- External-file and Draft-source Adapters obtain parsed data and delegate wrapper recognition, version checks, Mode validation, ambiguity handling, and normalization to the same **Historical Param Artifact Reader** Implementation.
- An external-file Adapter may receive an **Import Candidate** or an Import Mode selection requirement, while a Draft-source Adapter receives normalized parameters for the Draft's stored Mode without creating an Import Candidate or Import Normalization Report.
- A **Historical Param Artifact Reader** reports invalid content, unsupported versions, invalid or conflicting Mode identity, unrecognized parameter structure, expected-Mode mismatch, and normalization failure as distinct **Param Artifact Read Error** codes.
- A **Param Artifact Read Error** retains a user-readable Chinese message and preserves an underlying normalization failure as its cause.
- A required Import Mode choice is a normal reader result rather than a **Param Artifact Read Error**.
- **Draft Compatibility** reads a Draft according to its stored Mode identity and canonicalizes historical `stepped-cad` Drafts into the current `stepped` Mode without changing their parameter semantics.
- Current-format writing and historical reading are separate Interfaces and Implementations.
- `stepped` is the sole runtime and newly persisted Mode identity for **Custom Stepped Tray** parameters, including ellipse and split-assembly capabilities.
- Historical `stepped` and `stepped-cad` identities both resolve to the current `stepped` Mode.
- A historical `stepped-cad` artifact without an explicit Split Assembly Capability field migrates with that capability enabled, preserving access to direct split workflows that left no assembly-feature fields behind.
- A historical `stepped` artifact without an explicit Split Assembly Capability field migrates with that capability disabled.
- Removing `stepped-cad` from new **Persisted Param Artifacts** does not change the parameter-file version or Draft storage version because their envelope shapes remain unchanged.
- Historical Mode aliases are handled by the **Historical Param Artifact Reader**, not by a version increase for this Mode identity consolidation.
- A companion artifact may declare its own file type without treating that file type as a **Mode**.
- Newly exported parameter files are not required to remain importable by older application versions.
- A historical parameter file declared as either `stepped` or `stepped-cad` resolves directly to the unified `stepped` Mode without asking the user to identify its original construction backend.
- A legacy parameter file without a declared Mode uses structural inference only when exactly one Mode matches.
- A legacy parameter file whose structure matches the former ordinary and CAD stepped Modes resolves directly to the unified `stepped` Mode because those identities are no longer distinct.
- A declared Mode that conflicts with the parameter structure produces an import error and is not silently replaced by an inferred Mode.
- An **Import Candidate** exists only after parsing, required-field validation, and the full **Param Normalization Pipeline** succeed.
- A parameter file that cannot be safely normalized produces an import error and cannot be partially confirmed.
- An **Import Candidate** includes the normalized Mode parameters and one **Import Normalization Report** derived from the same normalization run.
- An **Import Candidate** targets the Mode identified by the imported parameter file rather than the currently active Mode.
- An external parameter-file import does not convert parameters between Modes; Mode conversion requires a separate explicit operation.
- Confirming an **Import Candidate** switches to its target Mode and replaces that Mode's parameters as one import action.
- The same normalization rules that produce an **Import Candidate** also record its **Import Normalization Report**; a separately reconstructed report is not authoritative.
- Every successful parameter-file import presents its **Import Normalization Report** for confirmation, including imports that require no compatibility adjustments.
- An **Import Normalization Report** with no adjustments explicitly states that the imported parameters can be used without compatibility changes.
- An **Import Normalization Report** groups adjustments as applied defaults, legacy-field migrations, value adjustments, and behavior changes.
- An import that changes the active Mode is displayed prominently before its field-level adjustments, including the current Mode, target Mode, and resulting workspace change.
- An **Import Normalization Report** prominently warns when confirmation will replace existing target-Mode edits, identifies **Unsaved Draft Changes**, and states that the target **Draft Binding** will be cleared.
- An **Import Normalization Report** compares imported parameters with current normalized parameters without implying a parameter-file version upgrade.
- Each user-facing adjustment identifies the previous or missing value, the normalized value, and why the adjustment was required.
- A finite value outside the current allowed range may be adjusted to the nearest valid value when the report identifies its original value, normalized value, and allowed range.
- A value with an invalid type, a non-finite number, or no safe interpretation prevents creation of an **Import Candidate**.
- Repeated technical adjustments may be aggregated in the user-facing report, while exact field paths remain available in collapsible technical details.
- A legacy field with a current equivalent is reported as a field migration, while a **Retired Import Field** is listed as ignored with no replacement.
- A **Retired Import Field** is recognized only to explain the import and is never retained in the **Import Candidate**.
- An **Import Normalization Report** is read-only; imported values are edited through the normal Mode editor only after confirmation.
- An **Import Normalization Report** belongs only to its **Import Candidate** and is not stored in a Draft or exported parameter file.
- Confirming an **Import Candidate** commits its normalized parameters as one import action.
- Confirming an **Import Candidate** clears the target Mode's **Draft Binding** after its normalized parameters are committed.
- A confirmed external parameter-file import is not added to Mode undo history.
- Cancelling an **Import Candidate** leaves the active Mode, active parameters, **Mode Interaction State**, and **Draft Binding** unchanged.
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
- A newly saved **Custom Stepped Tray** Draft belongs to `stepped` and uses the `stepped` Draft storage space.
- Existing `stepped` and `stepped-cad` Drafts are both listed in the unified **Custom Stepped Tray** workspace.
- Saving a historical `stepped-cad` Draft writes it to the current `stepped` Draft storage space while preserving its parameters.
- A **Manual Draft Save** does not imply autosave or session recovery.
- The current editor state may keep a **Draft Binding** even when there are unsaved edits.
- **Unsaved Draft Changes** may exist while a **Draft Binding** still exists.
- A **Draft Summary** belongs to the same **Mode** as its **Draft**.
- A **Draft Summary** may be mode-specific rather than globally uniform across all modes.
- A grid **Draft Summary** may show row/column count, structure mode, base size, and resulting width/depth.
- A custom **Draft Summary** may show slot count and resulting width/depth.
- A stepped **Draft Summary** may show group count, slot count, and resulting width/depth.
- A historical `simple-stepped` **Draft Summary** resolves to `stepped` after conversion and reports its converted group count, slot count, and resulting width/depth.
- A historical `stepped-cad` **Draft Summary** resolves to `stepped` while preserving its group count, slot count, and resulting width/depth fields.
- Draft titles may be duplicated within the same **Mode**.
- A **Draft Index** stores **Draft Summary** entries, while full draft records store full mode parameters.
- Draft limits may be enforced per **Mode**, not only globally.
- **Draft Compatibility** applies to already-saved browser drafts, especially existing stepped drafts.
- A draft record key may be mode-scoped while the **Draft Index** remains shared.
- A **Draft Manager Dialog** may be shared across modes while rendering mode-specific summaries.
- A **Draft Manager Dialog** may show drafts for the current **Mode** only.
- A **Draft Manager Dialog** labels historical `stepped-cad` Draft Summaries as **Custom Stepped Tray** Drafts after canonicalization.
- A **Draft Action Area** should remain broadly consistent across modes.
- A **Mode Workspace** may own a **Mode**'s **Draft Binding**, **Draft Action Area** inputs, parameter panel inputs, and reset/import side effects.
- A **Mode Workspace** should not own viewport-specific 2D/3D editing details unless those details become shared across modes.
- A **Mode Workspace Adapter** implements the shared **Mode Workspace** interface for one **Mode**.
- A **Mode Workspace Registry** selects the active **Mode Workspace Adapter** for the current **Mode**.
- **Mode Interaction State** belongs to one active **Mode** editing workflow, not to the page shell or a registry.
- A **Mode Workspace** and **Mode Viewport Workspace** may share **Mode Interaction State** when left-panel controls and viewport interactions both read or write the same transient editor state.
- A **Stepped Layout Core** owns behavior shared by whole-model and split-enabled editing while excluding split-assembly-specific lifecycle.
- **Stepped Split Orchestration** composes the **Stepped Layout Core** rather than being owned by it.
- **Stepped Split Orchestration** owns split-preview generation, invalidation, disposal, and split-part export within `stepped`.
- **Stepped Split Orchestration** reuses the **Stepped Layout Core** group action when it changes a group's split-part target.
- **Simple Stepped Model Capability** requires model equivalence through the Stepped Tray workflow, not preservation of the former simple-stepped editing workflow.
- A **Historical Simple Stepped Artifact** maps each ordered row to one height group and projects row-local Slot Instances into global stepped-layout coordinates.
- A converted **Historical Simple Stepped Artifact** uses a fixed Rectangular Stepped Footprint, preserves its stored tray dimensions, outer corner radius, slot depth, and Base-hole Structure, and disables Split Assembly Capability by default.
- Row gap is represented by the converted Slot Instance positions and is not retained as a current stepped parameter.
- Current saves, Drafts, and exports never write the historical `simple-stepped` Mode identity.
- Empty historical simple-stepped rows create no height group and consume no height step during conversion.
- Historical simple-stepped conversion preserves non-empty row order, Slot Instance centers and final geometry, tray dimensions, lowest-layer corner radius, height-band tops, slot depth, Base-hole Structure, printable-body count, and manufacturability.
- Historical simple-stepped conversion allows at most 0.1mm error in key linear dimensions and 1% model-volume difference.
- Historical simple-stepped compatibility does not require identical STL bytes, triangle counts, boolean topology, or facet ordering.
- Before removing the simple-stepped backend, rectangular stepped generation is compared against it using 10-, 30-, and 50-slot fixtures plus at least two Historical Simple Stepped Artifacts.
- Migration performance uses three post-warm-up measurements per fixture; the median fixture ratio must not exceed 1.25 and no fixture ratio may exceed 1.5.
- A failed migration gate requires optimizing rectangular height-band construction before backend removal; a passed gate removes the legacy backend and temporary comparison benchmark without a runtime fallback.
- Existing and newly created custom trays default to Rectangular Footprint when no Baseplate Footprint Style is recorded.
- Existing and newly created stepped trays default to Contoured Footprint when no Baseplate Footprint Style is recorded.
- Converted Historical Simple Stepped Artifacts explicitly use Rectangular Stepped Footprint.
- Baseplate Footprint Style is selected explicitly and is never inferred from Slot Instance positions.
- Split Assembly Capability is available for both Contoured Footprint and Rectangular Stepped Footprint.
- Split interfaces use the contact footprint produced by the active Baseplate Footprint Style at that height.
- A fixed lowest Rectangular Footprint does not expand higher split-interface footprints beyond their group-derived rectangular envelopes.
- Changing Baseplate Footprint Style invalidates whole-model and split previews while preserving Dormant Split Configuration.
- A **Rectangular Stepped Footprint** keeps the lowest layer connected even when height groups have planar gaps.
- Each higher band of a **Rectangular Stepped Footprint** is the union of the rectangular envelopes of groups whose required heights extend through that band.
- Only the continuous lowest layer of a **Rectangular Stepped Footprint** uses the model-level outer corner radius; higher group envelopes retain square corners.
- A **Rectangular Stepped Footprint** may use automatic sizing from all Slot Instances or a Fixed Tray Outer Footprint for its continuous lowest layer.
- Fixed sizing changes only the continuous lowest layer; higher rectangular height bands remain derived from their groups' Slot Instances and Boundary Spacing.
- Automatic lowest-layer and group-level rectangular footprints use **Axis-aligned Rectangular Envelopes**.
- Each height group's Axis-aligned Rectangular Envelope contains all of that group's Slot Instances as one rectangle, including the empty planar space between them.
- One tray has exactly one **Baseplate Footprint Style**; height groups cannot override it.
- A custom tray with **Contoured Footprint** always derives its active footprint from Slot Instances and cannot simultaneously have an active **Fixed Tray Outer Footprint**.
- Selecting **Contoured Footprint** preserves any fixed sizing choice and dimensions as **Dormant Fixed Tray Configuration**.
- The stepped workflow also preserves fixed sizing as dormant configuration while Contoured Footprint is selected.
- Historical simple-stepped tray dimensions can be represented by a fixed Rectangular Stepped Footprint without expanding its higher group envelopes.
- Custom and stepped trays use **Boundary Spacing** to derive automatic rectangular or contoured footprints while **Slot Spacing** remains responsible for inter-slot clearance and stepped connectivity.
- When independent **Boundary Spacing** is disabled, it follows **Slot Spacing**.
- Historical stepped parameters without an independent **Boundary Spacing** choice load with Boundary Spacing following Slot Spacing.
- Stepped smoothing and disconnection settings remain stored but have no effect while Rectangular Stepped Footprint is active.
- A custom tray's outer corner radius remains stored but has no effect while Contoured Footprint is active.
- A custom tray's Side Bevel remains stored but has no effect while Contoured Footprint is active.
- Contoured Footprint does not support Side Bevel until arbitrary-outline bevel construction has its own narrow-bridge, concavity, and body-connectivity validity rules.
- Custom and stepped editors always expose Baseplate Footprint Style, Slot Spacing, and Boundary Spacing.
- Editors show only controls that affect the active Baseplate Footprint Style while preserving inactive-style values as dormant configuration.
- Custom Rectangular Footprint exposes sizing, dimensions, outer corner radius, and Side Bevel; Custom Contoured Footprint exposes smoothing, disconnection, and Contour Body Count.
- Stepped Contoured Footprint exposes global and group smoothing and disconnection; Rectangular Stepped Footprint exposes sizing, dimensions, and the lowest-layer outer corner radius.
- Split Assembly Capability remains visible for both stepped footprint styles.
- Changing Baseplate Footprint Style updates the 2D footprint immediately and marks existing whole-model and split previews stale.
- Custom and stepped Contoured Footprints share smoothing and disconnection semantics and may deliberately produce more than one printable body.
- Given the same Slot Instances and contour parameters, custom and stepped workflows receive identical 2D bodies from **Contoured Footprint Construction**.
- 2D preview, 3D construction, dimensions, Contour Body Count, and base-hole edge validation consume the same Contoured Footprint Construction result.
- Custom trays initially use a 60mm smoothing radius and 0mm disconnection distance; those values remain stored while Rectangular Footprint is active.
- A multi-body **Contour Body Count** does not block model generation or export, but must be visible in preview and result summary.
- Base-hole fit validation evaluates each disconnected contoured body against its own exterior edges.
- A **Mode Viewport Workspace** may own a **Mode**'s viewport wiring, preview-view switching, and viewport-only transient state.
- A **Mode Viewport Workspace** should not own left-panel parameter editing or **Draft Binding** rules.
- A **Mode Viewport Workspace Adapter** implements the shared **Mode Viewport Workspace** interface for one **Mode**.
- A **Mode Viewport Workspace Registry** selects the active **Mode Viewport Workspace Adapter** for the current **Mode**.
- A **Layout Editor Viewport** is the shape consumed by the layout canvas for 2D editing.
- A **Layout Editor Viewport Adapter** projects a **Mode**'s local layout state into a **Layout Editor Viewport**.
- A layout canvas should consume a **Layout Editor Viewport** instead of inferring **Mode** behavior from raw parameters.
- A **Tray Result Projection** belongs to exactly one **Mode** editor state.
- A fixed result summary and its expanded details consume the same **Tray Result Projection** instance.
- A **Tray Result Projection** preserves **Slot Count**, build-limit, generation, and preview-staleness facts independently rather than collapsing them into one lifecycle state.
- A custom **Tray Result Projection** distinguishes an **Effective Baseplate** from a **Fixed Tray Outer Footprint**.
- A grid **Tray Result Projection** uses the **Grid Footprint Area** shown to the user.
- A Custom Stepped Tray **Tray Result Projection** reuses the **Stepped Layout Core** result and does not expose split-assembly-only behaviour as ordinary tray statistics.
- A **Stepped Tray** with the same circular Slot Instances, height groups, and non-split parameters has the same intended final tray semantics regardless of its internal construction algorithm.
- A **Stepped Tray** user chooses tray capabilities such as ellipse slots or split assembly, not the internal solid-construction algorithm.
- **Custom Stepped Tray** is the only user-visible top-level Mode for manually arranged stepped trays; ellipse slots and split assembly appear as capabilities within it.
- **CAD Stepped Construction** remains an internal modeling contract and is not a user-facing Mode name.
- **CAD Stepped Construction** is the sole authoritative whole-model backend for **Custom Stepped Tray** after migration validation; the former per-group solid backend is not retained as a runtime fallback.
- Historical ordinary-stepped fixtures remain regression inputs for critical dimensions, slot placement, height bands, connectivity, and printability rather than selecting a legacy backend.
- **Split Assembly Capability** is disabled and collapsed by default; enabling it reveals split merge targets, groove settings, Locator Pins, split preview, and split-part export.
- Ellipse Slot Definitions belong to **Custom Stepped Tray** itself and remain available independently of **Split Assembly Capability**.
- Disabling **Split Assembly Capability** preserves a **Dormant Split Configuration**, disables split preview and export, and prevents those settings from affecting whole-model generation.
- Re-enabling **Split Assembly Capability** restores its **Dormant Split Configuration**.
- A historical ordinary-stepped artifact loaded into the unified **Stepped Tray** workflow preserves its slot dimensions and positions, group heights, recess depths, intended footprint, and printability, but does not preserve STL facets, exact volume, or internal solid topology.
- In custom mode, the **Effective Baseplate** is derived from placed **Slot Instances** plus boundary spacing.
- A Rectangular Footprint **Tray Sizing Mode** is either automatic, which derives its lowest footprint from Slot Instances, or fixed, which uses the configured tray width and depth for the lowest footprint.
- In fixed custom **Tray Sizing Mode**, **Slot Instances** use the fixed tray's lower-left corner as their layout origin.
- Changing a custom **Tray Sizing Mode** preserves each **Slot Instance** position and does not silently reflow the layout.
- A custom tray retains configured width and depth while in automatic **Tray Sizing Mode**, so switching back to fixed mode restores the chosen size.
- A custom configuration that does not record a **Tray Sizing Mode** is treated as automatic to preserve legacy behavior.
- A **Tray Sizing Mode** is an optional additive custom configuration field and does not require a parameter-file version change.
- **Tray Sizing Mode** applies to custom Rectangular Footprint and Rectangular Stepped Footprint; it remains dormant while either workflow uses Contoured Footprint.
- A fixed custom tray's configured width and depth define its **Fixed Tray Outer Footprint**.
- A **Side Bevel** reduces the fixed tray's upper usable footprint inward from its **Fixed Tray Outer Footprint**, while boundary spacing is measured from that upper edge.
- A fixed tray's upper usable footprint follows its rounded-corner geometry, so a **Slot Boundary Violation** may occur at a corner even when a slot fits within the enclosing rectangle.
- A fixed-mode **Slot Boundary Violation** is visibly reported but does not prevent model generation or export.
- A **Slot Boundary Violation** is shown as persistent canvas status and error count feedback, not as an interrupting confirmation or transient message.
- A **Fixed Tray Footprint Area** belongs to exactly one **Fixed Tray Outer Footprint**.
- A fixed custom tray's displayed dimensions, exported file name, and **Draft Summary** use its **Fixed Tray Outer Footprint** and **Fixed Tray Footprint Area**.
- A fixed custom tray may have zero **Slot Instances** and can still be generated or exported as an empty tray using its **Fixed Tray Outer Footprint**.
- A **Random Slot Arrangement** applies only to the existing **Slot Instances** of a fixed custom tray and preserves each slot's identity, geometry, and rotation.
- A successful **Random Slot Arrangement** has no **Slot Boundary Violations** and no slot-overlap or slot-spacing collision.
- A **Random Slot Arrangement** searches positions at 0.1mm precision, placing larger slot footprints before smaller ones.
- A **Random Arrangement Result** is atomic: failure preserves every current slot position, while success replaces every slot position as one undoable edit.
- Repeating a successful **Random Slot Arrangement** produces a fresh candidate layout; no random seed is stored in a Draft or exported parameter file.
- A **Random Slot Arrangement** reports its success or capacity failure as action feedback, while ordinary **Slot Boundary Violations** remain persistent canvas status rather than transient feedback.
- A **Layout Arrangement Proposal** is distinct from a **Random Slot Arrangement** and is generated only when the user explicitly requests arrangement.
- Generating a **Layout Arrangement Proposal** does not change the current layout; applying a selected proposal replaces Slot Instance positions as one explicit action.
- Adding or manually editing a Slot Instance never implicitly regenerates or applies a **Layout Arrangement Proposal**.
- Custom and **Custom Stepped Tray** Modes support **Layout Arrangement Proposals** because each owns manually positionable Slot Instances.
- Grid Mode and Conversion Base Mode do not support **Layout Arrangement Proposals** because neither owns a freely arranged set of Slot Instances.
- Custom Mode supports **Layout Arrangement Proposals** in both automatic and fixed **Tray Sizing Modes**; a fixed-size proposal must keep every Slot Instance within the existing **Fixed Tray Outer Footprint**.
- A **Layout Arrangement Proposal** evaluates all participating Slot Instances as one arrangement set and does not preserve stepped-group boundaries as layout partitions.
- In stepped workflows, every Slot Instance retains its required group identity while a **Layout Arrangement Proposal** ignores those identities as arrangement partitions and leaves them unchanged.
- A stepped workflow needs no unassigned or staging Slot Instance state; after applying a proposal, the user may manually revise group assignments from the arranged positions.
- A stepped **Layout Arrangement Proposal** remains a free arrangement across all Slot Instances and does not restore row constraints for Rectangular Stepped Footprint.
- Stepped proposal scoring derives dimensions, build-limit state, and **Height-band Footprint Cost** from the active Baseplate Footprint Style.
- Rectangular stepped scoring penalizes large group envelopes and enclosed whitespace so same-group Slot Instances tend to remain spatially concentrated without becoming a hard layout partition.
- A candidate with a slot collision, insufficient spacing, fixed-footprint boundary violation, or base-hole manufacturing violation is not a valid **Layout Arrangement Proposal**.
- **Layout Arrangement Quality** compares valid candidates in this order: alignment rhythm, visual balance, compact whitespace, edge regularity, then original-position displacement.
- Automatic custom sizing rewards compact use of area, while fixed custom sizing preserves the **Fixed Tray Outer Footprint** and rewards balanced whitespace within it.
- **Layout Arrangement Quality** derives a suitable footprint from the participating Slot Instances and owning Mode constraints rather than targeting a fixed width-to-depth ratio.
- A **Side Bevel** keeps the upper edge as the slot boundary-spacing reference and expands the lower edge outward by the configured bevel width.
- A 2D view that displays a **Side Bevel** should keep the ordinary tray outline for the lower edge and mark only the inset upper edge.
- An **Effective Baseplate Area** belongs to exactly one **Effective Baseplate**.
- A **Grid Footprint Area** belongs to exactly one grid tray footprint derived from the displayed outer width and depth.
- Loading a different draft replaces the current **Draft Binding**.
- Saving as a new draft replaces the current **Draft Binding** with the new draft.
- Deleting the currently bound draft clears the current **Draft Binding**.
- Deleting a draft should use an explicit confirmation step.
- Resetting to default parameters clears the current **Draft Binding**.
- Importing an external parameter file clears the current **Draft Binding**.
- Multiple layout modes may expose different subsets of **Slot Definitions**.
- When two modes expose the same **Slot Definition**, they must use the same geometry.
- Grid, custom, and stepped modes all expose the 100mm circular **Slot Definition**.
- The 100mm circular **Slot Definition** has a 100mm **Base Size** and a 100.4mm **Final Slot Size**.
- A **Base Size** is not enough to reproduce a slot unless its **Tolerance** and shape-specific geometry are also known.
- A **Magnet Post Hole** applies to every supported Slot Instance shape, including Old World rectangular slots, and starts at each slot floor rather than using the automatically matched **Magnetic Base Hole** geometry.
- Every Mode that supports a **Magnetic Base Hole** uses the same **Magnetic Base Hole Matching Rule**.
- Each Slot Instance independently applies the **Magnetic Base Hole Matching Rule**, so one tray or stepped group may contain 20mm, standard, and large Magnetic Base Hole presets.
- A Base-hole Structure editor shows the selected Slot Instance's matched Magnetic Base Hole preset and summarizes every preset currently used by the tray; it never describes a stepped group's largest slot as the shared preset.
- One tray uses one shared **Magnet Post Hole** diameter and depth for all of its Slot Instances, without per-group or per-slot overrides.
- A **Magnet Post Hole** diameter is explicitly configurable from 1mm through 15mm in every supporting Mode.
- A **Magnet Post Hole** depth is explicitly configurable from 0.5mm through 3mm in every supporting Mode.
- A **Magnet Post Hole Fit Violation** identifies every incompatible Slot Instance and blocks model generation and export until the diameter or layout is corrected.
- A **Magnetic Base Hole Fit Violation** identifies every incompatible Slot Instance and blocks model generation and export until its surrounding material, position, or Base-hole Structure is corrected.
- A **Magnetic Base Hole** retains at least 0.6mm of solid side wall from every exterior or disconnected body edge throughout the cavity depth.
- Two distinct **Magnetic Base Holes** retain at least 0.6mm of solid separating wall; insufficient separation marks every involved Slot Instance with a **Magnetic Base Hole Fit Violation**.
- A **Magnetic Base Hole Fit Violation** is a manufacturing error distinct from a warning-only **Slot Boundary Violation**.
- A base-hole fit violation does not reject an imported artifact or prevent saving a Draft, so the owning Mode can retain and repair the layout.
- Import and Draft loading preserve the selected Base-hole Structure and Slot Instance positions when a base-hole fit violation exists; they never disable the hole, resize it, or move a slot implicitly.
- A loaded base-hole fit violation remains visible in the editor and continues to block model generation and export until repaired.
- A base-hole fit violation is not an **Import Normalization Report** entry and does not add another import confirmation step; it appears only in the owning Mode editor after an Import Candidate is accepted.
- Grid, custom, and Custom Stepped Tray Modes expose the same mutually exclusive Base-hole Structure choices and the same Magnet Post Hole diameter and depth controls; Conversion Base exposes none of them.
- A supporting Mode displays every base-hole fit violation persistently beside its Base-hole Structure controls, keeps 2D editing and Draft persistence available, and disables model generation and export with a visible reason until all such violations are repaired.
- Enabling a **Magnet Post Hole** raises each affected stepped group as needed to preserve the configured recess depth and at least 1mm of material beneath it.
- A selected **Magnetic Base Hole** requires its preset cavity depth plus 0.6mm top wall and 0.6mm bottom wall: 2.2mm for the 20mm preset and 2.4mm for the standard or large preset.
- A selected **Magnet Post Hole** requires **Base-hole Supporting Thickness** equal to its configured depth plus at least 1mm beneath it.
- Selecting a Base-hole Structure automatically raises grid and custom base thickness or affected stepped group heights until the required **Base-hole Supporting Thickness** exists.
- A selected Base-hole Structure must be present in generated geometry and must never silently degrade to no hole because supporting material is insufficient.
- An imported parameter artifact that requires automatic supporting-thickness adjustment reports that adjustment in its **Import Normalization Report**.
- A **Conversion Base** is a thin-bottom model and supports neither a **Magnetic Base Hole** nor a **Magnet Post Hole**.
- Selecting **Magnetic Base Plate Only** selects **Magnetic Base Hole** and disables half-circle slots.
- Selecting no base hole or **Magnet Post Hole** while **Magnetic Base Plate Only** is active restores the grid's complete slot structure.
- Grid, custom, and Custom Stepped Tray Modes each persist exactly one **Base-hole Structure** plus the shared **Magnet Post Hole** diameter and depth values.
- A legacy `enableBaseHole` value migrates to **Magnetic Base Hole** when true and no base hole when false; newly written Persisted Param Artifacts do not retain that legacy field.
- A new grid tray defaults to **Magnetic Base Hole**, while new custom and Custom Stepped Tray trays default to no base hole.
- A historical tray artifact with neither a Base-hole Structure nor a legacy `enableBaseHole` defaults to no base hole so import never adds a manufacturing hole implicitly.
- A historical grid artifact marked as **Magnetic Base Plate Only** always migrates to **Magnetic Base Hole**, even when its legacy magnetic-hole switch is absent.
- A tray selects exactly one **Base-hole Structure**.
- **CAD Stepped Construction** builds one extruded body per height band.
- **CAD Stepped Construction** applies slot holes and the selected **Base-hole Structure** after the stepped height bands are assembled.
- A Custom Stepped Tray split part has at most one active **Split Assembly Groove Type**.
- A **Profile Recess** uses the full upper contact-face outline as the male tenon profile.
- The user-facing label for **Profile Recess** is "轮廓凹槽".
- An **Inset Recess** uses the upper contact-face outline after a fixed 1mm inward inset as the male tenon profile.
- The user-facing label for **Inset Recess** is "内缩凹槽".
- A **Split Interface Profile** belongs to exactly one Custom Stepped Tray contact height.
- A **Split Interface Profile** includes a contact footprint, a male footprint, and a female footprint.
- A Custom Stepped Tray split body must consume profile-derived body, recess-shell, and tenon bands instead of re-deriving male or female geometry from finished 3D solids.
- **Split Interface Profile** is the sole source of male and female footprint geometry used by Custom Stepped Tray split body generation.
- A **Profile Recess** derives its male footprint from the full contact footprint.
- An **Inset Recess** derives its male footprint from the contact footprint after a fixed 1mm inward inset.
- If an **Inset Recess** profile becomes empty after inset, that interface generates no male tenon or female recess.
- If an **Inset Recess** profile separates into multiple islands after inset, each island remains part of the split assembly profile.
- Imported historical `stepped-cad` data with split assembly enabled but no explicit **Split Assembly Groove Type** uses **Profile Recess**.
- A **Locator Pin** may be enabled alongside either **Profile Recess** or **Inset Recess**.

## Example Dialogue

> **Dev:** "Can grid mode and stepped mode both offer a 40mm circular slot?"
> **Domain expert:** "Yes, and if they do, both must use the same slot definition, including the same clearance."
>
> **Dev:** "Does the 100mm option generate a 100mm hole?"
> **Domain expert:** "No. It fits a 100mm base and generates a 100.4mm final slot after tolerance."
>
> **Dev:** "Can Custom Stepped Tray generate each group as a full-height solid and union them?"
> **Domain expert:** "No. Its internal CAD Stepped Construction should generate the sketch for each height band, extrude that band, then apply the holes."
>
> **Dev:** "Can profile recess and inset recess both be enabled on the same split part?"
> **Domain expert:** "No. They are alternative split assembly groove types; locator pins are the optional add-on."
>
> **Dev:** "Does enabling split assembly create another Mode?"
> **Domain expert:** "No. Split preview and split-part export belong to Stepped Split Orchestration, an optional capability that composes the Stepped Layout Core."
>
> **Dev:** "Should adding another slot automatically rearrange the layout?"
> **Domain expert:** "No. The user explicitly requests a Layout Arrangement Proposal, previews it, and chooses whether to apply it before continuing manual edits."

## Flagged Ambiguities

- "凹槽定义" previously meant either a visible UI option or the generated hole geometry. Resolved: **Slot Definition** means the complete reusable geometry definition, including tolerance.
- "方底盘" was used for both square and rectangular Old World bases. Resolved: use **Old World Rectangular Slot Definition** for the family, including square dimensions as a special case.
- "30×60" could mean either grid orientation. Resolved: the first dimension follows X-axis columns and the second follows Y-axis rows.
- "半圆槽" could be mistaken for a generic grid feature. Resolved: it applies only to circular Slot Definitions, never to an **Old World Full-Slot Grid**.
- "矩形磁吸孔规格" could be chosen from either side. Resolved: use the shorter nominal side, and select the large magnet only above 40mm.
- "旧世界方底盘模式" might imply arbitrary rectangular dimensions. Resolved: grid mode exposes only the eleven-size **Old World Preset Set** and groups it as "旧世界方形/矩形底盘".
- "切换底盘类型" could imply resetting the layout. Resolved: a **Grid Slot Definition Switch** preserves grid and base parameters.
- "网格模式" could imply arbitrary mixed base layouts. Resolved: a grid tray has one **Uniform Grid Slot Definition**; mixed layouts belong to custom mode.
- "旧版网格配置" could be interpreted as an Old World layout after the feature is added. Resolved: **Grid Draft Shape Compatibility** keeps it circular unless it explicitly selects a non-circular Slot Definition.
- "矩形凹槽圆角" could be conflated with the tray’s outer corner radius. Resolved: **Old World Rectangular Slot Corners** are straight 90-degree corners.
- "底盘" was ambiguous between raw tray width/depth inputs and the derived printable footprint in custom mode. Resolved: use **Effective Baseplate** for the derived custom-mode footprint.
- "固定托盘大小" could mean a canvas-only frame or the generated model footprint. Resolved: fixed **Tray Sizing Mode** uses the configured width and depth as the final generated tray footprint.
- "固定尺寸" could mean the bottom outer edge or the side-bevel-inset upper edge. Resolved: it means the **Fixed Tray Outer Footprint**.
- "凹槽越界" could mean a hard editing constraint or a warning-only state. Resolved: use **Slot Boundary Violation** for a red, warning-only state that keeps generation and export available.
- "随机排列" could mean arbitrary positions that may require manual repair. Resolved: use **Random Slot Arrangement** only for an all-valid layout that satisfies both fixed-boundary and slot-spacing constraints.
- "自动优化布局" was used for both random placement and an automatically committed reflow. Resolved: use **Layout Arrangement Proposal** for an explicitly requested, previewed candidate that remains unapplied until the user confirms it.
- "几种自定义布局" could mean only Custom Mode or every Mode with manually positioned Slot Instances. Resolved: **Layout Arrangement Proposals** apply to custom and **Custom Stepped Tray** Modes, but not grid or Conversion Base Modes.
- "按分组优化" could mean that existing rows or groups constrain aesthetic arrangement. Resolved: a **Layout Arrangement Proposal** arranges all participating Slot Instances together while preserving—but not partitioning by—their existing row or group identities; the user may revise those identities afterward.
- "美观布局" could mean the smallest area, the least movement, or a fixed wide rectangle. Resolved: **Layout Arrangement Quality** first requires a valid layout, then prioritises alignment rhythm, visual balance, compact whitespace, edge regularity, and finally original-position displacement.
- "保留简易阶梯功能" could mean preserving either its generated model or its row-based editing workflow. Resolved: preserve **Simple Stepped Model Capability** only; row management and automatic row layout need not remain user-facing.
- Grid-mode "面积" means **Grid Footprint Area**, derived from the displayed outer width and depth.
- "CAD 阶梯模式生成" could mean either per-group solid union or band-by-band CAD construction. Resolved: use **CAD Stepped Construction**, which generates each height band from a sketch before extrusion.
- "自定义阶梯" and "CAD 阶梯" could imply two user-visible tray products distinguished by their construction algorithms. Resolved: both describe one **Stepped Tray** workflow; identical circular, non-split inputs are intended to produce the same tray semantics, while ellipse and split assembly are capabilities rather than separate tray kinds.
- "CAD 阶梯底座" could imply that users must understand the modeling implementation before choosing a workflow. Resolved: the only user-facing name is **Custom Stepped Tray（自定义阶梯底座）**; CAD remains internal terminology.
- "兼容旧阶梯文件" could mean reproducing the old generated mesh exactly. Resolved: compatibility preserves manufacturing semantics and critical dimensions, not STL bytes, facets, exact volume, or construction topology.
- "内缩凹槽" could mean an extra toggle layered on top of "轮廓浅槽". Resolved: use **Inset Recess** as a mutually exclusive **Split Assembly Groove Type**.
- "Mode conversion" was used for both switching to a file's Mode and changing one Mode's parameter semantics into another. Resolved: external import switches to the file's Mode without converting its parameters; parameter conversion is a separate explicit operation.
- "磁铁桩位" could mean either a solid locating post or a recess for a magnet. Resolved: use **Magnet Post Hole（磁铁桩孔）** for the cylindrical recess cut downward from a slot floor; it is never a solid protruding post.

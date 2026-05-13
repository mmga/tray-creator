# Unified Slot Definitions Design

## Goal

Unify tray slot definitions across grid, custom, simple stepped, and stepped modes so the same visible slot option always uses the same underlying geometry.

## Decisions

- Slot definitions are the source of truth for supported round and ellipse options.
- Round definitions store both nominal base diameter and final generated slot diameter.
- Ellipse definitions store nominal width, nominal height, outer offset, and profile exponent.
- Slot instances store a stable `slotDefinitionId` when the slot matches a known definition.
- Slot instances also store geometry snapshots used for generation, so saved trays do not silently change when definitions change.
- Model generation uses the slot instance geometry snapshot, not `slotDefinitionId` lookup.
- Legacy data without `slotDefinitionId` is conservatively matched to definitions. If no definition matches, the stored geometry remains valid.

## Implementation Shape

- Add a shared slot definition module for round and ellipse definitions.
- Derive existing UI option lists from the shared definition module.
- Add snapshot fields to grid, custom, stepped, and simple stepped parameter shapes.
- Normalize imported parameters by filling missing definition IDs and snapshots where safe.
- Keep existing nominal size fields for UI display and compatibility.

## Compatibility

Existing exported files remain version `1`. Missing snapshot fields are filled during import and in runtime normalization. Existing ellipse geometry remains unchanged; the previous `75x42mm` label is corrected to `75x43.2mm` to match its actual dimensions.

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

## Relationships

- A **Slot Definition** includes its **Tolerance**.
- A circular **Slot Definition** records its **Final Slot Size** directly.
- An ellipse **Slot Definition** includes base width, base height, **Ellipse Outer Offset**, and **Ellipse Profile Exponent**.
- A **Slot Instance** is created from exactly one **Slot Definition** and records its **Slot Definition ID**.
- A **Slot Instance** keeps a **Slot Geometry Snapshot** for reproducible generation.
- Existing **Slot Instances** do not silently change when a **Slot Definition** changes.
- Updating an existing slot to the latest **Slot Definition** must be an explicit action.
- Model generation uses the **Slot Geometry Snapshot**, not the **Slot Definition ID**.
- The **Slot Definition ID** is for creation, identity, and UI selection state.
- Legacy data without a **Slot Definition ID** may be conservatively matched to a definition.
- Circular legacy slots match by nominal diameter.
- Ellipse legacy slots match only when width, height, **Ellipse Outer Offset**, and **Ellipse Profile Exponent** all match.
- Legacy slots that do not match a definition remain valid geometry snapshots without a definition identity.
- A slot definition display name must reflect the actual geometry values in the definition.
- Multiple layout modes may expose different subsets of **Slot Definitions**.
- When two modes expose the same **Slot Definition**, they must use the same geometry.
- A **Base Size** is not enough to reproduce a slot unless its **Tolerance** and shape-specific geometry are also known.

## Example Dialogue

> **Dev:** "Can grid mode and stepped mode both offer a 40mm circular slot?"
> **Domain expert:** "Yes, and if they do, both must use the same slot definition, including the same clearance."

## Flagged Ambiguities

- "凹槽定义" previously meant either a visible UI option or the generated hole geometry. Resolved: **Slot Definition** means the complete reusable geometry definition, including tolerance.

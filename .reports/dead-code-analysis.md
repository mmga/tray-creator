# Dead Code Analysis Report

Generated: 2026-02-28
**Status: ✅ COMPLETED**

## Summary

- **Unused Files**: 3 → ✅ **Deleted**
- **Unused Dependencies**: 2 → ✅ **Removed**
- **Unused Exports**: 14 → ✅ **Cleaned**
- **Unlisted Dependencies**: 1 → ✅ **Added**

---

## Cleanup Results

### ✅ Phase 1: File Deletions (Completed)

1. ✅ Deleted `edge-functions/api/orders.js`
2. ✅ Deleted `src/components/ui/card.tsx`
3. ✅ Deleted `src/components/ui/checkbox.tsx`

### ✅ Phase 2: Dependency Cleanup (Completed)

1. ✅ Removed `@radix-ui/react-checkbox` from package.json
2. ✅ Removed `jszip` from package.json
3. ✅ Added `postcss` to devDependencies
4. ✅ Ran `pnpm install` to update lockfile

### ✅ Phase 3: Export Cleanup (Completed)

Removed unused exports from:
- ✅ `src/components/ui/button.tsx` (buttonVariants)
- ✅ `src/components/ui/select.tsx` (SelectGroup, SelectLabel, SelectSeparator, SelectScrollUpButton, SelectScrollDownButton)
- ✅ `src/components/ui/tabs.tsx` (tabsListVariants)
- ✅ `src/lib/config.ts` (DEFAULT_HOLE_TOLERANCE, SLOT_TOLERANCE_MAP, SLOT_COLORS)
- ✅ `src/lib/pricing.ts` (getSlotPrice, PRICING_CONFIG, getEquivalentDiameter)
- ✅ `src/lib/stl-export.ts` (exportToSTL)

### ✅ Verification

- ✅ Build passes after file deletions
- ✅ Build passes after dependency cleanup
- ✅ Build passes after export cleanup
- ✅ Knip reports no remaining issues

---

## Original Analysis

### Unused Files (3)

### 🟢 SAFE - Can be deleted

#### `edge-functions/api/orders.js`
- **Type**: Edge function for EdgeOne KV storage
- **Purpose**: Order configuration API endpoint
- **Risk**: LOW - This appears to be an alternative deployment target (EdgeOne) that's not currently used
- **Recommendation**: Safe to delete if not deploying to EdgeOne

#### `src/components/ui/card.tsx`
- **Type**: UI component
- **Purpose**: Card component with header, footer, title, etc.
- **Risk**: LOW - No imports found in codebase
- **Recommendation**: Safe to delete (shadcn/ui component not being used)

#### `src/components/ui/checkbox.tsx`
- **Type**: UI component
- **Purpose**: Checkbox component using Radix UI
- **Risk**: LOW - No imports found in codebase
- **Recommendation**: Safe to delete (shadcn/ui component not being used)

---

## 2. Unused Dependencies (2)

### 🟢 SAFE - Can be removed from package.json

#### `@radix-ui/react-checkbox` (package.json:18:6)
- **Used by**: `src/components/ui/checkbox.tsx` (which is itself unused)
- **Recommendation**: Remove after deleting checkbox.tsx

#### `jszip` (package.json:23:6)
- **Purpose**: ZIP file creation/manipulation
- **Risk**: LOW - Not imported anywhere
- **Recommendation**: Safe to remove unless planned for future use

---

## 3. Unused Exports (14)

### 🟢 SAFE - Can be removed

#### UI Component Exports (7)

1. **`buttonVariants`** - `src/components/ui/button.tsx:64:18`
   - Variant helper for button styling
   - Not used externally

2. **`SelectGroup`** - `src/components/ui/select.tsx:182:3`
3. **`SelectLabel`** - `src/components/ui/select.tsx:184:3`
4. **`SelectScrollDownButton`** - `src/components/ui/select.tsx:185:3`
5. **`SelectScrollUpButton`** - `src/components/ui/select.tsx:186:3`
6. **`SelectSeparator`** - `src/components/ui/select.tsx:187:3`
   - Advanced select component features not being used

7. **`tabsListVariants`** - `src/components/ui/tabs.tsx:91:52`
   - Variant helper for tabs styling

#### Configuration Exports (3)

8. **`DEFAULT_HOLE_TOLERANCE`** - `src/lib/config.ts:16:14`
9. **`SLOT_TOLERANCE_MAP`** - `src/lib/config.ts:19:14`
10. **`SLOT_COLORS`** - `src/lib/config.ts:174:14`
    - Configuration constants not being used

#### Pricing/Utility Exports (4)

11. **`getSlotPrice`** - `src/lib/pricing.ts:11:17` (function)
12. **`PRICING_CONFIG`** - `src/lib/pricing.ts:21:14`
13. **`getEquivalentDiameter`** - `src/lib/pricing.ts:57:17` (function)
    - Pricing utilities not being used

14. **`exportToSTL`** - `src/lib/stl-export.ts:7:17` (function)
    - STL export function not being used

---

## 4. Unlisted Dependencies (1)

### 🟡 CAUTION - Should be added to package.json

#### `postcss` - Used in `postcss.config.mjs`
- **Risk**: MEDIUM - Build tool dependency
- **Recommendation**: Add to devDependencies for explicit dependency management

---

## Deletion Plan

### Phase 1: Safe File Deletions (No tests to run)
⚠️ **Note**: No test suite detected in project. Proceeding with manual verification.

1. Delete `edge-functions/api/orders.js`
2. Delete `src/components/ui/card.tsx`
3. Delete `src/components/ui/checkbox.tsx`

### Phase 2: Dependency Cleanup

1. Remove `@radix-ui/react-checkbox` from package.json
2. Remove `jszip` from package.json
3. Add `postcss` to devDependencies

### Phase 3: Export Cleanup (Optional)

Remove unused exports from:
- `src/components/ui/button.tsx` (buttonVariants)
- `src/components/ui/select.tsx` (5 exports)
- `src/components/ui/tabs.tsx` (tabsListVariants)
- `src/lib/config.ts` (3 exports)
- `src/lib/pricing.ts` (3 exports)
- `src/lib/stl-export.ts` (exportToSTL)

---

## Risk Assessment

- **SAFE**: All unused files and dependencies are safe to remove
- **NO TESTS**: Project has no test suite, so verification must be done manually
- **RECOMMENDATION**: Build and manually test the application after each deletion

---

## Next Steps

1. ✅ Review this report
2. ⏳ Delete unused files
3. ⏳ Update package.json
4. ⏳ Run `pnpm install` to update lockfile
5. ⏳ Build the application (`npm run build`)
6. ⏳ Manually test core functionality
7. ⏳ (Optional) Remove unused exports

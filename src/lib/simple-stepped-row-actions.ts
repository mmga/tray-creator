/**
 * 简易阶梯式布局的行操作纯函数。
 *
 * 仿 stepped-layout-group-actions.ts 模式，从 useSimpleSteppedLayout hook
 * 提取，让行增删/重命名/清空/重排成为可独立测试的纯函数。
 */
import type {
  SimpleSteppedLayoutParams,
  SimpleSteppedRow,
} from "@/types/custom-tray";

export function addSimpleSteppedRow(
  params: SimpleSteppedLayoutParams,
  rowId: string,
  name?: string,
): SimpleSteppedLayoutParams {
  const newRow: SimpleSteppedRow = {
    id: rowId,
    name: name ?? `行 ${params.rows.length + 1}`,
    slotIds: [],
  };

  return {
    ...params,
    rows: [...params.rows, newRow],
  };
}

export function removeSimpleSteppedRow(
  params: SimpleSteppedLayoutParams,
  rowId: string,
): SimpleSteppedLayoutParams {
  return {
    ...params,
    rows: params.rows.filter((row) => row.id !== rowId),
    slots: params.slots.filter((slot) => slot.rowId !== rowId),
  };
}

export function renameSimpleSteppedRow(
  params: SimpleSteppedLayoutParams,
  rowId: string,
  name: string,
): SimpleSteppedLayoutParams {
  return {
    ...params,
    rows: params.rows.map((row) =>
      row.id === rowId ? { ...row, name: name.trim() || row.name } : row,
    ),
  };
}

export function clearSimpleSteppedRow(
  params: SimpleSteppedLayoutParams,
  rowId: string,
): SimpleSteppedLayoutParams {
  return {
    ...params,
    slots: params.slots.filter((slot) => slot.rowId !== rowId),
  };
}

export function reorderSimpleSteppedRows(
  params: SimpleSteppedLayoutParams,
  fromIndex: number,
  toIndex: number,
): SimpleSteppedLayoutParams {
  if (
    fromIndex < 0 ||
    fromIndex >= params.rows.length ||
    toIndex < 0 ||
    toIndex >= params.rows.length ||
    fromIndex === toIndex
  ) {
    return params;
  }

  const nextRows = [...params.rows];
  const [moved] = nextRows.splice(fromIndex, 1);
  nextRows.splice(toIndex, 0, moved);

  return { ...params, rows: nextRows };
}

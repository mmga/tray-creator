import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEditableParams } from "@/hooks/useEditableParams";

interface Params {
  value: number;
}

function renderEditableParams(onInvalidate = vi.fn()) {
  return renderHook(() =>
    useEditableParams<Params, Params>({
      initialState: { value: 1 },
      captureSnapshot: structuredClone,
      fingerprintSnapshot: JSON.stringify,
      generatePreview: vi.fn().mockResolvedValue(null),
      exportModel: vi.fn().mockResolvedValue(undefined),
      areEqual: (left, right) => left.value === right.value,
      onInvalidate,
    }),
  );
}

describe("useEditableParams 显式编辑事务", () => {
  it("归一化结果无变化时不写历史也不执行失效", () => {
    const onInvalidate = vi.fn();
    const { result } = renderEditableParams(onInvalidate);

    let outcome;
    act(() => {
      outcome = result.current.applyChange((params) => ({ ...params }));
    });

    expect(outcome).toEqual({ status: "unchanged" });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.transactionRevision).toBe(0);
    expect(onInvalidate).not.toHaveBeenCalled();
  });

  it("连续预览只修改工作参数，提交后只产生一个 Undo", () => {
    const onInvalidate = vi.fn();
    const { result } = renderEditableParams(onInvalidate);

    act(() => {
      expect(result.current.beginContinuousEdit()).toEqual({ status: "previewing" });
      result.current.previewContinuousEdit(() => ({ value: 2 }));
      result.current.previewContinuousEdit(() => ({ value: 3 }));
    });

    expect(result.current.params).toEqual({ value: 1 });
    expect(result.current.viewParams).toEqual({ value: 3 });
    expect(result.current.canUndo).toBe(false);
    expect(onInvalidate).not.toHaveBeenCalled();

    act(() => {
      expect(result.current.commitContinuousEdit()).toMatchObject({
        status: "committed",
      });
    });

    expect(result.current.params).toEqual({ value: 3 });
    expect(result.current.workingParams).toBeNull();
    expect(result.current.canUndo).toBe(true);
    expect(result.current.transactionRevision).toBe(1);
    expect(onInvalidate).toHaveBeenCalledTimes(1);

    act(() => result.current.undo());
    expect(result.current.params).toEqual({ value: 1 });
    expect(result.current.transactionRevision).toBe(2);
  });

  it("连续编辑回到原值时零副作用", () => {
    const onInvalidate = vi.fn();
    const { result } = renderEditableParams(onInvalidate);

    act(() => {
      result.current.beginContinuousEdit();
      result.current.previewContinuousEdit(() => ({ value: 2 }));
      result.current.previewContinuousEdit(() => ({ value: 1 }));
    });
    act(() => {
      expect(result.current.commitContinuousEdit()).toEqual({ status: "unchanged" });
    });

    expect(result.current.params).toEqual({ value: 1 });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.transactionRevision).toBe(0);
    expect(onInvalidate).not.toHaveBeenCalled();
  });

  it("已有连续事务时拒绝新的 begin", () => {
    const { result } = renderEditableParams();

    act(() => {
      expect(result.current.beginContinuousEdit()).toEqual({ status: "previewing" });
      expect(result.current.beginContinuousEdit()).toEqual({
        status: "rejected",
        code: "edit-already-active",
      });
    });

    expect(result.current.workingParams).toEqual({ value: 1 });
  });

  it("活动连续编辑期间 Undo 只取消工作参数", () => {
    const { result } = renderEditableParams();

    act(() => {
      result.current.applyChange(() => ({ value: 2 }));
      result.current.beginContinuousEdit();
      result.current.previewContinuousEdit(() => ({ value: 3 }));
      result.current.undo();
    });

    expect(result.current.params).toEqual({ value: 2 });
    expect(result.current.workingParams).toBeNull();
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.params).toEqual({ value: 1 });
  });

  it("replace 建立新编辑会话并清空历史", () => {
    const { result } = renderEditableParams();

    act(() => {
      result.current.applyChange(() => ({ value: 2 }));
      result.current.replaceParams({ value: 8 });
    });

    expect(result.current.params).toEqual({ value: 8 });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.transactionRevision).toBe(2);
  });

  it("replace 同时取消尚未提交的工作参数", () => {
    const { result } = renderEditableParams();

    act(() => {
      result.current.beginContinuousEdit();
      result.current.previewContinuousEdit(() => ({ value: 4 }));
      result.current.replaceParams({ value: 9 });
    });

    expect(result.current.params).toEqual({ value: 9 });
    expect(result.current.workingParams).toBeNull();
    expect(result.current.canUndo).toBe(false);
  });
});

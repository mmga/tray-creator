import { describe, expect, it } from "vitest";
import {
  bindDraftSession,
  clearDraftSession,
  createEmptyDraftSession,
  hasUnsavedDraftChanges,
  removeDraftSessionBinding,
} from "@/lib/draft-session";

describe("draft session", () => {
  it("tracks draft binding and unsaved changes from serialized snapshots", () => {
    const empty = createEmptyDraftSession();
    const bound = bindDraftSession("draft-1", "snapshot-a");

    expect(empty.currentDraftId).toBeNull();
    expect(hasUnsavedDraftChanges(empty, "snapshot-a")).toBe(false);
    expect(bound).toEqual({
      currentDraftId: "draft-1",
      boundSnapshot: "snapshot-a",
    });
    expect(hasUnsavedDraftChanges(bound, "snapshot-a")).toBe(false);
    expect(hasUnsavedDraftChanges(bound, "snapshot-b")).toBe(true);
  });

  it("clears binding when reset/import or current draft deletion breaks the session", () => {
    const bound = bindDraftSession("draft-1", "snapshot-a");

    expect(clearDraftSession()).toEqual(createEmptyDraftSession());
    expect(removeDraftSessionBinding(bound, "draft-1")).toEqual(
      createEmptyDraftSession(),
    );
    expect(removeDraftSessionBinding(bound, "draft-2")).toBe(bound);
  });
});

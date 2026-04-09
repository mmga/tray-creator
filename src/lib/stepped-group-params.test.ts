import { describe, expect, it } from "vitest";
import {
  createGroupStructureOverrides,
  getEffectiveGroupStructureParams,
} from "@/lib/stepped-group-params";

describe("stepped group params", () => {
  it("creates group overrides that follow global defaults by default", () => {
    expect(
      createGroupStructureOverrides({
        smoothingRadius: 60,
        disconnectDistance: 12,
      }),
    ).toEqual({
      useGroupSmoothingRadius: false,
      groupSmoothingRadius: 60,
      useGroupDisconnectDistance: false,
      groupDisconnectDistance: 12,
    });
  });

  it("resolves effective params per override dimension", () => {
    const defaults = {
      smoothingRadius: 60,
      disconnectDistance: 8,
    };

    expect(
      getEffectiveGroupStructureParams(
        {
          useGroupSmoothingRadius: false,
          groupSmoothingRadius: 40,
          useGroupDisconnectDistance: false,
          groupDisconnectDistance: 2,
        },
        defaults,
      ),
    ).toEqual(defaults);

    expect(
      getEffectiveGroupStructureParams(
        {
          useGroupSmoothingRadius: true,
          groupSmoothingRadius: 40,
          useGroupDisconnectDistance: false,
          groupDisconnectDistance: 2,
        },
        defaults,
      ),
    ).toEqual({
      smoothingRadius: 40,
      disconnectDistance: 8,
    });

    expect(
      getEffectiveGroupStructureParams(
        {
          useGroupSmoothingRadius: false,
          groupSmoothingRadius: 40,
          useGroupDisconnectDistance: true,
          groupDisconnectDistance: 2,
        },
        defaults,
      ),
    ).toEqual({
      smoothingRadius: 60,
      disconnectDistance: 2,
    });

    expect(
      getEffectiveGroupStructureParams(
        {
          useGroupSmoothingRadius: true,
          groupSmoothingRadius: 32,
          useGroupDisconnectDistance: true,
          groupDisconnectDistance: 0,
        },
        defaults,
      ),
    ).toEqual({
      smoothingRadius: 32,
      disconnectDistance: 0,
    });
  });
});

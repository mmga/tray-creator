import { beforeEach, describe, expect, it } from "vitest";
import {
  deletePersonalBaseSpecification,
  loadPersonalBaseSpecifications,
  savePersonalBaseSpecification,
  type PersonalBaseSpecification,
} from "@/lib/personal-base-specifications";

const SOURCE_SPECIFICATION: PersonalBaseSpecification = {
  id: "custom-source-test",
  role: "source",
  name: "实测 24 × 48",
  geometry: {
    customId: "custom-source-test",
    name: "实测 24 × 48",
    shape: "rectangle",
    nominalWidth: 25,
    nominalDepth: 50,
    fitWidth: 24,
    fitDepth: 48,
    cornerRadius: 2,
  },
};

describe("personal base specifications", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists reusable entries with stable ids and allows duplicate names", () => {
    savePersonalBaseSpecification(SOURCE_SPECIFICATION);
    savePersonalBaseSpecification({
      ...SOURCE_SPECIFICATION,
      id: "custom-source-test-2",
      geometry: {
        ...SOURCE_SPECIFICATION.geometry,
        customId: "custom-source-test-2",
      },
    });

    expect(loadPersonalBaseSpecifications()).toHaveLength(2);
    expect(loadPersonalBaseSpecifications().map((entry) => entry.name))
      .toEqual(["实测 24 × 48", "实测 24 × 48"]);
  });

  it("updates and deletes only the selected stable id", () => {
    savePersonalBaseSpecification(SOURCE_SPECIFICATION);
    savePersonalBaseSpecification({
      ...SOURCE_SPECIFICATION,
      name: "重命名",
      geometry: { ...SOURCE_SPECIFICATION.geometry, name: "重命名" },
    });
    expect(loadPersonalBaseSpecifications()).toHaveLength(1);
    expect(loadPersonalBaseSpecifications()[0].name).toBe("重命名");

    expect(deletePersonalBaseSpecification(SOURCE_SPECIFICATION.id)).toEqual([]);
  });

  it("ignores malformed local data", () => {
    window.localStorage.setItem(
      "tray-creator:personal-base-specifications:v1",
      "{broken",
    );
    expect(loadPersonalBaseSpecifications()).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { randomIdFactory } from "@/lib/id-factory";

describe("randomIdFactory", () => {
  it("delegates id creation to crypto.randomUUID", () => {
    expect(randomIdFactory.createId()).toBe("test-uuid");
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
  });
});

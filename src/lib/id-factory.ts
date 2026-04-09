import type { IdFactory } from "@/lib/model-ports";

export const randomIdFactory: IdFactory = {
  createId() {
    return crypto.randomUUID();
  },
};

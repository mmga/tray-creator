import type { ContouredFootprintConstructionError } from "@/lib/contoured-footprint";

export type ActiveContouredFootprintState<T> =
  | { readonly status: "ready"; readonly value: T }
  | {
      readonly status: "failed";
      readonly error: ContouredFootprintConstructionError;
    };

export type ContouredFootprintState<T> =
  | { readonly status: "inactive" }
  | ActiveContouredFootprintState<T>;

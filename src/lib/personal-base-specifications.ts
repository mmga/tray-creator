import type {
  ConversionSourceGeometrySnapshot,
  ConversionTargetGeometrySnapshot,
} from "@/types/custom-tray";

const STORAGE_KEY = "tray-creator:personal-base-specifications:v1";

export type PersonalBaseSpecification =
  | {
      id: string;
      role: "source";
      name: string;
      geometry: ConversionSourceGeometrySnapshot;
    }
  | {
      id: string;
      role: "target";
      name: string;
      geometry: ConversionTargetGeometrySnapshot;
    };

function isPersonalBaseSpecification(
  value: unknown,
): value is PersonalBaseSpecification {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PersonalBaseSpecification>;
  if (!(typeof candidate.id === "string"
    && candidate.id.length > 0
    && (candidate.role === "source" || candidate.role === "target")
    && typeof candidate.name === "string"
    && candidate.geometry !== null
    && typeof candidate.geometry === "object")) {
    return false;
  }
  const geometry = candidate.geometry as unknown as Record<string, unknown>;
  if (
    geometry.customId !== candidate.id
    || typeof geometry.name !== "string"
  ) {
    return false;
  }
  if (candidate.role === "source") {
    return geometry.shape === "rectangle"
      && [
        geometry.nominalWidth,
        geometry.nominalDepth,
        geometry.fitWidth,
        geometry.fitDepth,
        geometry.cornerRadius,
      ].every((entry) => typeof entry === "number" && Number.isFinite(entry));
  }
  return (geometry.shape === "circle" || geometry.shape === "ellipse")
    && [geometry.width, geometry.depth, geometry.profileExponent]
      .every((entry) => typeof entry === "number" && Number.isFinite(entry));
}

export function loadPersonalBaseSpecifications(): PersonalBaseSpecification[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter(isPersonalBaseSpecification)
      : [];
  } catch {
    return [];
  }
}

function persist(entries: readonly PersonalBaseSpecification[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function savePersonalBaseSpecification(
  specification: PersonalBaseSpecification,
): PersonalBaseSpecification[] {
  const entries = loadPersonalBaseSpecifications();
  const index = entries.findIndex((entry) => entry.id === specification.id);
  const next = index === -1
    ? [...entries, specification]
    : entries.map((entry) =>
        entry.id === specification.id ? specification : entry);
  persist(next);
  return next;
}

export function deletePersonalBaseSpecification(
  id: string,
): PersonalBaseSpecification[] {
  const next = loadPersonalBaseSpecifications().filter(
    (entry) => entry.id !== id,
  );
  persist(next);
  return next;
}

export function createPersonalSpecificationId(role: "source" | "target") {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `custom-${role}-${suffix}`;
}

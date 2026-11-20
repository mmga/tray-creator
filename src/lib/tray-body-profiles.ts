export interface TrayBodyProfile {
  width: number;
  depth: number;
  radius: number;
  z: number;
}

export function planTrayBodyProfiles(width: number, depth: number, height: number, radius: number, bevel: number): TrayBodyProfile[] {
  const clampRadius = (r: number, w: number, d: number) => Math.max(0, Math.min(r, w / 2 - 0.01, d / 2 - 0.01));
  const bottomRadius = clampRadius(radius, width, depth);
  const inset = Math.max(0, Math.min(bevel, width / 2 - 0.1, depth / 2 - 0.1));
  if (!inset) return [{ width, depth, radius: bottomRadius, z: 0 }, { width, depth, radius: bottomRadius, z: height }];
  const topWidth = width - inset * 2;
  const topDepth = depth - inset * 2;
  const topRadius = clampRadius(bottomRadius - inset, topWidth, topDepth);
  // 两端保留同样的边数，确保放样边一一对应。
  const normalized = (r: number) => bottomRadius > 0 ? Math.max(0.01, r) : 0;
  return [{ width, depth, radius: normalized(bottomRadius), z: 0 },
    { width: topWidth, depth: topDepth, radius: normalized(topRadius), z: height }];
}

export function planHalfTraySections(width: number, depth: number, baseThickness: number, holeDepth: number,
  cornerRadius: number, sideBevelWidth: number, axis: "x" | "y") {
  const safeBevel = Math.max(0, Math.min(sideBevelWidth, width / 2 - 0.1, depth / 2 - 0.1));
  const baseBevel = safeBevel * (baseThickness / (baseThickness + holeDepth));
  const upperWidth = width - baseBevel * 2;
  const upperDepth = depth - baseBevel * 2;
  const base = [width, depth, baseThickness, cornerRadius, baseBevel] as const;
  const upper = [upperWidth, upperDepth, holeDepth, Math.max(cornerRadius - baseBevel, 0), safeBevel - baseBevel] as const;
  const clipCenter: [number, number, number] = axis === "y"
    ? [0, -depth / 4, baseThickness + holeDepth / 2]
    : [-width / 4, 0, baseThickness + holeDepth / 2];
  const clipSize: [number, number, number] = axis === "y"
    ? [width + 1, depth / 2, holeDepth + 0.1] : [width / 2, depth + 1, holeDepth + 0.1];
  return { base, upper, clipCenter, clipSize };
}

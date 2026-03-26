export interface ConnectivityCircle {
  id: string;
  cx: number;
  cy: number;
  rOuter: number;
}

export interface BridgeWarning {
  groupId: string;
  groupName: string;
  separatedClusterCount: number;
  mergedClusterCount: number;
  effectiveBridgeGap: number;
}

export function getConnectivityRadius(
  width: number,
  height: number,
  spacing: number,
  widthTolerance: number,
  heightTolerance: number,
): number {
  return Math.max(width + widthTolerance, height + heightTolerance) / 2 + spacing;
}

function getCircleGap(a: ConnectivityCircle, b: ConnectivityCircle): number {
  return Math.hypot(a.cx - b.cx, a.cy - b.cy) - a.rOuter - b.rOuter;
}

export function getEffectiveBridgeGap(
  smoothingRadius: number,
  disconnectDistance: number,
): number {
  if (disconnectDistance > 0) {
    return Math.max(0, disconnectDistance);
  }

  return Math.max(0, smoothingRadius * 2);
}

export function clusterConnectivityCircles(
  circles: ConnectivityCircle[],
  maxGap: number,
): ConnectivityCircle[][] {
  if (circles.length === 0) return [];

  const clusters: ConnectivityCircle[][] = [];
  const visited = new Set<string>();
  const allowedGap = Math.max(0, maxGap);

  for (const circle of circles) {
    if (visited.has(circle.id)) continue;

    const queue = [circle];
    const cluster: ConnectivityCircle[] = [];
    visited.add(circle.id);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      cluster.push(current);

      for (const candidate of circles) {
        if (visited.has(candidate.id)) continue;
        if (getCircleGap(current, candidate) <= allowedGap + 1e-6) {
          visited.add(candidate.id);
          queue.push(candidate);
        }
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

export function analyzeBridgeWarning(
  circles: ConnectivityCircle[],
  smoothingRadius: number,
  disconnectDistance: number,
  groupMeta: { groupId: string; groupName: string },
): BridgeWarning | null {
  if (circles.length < 2) return null;

  const separatedClusters = clusterConnectivityCircles(circles, 0);
  const effectiveBridgeGap = getEffectiveBridgeGap(
    smoothingRadius,
    disconnectDistance,
  );

  if (effectiveBridgeGap <= 0) return null;

  const mergedClusters = clusterConnectivityCircles(circles, effectiveBridgeGap);

  if (mergedClusters.length >= separatedClusters.length) {
    return null;
  }

  return {
    groupId: groupMeta.groupId,
    groupName: groupMeta.groupName,
    separatedClusterCount: separatedClusters.length,
    mergedClusterCount: mergedClusters.length,
    effectiveBridgeGap,
  };
}
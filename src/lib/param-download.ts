import type { AppMode } from "@/types/custom-tray";
import { createCurrentParamArtifactBlob } from "@/lib/current-param-artifact-encoder";
import type { ModeParamSnapshot } from "@/lib/mode-param-snapshot";
import { browserDownloadPort } from "@/lib/download-port";

export function downloadParamFile<M extends AppMode>(
  snapshot: ModeParamSnapshot<M>,
  filename: string = `tray-${snapshot.mode}-config.json`,
) {
  const blob = createCurrentParamArtifactBlob(snapshot);
  browserDownloadPort.downloadBlob(blob, filename);
}

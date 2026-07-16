import type { AppMode } from "@/types/custom-tray";
import { createCurrentParamArtifactBlob } from "@/lib/current-param-artifact-encoder";
import type { ModeParamSnapshot } from "@/lib/mode-param-snapshot";

export function downloadParamFile<M extends AppMode>(
  snapshot: ModeParamSnapshot<M>,
  filename: string = `tray-${snapshot.mode}-config.json`,
) {
  const blob = createCurrentParamArtifactBlob(snapshot);
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function exportParams<M extends AppMode>(snapshot: ModeParamSnapshot<M>) {
  downloadParamFile(snapshot);
}

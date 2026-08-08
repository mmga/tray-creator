import type { DownloadPort } from "@/lib/model-ports";

export const browserDownloadPort: DownloadPort = {
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    let appended = false;
    try {
      document.body.appendChild(link);
      appended = true;
      link.click();
    } finally {
      if (appended && link.parentNode === document.body) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }
  },
};

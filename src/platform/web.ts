import type { OpenedFile, Platform } from "./index";

export const INVOICE_ACCEPT = ".xml,.pdf,application/xml,text/xml,application/pdf";

export function pickFile(accept = INVOICE_ACCEPT): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    input.addEventListener("change", () => {
      resolve(input.files?.[0] ?? null);
      input.remove();
    });
    input.addEventListener("cancel", () => {
      resolve(null);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  });
}

export async function fileToOpened(file: File): Promise<OpenedFile> {
  return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
}

export function createWebPlatform(): Platform {
  return {
    kind: "web",
    async openInvoice() {
      const file = await pickFile();
      return file ? fileToOpened(file) : null;
    },
    async saveFile(defaultName, bytes, filter) {
      const type = filter.extensions.includes("pdf") ? "application/pdf" : "application/octet-stream";
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
      const a = document.createElement("a");
      a.href = url;
      a.download = defaultName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      return true;
    },
    async print() {
      window.print();
    },
    async openUrl(url) {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    onExternalFiles() {
      return () => {};
    },
    async appVersion() {
      return import.meta.env.VITE_APP_VERSION ?? "dev";
    },
  };
}

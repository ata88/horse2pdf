import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { baseName, type OpenedFile, type Platform } from "./index";

async function readPath(path: string): Promise<OpenedFile> {
  // The Rust side returns the raw bytes (tauri::ipc::Response) – no JSON array overhead.
  const data = await invoke<ArrayBuffer>("read_file", { path });
  return { name: baseName(path), path, bytes: new Uint8Array(data) };
}

export function createTauriPlatform(): Platform {
  return {
    kind: "tauri",
    async openInvoice() {
      const path = await open({
        multiple: false,
        directory: false,
        filters: [
          { name: "E-Rechnung (XML, PDF)", extensions: ["xml", "pdf"] },
          { name: "Alle Dateien", extensions: ["*"] },
        ],
      });
      return typeof path === "string" ? readPath(path) : null;
    },
    async saveFile(defaultName, bytes, filter) {
      const path = await save({ defaultPath: defaultName, filters: [filter] });
      if (!path) return false;
      await invoke("write_file", bytes, { headers: { path: encodeURIComponent(path) } });
      return true;
    },
    async print() {
      await invoke("print_window");
    },
    async openUrl(url) {
      await openUrl(url);
    },
    onExternalFiles(cb) {
      let disposed = false;
      const deliver = async (paths: string[]) => {
        const files = await Promise.all(paths.map(readPath));
        if (!disposed && files.length) cb(files);
      };
      const unlisten = listen<string[]>("open-files", (e) => void deliver(e.payload));
      // Files passed on startup (double click / "Open with") before the UI was ready.
      void invoke<string[]>("take_pending_files").then(deliver);
      return () => {
        disposed = true;
        void unlisten.then((f) => f());
      };
    },
    appVersion: getVersion,
  };
}

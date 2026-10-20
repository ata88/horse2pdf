/**
 * Platform abstraction: the UI never talks to Tauri directly. In the desktop app the
 * Tauri implementation is used, in a normal browser (dev server, E2E tests) the web
 * implementation – both offer the same capabilities.
 */
import { createWebPlatform } from "./web";

export interface OpenedFile {
  name: string;
  bytes: Uint8Array;
  /** Absolute path (desktop only). */
  path?: string;
}

export interface SaveFilter {
  name: string;
  extensions: string[];
}

export interface Platform {
  readonly kind: "tauri" | "web";
  /** Shows an open dialog for invoices (XML/PDF). */
  openInvoice(): Promise<OpenedFile | null>;
  /** Saves bytes; returns false if the user cancelled. */
  saveFile(defaultName: string, bytes: Uint8Array, filter: SaveFilter): Promise<boolean>;
  /** Prints the current page (the print view is selected via CSS). */
  print(): Promise<void>;
  openUrl(url: string): Promise<void>;
  /** Files passed via "Open with…", file association or a second app start. */
  onExternalFiles(cb: (files: OpenedFile[]) => void): () => void;
  appVersion(): Promise<string>;
}

export const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let platform: Promise<Platform> | undefined;

export function getPlatform(): Promise<Platform> {
  platform ??= isTauri()
    ? import("./tauri").then((m) => m.createTauriPlatform())
    : Promise.resolve(createWebPlatform());
  return platform;
}

export function baseName(path: string): string {
  return path.replace(/^.*[\\/]/, "");
}

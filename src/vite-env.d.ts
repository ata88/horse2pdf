/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string;
}

declare module "pdfmake/build/pdfmake" {
  const pdfMake: unknown;
  export default pdfMake;
}
declare module "pdfmake/build/vfs_fonts" {
  const vfs: Record<string, string>;
  export default vfs;
}

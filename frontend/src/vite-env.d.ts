/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KHANZA_WEBAPPS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

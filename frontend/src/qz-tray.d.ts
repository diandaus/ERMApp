// qz-tray tidak menyertakan definisi TypeScript sendiri — deklarasi minimal
// ini cuma mencakup bagian API yang benar-benar dipakai di ApotekPengaturanPrinter.tsx
// (koneksi websocket, daftar printer, kirim print job). Lihat qz-tray.js di
// node_modules untuk API lengkapnya kalau nanti perlu lebih.
declare module 'qz-tray' {
  export interface QzPrinterConfigOptions {
    copies?: number;
    orientation?: 'portrait' | 'landscape' | 'reverse-landscape';
    units?: 'in' | 'cm' | 'mm';
    density?: number;
  }

  export interface QzPrintData {
    type: 'raw' | 'html' | 'pixel' | 'image';
    format?: 'plain' | 'html' | 'file' | 'base64' | 'hex';
    data: string;
  }

  export interface QzConfig {
    printer: string;
  }

  export const websocket: {
    connect: (options?: Record<string, unknown>) => Promise<void>;
    disconnect: () => Promise<void>;
    isActive: () => boolean;
  };

  export const printers: {
    find: (query?: string) => Promise<string | string[]>;
    getDefault: () => Promise<string>;
  };

  export const configs: {
    create: (printer: string, options?: QzPrinterConfigOptions) => QzConfig;
  };

  export function print(config: QzConfig, data: QzPrintData[]): Promise<void>;

  export const security: {
    setCertificatePromise: (resolver: (resolve: (cert: string) => void, reject: (err: unknown) => void) => void) => void;
    setSignaturePromise: (
      signer: (toSign: string) => (resolve: (sig: string) => void, reject: (err: unknown) => void) => void
    ) => void;
  };
}

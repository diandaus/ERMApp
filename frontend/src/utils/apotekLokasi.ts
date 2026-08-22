// Daftar kode bangsal yang BENAR-BENAR jadi lokasi stok obat/BHP (apotek,
// gudang, depo ruangan, troli emergensi) — dipakai memfilter dropdown
// "Lokasi"/"Dari"/"Ke" di seluruh modul Apotek (Mutasi, Stok Opname,
// Penjualan, Penerimaan, Permintaan, Retur, Riwayat Barang Medis, Troli
// Emergensi, Validasi Obat) supaya baris `bangsal` lain yang sebenarnya
// kategori kamar rawat inap/ruangan non-stok (mis. K1/K2/K3/VIP/VVIP/KO)
// tidak ikut nongol sebagai pilihan lokasi stok.
//
// SENGAJA TIDAK dipakai di ApotekPengaturan.tsx (tab Pengaturan Depo
// Ralan/Ranap/Lokasi) — layar itu justru butuh SELURUH daftar bangsal apa
// adanya (termasuk kamar rawat inap di luar whitelist ini) supaya admin
// tetap bisa memetakan poli/kamar ke depo obatnya masing-masing.
export const APOTEK_LOKASI_WHITELIST = new Set([
  'AP', 'APK', 'GD', 'RI', 'KIA', 'ICU', 'IGD', 'OK',
  'TRL1', 'TRL2', 'TRL3', 'TRL4', 'TRL5', 'TRL6',
  'NIC', 'HCU',
]);

export type KvOpsi = { kode: string; nama: string };

export function filterLokasiApotek(list: KvOpsi[]): KvOpsi[] {
  return list.filter((b) => APOTEK_LOKASI_WHITELIST.has(b.kode));
}

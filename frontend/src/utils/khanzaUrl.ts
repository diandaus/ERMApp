/**
 * Build URL gambar radiologi Khanza.
 * Backend menangani routing /radiologi/* ke sumber yang benar
 * (static lokal atau reverse proxy ke server terpisah) sesuai konfigurasi .env backend.
 */
export function khanzaRadiologiUrl(lokasiGambar: string): string {
  if (!lokasiGambar) return '';
  return `/radiologi/${lokasiGambar}`;
}

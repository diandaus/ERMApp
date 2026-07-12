/**
 * Format tanggal ke YYYY-MM-DD berdasarkan waktu LOKAL, bukan UTC.
 *
 * `new Date().toISOString().split('T')[0]` tampak seperti pola yang aman,
 * padahal toISOString() mengonversi ke UTC dulu. Untuk WIB (UTC+7), di jam
 * 00:00–06:59 tanggal UTC-nya masih "kemarin" — filter tanggal/default form
 * jadi mundur satu hari persis di jam-jam itu.
 */
export function localDateStr(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

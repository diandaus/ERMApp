/**
 * Ubah teks ALL CAPS jadi Title Case sebelum dikirim ke SpeechSynthesisUtterance.
 *
 * Banyak voice TTS Windows/SAPI menganggap kata full-uppercase sebagai
 * singkatan/akronim dan mengejanya huruf per huruf (mis. "USA" dibaca
 * "U-S-A") — termasuk nama pasien yang di database memang tersimpan
 * ALL CAPS ("RAHMA NIA"). macOS/Safari tidak punya kuirk ini, makanya
 * pengejaan cuma bermasalah di sebagian komputer/voice. Title Case tetap
 * dibaca normal di semua voice, jadi ini fix yang aman universal —
 * tampilan layar (yang ALL CAPS) tidak disentuh, cuma teks yang dikirim
 * ke speechSynthesis.
 */
export function toSpokenCase(text: string): string {
  return text.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

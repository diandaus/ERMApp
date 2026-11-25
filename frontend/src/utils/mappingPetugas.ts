// mappingPetugas — petugas default modal input hasil (USG, Radiologi,
// Laboratorium PK/PA). Urutan: (1) petugas hasil Pengaturan > Mapping
// Petugas utk jenis itu, (2) akun yg sedang login (nip, dicocokkan PERSIS
// ke tabel petugas). Petugas dari hasil yg SUDAH tersimpan (mode edit)
// ditangani masing2 modal & tetap diutamakan di atas keduanya.

export type JenisMappingPetugas = 'usg' | 'radiologi' | 'lab_pk' | 'lab_pa';

export const JENIS_MAPPING_PETUGAS: { jenis: JenisMappingPetugas; label: string }[] = [
  { jenis: 'usg', label: 'Input Hasil USG' },
  { jenis: 'radiologi', label: 'Input Hasil Radiologi' },
  { jenis: 'lab_pk', label: 'Input Hasil Laboratorium PK' },
  { jenis: 'lab_pa', label: 'Input Hasil Laboratorium PA' },
];

export type PetugasDefault = { nip: string; nama: string };

export async function resolvePetugasDefault(jenis: JenisMappingPetugas, fallbackNip?: string): Promise<PetugasDefault | null> {
  try {
    const res = await fetch('/api/mapping-petugas');
    if (res.ok) {
      const list: { jenis: string; nip: string; nama: string }[] = await res.json();
      const m = Array.isArray(list) ? list.find((x) => x.jenis === jenis && x.nip) : undefined;
      if (m) return { nip: m.nip, nama: m.nama || m.nip };
    }
  } catch {
    /* lanjut ke fallback */
  }
  if (!fallbackNip) return null;
  try {
    const res = await fetch(`/api/petugas?search=${encodeURIComponent(fallbackNip)}`);
    if (!res.ok) return null;
    const list: { nip: string; nama: string }[] = await res.json();
    const match = Array.isArray(list) ? list.find((p) => p.nip === fallbackNip) : undefined;
    return match ? { nip: match.nip, nama: match.nama } : null;
  } catch {
    return null;
  }
}

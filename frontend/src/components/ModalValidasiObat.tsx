import React from 'react';
import Swal from 'sweetalert2';
import { getCurrentPetugas } from '../utils/currentUser';

// ============================================================================
// MODAL VALIDASI OBAT — dipakai dari tab "Daftar Resep Dokter" (Permintaan
// Resep, frontend/src/modules/PermintaanResep.tsx), tombol "Validasi" di
// kolom Validasi tabel resep ralan. Padanan alur "Pemberian Obat" di
// inventory/DlgCariObat.java (5429 baris) — panel "Data Obat, Alkes & BHP
// Medis" (border ber-judul ala Khanza, direplikasi lewat <fieldset>/
// <legend> asli HTML — bukan absolute-positioned text, biar sama persis
// efek visual "garis border ketimpa teks judul" tanpa hack) + switch
// [Non Racikan]/[Racikan] di bawahnya untuk daftar item.
//
// Layout mengikuti pola di /Users/firdaus/ERMApp/default_card.md (§2 Modal
// & §3 Segmented Control Tab) dan primitif "pill row" ala Khanza Desktop
// yang sudah dipakai BpjsSep.tsx (Input SEP) — pillInput/PillSelect/Row
// diduplikasi ke sini (bukan diimpor) mengikuti pola
// yang sama persis dipakai ApotekDataBarang.tsx: menghindari risiko
// mengubah form lain yang sudah teruji.
//
// Lihat backend/permintaan_resep_handler.go (getPermintaanResepRalanItems,
// submitPermintaanResepValidasi) dan PERMINTAAN_RESEP_MODUL.md untuk
// rincian lengkap replikasi & penyederhanaan (skip billing/P-Care BPJS/
// jurnal akuntansi — Total/PPN/Total+PPN di sini SEKADAR TAMPILAN mengikuti
// tampilan Java, tidak diposting ke akuntansi mana pun karena proyek ini
// belum punya modul Keuangan). Jumlah yang diserahkan = jumlah peresepan
// penuh, tanpa UI edit jumlah parsial seperti tbObat Java.
// ============================================================================

const pillInput: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '7px 14px',
  borderRadius: 4,
  border: '1px solid #d1d5db',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  background: '#ffffff',
  color: '#111827',
};

const pillReadOnly: React.CSSProperties = {
  ...pillInput,
  background: '#f9fafb',
  color: '#374151',
};

const pillSelectStyle: React.CSSProperties = {
  ...pillInput,
  appearance: 'none',
  WebkitAppearance: 'none',
  paddingRight: 30,
  cursor: 'pointer',
};

const StepperIcon: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      right: 4,
      top: '50%',
      transform: 'translateY(-50%)',
      width: 20,
      height: 20,
      borderRadius: '50%',
      background: '#2563eb',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      flexShrink: 0,
    }}
  >
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 8.5 12 3.5 7 8.5"></polyline>
      <polyline points="7 15.5 12 20.5 17 15.5"></polyline>
    </svg>
  </div>
);

const PillSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  style?: React.CSSProperties;
  disabled?: boolean;
}> = ({ value, onChange, options, style, disabled }) => (
  <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', ...style }}>
    <select disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} style={{ ...pillSelectStyle, ...(disabled ? { background: '#f9fafb', cursor: 'default' } : {}) }}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    <StepperIcon />
  </div>
);

// Row — satu baris label:value ala form Khanza Desktop.
const Row: React.FC<{ label: string; labelWidth?: number; children: React.ReactNode }> = ({ label, labelWidth = 90, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', rowGap: 8 }}>
    <div style={{ width: labelWidth, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: '#111827' }}>{label} :</div>
    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', rowGap: 8 }}>{children}</div>
  </div>
);

const formatRupiah = (v: number) => Math.round(v || 0).toLocaleString('id-ID');
const pad2 = (n: number) => String(n).padStart(2, '0');
const range = (n: number) => Array.from({ length: n }, (_, i) => ({ value: pad2(i), label: pad2(i) }));

// Field tambahan (jenis_obat s/d kadaluarsa) padanan 19 kolom tabModeobat
// (tbObat) di DlgCariObat.java — lihat komentar struct Go ResepNonRacikan
// (resep_handler.go) untuk rincian sumber tiap kolom & kenapa no_batch/
// no_faktur selalu "-".
export type ResepNonRacikan = {
  kode_brng: string;
  nama_brng: string;
  jml: number;
  kode_sat: string;
  aturan_pakai: string;
  h_jual: number;
  subtotal: number;
  jenis_obat: string;
  embalase: number;
  tuslah: number;
  stok: number;
  nama_industri: string;
  h_beli: number;
  kategori: string;
  golongan: string;
  no_batch: string;
  no_faktur: string;
  kadaluarsa: string;
  kapasitas: number;
};
export type ResepRacikanDetail = {
  kode_brng: string;
  nama_brng: string;
  kandungan: string;
  jml: number;
  kode_sat: string;
  h_jual: number;
  subtotal: number;
  jenis_obat: string;
  embalase: number;
  tuslah: number;
  stok: number;
  nama_industri: string;
  h_beli: number;
  kategori: string;
  golongan: string;
  no_batch: string;
  no_faktur: string;
  kadaluarsa: string;
  kapasitas: number;
};
export type ResepRacikan = {
  no_racik: number;
  nama_racik: string;
  kd_racik: string;
  metode_racik: string;
  jml_dr: number;
  aturan_pakai: string;
  keterangan: string;
  detail: ResepRacikanDetail[];
};
export type ResepItems = {
  no_rawat: string;
  kd_bangsal: string;
  nm_bangsal: string;
  total: number;
  ppn: number;
  total_ppn: number;
  non_racikan: ResepNonRacikan[];
  racikan: ResepRacikan[];
};

export type ResepValidasiRingkasan = {
  no_resep: string;
  nm_pasien: string;
  no_rkm_medis: string;
  nm_dokter: string;
  nm_poli: string;
  jenis_bayar: string;
};

// Bentuk respons /api/obat/search (searchObat, resep_handler.go) — dipakai
// kolom "Tambah Obat".
type ObatSearchResult = {
  kode_brng: string;
  nama_brng: string;
  jenis_obat: string;
  kode_sat: string;
  harga: number;
  stok: number;
  kapasitas?: string;
};

interface ModalValidasiObatProps {
  resep: ResepValidasiRingkasan | null;
  onClose: () => void;
  onValidated: () => void;
  // kind — 'ralan' (default) atau 'ranap', menentukan endpoint mana yang
  // dipakai (backend/permintaan_resep_handler.go vs
  // backend/permintaan_resep_ranap_handler.go). Alur & tampilan modal
  // PERSIS sama, cuma base path-nya beda.
  kind?: 'ralan' | 'ranap';
}

export const ModalValidasiObat: React.FC<ModalValidasiObatProps> = ({ resep, onClose, onValidated, kind = 'ralan' }) => {
  const [detail, setDetail] = React.useState<ResepItems | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [subTab, setSubTab] = React.useState<'non-racikan' | 'racikan'>('non-racikan');
  // Racikan yang dipilih di tabel header (master-detail, padanan tampilan
  // dua tabel di DlgCariObat.java: tabel racikan di atas, tabel item obat
  // racikan terpilih di bawah).
  const [selectedRacikNo, setSelectedRacikNo] = React.useState<number | null>(null);
  const [metodeRacikOptions, setMetodeRacikOptions] = React.useState<{ kd_racik: string; nm_racik: string }[]>([]);
  // Racikan yang dihapus lewat tombol "Hapus" — dikirim ke backend saat
  // Simpan supaya resep_dokter_racikan(_detail)-nya ikut terhapus (lihat
  // handleSubmit & submitPermintaanResepValidasi).
  const [deletedRacikNos, setDeletedRacikNos] = React.useState<number[]>([]);

  // Tarif (Jeniskelas combo di DlgCariObat.java) — menentukan kolom harga
  // (databarang.ralan/beliluar/karyawan/utama) yang dipakai backend utk
  // h_jual, dan diteruskan ke /api/obat/search (jenis_kelas) saat Tambah
  // Obat. Depo bisa dipilih manual (override resolveDepoRalan otomatis) —
  // keduanya memicu refetch item resep, lihat useEffect di bawah.
  const [tarif, setTarif] = React.useState('Rawat Jalan');
  const [depoSelected, setDepoSelected] = React.useState('');
  const [depoOptions, setDepoOptions] = React.useState<{ kode: string; nama: string }[]>([]);

  React.useEffect(() => {
    fetch('/api/apotek/metode-racik')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setMetodeRacikOptions(Array.isArray(data) ? data : []))
      .catch(() => setMetodeRacikOptions([]));
    fetch('/api/apotek/pengaturan/depo/opsi')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setDepoOptions(Array.isArray(data?.bangsal) ? data.bangsal : []))
      .catch(() => setDepoOptions([]));
  }, []);

  // Reset Tarif/Depo ke default tiap kali modal dibuka utk resep berbeda —
  // efek fetch di bawah (deps [resep, tarif, depoSelected]) yang benar-benar
  // ambil datanya, ini cuma reset pilihan.
  React.useEffect(() => {
    setTarif('Rawat Jalan');
    setDepoSelected('');
  }, [resep]);

  const now = React.useMemo(() => new Date(), []);
  const [tanggal, setTanggal] = React.useState(() => now.toISOString().slice(0, 10));
  const [jam, setJam] = React.useState(() => pad2(now.getHours()));
  const [menit, setMenit] = React.useState(() => pad2(now.getMinutes()));
  const [detik, setDetik] = React.useState(() => pad2(now.getSeconds()));
  const [waktuOtomatis, setWaktuOtomatis] = React.useState(true);

  React.useEffect(() => {
    if (!waktuOtomatis) return;
    const t = setInterval(() => {
      const n = new Date();
      setJam(pad2(n.getHours()));
      setMenit(pad2(n.getMinutes()));
      setDetik(pad2(n.getSeconds()));
    }, 1000);
    return () => clearInterval(t);
  }, [waktuOtomatis]);

  React.useEffect(() => {
    if (!resep) {
      setDetail(null);
      setSubTab('non-racikan');
      setSelectedRacikNo(null);
      setDeletedRacikNos([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setDeletedRacikNos([]);
    const params = new URLSearchParams();
    if (tarif) params.set('tarif', tarif);
    if (depoSelected) params.set('kd_bangsal', depoSelected);
    fetch(`/api/permintaan-resep/${kind}/${encodeURIComponent(resep.no_resep)}/items?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          setDetail(data);
          setSubTab(data && data.non_racikan.length === 0 && data.racikan.length > 0 ? 'racikan' : 'non-racikan');
          setSelectedRacikNo(data && data.racikan.length > 0 ? data.racikan[0].no_racik : null);
        }
      })
      .catch(() => {
        if (!cancelled) setDetail({ no_rawat: '', kd_bangsal: '', nm_bangsal: '', total: 0, ppn: 0, total_ppn: 0, non_racikan: [], racikan: [] });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resep, tarif, depoSelected, kind]);

  // Ganti Tarif/Depo memuat ULANG seluruh daftar item dari server (harga &
  // stok beda per tarif/depo) — kalau resep sudah dimuat (berarti user
  // MUNGKIN sudah mengedit jumlah/kandungan/nambah-hapus obat), konfirmasi
  // dulu supaya tidak kehilangan perubahan yang belum Simpan tanpa sadar.
  const handleTarifChange = async (value: string) => {
    if (value === tarif) return;
    if (detail) {
      const confirm = await Swal.fire({
        title: 'Ganti Tarif?',
        text: 'Harga & daftar obat akan dimuat ulang dari database. Perubahan yang belum disimpan (jumlah, kandungan, obat yang ditambah/dihapus) akan hilang.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ganti',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#dc2626',
      });
      if (!confirm.isConfirmed) return;
    }
    setTarif(value);
  };

  const handleDepoChange = async (value: string) => {
    if (value === depoSelected) return;
    if (detail) {
      const confirm = await Swal.fire({
        title: 'Ganti Depo?',
        text: 'Stok & daftar obat akan dimuat ulang dari database sesuai depo baru. Perubahan yang belum disimpan (jumlah, kandungan, obat yang ditambah/dihapus) akan hilang.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ganti',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#dc2626',
      });
      if (!confirm.isConfirmed) return;
    }
    setDepoSelected(value);
  };

  // Jumlah/Emb/Tsl/Aturan Pakai baris yang SUDAH ADA di daftar diedit
  // langsung inline di sel tabel (pola sama persis kolom Jumlah di
  // ApotekPermintaan.tsx — <input> langsung di sel, tanpa tombol/modal
  // terpisah). Modal kecil di bawah ini SEKARANG cuma dipakai untuk alur
  // "Tambah Obat" (item baru dari pencarian, isi jumlah/aturan pakai/emb/
  // tsl awal sebelum benar-benar masuk daftar).
  // target menentukan mau ditambah ke Non Racikan atau ke racikan tertentu
  // (kandungan cuma dipakai utk racikan, aturanPakai & kemasan cuma dipakai
  // utk non-racikan — lihat saveEditModal).
  const [editModal, setEditModal] = React.useState<{
    item: ObatSearchResult;
    target: { kind: 'non-racikan' } | { kind: 'racikan'; noRacik: number; jmlDr: number };
    jml: string;
    aturanPakai: string;
    kandungan: string;
    embalase: string;
    tuslah: string;
    kemasan: boolean;
  } | null>(null);

  // "K" (kolom pertama tabModeobat Java) — konversi satuan besar/kemasan,
  // padanan persis DlgCariObat.java (~baris 1411-1477): dicentang berarti
  // Jumlah diisi dalam satuan kemasan (mis. box/dus), lalu dibagi
  // databarang.kapasitas ("isi per kemasan") sebelum dipakai potong stok &
  // billing. HANYA untuk Non Racikan (key: kode_brng) — tabel item Racikan
  // di DlgCariObat.java TIDAK punya kolom K, racikan selalu diinput dalam
  // satuan dasar (dikonfirmasi user dari screenshot tampilan asli Java).
  const [kemasanKeys, setKemasanKeys] = React.useState<Set<string>>(new Set());

  // Jumlah efektif (satuan dasar) yang benar-benar dipakai untuk billing &
  // potong stok — sama seperti Java: K dicentang -> jumlah/kapasitas.
  const effectiveJml = (jml: number, kapasitas: number, isKemasan: boolean) => (isKemasan ? jml / (kapasitas || 1) : jml);

  const toggleKemasanNonRacikan = (kodeBrng: string) => {
    const willBeKemasan = !kemasanKeys.has(kodeBrng);
    setKemasanKeys((prev) => {
      const next = new Set(prev);
      if (willBeKemasan) next.add(kodeBrng);
      else next.delete(kodeBrng);
      return next;
    });
    setDetail((d) => {
      if (!d) return d;
      return recomputeTotals({
        ...d,
        non_racikan: d.non_racikan.map((it) => {
          if (it.kode_brng !== kodeBrng) return it;
          const eff = effectiveJml(it.jml, it.kapasitas, willBeKemasan);
          return { ...it, subtotal: eff * it.h_jual + it.embalase + it.tuslah };
        }),
      });
    });
  };


  // Tambah Obat — cari & tambahkan baris non-racikan baru ke resep
  // (padanan tambahan barang di tbObat DlgCariObat.java yang bisa dicari
  // lewat kolom pencarian, bukan cuma barang yang sudah ada di resep).
  const [addSearch, setAddSearch] = React.useState('');
  const [addResults, setAddResults] = React.useState<ObatSearchResult[]>([]);
  const [addLoading, setAddLoading] = React.useState(false);

  const recomputeTotals = (d: ResepItems): ResepItems => {
    const totalNonRacikan = d.non_racikan.reduce((s, it) => s + it.subtotal, 0);
    const totalRacikan = d.racikan.reduce((s, rc) => s + rc.detail.reduce((s2, dd) => s2 + dd.subtotal, 0), 0);
    const total = totalNonRacikan + totalRacikan;
    const ppn = total * 0.11;
    return { ...d, total, ppn, total_ppn: total + ppn };
  };

  const saveEditModal = () => {
    if (!editModal || !detail) {
      setEditModal(null);
      return;
    }
    const item = editModal.item;
    const newJml = Math.max(0, Number(editModal.jml) || 0);
    const newEmb = Math.max(0, Number(editModal.embalase) || 0);
    const newTsl = Math.max(0, Number(editModal.tuslah) || 0);
    const kapasitas = Number(item.kapasitas) || 1;

    if (editModal.target.kind === 'racikan') {
      const noRacik = editModal.target.noRacik;
      const existing = detail.racikan.find((rc) => rc.no_racik === noRacik)?.detail.find((d) => d.kode_brng === item.kode_brng);
      const newDetailItem: ResepRacikanDetail = {
        kode_brng: item.kode_brng,
        nama_brng: item.nama_brng,
        kandungan: editModal.kandungan,
        jml: newJml,
        kode_sat: item.kode_sat,
        h_jual: item.harga,
        subtotal: newJml * item.harga + newEmb + newTsl,
        jenis_obat: item.jenis_obat,
        embalase: newEmb,
        tuslah: newTsl,
        stok: item.stok,
        nama_industri: '',
        h_beli: 0,
        kategori: '',
        golongan: '',
        no_batch: '-',
        no_faktur: '-',
        kapasitas,
        kadaluarsa: '',
      };
      const racikan = detail.racikan.map((rc) =>
        rc.no_racik === noRacik
          ? { ...rc, detail: existing ? rc.detail.map((d) => (d.kode_brng === item.kode_brng ? newDetailItem : d)) : [...rc.detail, newDetailItem] }
          : rc
      );
      setDetail(recomputeTotals({ ...detail, racikan }));
      setEditModal(null);
      return;
    }

    const eff = effectiveJml(newJml, kapasitas, editModal.kemasan);
    const existing = detail.non_racikan.find((it) => it.kode_brng === item.kode_brng);
    const nonRacikan = existing
      ? detail.non_racikan.map((it) =>
          it.kode_brng === item.kode_brng
            ? { ...it, jml: newJml, kapasitas, embalase: newEmb, tuslah: newTsl, subtotal: eff * it.h_jual + newEmb + newTsl, aturan_pakai: editModal.aturanPakai }
            : it
        )
      : [
          ...detail.non_racikan,
          {
            kode_brng: item.kode_brng,
            nama_brng: item.nama_brng,
            jml: newJml,
            kode_sat: item.kode_sat,
            aturan_pakai: editModal.aturanPakai,
            h_jual: item.harga,
            subtotal: eff * item.harga + newEmb + newTsl,
            jenis_obat: item.jenis_obat,
            embalase: newEmb,
            tuslah: newTsl,
            stok: item.stok,
            nama_industri: '',
            h_beli: 0,
            kategori: '',
            golongan: '',
            no_batch: '-',
            no_faktur: '-',
            kadaluarsa: '',
            kapasitas,
          },
        ];
    setKemasanKeys((prev) => {
      const next = new Set(prev);
      if (editModal.kemasan) next.add(item.kode_brng);
      else next.delete(item.kode_brng);
      return next;
    });
    setDetail(recomputeTotals({ ...detail, non_racikan: nonRacikan }));
    setSubTab('non-racikan');
    setEditModal(null);
  };

  // Edit inline Jumlah/Emb/Tsl/Aturan Pakai untuk baris yang SUDAH ADA di
  // daftar — pola sama persis kolom Jumlah di ApotekPermintaan.tsx
  // (<input> langsung di sel tabel, commit tiap onChange, tanpa tombol
  // "Ubah"/modal terpisah).
  const setNonRacikanField = (kodeBrng: string, field: 'jml' | 'embalase' | 'tuslah' | 'aturan_pakai', value: string) => {
    if (!detail) return;
    const isKemasan = kemasanKeys.has(kodeBrng);
    setDetail(
      recomputeTotals({
        ...detail,
        non_racikan: detail.non_racikan.map((it) => {
          if (it.kode_brng !== kodeBrng) return it;
          const updated = field === 'aturan_pakai' ? { ...it, aturan_pakai: value } : { ...it, [field]: Math.max(0, Number(value) || 0) };
          const eff = effectiveJml(updated.jml, updated.kapasitas, isKemasan);
          return { ...updated, subtotal: eff * updated.h_jual + updated.embalase + updated.tuslah };
        }),
      })
    );
  };

  // Edit inline header racikan (Nama Racikan/Metode Racik/Jml.Racik/Aturan
  // Pakai/Keterangan) di tabel master — tidak memengaruhi subtotal/total
  // (cuma item obat yang punya harga), jadi tanpa recomputeTotals. Dikirim
  // ke backend lewat racikan_headers saat Simpan (lihat handleSubmit).
  const setRacikanHeaderField = (
    noRacik: number,
    field: 'nama_racik' | 'kd_racik' | 'jml_dr' | 'aturan_pakai' | 'keterangan',
    value: string
  ) => {
    if (!detail) return;
    setDetail({
      ...detail,
      racikan: detail.racikan.map((rc) =>
        rc.no_racik === noRacik ? { ...rc, [field]: field === 'jml_dr' ? Math.max(0, Number(value) || 0) : value } : rc
      ),
    });
  };

  // Hapus racikan (seluruh header + item obatnya) dari daftar yang mau
  // divalidasi — dikonfirmasi dulu karena menghapus satu racikan penuh
  // (beda dari Jumlah=0 yang cuma menghapus satu item obat). no_racik-nya
  // dicatat di deletedRacikNos supaya ikut dihapus dari resep_dokter_racikan
  // (dan detail-nya) di backend saat Simpan.
  const handleHapusRacikan = async (rc: ResepRacikan) => {
    const confirm = await Swal.fire({
      title: `Hapus racikan "${rc.nama_racik}"?`,
      text: 'Seluruh item obat di racikan ini ikut terhapus dari resep yang mau divalidasi.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed || !detail) return;

    const sisaRacikan = detail.racikan.filter((r) => r.no_racik !== rc.no_racik);
    setDetail(recomputeTotals({ ...detail, racikan: sisaRacikan }));
    setDeletedRacikNos((prev) => [...prev, rc.no_racik]);
    setSelectedRacikNo((prev) => (prev === rc.no_racik ? sisaRacikan[0]?.no_racik ?? null : prev));
  };

  // Tambah racikan baru (kosong, siap diisi Nama Racikan/Metode Racik/
  // Jml.Racik/Aturan Pakai/Keterangan lewat edit inline yang sudah ada).
  // no_racik varchar(2) di DB (lihat resep_dokter_racikan) jadi dibatasi
  // 1-99 — cukup untuk pemakaian normal. Racikan baru INSERT (bukan UPDATE)
  // di backend saat Simpan (lihat submitPermintaanResepValidasi: UPSERT
  // by no_racik). Item obatnya belum bisa ditambah dari sini — "Tambah
  // Obat" di footer masih khusus Non Racikan.
  const handleTambahRacikan = () => {
    if (!detail) return;
    const nextNo = Math.min(99, detail.racikan.reduce((m, rc) => Math.max(m, rc.no_racik), 0) + 1);
    const newRacikan: ResepRacikan = {
      no_racik: nextNo,
      nama_racik: '',
      kd_racik: '',
      metode_racik: '',
      jml_dr: 0,
      aturan_pakai: '',
      keterangan: '',
      detail: [],
    };
    setDetail({ ...detail, racikan: [...detail.racikan, newRacikan] });
    setSelectedRacikNo(nextNo);
  };

  // Racikan TIDAK punya kolom K/konversi kemasan (lihat komentar kemasanKeys
  // di atas) — subtotal selalu dihitung langsung dari jml apa adanya.
  const setRacikanField = (noRacik: number, kodeBrng: string, field: 'jml' | 'embalase' | 'tuslah', value: string) => {
    if (!detail) return;
    setDetail(
      recomputeTotals({
        ...detail,
        racikan: detail.racikan.map((rc) =>
          rc.no_racik === noRacik
            ? {
                ...rc,
                detail: rc.detail.map((d) => {
                  if (d.kode_brng !== kodeBrng) return d;
                  const updated = { ...d, [field]: Math.max(0, Number(value) || 0) };
                  return { ...updated, subtotal: updated.jml * updated.h_jual + updated.embalase + updated.tuslah };
                }),
              }
            : rc
        ),
      })
    );
  };

  // "a" -> a; "a/b" -> a/b (dukung input pecahan kandungan mis. "2/3") —
  // padanan persis parsing kandungan di hitungJumlahObatRacikan
  // (ResepModal.tsx, dipakai saat MEMBUAT resep racikan pertama kali).
  const parseKandungan = (kandungan: string): number => {
    if (kandungan.includes('/')) {
      const [num, denom] = kandungan.split('/').map((s) => parseFloat(s.trim()));
      if (isNaN(num) || isNaN(denom) || denom === 0) return NaN;
      return num / denom;
    }
    return parseFloat(kandungan);
  };

  // Kandungan diedit -> Jumlah dihitung ulang otomatis: kandungan * Jml.Racik
  // (jml_dr racikan) / Kps (databarang.kapasitas), padanan persis
  // hitungJumlahObatRacikan di ResepModal.tsx. Kalau kandungan/kapasitas
  // tidak valid, Jumlah dibiarkan seperti sebelumnya (tidak dipaksa 0) biar
  // apoteker tidak kehilangan input jumlah manual yang sudah benar.
  const setRacikanKandungan = (noRacik: number, kodeBrng: string, kandungan: string, jmlDr: number) => {
    if (!detail) return;
    setDetail(
      recomputeTotals({
        ...detail,
        racikan: detail.racikan.map((rc) =>
          rc.no_racik === noRacik
            ? {
                ...rc,
                detail: rc.detail.map((d) => {
                  if (d.kode_brng !== kodeBrng) return d;
                  const kandunganNum = parseKandungan(kandungan);
                  const kapasitas = d.kapasitas || 0;
                  const jml = !isNaN(kandunganNum) && kapasitas > 0 ? Math.round(((kandunganNum * jmlDr) / kapasitas) * 100) / 100 : d.jml;
                  return { ...d, kandungan, jml, subtotal: jml * d.h_jual + d.embalase + d.tuslah };
                }),
              }
            : rc
        ),
      })
    );
  };

  // Jumlah diubah jadi 0 (blur, bukan tiap keystroke, supaya tidak
  // menghapus baris saat user baru mengetik "0" awal sebelum melanjutkan
  // ke "0.5" dst) — artinya obat itu dihapus dari daftar resep yang mau
  // divalidasi, bukan cuma disimpan sebagai baris jml=0. "Simpan" di modal
  // ini TETAP cuma memanggil endpoint /validasi (potong stok + stempel
  // tgl_perawatan) — TIDAK PERNAH memicu alur "Penyerahan" (tombol
  // Penyerahan terpisah, masih placeholder, sengaja tidak disentuh di sini).
  const handleJmlBlurNonRacikan = (kodeBrng: string) => {
    if (!detail) return;
    const it = detail.non_racikan.find((x) => x.kode_brng === kodeBrng);
    if (!it || it.jml > 0) return;
    setKemasanKeys((prev) => {
      if (!prev.has(kodeBrng)) return prev;
      const next = new Set(prev);
      next.delete(kodeBrng);
      return next;
    });
    setDetail(recomputeTotals({ ...detail, non_racikan: detail.non_racikan.filter((x) => x.kode_brng !== kodeBrng) }));
  };

  const handleJmlBlurRacikan = (noRacik: number, kodeBrng: string) => {
    if (!detail) return;
    const rc = detail.racikan.find((r) => r.no_racik === noRacik);
    const dd = rc?.detail.find((x) => x.kode_brng === kodeBrng);
    if (!dd || dd.jml > 0) return;
    setDetail(
      recomputeTotals({
        ...detail,
        racikan: detail.racikan.map((r) => (r.no_racik === noRacik ? { ...r, detail: r.detail.filter((x) => x.kode_brng !== kodeBrng) } : r)),
      })
    );
  };

  React.useEffect(() => {
    if (addSearch.trim().length < 2) {
      setAddResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      setAddLoading(true);
      const kdBangsal = detail?.kd_bangsal || 'AP';
      fetch(`/api/obat/search?query=${encodeURIComponent(addSearch.trim())}&kd_bangsal=${encodeURIComponent(kdBangsal)}&jenis_kelas=${encodeURIComponent(tarif)}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (!cancelled) setAddResults(Array.isArray(data) ? data : []);
        })
        .catch(() => {
          if (!cancelled) setAddResults([]);
        })
        .finally(() => {
          if (!cancelled) setAddLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [addSearch, detail?.kd_bangsal, tarif]);

  // Racikan yang sedang aktif — dipakai handleAddObat utk menentukan target
  // "Tambah Obat" (ke Non Racikan atau ke racikan ini) sekaligus dipakai
  // ulang di render tabel master-detail racikan (subTab === 'racikan').
  const selectedRacik = detail?.racikan.find((rc) => rc.no_racik === selectedRacikNo) || detail?.racikan[0];

  // Pilih obat dari hasil pencarian TIDAK langsung ditambahkan — buka modal
  // kecil dulu supaya apoteker isi jumlah (atau kandungan, utk racikan)
  // sebelum benar-benar masuk ke daftar resep. Kalau lagi di tab Racikan
  // dan ada racikan yang dipilih, obat ditambahkan ke racikan itu; kalau
  // tidak, ditambahkan ke Non Racikan seperti sebelumnya. Kalau obatnya
  // sudah ada di daftar tujuan, modal dibuka dengan nilai yang sudah ada
  // (siap ditambah/diubah), bukan mulai dari kosong.
  const handleAddObat = (item: ObatSearchResult) => {
    if (subTab === 'racikan' && selectedRacik) {
      const existing = selectedRacik.detail.find((d) => d.kode_brng === item.kode_brng);
      const defaultEmb = selectedRacik.detail[0]?.embalase ?? 0;
      const defaultTsl = selectedRacik.detail[0]?.tuslah ?? 0;
      setEditModal({
        item,
        target: { kind: 'racikan', noRacik: selectedRacik.no_racik, jmlDr: selectedRacik.jml_dr },
        jml: existing ? String(existing.jml) : '0',
        aturanPakai: '',
        kandungan: existing?.kandungan || '',
        embalase: String(existing?.embalase ?? defaultEmb),
        tuslah: String(existing?.tuslah ?? defaultTsl),
        kemasan: false,
      });
      setAddSearch('');
      setAddResults([]);
      return;
    }

    const existing = detail?.non_racikan.find((it) => it.kode_brng === item.kode_brng);
    // Default Emb/Tsl obat baru: ikut nilai default system-wide yang sama
    // dengan baris lain (kalau ada baris non-racikan lain untuk dicontoh),
    // fallback '0' kalau daftar masih kosong.
    const defaultEmb = detail?.non_racikan[0]?.embalase ?? 0;
    const defaultTsl = detail?.non_racikan[0]?.tuslah ?? 0;
    setEditModal({
      item,
      target: { kind: 'non-racikan' },
      jml: existing ? String(existing.jml + 1) : '1',
      aturanPakai: existing?.aturan_pakai || '',
      kandungan: '',
      embalase: String(existing?.embalase ?? defaultEmb),
      tuslah: String(existing?.tuslah ?? defaultTsl),
      kemasan: existing ? kemasanKeys.has(existing.kode_brng) : false,
    });
    setAddSearch('');
    setAddResults([]);
  };

  const jumlahCellStyle: React.CSSProperties = { padding: '4px 6px', textAlign: 'right' };
  // Style input inline di sel tabel — pola sama persis kolom Jumlah di
  // ApotekPermintaan.tsx.
  const inlineNumInputStyle: React.CSSProperties = { width: 64, padding: '5px 4px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, textAlign: 'right', outline: 'none', boxSizing: 'border-box' };
  const inlineTextInputStyle: React.CSSProperties = { width: '100%', minWidth: 120, padding: '5px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', boxSizing: 'border-box' };

  // Kolom Aksi (Ubah/Hapus) & Subtotal DIHAPUS DULU dari tabel (per
  // permintaan user, 2026-07-19) — kalau perlu dikembalikan, cek riwayat
  // git untuk implementasi sebelumnya (renderAksiCellNonRacikan/
  // renderAksiCellRacikan + handleHapusNonRacikan/handleHapusRacikanDetail
  // + aksiCellStyle/aksiBtnStyle).

  if (!resep) return null;

  const handleSubmit = async () => {
    const confirm = await Swal.fire({
      title: 'Serahkan obat untuk resep ini?',
      text: 'Stok akan langsung dikurangi sesuai jumlah yang diresepkan. Tindakan ini tidak bisa dibatalkan.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Serahkan & Validasi',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#2563eb',
    });
    if (!confirm.isConfirmed) return;

    // Kolom "K" — cuma berlaku Non Racikan: jumlah yang dikirim ke backend
    // selalu dalam satuan dasar, kalau K dicentang jumlah yang diinput
    // (satuan kemasan) sudah dikonversi (dibagi kapasitas) di sini, persis
    // alur DlgCariObat.java. Racikan tidak punya K, jml dikirim apa adanya.
    const items = [
      ...(detail?.non_racikan || []).map((it) => ({ kode_brng: it.kode_brng, jml: effectiveJml(it.jml, it.kapasitas, kemasanKeys.has(it.kode_brng)) })),
      ...(detail?.racikan || []).flatMap((rc) => rc.detail.map((d) => ({ kode_brng: d.kode_brng, jml: d.jml }))),
    ];
    // Edit inline Nama Racikan/Metode Racik/Jml.Racik/Aturan Pakai/
    // Keterangan (tabel master racikan) ikut disimpan ke resep_dokter_racikan
    // bareng transaksi validasi — lihat submitPermintaanResepValidasi.
    const racikanHeaders = (detail?.racikan || []).map((rc) => ({
      no_racik: rc.no_racik,
      nama_racik: rc.nama_racik,
      kd_racik: rc.kd_racik,
      jml_dr: rc.jml_dr,
      aturan_pakai: rc.aturan_pakai,
      keterangan: rc.keterangan,
    }));

    setSaving(true);
    try {
      const res = await fetch(`/api/permintaan-resep/${kind}/${encodeURIComponent(resep.no_resep)}/validasi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          petugas: getCurrentPetugas(),
          items,
          racikan_headers: racikanHeaders,
          deleted_racikan: deletedRacikNos,
          kd_bangsal: depoSelected || detail?.kd_bangsal || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memvalidasi resep');
      onValidated();
      onClose();
      Swal.fire({ icon: 'success', title: 'Obat berhasil diserahkan, resep tervalidasi', timer: 2200, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: 20 }}
      onClick={() => !saving && onClose()}
    >
      <div
        style={{ background: '#F3F4F6', borderRadius: 20, padding: '35px 8px 8px 8px', position: 'relative', maxWidth: 1600, width: '98vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 16px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>Data Peresepan Obat Oleh Dokter</span>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}>
            ×
          </button>
        </div>

        {/* White Card Content */}
        <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db', padding: 14, overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <fieldset style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '14px 14px 16px', margin: 0 }}>
            <legend style={{ padding: '0 8px', fontSize: 12, color: '#374151' }}>:: Data Obat, Alkes &amp; BHP Medis ::</legend>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Row label="No.Rawat">
                <input readOnly value={detail?.no_rawat || ''} style={{ ...pillReadOnly, flex: '0 0 150px' }} />
                <div style={{ width: 60, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: '#111827' }}>No.RM :</div>
                <input readOnly value={resep.no_rkm_medis} style={{ ...pillReadOnly, flex: '0 0 80px' }} />
                <div style={{ width: 84, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: '#111827' }}>Nama Pasien :</div>
                <input readOnly value={resep.nm_pasien} style={{ ...pillReadOnly, flex: '0 0 250px' }} />
              </Row>

              <Row label="Tanggal">
                <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} disabled={waktuOtomatis} style={{ ...(waktuOtomatis ? pillReadOnly : pillInput), flex: '0 0 148px' }} />
                <PillSelect value={jam} onChange={setJam} options={range(24)} style={{ flex: '0 0 60px' }} disabled={waktuOtomatis} />
                <PillSelect value={menit} onChange={setMenit} options={range(60)} style={{ flex: '0 0 60px' }} disabled={waktuOtomatis} />
                <PillSelect value={detik} onChange={setDetik} options={range(60)} style={{ flex: '0 0 60px' }} disabled={waktuOtomatis} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#6b7280', flexShrink: 0, cursor: 'pointer' }}>
                  <input type="checkbox" checked={waktuOtomatis} onChange={(e) => setWaktuOtomatis(e.target.checked)} />
                  Waktu Sekarang
                </label>
                <div style={{ width: 40, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: '#111827' }}>Tarif :</div>
                <PillSelect
                  value={tarif}
                  onChange={handleTarifChange}
                  options={['Rawat Jalan', 'Beli Luar', 'Karyawan', 'Utama/BPJS'].map((v) => ({ value: v, label: v }))}
                  style={{ flex: '0 0 150px' }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#6b7280', flexShrink: 0 }}>
                  <input type="checkbox" checked readOnly disabled />
                  No.Resep
                </label>
              </Row>

              <Row label="Total">
                <input readOnly value={formatRupiah(detail?.total || 0)} style={{ ...pillReadOnly, flex: '0 0 120px', textAlign: 'right' }} />
                <div style={{ width: 40, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: '#111827' }}>PPN :</div>
                <input readOnly value={formatRupiah(detail?.ppn || 0)} style={{ ...pillReadOnly, flex: '0 0 100px', textAlign: 'right' }} />
                <div style={{ width: 76, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: '#111827' }}>Total+PPN :</div>
                <input readOnly value={formatRupiah(detail?.total_ppn || 0)} style={{ ...pillReadOnly, flex: '0 0 120px', textAlign: 'right' }} />
                <div style={{ width: 44, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: '#111827' }}>Depo :</div>
                <PillSelect
                  value={depoSelected || detail?.kd_bangsal || ''}
                  onChange={handleDepoChange}
                  options={[
                    ...(detail?.kd_bangsal && !depoOptions.some((d) => d.kode === detail.kd_bangsal)
                      ? [{ value: detail.kd_bangsal, label: `${detail.kd_bangsal} - ${detail.nm_bangsal}` }]
                      : []),
                    ...depoOptions.map((d) => ({ value: d.kode, label: `${d.kode} - ${d.nama}` })),
                  ]}
                  style={{ flex: '0 0 240px' }}
                />
              </Row>
            </div>
          </fieldset>

          <div style={{ fontSize: 11.5, color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 10px' }}>
          Kolom "K" — jumlah yang dikirim ke selalu dalam satuan dasar; kalau K dicentang, jumlah yang diinput (satuan kemasan) sudah dikonversi ke satuan dasar (dibagi kapasitas) di sini
          </div>

          {/* Segmented Control — Non Racikan / Racikan (tengah) + Tambah
              Racikan (kanan, cuma tab Racikan) sebaris */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
            <span />
            <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 12, padding: 4, gap: 4, justifySelf: 'center' }}>
              {([
                { key: 'non-racikan', label: `Non Racikan${detail ? ` (${detail.non_racikan.length})` : ''}` },
                { key: 'racikan', label: `Racikan${detail ? ` (${detail.racikan.length})` : ''}` },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setSubTab(t.key)}
                  style={{
                    padding: '6px 18px',
                    borderRadius: 8,
                    border: subTab === t.key ? '1px solid #2563eb' : '1px solid transparent',
                    background: subTab === t.key ? '#ffffff' : 'transparent',
                    color: subTab === t.key ? '#2563eb' : '#6b7280',
                    cursor: 'pointer',
                    fontSize: 12.5,
                    fontWeight: subTab === t.key ? 600 : 400,
                    transition: 'all 0.2s ease',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ justifySelf: 'end' }}>
              {subTab === 'racikan' && (
                <button
                  type="button"
                  onClick={handleTambahRacikan}
                  style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #2563eb', background: '#ffffff', color: '#2563eb', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                >
                  + Tambah Racikan
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 12.5 }}>Memuat item resep...</div>
          ) : subTab === 'non-racikan' ? (
            (detail?.non_racikan.length || 0) === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 12.5 }}>Tidak ada obat non-racikan pada resep ini</div>
            ) : (
              <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '4px 6px', textAlign: 'center' }}>K</th>
                    <th style={{ padding: '4px 6px', textAlign: 'right' }}>Jumlah</th>
                    <th style={{ padding: '4px 6px', textAlign: 'left' }}>Kode Barang</th>
                    <th style={{ padding: '4px 6px', textAlign: 'left' }}>Nama Barang</th>
                    <th style={{ padding: '4px 6px', textAlign: 'left' }}>Satuan</th>
                    <th style={{ padding: '4px 6px', textAlign: 'left' }}>Kandungan</th>
                    <th style={{ padding: '4px 6px', textAlign: 'right' }}>Harga(Rp)</th>
                    <th style={{ padding: '4px 6px', textAlign: 'left' }}>Jenis Obat</th>
                    <th style={{ padding: '4px 6px', textAlign: 'right' }}>Emb</th>
                    <th style={{ padding: '4px 6px', textAlign: 'right' }}>Tsl</th>
                    <th style={{ padding: '4px 6px', textAlign: 'right' }}>Stok</th>
                    <th style={{ padding: '4px 6px', textAlign: 'left' }}>Aturan Pakai</th>
                    <th style={{ padding: '4px 6px', textAlign: 'left' }}>I.F.</th>
                    <th style={{ padding: '4px 6px', textAlign: 'right' }}>H.Beli</th>
                    <th style={{ padding: '4px 6px', textAlign: 'left' }}>Kategori</th>
                    <th style={{ padding: '4px 6px', textAlign: 'left' }}>Golongan</th>
                    <th style={{ padding: '4px 6px', textAlign: 'left' }}>No.Batch</th>
                    <th style={{ padding: '4px 6px', textAlign: 'left' }}>No.Faktur</th>
                    <th style={{ padding: '4px 6px', textAlign: 'left' }}>Kadaluarsa</th>
                  </tr>
                </thead>
                <tbody>
                  {detail!.non_racikan.map((it) => {
                    const isKemasan = kemasanKeys.has(it.kode_brng);
                    return (
                      <tr key={it.kode_brng} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isKemasan}
                            onChange={() => toggleKemasanNonRacikan(it.kode_brng)}
                            title="Jumlah diisi dalam satuan kemasan (konversi ke satuan dasar sebelum potong stok)"
                          />
                        </td>
                        <td style={jumlahCellStyle}>
                          <input
                            type="number"
                            step="any"
                            value={it.jml}
                            onChange={(e) => setNonRacikanField(it.kode_brng, 'jml', e.target.value)}
                            onBlur={() => handleJmlBlurNonRacikan(it.kode_brng)}
                            style={inlineNumInputStyle}
                          />
                          {isKemasan && (
                            <div style={{ fontSize: 9.5, color: '#6b7280', marginTop: 2 }}>
                              = {effectiveJml(it.jml, it.kapasitas, true).toLocaleString('id-ID', { maximumFractionDigits: 2 })} dasar
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '5px 6px', color: '#374151' }}>{it.kode_brng}</td>
                        <td style={{ padding: '5px 6px', color: '#111827' }}>{it.nama_brng}</td>
                        <td style={{ padding: '5px 6px', color: '#374151' }}>{it.kode_sat}</td>
                        <td style={{ padding: '5px 6px', color: '#9ca3af' }}>-</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', color: '#374151' }}>{formatRupiah(it.h_jual)}</td>
                        <td style={{ padding: '5px 6px', color: '#374151' }}>{it.jenis_obat}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                          <input
                            type="number"
                            step="any"
                            value={it.embalase}
                            onChange={(e) => setNonRacikanField(it.kode_brng, 'embalase', e.target.value)}
                            style={inlineNumInputStyle}
                          />
                        </td>
                        <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                          <input
                            type="number"
                            step="any"
                            value={it.tuslah}
                            onChange={(e) => setNonRacikanField(it.kode_brng, 'tuslah', e.target.value)}
                            style={inlineNumInputStyle}
                          />
                        </td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', color: '#374151' }}>{it.stok}</td>
                        <td style={{ padding: '4px 6px' }}>
                          <input
                            type="text"
                            value={it.aturan_pakai}
                            onChange={(e) => setNonRacikanField(it.kode_brng, 'aturan_pakai', e.target.value)}
                            style={inlineTextInputStyle}
                          />
                        </td>
                        <td style={{ padding: '5px 6px', color: '#374151' }}>{it.nama_industri}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', color: '#374151' }}>{formatRupiah(it.h_beli)}</td>
                        <td style={{ padding: '5px 6px', color: '#374151' }}>{it.kategori}</td>
                        <td style={{ padding: '5px 6px', color: '#374151' }}>{it.golongan}</td>
                        <td style={{ padding: '5px 6px', color: '#9ca3af' }}>{it.no_batch}</td>
                        <td style={{ padding: '5px 6px', color: '#9ca3af' }}>{it.no_faktur}</td>
                        <td style={{ padding: '5px 6px', color: '#374151' }}>{it.kadaluarsa || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )
          ) : (detail?.racikan.length || 0) === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 12.5 }}>Tidak ada obat racikan pada resep ini</div>
          ) : (
            (() => {
              const selectedRacik = detail!.racikan.find((rc) => rc.no_racik === selectedRacikNo) || detail!.racikan[0];
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Tabel header racikan — klik baris untuk pilih, padanan
                      tabel "Racikan" di DlgCariObat.java */}
                  <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>
                          <th style={{ padding: '4px 6px', textAlign: 'left' }}>No</th>
                          <th style={{ padding: '4px 6px', textAlign: 'left' }}>Nama Racikan</th>
                          <th style={{ padding: '4px 6px', textAlign: 'left' }}>Metode Racik</th>
                          <th style={{ padding: '4px 6px', textAlign: 'right' }}>Jml.Racik</th>
                          <th style={{ padding: '4px 6px', textAlign: 'left' }}>Aturan Pakai</th>
                          <th style={{ padding: '4px 6px', textAlign: 'left' }}>Keterangan</th>
                          <th style={{ padding: '4px 6px', textAlign: 'center' }}>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail!.racikan.map((rc, idx) => {
                          const isSelected = rc.no_racik === selectedRacik?.no_racik;
                          return (
                            <tr
                              key={rc.no_racik}
                              onClick={() => setSelectedRacikNo(rc.no_racik)}
                              style={{ cursor: 'pointer', background: isSelected ? '#eff6ff' : 'transparent', borderBottom: '1px solid #f3f4f6' }}
                            >
                              <td style={{ padding: '5px 6px', color: '#374151' }}>{idx + 1}</td>
                              <td style={{ padding: '4px 6px' }}>
                                <input
                                  type="text"
                                  value={rc.nama_racik}
                                  onFocus={() => setSelectedRacikNo(rc.no_racik)}
                                  onChange={(e) => setRacikanHeaderField(rc.no_racik, 'nama_racik', e.target.value)}
                                  style={inlineTextInputStyle}
                                />
                              </td>
                              <td style={{ padding: '4px 6px' }}>
                                <select
                                  value={rc.kd_racik}
                                  onFocus={() => setSelectedRacikNo(rc.no_racik)}
                                  onChange={(e) => setRacikanHeaderField(rc.no_racik, 'kd_racik', e.target.value)}
                                  style={inlineTextInputStyle}
                                >
                                  {!metodeRacikOptions.some((m) => m.kd_racik === rc.kd_racik) && (
                                    <option value={rc.kd_racik}>{rc.kd_racik === '' ? '-- Pilih Metode Racik --' : rc.metode_racik || rc.kd_racik}</option>
                                  )}
                                  {metodeRacikOptions.map((m) => (
                                    <option key={m.kd_racik} value={m.kd_racik}>
                                      {m.nm_racik}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                                <input
                                  type="number"
                                  step="any"
                                  placeholder="-"
                                  value={rc.jml_dr === 0 ? '' : rc.jml_dr}
                                  onFocus={() => setSelectedRacikNo(rc.no_racik)}
                                  onChange={(e) => setRacikanHeaderField(rc.no_racik, 'jml_dr', e.target.value)}
                                  style={{ ...inlineNumInputStyle, color: isSelected ? '#2563eb' : undefined }}
                                />
                              </td>
                              <td style={{ padding: '4px 6px' }}>
                                <input
                                  type="text"
                                  value={rc.aturan_pakai}
                                  onFocus={() => setSelectedRacikNo(rc.no_racik)}
                                  onChange={(e) => setRacikanHeaderField(rc.no_racik, 'aturan_pakai', e.target.value)}
                                  style={inlineTextInputStyle}
                                />
                              </td>
                              <td style={{ padding: '4px 6px' }}>
                                <input
                                  type="text"
                                  value={rc.keterangan}
                                  onFocus={() => setSelectedRacikNo(rc.no_racik)}
                                  onChange={(e) => setRacikanHeaderField(rc.no_racik, 'keterangan', e.target.value)}
                                  style={inlineTextInputStyle}
                                />
                              </td>
                              <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleHapusRacikan(rc)}
                                  title={`Hapus racikan ${rc.nama_racik}`}
                                  style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #dc2626', background: '#ffffff', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}
                                >
                                  Hapus
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Tabel item obat racikan terpilih — tanpa kolom K, racikan
                      selalu diinput satuan dasar (lihat komentar kemasanKeys) */}
                  {selectedRacik && selectedRacik.detail.length === 0 && (
                    <div style={{ padding: '10px 4px', color: '#9ca3af', fontSize: 11.5 }}>
                      Racikan ini belum punya item obat. Cari lewat "Tambah Obat" di bawah untuk menambahkan.
                    </div>
                  )}
                  {selectedRacik && selectedRacik.detail.length > 0 && (
                    <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>
                            <th style={{ padding: '4px 6px', textAlign: 'left' }}>No</th>
                            <th style={{ padding: '4px 6px', textAlign: 'left' }}>Kode Barang</th>
                            <th style={{ padding: '4px 6px', textAlign: 'left' }}>Nama Barang</th>
                            <th style={{ padding: '4px 6px', textAlign: 'left' }}>Satuan</th>
                            <th style={{ padding: '4px 6px', textAlign: 'right' }}>Harga(Rp)</th>
                            <th style={{ padding: '4px 6px', textAlign: 'left' }}>Jenis Obat</th>
                            <th style={{ padding: '4px 6px', textAlign: 'right' }}>Stok</th>
                            <th style={{ padding: '4px 6px', textAlign: 'right' }}>Kps</th>
                            <th style={{ padding: '4px 6px', textAlign: 'left' }}>Kandungan</th>
                            <th style={{ padding: '4px 6px', textAlign: 'right' }}>Jml</th>
                            <th style={{ padding: '4px 6px', textAlign: 'right' }}>Emb</th>
                            <th style={{ padding: '4px 6px', textAlign: 'right' }}>Tsl</th>
                            <th style={{ padding: '4px 6px', textAlign: 'left' }}>I.F.</th>
                            <th style={{ padding: '4px 6px', textAlign: 'left' }}>Kategori</th>
                            <th style={{ padding: '4px 6px', textAlign: 'left' }}>Golongan</th>
                            <th style={{ padding: '4px 6px', textAlign: 'left' }}>No.Batch</th>
                            <th style={{ padding: '4px 6px', textAlign: 'left' }}>No.Faktur</th>
                            <th style={{ padding: '4px 6px', textAlign: 'left' }}>Kadaluarsa</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRacik.detail.map((d, idx) => (
                            <tr key={d.kode_brng} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '5px 6px', color: '#374151' }}>{idx + 1}</td>
                              <td style={{ padding: '5px 6px', color: '#374151' }}>{d.kode_brng}</td>
                              <td style={{ padding: '5px 6px', color: '#111827' }}>{d.nama_brng}</td>
                              <td style={{ padding: '5px 6px', color: '#374151' }}>{d.kode_sat}</td>
                              <td style={{ padding: '5px 6px', textAlign: 'right', color: '#374151' }}>{formatRupiah(d.h_jual)}</td>
                              <td style={{ padding: '5px 6px', color: '#374151' }}>{d.jenis_obat}</td>
                              <td style={{ padding: '5px 6px', textAlign: 'right', color: '#374151' }}>{d.stok}</td>
                              <td style={{ padding: '5px 6px', textAlign: 'right', color: '#374151' }}>{d.kapasitas}</td>
                              <td style={{ padding: '4px 6px' }}>
                                <input
                                  type="text"
                                  value={d.kandungan}
                                  placeholder="mis. 200 atau 2/3"
                                  onChange={(e) => setRacikanKandungan(selectedRacik.no_racik, d.kode_brng, e.target.value, selectedRacik.jml_dr)}
                                  style={inlineTextInputStyle}
                                />
                              </td>
                              <td style={jumlahCellStyle}>
                                <input
                                  type="number"
                                  step="any"
                                  value={d.jml}
                                  onChange={(e) => setRacikanField(selectedRacik.no_racik, d.kode_brng, 'jml', e.target.value)}
                                  onBlur={() => handleJmlBlurRacikan(selectedRacik.no_racik, d.kode_brng)}
                                  style={inlineNumInputStyle}
                                />
                              </td>
                              <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                                <input
                                  type="number"
                                  step="any"
                                  value={d.embalase}
                                  onChange={(e) => setRacikanField(selectedRacik.no_racik, d.kode_brng, 'embalase', e.target.value)}
                                  style={inlineNumInputStyle}
                                />
                              </td>
                              <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                                <input
                                  type="number"
                                  step="any"
                                  value={d.tuslah}
                                  onChange={(e) => setRacikanField(selectedRacik.no_racik, d.kode_brng, 'tuslah', e.target.value)}
                                  style={inlineNumInputStyle}
                                />
                              </td>
                              <td style={{ padding: '5px 6px', color: '#374151' }}>{d.nama_industri}</td>
                              <td style={{ padding: '5px 6px', color: '#374151' }}>{d.kategori}</td>
                              <td style={{ padding: '5px 6px', color: '#374151' }}>{d.golongan}</td>
                              <td style={{ padding: '5px 6px', color: '#9ca3af' }}>{d.no_batch}</td>
                              <td style={{ padding: '5px 6px', color: '#9ca3af' }}>{d.no_faktur}</td>
                              <td style={{ padding: '5px 6px', color: '#374151' }}>{d.kadaluarsa || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()
          )}

          {/* Footer — Tambah Obat (kiri) + tombol aksi (kanan) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginTop: 4, flexWrap: 'wrap', rowGap: 10 }}>
            <div style={{ position: 'relative', flex: '0 1 460px', minWidth: 260, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12.5, color: '#111827', flexShrink: 0, whiteSpace: 'nowrap' }}>
                {subTab === 'racikan' && selectedRacik ? `Tambah Obat ke Racikan "${selectedRacik.nama_racik || '#' + selectedRacik.no_racik}" :` : 'Tambah Obat :'}
              </span>
              <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.3-4.3"></path>
                </svg>
                <input
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  placeholder="Cari kode / nama obat..."
                  style={{ ...pillInput, width: '100%', paddingLeft: 30 }}
                />
                {addSearch.trim().length >= 2 && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: 0,
                      right: 0,
                      marginBottom: 4,
                      background: '#ffffff',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      maxHeight: 220,
                      overflowY: 'auto',
                      boxShadow: '0 -4px 16px rgba(0,0,0,0.12)',
                      zIndex: 1,
                    }}
                  >
                    {addLoading ? (
                      <div style={{ padding: 10, fontSize: 12, color: '#6b7280' }}>Mencari...</div>
                    ) : addResults.length === 0 ? (
                      <div style={{ padding: 10, fontSize: 12, color: '#6b7280' }}>Tidak ditemukan</div>
                    ) : (
                      addResults.map((item) => (
                        <div
                          key={item.kode_brng}
                          onClick={() => handleAddObat(item)}
                          style={{ padding: '7px 10px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div style={{ color: '#111827' }}>{item.nama_brng}</div>
                          <div style={{ color: '#9ca3af', fontSize: 11 }}>
                            {item.kode_brng} · Stok {item.stok} · Rp {formatRupiah(item.harga)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#6b7280', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}
              >
                Tutup
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={saving || loading}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: saving || loading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}
              >
                {saving ? 'Memproses...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    {editModal && (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={() => setEditModal(null)}
      >
        <div
          style={{ background: '#ffffff', borderRadius: 12, padding: 20, width: 340, maxWidth: '90vw', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
            {editModal.target.kind === 'racikan' ? 'Tambah Obat ke Racikan' : 'Tambah Obat'}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
            {editModal.item.nama_brng}
            {editModal.target.kind === 'racikan' && <> · Kps {Number(editModal.item.kapasitas) || 1}</>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {editModal.target.kind === 'racikan' && (
              <label style={{ fontSize: 12, color: '#374151' }}>
                Kandungan
                <input
                  type="text"
                  autoFocus
                  placeholder="mis. 200 atau 2/3"
                  value={editModal.kandungan}
                  onChange={(e) => {
                    const target = editModal.target;
                    if (target.kind !== 'racikan') return;
                    const kandunganNum = parseKandungan(e.target.value);
                    const kapasitas = Number(editModal.item.kapasitas) || 1;
                    const computed = !isNaN(kandunganNum) && kapasitas > 0 ? Math.round(((kandunganNum * target.jmlDr) / kapasitas) * 100) / 100 : null;
                    setEditModal({ ...editModal, kandungan: e.target.value, jml: computed !== null ? String(computed) : editModal.jml });
                  }}
                  style={{ ...pillInput, display: 'block', width: '100%', marginTop: 4, borderRadius: 4 }}
                />
              </label>
            )}

            {editModal.target.kind === 'racikan' ? (
              <label style={{ fontSize: 12, color: '#374151' }}>
                Jumlah
                <input
                  type="number"
                  step="any"
                  value={editModal.jml}
                  onChange={(e) => setEditModal({ ...editModal, jml: e.target.value })}
                  style={{ ...pillInput, display: 'block', width: '100%', marginTop: 4, borderRadius: 4 }}
                />
              </label>
            ) : (
              <div style={{ display: 'flex', gap: 10 }}>
                <label style={{ fontSize: 12, color: '#374151', width: 64, flexShrink: 0 }}>
                  Jumlah
                  <input
                    type="number"
                    step="any"
                    autoFocus
                    value={editModal.jml}
                    onChange={(e) => setEditModal({ ...editModal, jml: e.target.value })}
                    style={{ ...pillInput, display: 'block', width: '100%', marginTop: 4, borderRadius: 4 }}
                  />
                </label>
                <label style={{ fontSize: 12, color: '#374151', flex: 1, minWidth: 0 }}>
                  Aturan Pakai
                  <input
                    value={editModal.aturanPakai}
                    onChange={(e) => setEditModal({ ...editModal, aturanPakai: e.target.value })}
                    style={{ ...pillInput, display: 'block', width: '100%', marginTop: 4, borderRadius: 4 }}
                  />
                </label>
              </div>
            )}

            {editModal.target.kind === 'non-racikan' && (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#374151', cursor: 'pointer' }}>
                  <input type="checkbox" checked={editModal.kemasan} onChange={(e) => setEditModal({ ...editModal, kemasan: e.target.checked })} />
                  Jumlah dalam satuan kemasan (K)
                </label>
                {editModal.kemasan && (
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: -4 }}>
                    = {effectiveJml(Number(editModal.jml) || 0, Number(editModal.item.kapasitas) || 1, true).toLocaleString('id-ID', { maximumFractionDigits: 2 })} {editModal.item.kode_sat} satuan dasar
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ fontSize: 12, color: '#374151', flex: 1 }}>
                Embalase
                <input
                  type="number"
                  step="any"
                  value={editModal.embalase}
                  onChange={(e) => setEditModal({ ...editModal, embalase: e.target.value })}
                  style={{ ...pillInput, display: 'block', width: '100%', marginTop: 4, borderRadius: 4 }}
                />
              </label>
              <label style={{ fontSize: 12, color: '#374151', flex: 1 }}>
                Tuslah
                <input
                  type="number"
                  step="any"
                  value={editModal.tuslah}
                  onChange={(e) => setEditModal({ ...editModal, tuslah: e.target.value })}
                  style={{ ...pillInput, display: 'block', width: '100%', marginTop: 4, borderRadius: 4 }}
                />
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button
              type="button"
              onClick={() => setEditModal(null)}
              style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={saveEditModal}
              style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
            >
              Tambahkan
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

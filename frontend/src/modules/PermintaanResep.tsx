import React from 'react';
import Swal from 'sweetalert2';
import { ModalValidasiObat, ResepItems } from '../components/ModalValidasiObat';
import { RiwayatModal } from '../components/RiwayatModal';
import { ModalPenyerahanResep } from '../components/ModalPenyerahanResep';
import { ModalTelaahResep } from '../components/ModalTelaahResep';
import { ModalKonselingFarmasi } from '../components/ModalKonselingFarmasi';
import { localDateStr } from '../utils/date';
import { toSpokenCase } from '../utils/tts';
import { getCurrentPetugas, getCurrentUserNip } from '../utils/currentUser';

// ============================================================================
// PERMINTAAN RESEP — dipicu dari tab 'permintaan-resep' di sidebar Apotek
// (frontend/src/modules/Apotek.tsx), TAPI dirender sebagai overlay
// layar-penuh yang menutupi seluruh halaman Apotek (bukan konten inline di
// dalam card Apotek) — mendekati DlgDaftarPermintaanResep.java yang juga
// dialog/form tersendiri di Java, bukan tab menyatu. Sub-navigasi 11 item
// di dalamnya pakai pola nested-sidebar yang sama dengan
// ApotekPengaturanView (nav list di kiri + panel konten di kanan).
//
// Cocok dengan dialog Khanza Desktop inventory/DlgDaftarPermintaanResep.java
// (5515 baris — dialog terbesar yang pernah kami temui di Khanza) beserta
// 10 dialog terpisah yang dibuka dari tombol-tombolnya. FASE 1: hanya tab
// "Dashboard" (antrean resep ralan) yang nyata, 10 tab lain placeholder —
// digarap satu-satu di giliran berikutnya. Lihat
// backend/permintaan_resep_handler.go untuk detail replikasi query Java.
// ============================================================================

const pillSelectStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 32px 7px 14px',
  borderRadius: 4,
  border: '1px solid #d1d5db',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
  background: '#ffffff',
  color: '#111827',
  appearance: 'none',
  WebkitAppearance: 'none',
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 14px',
  borderRadius: 4,
  border: '1px solid #d1d5db',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
};

// Ikon panah atas/bawah bulat biru — padanan StepperIcon di
// ModalValidasiObat.tsx, dipasang di atas <select appearance:none> yang
// paddingRight-nya sudah menyisakan ruang (pillSelectStyle).
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
      background: '#059669',
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

const todayStr = () => localDateStr();

type PermintaanResepTab =
  | 'dashboard'
  | 'riwayat-pasien'
  | 'obat-tervalidasi'
  | 'telaah-resep'
  | 'konseling-farmasi'
  | 'informasi-obat'
  | 'cetak-resep-awal'
  | 'resep-luar'
  | 'piutang-obat'
  | 'data-sep-bpjs'
  | 'obat-online-bpjs';

const MENU: { key: PermintaanResepTab; label: string; icon: React.ReactNode }[] = [
  {
    key: 'dashboard',
    label: 'Daftar Resep Dokter',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
        <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
        <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
        <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
      </svg>
    ),
  },
  {
    key: 'riwayat-pasien',
    label: 'Riwayat Pasien',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v5h5"></path>
        <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"></path>
        <path d="M12 7v5l4 2"></path>
      </svg>
    ),
  },
  {
    key: 'obat-tervalidasi',
    label: 'Obat Tervalidasi',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"></path>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
      </svg>
    ),
  },
  {
    key: 'telaah-resep',
    label: 'Telaah Resep',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path>
        <path d="M14 2v6h6"></path>
        <path d="M9 15h6"></path>
        <path d="M9 11h6"></path>
      </svg>
    ),
  },
  {
    key: 'konseling-farmasi',
    label: 'Konseling Farmasi',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    ),
  },
  {
    key: 'informasi-obat',
    label: 'Informasi Obat',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 16v-4"></path>
        <path d="M12 8h.01"></path>
      </svg>
    ),
  },
  {
    key: 'cetak-resep-awal',
    label: 'Cetak Resep Awal',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 6 2 18 2 18 9"></polyline>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
        <rect x="6" y="14" width="12" height="8"></rect>
      </svg>
    ),
  },
  {
    key: 'resep-luar',
    label: 'Resep Luar',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3 21 7 17 11"></path>
        <path d="M3 7h18"></path>
        <path d="M7 21 3 17 7 13"></path>
        <path d="M21 17H3"></path>
      </svg>
    ),
  },
  {
    key: 'piutang-obat',
    label: 'Piutang Obat',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"></line>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
      </svg>
    ),
  },
  {
    key: 'data-sep-bpjs',
    label: 'Data Sep BPJS',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path>
        <path d="M14 2v6h6"></path>
      </svg>
    ),
  },
  {
    key: 'obat-online-bpjs',
    label: 'Obat Apotek Online BPJS',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M2 12h20"></path>
        <path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"></path>
      </svg>
    ),
  },
];

const Placeholder: React.FC<{ title: string }> = ({ title }) => (
  <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 16, background: '#ffffff' }}>
    Fitur {title} akan dikembangkan berikutnya.
  </div>
);

// ---- Tab: Daftar Resep Dokter (antrean resep ralan masuk apotek) -----------

export type ResepRalanRow = {
  no_resep: string;
  tgl_peresepan: string;
  jam_peresepan: string;
  no_rawat: string;
  no_rkm_medis: string;
  nm_pasien: string;
  kd_dokter: string;
  nm_dokter: string;
  status: string;
  nm_poli: string;
  kd_poli: string;
  jenis_bayar: string;
  tgl_validasi: string;
  jam_validasi: string;
  tgl_penyerahan: string;
  jam_penyerahan: string;
  sdh_telaah: boolean;
  sdh_konseling: boolean;
};


type PasienRingkas = { no_rkm_medis: string; nm_pasien: string };
type SelectedResep = { no_resep: string; kind: 'ralan' | 'ranap'; status: string; nm_pasien: string; no_rkm_medis: string };

const TabResepRalan: React.FC<{ onSelectPasien: (p: PasienRingkas) => void; onSelectResep: (r: SelectedResep) => void }> = ({
  onSelectPasien,
  onSelectResep,
}) => {
  const [tgl1, setTgl1] = React.useState(todayStr());
  const [tgl2, setTgl2] = React.useState(todayStr());
  const [dokter, setDokter] = React.useState('');
  const [poli, setPoli] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [searchText, setSearchText] = React.useState('');
  const [items, setItems] = React.useState<ResepRalanRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [itemsDetail, setItemsDetail] = React.useState<Record<string, ResepItems>>({});
  const [loadingDetail, setLoadingDetail] = React.useState<string | null>(null);
  const [validasiRow, setValidasiRow] = React.useState<ResepRalanRow | null>(null);
  const [dokterOptions, setDokterOptions] = React.useState<{ kd_dokter: string; nm_dokter: string }[]>([]);
  const [poliOptions, setPoliOptions] = React.useState<{ kd_poli: string; nm_poli: string }[]>([]);
  // Sub-tab dalam Rawat Jalan — padanan TabRawatJalan.addTab("Detail Rawat
  // Jalan", ...) di DlgDaftarPermintaanResep.java: laporan flat semua resep
  // (sesuai filter aktif) + item obatnya sekaligus, tanpa perlu klik expand
  // satu-satu seperti tab "Daftar Resep Dokter".
  const [ralanView, setRalanView] = React.useState<'daftar' | 'detail'>('daftar');
  const [loadingAllDetail, setLoadingAllDetail] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/dokter')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setDokterOptions(Array.isArray(data) ? data : []))
      .catch(() => setDokterOptions([]));
    fetch('/api/pendaftaran/poli')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPoliOptions(Array.isArray(data) ? data : []))
      .catch(() => setPoliOptions([]));
  }, []);
  // Modal Penyerahan — padanan BtnPenyerahanActionPerformed di
  // DlgDaftarPermintaanResep.java (yang di Java buka jendela terpisah ke
  // webapps/penyerahanresep/index.php?act=Kamera). Di sini modal kamera
  // native (ModalPenyerahanResep.tsx) langsung di halaman yang sama,
  // tabel antrian sementara `antriapotek3` yang dipakai Java buat
  // mengoper no_resep antar window DILEWATI (tidak perlu, no_resep sudah
  // ada di `row` React) — hasil akhir identik: baris baru di
  // bukti_penyerahan_resep_obat + resep_obat.tgl_penyerahan/
  // jam_penyerahan ter-update (lihat backend/permintaan_resep_penyerahan_handler.go).
  const [penyerahanRow, setPenyerahanRow] = React.useState<ResepRalanRow | null>(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/permintaan-resep/ralan?tgl1=${tgl1}&tgl2=${tgl2}`;
      if (dokter) url += `&dokter=${encodeURIComponent(dokter)}`;
      if (poli) url += `&poli=${encodeURIComponent(poli)}`;
      if (status) url += `&status=${encodeURIComponent(status)}`;
      if (searchText) url += `&search=${encodeURIComponent(searchText)}`;
      const res = await fetch(url);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tgl1, tgl2, dokter, poli, status, searchText]);

  const isFirst = React.useRef(true);
  React.useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      fetchData();
      return;
    }
    const t = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tgl1, tgl2, dokter, poli, status, searchText]);

  // Auto-refresh tiap 30 detik — supaya resep baru yang masuk sementara
  // layar ini terbuka langsung kelihatan tanpa perlu ganti filter/reload
  // manual. Efek dipisah dari debounce di atas & bergantung ke fetchData
  // (useCallback dgn deps filter) supaya intervalnya selalu pakai filter
  // TERBARU, bukan closure basi dari saat pertama mount.
  React.useEffect(() => {
    const interval = setInterval(() => fetchData(), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const [deletingResep, setDeletingResep] = React.useState<string | null>(null);

  const handleHapusResep = async (row: ResepRalanRow) => {
    const confirm = await Swal.fire({
      title: `Hapus resep ${row.no_resep}?`,
      text: 'Resep dan seluruh item obatnya akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;

    setDeletingResep(row.no_resep);
    try {
      const res = await fetch(`/api/resep/${encodeURIComponent(row.no_resep)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || 'Gagal menghapus resep');
      Swal.fire({ icon: 'success', title: 'Resep berhasil dihapus', timer: 1500, showConfirmButton: false });
      fetchData();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setDeletingResep(null);
    }
  };

  // Bel doorbell (file asli, bukan bangkitan oscillator) — public/sounds/
  // doorbell.mp3 (freesound_community-doorbell-shortened-100308.mp3),
  // diputar via <audio> lalu resolve setelah selesai/error supaya suara
  // panggilan menyusul, bukan tumpang tindih.
  const playBell = (): Promise<void> =>
    new Promise((resolve) => {
      try {
        const audio = new Audio('/sounds/doorbell.mp3');
        audio.addEventListener('ended', () => resolve());
        audio.addEventListener('error', () => resolve());
        audio.play().catch(() => resolve());
      } catch {
        resolve();
      }
    });

  // Panggil pasien — sekarang juga update antrian_apotek (POST
  // /api/antrian/apotek/call-patient) supaya layar display pasien
  // (DisplayAntrianApotek.tsx, yang polling GET .../display) IKUT
  // memanggil/mengumumkan, bukan cuma bunyi lokal di komputer petugas
  // yang klik. Panggilan API dan bel+TTS lokal SENGAJA tidak saling
  // menunggu hasil satu sama lain (Promise.allSettled) — kalau resep
  // ini belum/tidak ada di antrian_apotek (mis. dibuat sebelum trigger
  // auto-insert terpasang), bel+TTS lokal tetap jalan sebagai fallback,
  // cuma dikasih tahu display tidak ikut memanggil.
  const handlePanggilPasien = async (row: ResepRalanRow) => {
    const callApiPromise = fetch('/api/antrian/apotek/call-patient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ no_resep: row.no_resep, petugas_nip: getCurrentUserNip(), petugas_nama: getCurrentPetugas() }),
    });

    const [apiResult] = await Promise.allSettled([callApiPromise, playBell()]);

    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(toSpokenCase(`ATAS NAMA ${row.nm_pasien} SILAHKAN MENUJU LOKET APOTEK`));
    utterance.lang = 'id-ID';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);

    const apiOk = apiResult.status === 'fulfilled' && apiResult.value.ok;
    if (!apiOk) {
      Swal.fire({
        icon: 'warning',
        title: 'Layar display tidak ikut memanggil',
        text: 'Resep ini tidak ditemukan di antrian apotek — suara panggilan cuma diputar di komputer ini.',
        timer: 3500,
        showConfirmButton: false,
      });
    }
  };

  const toggleExpand = async (row: ResepRalanRow) => {
    onSelectPasien({ no_rkm_medis: row.no_rkm_medis, nm_pasien: row.nm_pasien });
    onSelectResep({ no_resep: row.no_resep, kind: 'ralan', status: row.status, nm_pasien: row.nm_pasien, no_rkm_medis: row.no_rkm_medis });
    if (expanded === row.no_resep) {
      setExpanded(null);
      return;
    }
    setExpanded(row.no_resep);
    if (!itemsDetail[row.no_resep]) {
      setLoadingDetail(row.no_resep);
      try {
        const res = await fetch(`/api/permintaan-resep/ralan/${encodeURIComponent(row.no_resep)}/items`);
        const data = await res.json();
        setItemsDetail((prev) => ({ ...prev, [row.no_resep]: data }));
      } catch {
        setItemsDetail((prev) => ({ ...prev, [row.no_resep]: { no_rawat: '', kd_bangsal: '', nm_bangsal: '', total: 0, ppn: 0, total_ppn: 0, non_racikan: [], racikan: [] } }));
      } finally {
        setLoadingDetail(null);
      }
    }
  };

  // Tab "Detail Rawat Jalan" butuh item semua resep yang lolos filter
  // sekaligus (bukan cuma yang di-expand user) — ambil yang belum ada di
  // cache itemsDetail begitu tab ini dibuka atau daftar resep (filter)
  // berubah selagi tab ini aktif.
  React.useEffect(() => {
    if (ralanView !== 'detail' || items.length === 0) return;
    const missing = items.filter((row) => !itemsDetail[row.no_resep]);
    if (missing.length === 0) return;
    let cancelled = false;
    setLoadingAllDetail(true);
    Promise.all(
      missing.map(async (row) => {
        try {
          const res = await fetch(`/api/permintaan-resep/ralan/${encodeURIComponent(row.no_resep)}/items`);
          const data = await res.json();
          return [row.no_resep, data] as const;
        } catch {
          return [row.no_resep, { no_rawat: '', kd_bangsal: '', nm_bangsal: '', total: 0, ppn: 0, total_ppn: 0, non_racikan: [], racikan: [] } as ResepItems] as const;
        }
      })
    ).then((pairs) => {
      if (cancelled) return;
      setItemsDetail((prev) => {
        const next = { ...prev };
        for (const [noResep, data] of pairs) next[noResep] = data;
        return next;
      });
      setLoadingAllDetail(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ralanView, items, itemsDetail]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        {([
          { key: 'daftar', label: 'Daftar Resep Dokter' },
          { key: 'detail', label: 'Detail Rawat Jalan' },
        ] as const).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setRalanView(t.key)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: ralanView === t.key ? '2px solid #059669' : '2px solid transparent',
              background: 'transparent',
              color: ralanView === t.key ? '#059669' : '#6b7280',
              fontWeight: ralanView === t.key ? 600 : 400,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ width: 120 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Dari Tanggal</label>
          <input type="date" style={inputStyle} value={tgl1} onChange={(e) => setTgl1(e.target.value)} />
        </div>
        <div style={{ width: 120 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>s.d. Tanggal</label>
          <input type="date" style={inputStyle} value={tgl2} onChange={(e) => setTgl2(e.target.value)} />
        </div>
        <div style={{ width: 200 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Dokter</label>
          <div style={{ position: 'relative' }}>
            <select value={dokter} onChange={(e) => setDokter(e.target.value)} style={pillSelectStyle}>
              <option value="">Semua Dokter</option>
              {dokterOptions.map((d) => (
                <option key={d.kd_dokter} value={d.nm_dokter}>
                  {d.nm_dokter}
                </option>
              ))}
            </select>
            <StepperIcon />
          </div>
        </div>
        <div style={{ width: 200 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Poli/Unit</label>
          <div style={{ position: 'relative' }}>
            <select value={poli} onChange={(e) => setPoli(e.target.value)} style={pillSelectStyle}>
              <option value="">Semua Poli</option>
              {poliOptions.map((p) => (
                <option key={p.kd_poli} value={p.nm_poli}>
                  {p.nm_poli}
                </option>
              ))}
            </select>
            <StepperIcon />
          </div>
        </div>
        <div style={{ width: 140 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Status</label>
          <div style={{ position: 'relative' }}>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={pillSelectStyle}>
              <option value="">Semua</option>
              <option value="Belum Terlayani">Belum Terlayani</option>
              <option value="Sudah Terlayani">Sudah Terlayani</option>
            </select>
            <StepperIcon />
          </div>
        </div>
        <div style={{ minWidth: 200, flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cari</label>
          <div style={{ position: 'relative', display: 'flex' }}>
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
              style={{ ...inputStyle, paddingLeft: 30 }}
              placeholder="No.Resep / No.RM / Pasien / Jenis Bayar..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
        </div>
        <span style={{ fontSize: 12, color: '#6b7280', paddingBottom: 8, whiteSpace: 'nowrap' }}>{loading ? 'Memuat...' : `${items.length} resep`}</span>
      </div>

      {ralanView === 'daftar' && (
      <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', width: 24 }}></th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No.Resep</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tgl/Jam Peresepan</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Pasien</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Dokter</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Poli/Unit</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jenis Bayar</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Status</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Validasi</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Penyerahan</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada resep ralan pada rentang ini</td></tr>
            ) : (
              items.map((row, index) => {
                const isOpen = expanded === row.no_resep;
                const detail = itemsDetail[row.no_resep];
                const belum = row.status === 'Belum Terlayani';
                return (
                  <React.Fragment key={row.no_resep}>
                    <tr style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb', cursor: 'pointer' }} onClick={() => toggleExpand(row)}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af' }}>{isOpen ? '▾' : '▸'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{row.no_resep}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                        {row.tgl_peresepan.slice(0, 10)} <span style={{ color: '#9ca3af' }}>{row.jam_peresepan}</span>
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }} onClick={(e) => e.stopPropagation()}>
                        <div
                          onClick={() => handlePanggilPasien(row)}
                          title="Klik untuk memanggil pasien ke loket Apotek"
                          style={{
                            display: 'inline-flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            gap: 0,
                            padding: '2px 4px',
                            borderRadius: 4,
                            border: '1px solid #1AB1E5',
                            background: '#ffffff',
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ color: '#1AB1E5', fontWeight: 400, fontSize: 11 }}>{row.nm_pasien}</span>
                          <span style={{ fontSize: 10.5, color: '#9ca3af' }}>{row.no_rkm_medis}</span>
                        </div>
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{row.nm_dokter}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{row.nm_poli}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{row.jenis_bayar}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: belum ? '#fffbeb' : '#ecfdf5', color: belum ? '#d97706' : '#059669' }}>
                          {row.status}
                        </span>
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                        {row.tgl_validasi ? (
                          `${row.tgl_validasi.slice(0, 10)} ${row.jam_validasi}`
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => setValidasiRow(row)}
                              style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #059669', background: '#ffffff', color: '#059669', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}
                            >
                              Validasi
                            </button>
                            <button
                              type="button"
                              onClick={() => handleHapusResep(row)}
                              disabled={deletingResep === row.no_resep}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 4,
                                border: '1px solid #dc2626',
                                background: '#ffffff',
                                color: '#dc2626',
                                cursor: deletingResep === row.no_resep ? 'not-allowed' : 'pointer',
                                fontSize: 11,
                                fontWeight: 500,
                              }}
                            >
                              Hapus
                            </button>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                        {row.tgl_penyerahan ? (
                          `${row.tgl_penyerahan.slice(0, 10)} ${row.jam_penyerahan}`
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPenyerahanRow(row)}
                            style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #059669', background: '#ffffff', color: '#059669', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}
                          >
                            Penyerahan
                          </button>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={10} style={{ padding: '4px 8px 12px 32px', borderBottom: '1px solid #e5e7eb', background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                          {loadingDetail === row.no_resep ? (
                            <div style={{ padding: 12, color: '#6b7280', fontSize: 11.5 }}>Memuat item resep...</div>
                          ) : !detail || (detail.non_racikan.length === 0 && detail.racikan.length === 0) ? (
                            <div style={{ padding: 12, color: '#6b7280', fontSize: 11.5 }}>Tidak ada item obat pada resep ini</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {detail.non_racikan.length > 0 && (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                                  <thead>
                                    <tr style={{ color: '#6b7280' }}>
                                      <th style={{ padding: '3px 6px', textAlign: 'left' }}>Kode</th>
                                      <th style={{ padding: '3px 6px', textAlign: 'left' }}>Nama Obat</th>
                                      <th style={{ padding: '3px 6px', textAlign: 'right' }}>Jumlah</th>
                                      <th style={{ padding: '3px 6px', textAlign: 'left' }}>Satuan</th>
                                      <th style={{ padding: '3px 6px', textAlign: 'left' }}>Aturan Pakai</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detail.non_racikan.map((it) => (
                                      <tr key={it.kode_brng}>
                                        <td style={{ padding: '3px 6px', color: '#374151' }}>{it.kode_brng}</td>
                                        <td style={{ padding: '3px 6px', color: '#111827' }}>{it.nama_brng}</td>
                                        <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{it.jml}</td>
                                        <td style={{ padding: '3px 6px', color: '#374151' }}>{it.kode_sat}</td>
                                        <td style={{ padding: '3px 6px', color: '#6b7280' }}>{it.aturan_pakai}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                              {detail.racikan.map((rc) => (
                                <div key={rc.no_racik} style={{ border: '1px solid #e5e7eb', borderRadius: 4, padding: 8 }}>
                                  <div style={{ fontSize: 11.5, fontWeight: 600, color: '#4f46e5', marginBottom: 4 }}>
                                    Racikan #{rc.no_racik} — {rc.nama_racik} ({rc.metode_racik}) × {rc.jml_dr}
                                  </div>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                                    <thead>
                                      <tr style={{ color: '#6b7280' }}>
                                        <th style={{ padding: '3px 6px', textAlign: 'left' }}>Kode</th>
                                        <th style={{ padding: '3px 6px', textAlign: 'left' }}>Nama Obat</th>
                                        <th style={{ padding: '3px 6px', textAlign: 'right' }}>Jumlah</th>
                                        <th style={{ padding: '3px 6px', textAlign: 'left' }}>Satuan</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {rc.detail.map((d) => (
                                        <tr key={d.kode_brng}>
                                          <td style={{ padding: '3px 6px', color: '#374151' }}>{d.kode_brng}</td>
                                          <td style={{ padding: '3px 6px', color: '#111827' }}>{d.nama_brng}</td>
                                          <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{d.jml}</td>
                                          <td style={{ padding: '3px 6px', color: '#374151' }}>{d.kode_sat}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                                    Aturan Pakai: {rc.aturan_pakai} {rc.keterangan && `— ${rc.keterangan}`}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      )}

      {ralanView === 'detail' && (
        <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0, padding: 10 }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada resep ralan pada rentang ini</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {loadingAllDetail && <div style={{ fontSize: 11.5, color: '#6b7280' }}>Memuat detail resep...</div>}
              {items.map((row) => {
                const detail = itemsDetail[row.no_resep];
                return (
                  <div key={row.no_resep} style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f3f4f6', color: '#374151' }}>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>No.Resep</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Tgl.Peresepan</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Poli/Unit</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Status</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Pasien</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Dokter Peresep</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '6px 8px', fontWeight: 600 }}>{row.no_resep}</td>
                          <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                            {row.tgl_peresepan.slice(0, 10)} <span style={{ color: '#9ca3af' }}>{row.jam_peresepan}</span>
                          </td>
                          <td style={{ padding: '6px 8px' }}>{row.nm_poli}</td>
                          <td style={{ padding: '6px 8px' }}>{row.status}</td>
                          <td style={{ padding: '6px 8px' }}>
                            {row.no_rawat} {row.no_rkm_medis} {row.nm_pasien} ({row.jenis_bayar})
                          </td>
                          <td style={{ padding: '6px 8px' }}>{row.nm_dokter}</td>
                        </tr>
                      </tbody>
                    </table>

                    {!detail ? (
                      <div style={{ padding: 10, color: '#6b7280', fontSize: 11.5 }}>Memuat item resep...</div>
                    ) : detail.non_racikan.length === 0 && detail.racikan.length === 0 ? (
                      <div style={{ padding: 10, color: '#6b7280', fontSize: 11.5 }}>Tidak ada item obat pada resep ini</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                        <thead>
                          <tr style={{ color: '#6b7280', borderTop: '1px solid #e5e7eb' }}>
                            <th style={{ padding: '4px 8px', textAlign: 'left', width: 130 }}>Jumlah</th>
                            <th style={{ padding: '4px 8px', textAlign: 'left' }}>Kode Obat</th>
                            <th style={{ padding: '4px 8px', textAlign: 'left' }}>Nama Obat</th>
                            <th style={{ padding: '4px 8px', textAlign: 'left' }}>Aturan Pakai</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.non_racikan.map((it) => (
                            <tr key={it.kode_brng}>
                              <td style={{ padding: '3px 8px', color: '#374151' }}>{it.jml} {it.kode_sat}</td>
                              <td style={{ padding: '3px 8px', color: '#374151' }}>{it.kode_brng}</td>
                              <td style={{ padding: '3px 8px', color: '#111827' }}>{it.nama_brng}</td>
                              <td style={{ padding: '3px 8px', color: '#6b7280' }}>{it.aturan_pakai}</td>
                            </tr>
                          ))}
                          {detail.racikan.map((rc) => (
                            <React.Fragment key={rc.no_racik}>
                              <tr style={{ background: '#f9fafb' }}>
                                <td style={{ padding: '3px 8px', color: '#374151' }}>{rc.jml_dr} {rc.metode_racik}</td>
                                <td style={{ padding: '3px 8px', color: '#4f46e5' }}>No.Racik : {rc.no_racik}</td>
                                <td style={{ padding: '3px 8px', color: '#111827', fontWeight: 600 }}>{rc.nama_racik}</td>
                                <td style={{ padding: '3px 8px', color: '#6b7280' }}>{rc.aturan_pakai}</td>
                              </tr>
                              {rc.detail.map((d) => (
                                <tr key={d.kode_brng}>
                                  <td style={{ padding: '3px 8px 3px 20px', color: '#374151' }}>{d.jml} {d.kode_sat}</td>
                                  <td style={{ padding: '3px 8px 3px 20px', color: '#374151' }}>{d.kode_brng}</td>
                                  <td style={{ padding: '3px 8px 3px 20px', color: '#111827' }}>{d.nama_brng}</td>
                                  <td></td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <ModalValidasiObat resep={validasiRow} onClose={() => setValidasiRow(null)} onValidated={fetchData} />

      <ModalPenyerahanResep resep={penyerahanRow} onClose={() => setPenyerahanRow(null)} onSaved={fetchData} />
    </div>
  );
};

// ---- Tab: Daftar Resep Dokter > Rawat Inap ---------------------------------
//
// Padanan TabRawatInap (6 sub-tab: tabMode3..tabMode8) di
// DlgDaftarPermintaanResep.java: "Resep Rawat Inap"/"Detail Rawat Inap"
// (resep_obat status='ranap'), "Permintaan Stok Pasien"/"Detail Stok
// Pasien" (tabel permintaan_stok_obat_pasien, permintaan mandiri di luar
// resep dokter), "Permintaan Resep Pulang"/"Detail Resep Pulang" (tabel
// permintaan_resep_pulang — dashboard baca-saja, BEDA dari
// /api/resep-pulang-req yang dipakai form input perawat). Filter
// (tanggal/dokter/kamar/status/cari) DIBAGI RATA ke ke-6 tab, persis Java
// (field yang sama dipakai tampil3..tampil8, bukan filter terpisah per
// tab). Cuma "Resep Rawat Inap" yang punya aksi Validasi (reuse
// ModalValidasiObat kind="ranap") — Permintaan Stok Pasien & Resep Pulang
// dashboard-only (aksi validasinya di Java lewat dialog terpisah
// DlgStokPasien/DlgResepPulang, BELUM diport, prioritas dipercepat
// menutup ke-6 sub-tab tampilan dulu — lihat PERMINTAAN_RESEP_MODUL.md).
// ============================================================================

type ResepRanapRow = {
  no_resep: string;
  tgl_peresepan: string;
  jam_peresepan: string;
  no_rawat: string;
  no_rkm_medis: string;
  nm_pasien: string;
  kd_dokter: string;
  nm_dokter: string;
  status: string;
  nm_bangsal: string;
  kd_bangsal: string;
  jenis_bayar: string;
  tgl_validasi: string;
  jam_validasi: string;
};

type PermintaanDashRow = {
  no_permintaan: string;
  tgl_permintaan: string;
  jam: string;
  no_rawat: string;
  no_rkm_medis: string;
  nm_pasien: string;
  kd_dokter: string;
  nm_dokter: string;
  status: string;
  nm_bangsal: string;
  kd_bangsal: string;
  jenis_bayar: string;
};

type StokPasienItem = {
  kode_brng: string;
  nama_brng: string;
  jml: number;
  kode_sat: string;
  aturan_pakai: string;
  jadwal: Record<string, boolean>;
};

type ResepPulangDashItem = {
  kode_brng: string;
  nama_brng: string;
  jml: number;
  kode_sat: string;
  dosis: string;
};

type RanapSubTab = 'resep' | 'detail-resep' | 'stok' | 'detail-stok' | 'pulang' | 'detail-pulang';

// Jadwal jam00-jam23 ditampilkan sebagai daftar jam yang DICENTANG saja
// (mis. "06, 12, 18") — lebih ringkas & terbaca daripada dump 24 kolom
// ✓/✕ mentah ala Java, tanpa mengubah data yang sebenarnya disimpan.
const formatJadwal = (jadwal: Record<string, boolean>): string => {
  const jam = Object.keys(jadwal)
    .filter((k) => jadwal[k])
    .sort();
  return jam.length > 0 ? jam.join(', ') : '-';
};

const TabResepRanap: React.FC<{ onSelectPasien: (p: PasienRingkas) => void; onSelectResep: (r: SelectedResep) => void }> = ({
  onSelectPasien,
  onSelectResep,
}) => {
  const [subTab, setSubTab] = React.useState<RanapSubTab>('resep');
  const [tgl1, setTgl1] = React.useState(todayStr());
  const [tgl2, setTgl2] = React.useState(todayStr());
  const [dokter, setDokter] = React.useState('');
  const [kamar, setKamar] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [searchText, setSearchText] = React.useState('');
  const [dokterOptions, setDokterOptions] = React.useState<{ kd_dokter: string; nm_dokter: string }[]>([]);

  React.useEffect(() => {
    fetch('/api/dokter')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setDokterOptions(Array.isArray(data) ? data : []))
      .catch(() => setDokterOptions([]));
  }, []);

  const group: 'resep' | 'stok' | 'pulang' =
    subTab === 'resep' || subTab === 'detail-resep' ? 'resep' : subTab === 'stok' || subTab === 'detail-stok' ? 'stok' : 'pulang';

  const filterQS = React.useCallback(() => {
    let qs = `tgl1=${tgl1}&tgl2=${tgl2}`;
    if (dokter) qs += `&dokter=${encodeURIComponent(dokter)}`;
    if (kamar) qs += `&kamar=${encodeURIComponent(kamar)}`;
    if (status) qs += `&status=${encodeURIComponent(status)}`;
    if (searchText) qs += `&search=${encodeURIComponent(searchText)}`;
    return qs;
  }, [tgl1, tgl2, dokter, kamar, status, searchText]);

  // ---- Resep Rawat Inap / Detail Rawat Inap ----
  const [resepItems, setResepItems] = React.useState<ResepRanapRow[]>([]);
  const [resepLoading, setResepLoading] = React.useState(false);
  const [resepExpanded, setResepExpanded] = React.useState<string | null>(null);
  const [resepItemsDetail, setResepItemsDetail] = React.useState<Record<string, ResepItems>>({});
  const [resepLoadingDetail, setResepLoadingDetail] = React.useState<string | null>(null);
  const [resepLoadingAllDetail, setResepLoadingAllDetail] = React.useState(false);
  const [validasiRow, setValidasiRow] = React.useState<ResepRanapRow | null>(null);

  const fetchResep = React.useCallback(async () => {
    setResepLoading(true);
    try {
      const res = await fetch(`/api/permintaan-resep/ranap?${filterQS()}`);
      const data = await res.json();
      setResepItems(Array.isArray(data) ? data : []);
    } catch {
      setResepItems([]);
    } finally {
      setResepLoading(false);
    }
  }, [filterQS]);

  const isFirstResep = React.useRef(true);
  React.useEffect(() => {
    if (group !== 'resep') return;
    if (isFirstResep.current) {
      isFirstResep.current = false;
      fetchResep();
      return;
    }
    const t = setTimeout(() => fetchResep(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, tgl1, tgl2, dokter, kamar, status, searchText]);

  // Auto-refresh tiap 30 detik (lihat catatan sama di TabResepRalan).
  React.useEffect(() => {
    if (group !== 'resep') return;
    const interval = setInterval(() => fetchResep(), 30000);
    return () => clearInterval(interval);
  }, [group, fetchResep]);

  const toggleResepExpand = async (row: ResepRanapRow) => {
    onSelectPasien({ no_rkm_medis: row.no_rkm_medis, nm_pasien: row.nm_pasien });
    onSelectResep({ no_resep: row.no_resep, kind: 'ranap', status: row.status, nm_pasien: row.nm_pasien, no_rkm_medis: row.no_rkm_medis });
    if (resepExpanded === row.no_resep) {
      setResepExpanded(null);
      return;
    }
    setResepExpanded(row.no_resep);
    if (!resepItemsDetail[row.no_resep]) {
      setResepLoadingDetail(row.no_resep);
      try {
        const res = await fetch(`/api/permintaan-resep/ranap/${encodeURIComponent(row.no_resep)}/items`);
        const data = await res.json();
        setResepItemsDetail((prev) => ({ ...prev, [row.no_resep]: data }));
      } catch {
        setResepItemsDetail((prev) => ({ ...prev, [row.no_resep]: { no_rawat: '', kd_bangsal: '', nm_bangsal: '', total: 0, ppn: 0, total_ppn: 0, non_racikan: [], racikan: [] } }));
      } finally {
        setResepLoadingDetail(null);
      }
    }
  };

  React.useEffect(() => {
    if (subTab !== 'detail-resep' || resepItems.length === 0) return;
    const missing = resepItems.filter((row) => !resepItemsDetail[row.no_resep]);
    if (missing.length === 0) return;
    let cancelled = false;
    setResepLoadingAllDetail(true);
    Promise.all(
      missing.map(async (row) => {
        try {
          const res = await fetch(`/api/permintaan-resep/ranap/${encodeURIComponent(row.no_resep)}/items`);
          const data = await res.json();
          return [row.no_resep, data] as const;
        } catch {
          return [row.no_resep, { no_rawat: '', kd_bangsal: '', nm_bangsal: '', total: 0, ppn: 0, total_ppn: 0, non_racikan: [], racikan: [] } as ResepItems] as const;
        }
      })
    ).then((pairs) => {
      if (cancelled) return;
      setResepItemsDetail((prev) => {
        const next = { ...prev };
        for (const [noResep, data] of pairs) next[noResep] = data;
        return next;
      });
      setResepLoadingAllDetail(false);
    });
    return () => {
      cancelled = true;
    };
  }, [subTab, resepItems, resepItemsDetail]);

  // ---- Permintaan Stok Pasien / Detail Stok Pasien ----
  const [stokItems, setStokItems] = React.useState<PermintaanDashRow[]>([]);
  const [stokLoading, setStokLoading] = React.useState(false);
  const [stokExpanded, setStokExpanded] = React.useState<string | null>(null);
  const [stokItemsDetail, setStokItemsDetail] = React.useState<Record<string, StokPasienItem[]>>({});
  const [stokLoadingDetail, setStokLoadingDetail] = React.useState<string | null>(null);
  const [stokLoadingAllDetail, setStokLoadingAllDetail] = React.useState(false);

  const fetchStok = React.useCallback(async () => {
    setStokLoading(true);
    try {
      const res = await fetch(`/api/permintaan-resep/ranap-stok-pasien?${filterQS()}`);
      const data = await res.json();
      setStokItems(Array.isArray(data) ? data : []);
    } catch {
      setStokItems([]);
    } finally {
      setStokLoading(false);
    }
  }, [filterQS]);

  const isFirstStok = React.useRef(true);
  React.useEffect(() => {
    if (group !== 'stok') return;
    if (isFirstStok.current) {
      isFirstStok.current = false;
      fetchStok();
      return;
    }
    const t = setTimeout(() => fetchStok(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, tgl1, tgl2, dokter, kamar, status, searchText]);

  const toggleStokExpand = async (row: PermintaanDashRow) => {
    onSelectPasien({ no_rkm_medis: row.no_rkm_medis, nm_pasien: row.nm_pasien });
    if (stokExpanded === row.no_permintaan) {
      setStokExpanded(null);
      return;
    }
    setStokExpanded(row.no_permintaan);
    if (!stokItemsDetail[row.no_permintaan]) {
      setStokLoadingDetail(row.no_permintaan);
      try {
        const res = await fetch(`/api/permintaan-resep/ranap-stok-pasien/${encodeURIComponent(row.no_permintaan)}/items`);
        const data = await res.json();
        setStokItemsDetail((prev) => ({ ...prev, [row.no_permintaan]: Array.isArray(data) ? data : [] }));
      } catch {
        setStokItemsDetail((prev) => ({ ...prev, [row.no_permintaan]: [] }));
      } finally {
        setStokLoadingDetail(null);
      }
    }
  };

  React.useEffect(() => {
    if (subTab !== 'detail-stok' || stokItems.length === 0) return;
    const missing = stokItems.filter((row) => !stokItemsDetail[row.no_permintaan]);
    if (missing.length === 0) return;
    let cancelled = false;
    setStokLoadingAllDetail(true);
    Promise.all(
      missing.map(async (row) => {
        try {
          const res = await fetch(`/api/permintaan-resep/ranap-stok-pasien/${encodeURIComponent(row.no_permintaan)}/items`);
          const data = await res.json();
          return [row.no_permintaan, Array.isArray(data) ? data : []] as const;
        } catch {
          return [row.no_permintaan, [] as StokPasienItem[]] as const;
        }
      })
    ).then((pairs) => {
      if (cancelled) return;
      setStokItemsDetail((prev) => {
        const next = { ...prev };
        for (const [noPermintaan, data] of pairs) next[noPermintaan] = data;
        return next;
      });
      setStokLoadingAllDetail(false);
    });
    return () => {
      cancelled = true;
    };
  }, [subTab, stokItems, stokItemsDetail]);

  // ---- Permintaan Resep Pulang / Detail Resep Pulang ----
  const [pulangItems, setPulangItems] = React.useState<PermintaanDashRow[]>([]);
  const [pulangLoading, setPulangLoading] = React.useState(false);
  const [pulangExpanded, setPulangExpanded] = React.useState<string | null>(null);
  const [pulangItemsDetail, setPulangItemsDetail] = React.useState<Record<string, ResepPulangDashItem[]>>({});
  const [pulangLoadingDetail, setPulangLoadingDetail] = React.useState<string | null>(null);
  const [pulangLoadingAllDetail, setPulangLoadingAllDetail] = React.useState(false);

  const fetchPulang = React.useCallback(async () => {
    setPulangLoading(true);
    try {
      const res = await fetch(`/api/permintaan-resep/ranap-resep-pulang?${filterQS()}`);
      const data = await res.json();
      setPulangItems(Array.isArray(data) ? data : []);
    } catch {
      setPulangItems([]);
    } finally {
      setPulangLoading(false);
    }
  }, [filterQS]);

  const isFirstPulang = React.useRef(true);
  React.useEffect(() => {
    if (group !== 'pulang') return;
    if (isFirstPulang.current) {
      isFirstPulang.current = false;
      fetchPulang();
      return;
    }
    const t = setTimeout(() => fetchPulang(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, tgl1, tgl2, dokter, kamar, status, searchText]);

  const togglePulangExpand = async (row: PermintaanDashRow) => {
    onSelectPasien({ no_rkm_medis: row.no_rkm_medis, nm_pasien: row.nm_pasien });
    if (pulangExpanded === row.no_permintaan) {
      setPulangExpanded(null);
      return;
    }
    setPulangExpanded(row.no_permintaan);
    if (!pulangItemsDetail[row.no_permintaan]) {
      setPulangLoadingDetail(row.no_permintaan);
      try {
        const res = await fetch(`/api/permintaan-resep/ranap-resep-pulang/${encodeURIComponent(row.no_permintaan)}/items`);
        const data = await res.json();
        setPulangItemsDetail((prev) => ({ ...prev, [row.no_permintaan]: Array.isArray(data) ? data : [] }));
      } catch {
        setPulangItemsDetail((prev) => ({ ...prev, [row.no_permintaan]: [] }));
      } finally {
        setPulangLoadingDetail(null);
      }
    }
  };

  React.useEffect(() => {
    if (subTab !== 'detail-pulang' || pulangItems.length === 0) return;
    const missing = pulangItems.filter((row) => !pulangItemsDetail[row.no_permintaan]);
    if (missing.length === 0) return;
    let cancelled = false;
    setPulangLoadingAllDetail(true);
    Promise.all(
      missing.map(async (row) => {
        try {
          const res = await fetch(`/api/permintaan-resep/ranap-resep-pulang/${encodeURIComponent(row.no_permintaan)}/items`);
          const data = await res.json();
          return [row.no_permintaan, Array.isArray(data) ? data : []] as const;
        } catch {
          return [row.no_permintaan, [] as ResepPulangDashItem[]] as const;
        }
      })
    ).then((pairs) => {
      if (cancelled) return;
      setPulangItemsDetail((prev) => {
        const next = { ...prev };
        for (const [noPermintaan, data] of pairs) next[noPermintaan] = data;
        return next;
      });
      setPulangLoadingAllDetail(false);
    });
    return () => {
      cancelled = true;
    };
  }, [subTab, pulangItems, pulangItemsDetail]);

  const countLabel = group === 'resep' ? `${resepItems.length} resep` : group === 'stok' ? `${stokItems.length} permintaan` : `${pulangItems.length} permintaan`;
  const isLoading = group === 'resep' ? resepLoading : group === 'stok' ? stokLoading : pulangLoading;

  const SUB_TABS: { key: RanapSubTab; label: string }[] = [
    { key: 'resep', label: 'Resep Rawat Inap' },
    { key: 'detail-resep', label: 'Detail Rawat Inap' },
    { key: 'stok', label: 'Permintaan Stok Pasien' },
    { key: 'detail-stok', label: 'Detail Stok Pasien' },
    { key: 'pulang', label: 'Permintaan Resep Pulang' },
    { key: 'detail-pulang', label: 'Detail Resep Pulang' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', flexShrink: 0, flexWrap: 'wrap' }}>
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSubTab(t.key)}
            style={{
              padding: '8px 14px',
              border: 'none',
              borderBottom: subTab === t.key ? '2px solid #059669' : '2px solid transparent',
              background: 'transparent',
              color: subTab === t.key ? '#059669' : '#6b7280',
              fontWeight: subTab === t.key ? 600 : 400,
              fontSize: 12.5,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ width: 120 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Dari Tanggal</label>
          <input type="date" style={inputStyle} value={tgl1} onChange={(e) => setTgl1(e.target.value)} />
        </div>
        <div style={{ width: 120 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>s.d. Tanggal</label>
          <input type="date" style={inputStyle} value={tgl2} onChange={(e) => setTgl2(e.target.value)} />
        </div>
        <div style={{ width: 200 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Dokter</label>
          <div style={{ position: 'relative' }}>
            <select value={dokter} onChange={(e) => setDokter(e.target.value)} style={pillSelectStyle}>
              <option value="">Semua Dokter</option>
              {dokterOptions.map((d) => (
                <option key={d.kd_dokter} value={d.nm_dokter}>
                  {d.nm_dokter}
                </option>
              ))}
            </select>
            <StepperIcon />
          </div>
        </div>
        <div style={{ width: 160 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Ruang/Kamar</label>
          <input style={inputStyle} placeholder="Nama bangsal..." value={kamar} onChange={(e) => setKamar(e.target.value)} />
        </div>
        <div style={{ width: 140 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Status</label>
          <div style={{ position: 'relative' }}>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={pillSelectStyle}>
              <option value="">Semua</option>
              <option value="Belum Terlayani">Belum Terlayani</option>
              <option value="Sudah Terlayani">Sudah Terlayani</option>
            </select>
            <StepperIcon />
          </div>
        </div>
        <div style={{ minWidth: 200, flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cari</label>
          <div style={{ position: 'relative', display: 'flex' }}>
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
              style={{ ...inputStyle, paddingLeft: 30 }}
              placeholder="No.Permintaan / No.RM / Pasien / Jenis Bayar..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
        </div>
        <span style={{ fontSize: 12, color: '#6b7280', paddingBottom: 8, whiteSpace: 'nowrap' }}>{isLoading ? 'Memuat...' : countLabel}</span>
      </div>

      {/* ---- Resep Rawat Inap (daftar) ---- */}
      {subTab === 'resep' && (
        <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
              <tr>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', width: 24 }}></th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No.Resep</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tgl/Jam Peresepan</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Pasien</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Dokter</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Ruang/Kamar</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jenis Bayar</th>
                <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Status</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Validasi</th>
              </tr>
            </thead>
            <tbody>
              {resepLoading ? (
                <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
              ) : resepItems.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada resep rawat inap pada rentang ini</td></tr>
              ) : (
                resepItems.map((row, index) => {
                  const isOpen = resepExpanded === row.no_resep;
                  const detail = resepItemsDetail[row.no_resep];
                  const belum = row.status === 'Belum Terlayani';
                  return (
                    <React.Fragment key={row.no_resep}>
                      <tr style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb', cursor: 'pointer' }} onClick={() => toggleResepExpand(row)}>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af' }}>{isOpen ? '▾' : '▸'}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{row.no_resep}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                          {row.tgl_peresepan.slice(0, 10)} <span style={{ color: '#9ca3af' }}>{row.jam_peresepan}</span>
                        </td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                          {row.nm_pasien} <span style={{ color: '#9ca3af' }}>({row.no_rkm_medis})</span>
                        </td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{row.nm_dokter}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{row.nm_bangsal}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{row.jenis_bayar}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: belum ? '#fffbeb' : '#ecfdf5', color: belum ? '#d97706' : '#059669' }}>
                            {row.status}
                          </span>
                        </td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                          {row.tgl_validasi ? (
                            `${row.tgl_validasi.slice(0, 10)} ${row.jam_validasi}`
                          ) : (
                            <button
                              type="button"
                              onClick={() => setValidasiRow(row)}
                              style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #059669', background: '#ffffff', color: '#059669', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}
                            >
                              Validasi
                            </button>
                          )}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={9} style={{ padding: '4px 8px 12px 32px', borderBottom: '1px solid #e5e7eb', background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                            {resepLoadingDetail === row.no_resep ? (
                              <div style={{ padding: 12, color: '#6b7280', fontSize: 11.5 }}>Memuat item resep...</div>
                            ) : !detail || (detail.non_racikan.length === 0 && detail.racikan.length === 0) ? (
                              <div style={{ padding: 12, color: '#6b7280', fontSize: 11.5 }}>Tidak ada item obat pada resep ini</div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {detail.non_racikan.length > 0 && (
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                                    <thead>
                                      <tr style={{ color: '#6b7280' }}>
                                        <th style={{ padding: '3px 6px', textAlign: 'left' }}>Kode</th>
                                        <th style={{ padding: '3px 6px', textAlign: 'left' }}>Nama Obat</th>
                                        <th style={{ padding: '3px 6px', textAlign: 'right' }}>Jumlah</th>
                                        <th style={{ padding: '3px 6px', textAlign: 'left' }}>Satuan</th>
                                        <th style={{ padding: '3px 6px', textAlign: 'left' }}>Aturan Pakai</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {detail.non_racikan.map((it) => (
                                        <tr key={it.kode_brng}>
                                          <td style={{ padding: '3px 6px', color: '#374151' }}>{it.kode_brng}</td>
                                          <td style={{ padding: '3px 6px', color: '#111827' }}>{it.nama_brng}</td>
                                          <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{it.jml}</td>
                                          <td style={{ padding: '3px 6px', color: '#374151' }}>{it.kode_sat}</td>
                                          <td style={{ padding: '3px 6px', color: '#6b7280' }}>{it.aturan_pakai}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                                {detail.racikan.map((rc) => (
                                  <div key={rc.no_racik} style={{ border: '1px solid #e5e7eb', borderRadius: 4, padding: 8 }}>
                                    <div style={{ fontSize: 11.5, fontWeight: 600, color: '#4f46e5', marginBottom: 4 }}>
                                      Racikan #{rc.no_racik} — {rc.nama_racik} ({rc.metode_racik}) × {rc.jml_dr}
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                                      <thead>
                                        <tr style={{ color: '#6b7280' }}>
                                          <th style={{ padding: '3px 6px', textAlign: 'left' }}>Kode</th>
                                          <th style={{ padding: '3px 6px', textAlign: 'left' }}>Nama Obat</th>
                                          <th style={{ padding: '3px 6px', textAlign: 'right' }}>Jumlah</th>
                                          <th style={{ padding: '3px 6px', textAlign: 'left' }}>Satuan</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {rc.detail.map((d) => (
                                          <tr key={d.kode_brng}>
                                            <td style={{ padding: '3px 6px', color: '#374151' }}>{d.kode_brng}</td>
                                            <td style={{ padding: '3px 6px', color: '#111827' }}>{d.nama_brng}</td>
                                            <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{d.jml}</td>
                                            <td style={{ padding: '3px 6px', color: '#374151' }}>{d.kode_sat}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                                      Aturan Pakai: {rc.aturan_pakai} {rc.keterangan && `— ${rc.keterangan}`}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- Detail Rawat Inap (flat, semua resep + item sekaligus) ---- */}
      {subTab === 'detail-resep' && (
        <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0, padding: 10 }}>
          {resepLoading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</div>
          ) : resepItems.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada resep rawat inap pada rentang ini</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {resepLoadingAllDetail && <div style={{ fontSize: 11.5, color: '#6b7280' }}>Memuat detail resep...</div>}
              {resepItems.map((row) => {
                const detail = resepItemsDetail[row.no_resep];
                return (
                  <div key={row.no_resep} style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f3f4f6', color: '#374151' }}>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>No.Resep</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Tgl.Resep</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Ruang/Kamar</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Status</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Pasien</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Dokter Peresep</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '6px 8px', fontWeight: 600 }}>{row.no_resep}</td>
                          <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                            {row.tgl_peresepan.slice(0, 10)} <span style={{ color: '#9ca3af' }}>{row.jam_peresepan}</span>
                          </td>
                          <td style={{ padding: '6px 8px' }}>{row.nm_bangsal}</td>
                          <td style={{ padding: '6px 8px' }}>{row.status}</td>
                          <td style={{ padding: '6px 8px' }}>
                            {row.no_rawat} {row.no_rkm_medis} {row.nm_pasien} ({row.jenis_bayar})
                          </td>
                          <td style={{ padding: '6px 8px' }}>{row.nm_dokter}</td>
                        </tr>
                      </tbody>
                    </table>

                    {!detail ? (
                      <div style={{ padding: 10, color: '#6b7280', fontSize: 11.5 }}>Memuat item resep...</div>
                    ) : detail.non_racikan.length === 0 && detail.racikan.length === 0 ? (
                      <div style={{ padding: 10, color: '#6b7280', fontSize: 11.5 }}>Tidak ada item obat pada resep ini</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                        <thead>
                          <tr style={{ color: '#6b7280', borderTop: '1px solid #e5e7eb' }}>
                            <th style={{ padding: '4px 8px', textAlign: 'left', width: 130 }}>Jumlah</th>
                            <th style={{ padding: '4px 8px', textAlign: 'left' }}>Kode Obat</th>
                            <th style={{ padding: '4px 8px', textAlign: 'left' }}>Nama Obat</th>
                            <th style={{ padding: '4px 8px', textAlign: 'left' }}>Aturan Pakai</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.non_racikan.map((it) => (
                            <tr key={it.kode_brng}>
                              <td style={{ padding: '3px 8px', color: '#374151' }}>{it.jml} {it.kode_sat}</td>
                              <td style={{ padding: '3px 8px', color: '#374151' }}>{it.kode_brng}</td>
                              <td style={{ padding: '3px 8px', color: '#111827' }}>{it.nama_brng}</td>
                              <td style={{ padding: '3px 8px', color: '#6b7280' }}>{it.aturan_pakai}</td>
                            </tr>
                          ))}
                          {detail.racikan.map((rc) => (
                            <React.Fragment key={rc.no_racik}>
                              <tr style={{ background: '#f9fafb' }}>
                                <td style={{ padding: '3px 8px', color: '#374151' }}>{rc.jml_dr} {rc.metode_racik}</td>
                                <td style={{ padding: '3px 8px', color: '#4f46e5' }}>No.Racik : {rc.no_racik}</td>
                                <td style={{ padding: '3px 8px', color: '#111827', fontWeight: 600 }}>{rc.nama_racik}</td>
                                <td style={{ padding: '3px 8px', color: '#6b7280' }}>{rc.aturan_pakai}</td>
                              </tr>
                              {rc.detail.map((d) => (
                                <tr key={d.kode_brng}>
                                  <td style={{ padding: '3px 8px 3px 20px', color: '#374151' }}>{d.jml} {d.kode_sat}</td>
                                  <td style={{ padding: '3px 8px 3px 20px', color: '#374151' }}>{d.kode_brng}</td>
                                  <td style={{ padding: '3px 8px 3px 20px', color: '#111827' }}>{d.nama_brng}</td>
                                  <td></td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ---- Permintaan Stok Pasien (daftar) ---- */}
      {subTab === 'stok' && (
        <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
              <tr>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', width: 24 }}></th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No.Permintaan</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tgl/Jam</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Pasien</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Dokter</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Ruang/Kamar</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jenis Bayar</th>
                <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {stokLoading ? (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
              ) : stokItems.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada permintaan stok pasien pada rentang ini</td></tr>
              ) : (
                stokItems.map((row, index) => {
                  const isOpen = stokExpanded === row.no_permintaan;
                  const items = stokItemsDetail[row.no_permintaan];
                  const belum = row.status === 'Belum Terlayani';
                  return (
                    <React.Fragment key={row.no_permintaan}>
                      <tr style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb', cursor: 'pointer' }} onClick={() => toggleStokExpand(row)}>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af' }}>{isOpen ? '▾' : '▸'}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{row.no_permintaan}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                          {row.tgl_permintaan.slice(0, 10)} <span style={{ color: '#9ca3af' }}>{row.jam}</span>
                        </td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                          {row.nm_pasien} <span style={{ color: '#9ca3af' }}>({row.no_rkm_medis})</span>
                        </td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{row.nm_dokter}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{row.nm_bangsal}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{row.jenis_bayar}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: belum ? '#fffbeb' : '#ecfdf5', color: belum ? '#d97706' : '#059669' }}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={8} style={{ padding: '4px 8px 12px 32px', borderBottom: '1px solid #e5e7eb', background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                            {stokLoadingDetail === row.no_permintaan ? (
                              <div style={{ padding: 12, color: '#6b7280', fontSize: 11.5 }}>Memuat item permintaan...</div>
                            ) : !items || items.length === 0 ? (
                              <div style={{ padding: 12, color: '#6b7280', fontSize: 11.5 }}>Tidak ada item obat pada permintaan ini</div>
                            ) : (
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                                <thead>
                                  <tr style={{ color: '#6b7280' }}>
                                    <th style={{ padding: '3px 6px', textAlign: 'left' }}>Kode</th>
                                    <th style={{ padding: '3px 6px', textAlign: 'left' }}>Nama Obat</th>
                                    <th style={{ padding: '3px 6px', textAlign: 'right' }}>Jumlah</th>
                                    <th style={{ padding: '3px 6px', textAlign: 'left' }}>Satuan</th>
                                    <th style={{ padding: '3px 6px', textAlign: 'left' }}>Aturan Pakai</th>
                                    <th style={{ padding: '3px 6px', textAlign: 'left' }}>Jadwal (Jam)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map((it) => (
                                    <tr key={it.kode_brng}>
                                      <td style={{ padding: '3px 6px', color: '#374151' }}>{it.kode_brng}</td>
                                      <td style={{ padding: '3px 6px', color: '#111827' }}>{it.nama_brng}</td>
                                      <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{it.jml}</td>
                                      <td style={{ padding: '3px 6px', color: '#374151' }}>{it.kode_sat}</td>
                                      <td style={{ padding: '3px 6px', color: '#6b7280' }}>{it.aturan_pakai}</td>
                                      <td style={{ padding: '3px 6px', color: '#6b7280' }}>{formatJadwal(it.jadwal)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- Detail Stok Pasien (flat) ---- */}
      {subTab === 'detail-stok' && (
        <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0, padding: 10 }}>
          {stokLoading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</div>
          ) : stokItems.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada permintaan stok pasien pada rentang ini</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {stokLoadingAllDetail && <div style={{ fontSize: 11.5, color: '#6b7280' }}>Memuat detail permintaan...</div>}
              {stokItems.map((row) => {
                const items = stokItemsDetail[row.no_permintaan];
                return (
                  <div key={row.no_permintaan} style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f3f4f6', color: '#374151' }}>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>No.Permintaan</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Tanggal</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Ruang/Kamar</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Status</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Pasien</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Dokter</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '6px 8px', fontWeight: 600 }}>{row.no_permintaan}</td>
                          <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                            {row.tgl_permintaan.slice(0, 10)} <span style={{ color: '#9ca3af' }}>{row.jam}</span>
                          </td>
                          <td style={{ padding: '6px 8px' }}>{row.nm_bangsal}</td>
                          <td style={{ padding: '6px 8px' }}>{row.status}</td>
                          <td style={{ padding: '6px 8px' }}>
                            {row.no_rawat} {row.no_rkm_medis} {row.nm_pasien} ({row.jenis_bayar})
                          </td>
                          <td style={{ padding: '6px 8px' }}>{row.nm_dokter}</td>
                        </tr>
                      </tbody>
                    </table>
                    {!items ? (
                      <div style={{ padding: 10, color: '#6b7280', fontSize: 11.5 }}>Memuat item permintaan...</div>
                    ) : items.length === 0 ? (
                      <div style={{ padding: 10, color: '#6b7280', fontSize: 11.5 }}>Tidak ada item obat pada permintaan ini</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                        <thead>
                          <tr style={{ color: '#6b7280', borderTop: '1px solid #e5e7eb' }}>
                            <th style={{ padding: '4px 8px', textAlign: 'left', width: 130 }}>Jumlah</th>
                            <th style={{ padding: '4px 8px', textAlign: 'left' }}>Kode Obat</th>
                            <th style={{ padding: '4px 8px', textAlign: 'left' }}>Nama Obat</th>
                            <th style={{ padding: '4px 8px', textAlign: 'left' }}>Aturan Pakai</th>
                            <th style={{ padding: '4px 8px', textAlign: 'left' }}>Jadwal (Jam)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((it) => (
                            <tr key={it.kode_brng}>
                              <td style={{ padding: '3px 8px', color: '#374151' }}>{it.jml} {it.kode_sat}</td>
                              <td style={{ padding: '3px 8px', color: '#374151' }}>{it.kode_brng}</td>
                              <td style={{ padding: '3px 8px', color: '#111827' }}>{it.nama_brng}</td>
                              <td style={{ padding: '3px 8px', color: '#6b7280' }}>{it.aturan_pakai}</td>
                              <td style={{ padding: '3px 8px', color: '#6b7280' }}>{formatJadwal(it.jadwal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ---- Permintaan Resep Pulang (daftar) ---- */}
      {subTab === 'pulang' && (
        <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
              <tr>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb', width: 24 }}></th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No.Permintaan</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tgl/Jam</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Pasien</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Dokter</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Ruang/Kamar</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jenis Bayar</th>
                <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {pulangLoading ? (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
              ) : pulangItems.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada permintaan resep pulang pada rentang ini</td></tr>
              ) : (
                pulangItems.map((row, index) => {
                  const isOpen = pulangExpanded === row.no_permintaan;
                  const items = pulangItemsDetail[row.no_permintaan];
                  const belum = row.status === 'Belum Terlayani';
                  return (
                    <React.Fragment key={row.no_permintaan}>
                      <tr style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb', cursor: 'pointer' }} onClick={() => togglePulangExpand(row)}>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af' }}>{isOpen ? '▾' : '▸'}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{row.no_permintaan}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                          {row.tgl_permintaan.slice(0, 10)} <span style={{ color: '#9ca3af' }}>{row.jam}</span>
                        </td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                          {row.nm_pasien} <span style={{ color: '#9ca3af' }}>({row.no_rkm_medis})</span>
                        </td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{row.nm_dokter}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{row.nm_bangsal}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{row.jenis_bayar}</td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: belum ? '#fffbeb' : '#ecfdf5', color: belum ? '#d97706' : '#059669' }}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={8} style={{ padding: '4px 8px 12px 32px', borderBottom: '1px solid #e5e7eb', background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                            {pulangLoadingDetail === row.no_permintaan ? (
                              <div style={{ padding: 12, color: '#6b7280', fontSize: 11.5 }}>Memuat item permintaan...</div>
                            ) : !items || items.length === 0 ? (
                              <div style={{ padding: 12, color: '#6b7280', fontSize: 11.5 }}>Tidak ada item obat pada permintaan ini</div>
                            ) : (
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                                <thead>
                                  <tr style={{ color: '#6b7280' }}>
                                    <th style={{ padding: '3px 6px', textAlign: 'left' }}>Kode</th>
                                    <th style={{ padding: '3px 6px', textAlign: 'left' }}>Nama Obat</th>
                                    <th style={{ padding: '3px 6px', textAlign: 'right' }}>Jumlah</th>
                                    <th style={{ padding: '3px 6px', textAlign: 'left' }}>Satuan</th>
                                    <th style={{ padding: '3px 6px', textAlign: 'left' }}>Dosis</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map((it) => (
                                    <tr key={it.kode_brng}>
                                      <td style={{ padding: '3px 6px', color: '#374151' }}>{it.kode_brng}</td>
                                      <td style={{ padding: '3px 6px', color: '#111827' }}>{it.nama_brng}</td>
                                      <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{it.jml}</td>
                                      <td style={{ padding: '3px 6px', color: '#374151' }}>{it.kode_sat}</td>
                                      <td style={{ padding: '3px 6px', color: '#6b7280' }}>{it.dosis}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- Detail Resep Pulang (flat) ---- */}
      {subTab === 'detail-pulang' && (
        <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0, padding: 10 }}>
          {pulangLoading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</div>
          ) : pulangItems.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada permintaan resep pulang pada rentang ini</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {pulangLoadingAllDetail && <div style={{ fontSize: 11.5, color: '#6b7280' }}>Memuat detail permintaan...</div>}
              {pulangItems.map((row) => {
                const items = pulangItemsDetail[row.no_permintaan];
                return (
                  <div key={row.no_permintaan} style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f3f4f6', color: '#374151' }}>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>No.Permintaan</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Tanggal</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Ruang/Kamar</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Status</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Pasien</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Dokter</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '6px 8px', fontWeight: 600 }}>{row.no_permintaan}</td>
                          <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                            {row.tgl_permintaan.slice(0, 10)} <span style={{ color: '#9ca3af' }}>{row.jam}</span>
                          </td>
                          <td style={{ padding: '6px 8px' }}>{row.nm_bangsal}</td>
                          <td style={{ padding: '6px 8px' }}>{row.status}</td>
                          <td style={{ padding: '6px 8px' }}>
                            {row.no_rawat} {row.no_rkm_medis} {row.nm_pasien} ({row.jenis_bayar})
                          </td>
                          <td style={{ padding: '6px 8px' }}>{row.nm_dokter}</td>
                        </tr>
                      </tbody>
                    </table>
                    {!items ? (
                      <div style={{ padding: 10, color: '#6b7280', fontSize: 11.5 }}>Memuat item permintaan...</div>
                    ) : items.length === 0 ? (
                      <div style={{ padding: 10, color: '#6b7280', fontSize: 11.5 }}>Tidak ada item obat pada permintaan ini</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                        <thead>
                          <tr style={{ color: '#6b7280', borderTop: '1px solid #e5e7eb' }}>
                            <th style={{ padding: '4px 8px', textAlign: 'left', width: 130 }}>Jumlah</th>
                            <th style={{ padding: '4px 8px', textAlign: 'left' }}>Kode Obat</th>
                            <th style={{ padding: '4px 8px', textAlign: 'left' }}>Nama Obat</th>
                            <th style={{ padding: '4px 8px', textAlign: 'left' }}>Dosis</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((it) => (
                            <tr key={it.kode_brng}>
                              <td style={{ padding: '3px 8px', color: '#374151' }}>{it.jml} {it.kode_sat}</td>
                              <td style={{ padding: '3px 8px', color: '#374151' }}>{it.kode_brng}</td>
                              <td style={{ padding: '3px 8px', color: '#111827' }}>{it.nama_brng}</td>
                              <td style={{ padding: '3px 8px', color: '#6b7280' }}>{it.dosis}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <ModalValidasiObat
        kind="ranap"
        resep={
          validasiRow
            ? { no_resep: validasiRow.no_resep, nm_pasien: validasiRow.nm_pasien, no_rkm_medis: validasiRow.no_rkm_medis, nm_dokter: validasiRow.nm_dokter, nm_poli: validasiRow.nm_bangsal, jenis_bayar: validasiRow.jenis_bayar }
            : null
        }
        onClose={() => setValidasiRow(null)}
        onValidated={fetchResep}
      />
    </div>
  );
};

// ---- Modal: Obat Tervalidasi ------------------------------------------------
//
// Padanan BtnPemberianObat di DlgDaftarPermintaanResep.java — TOMBOL
// TOOLBAR (bukan tab navigasi, sama pola dengan Riwayat Pasien) yang
// aksinya terikat ke baris resep yang SEDANG DIPILIH di Daftar Resep
// Dokter, dan HANYA aktif kalau baris itu Status="Sudah Terlayani" (Java:
// JOptionPane "Silahkan pilih data yang sudah divalidasi..!!" kalau
// belum). Di Java, tombol ini membuka DlgPemberianObat — dialog 1791
// baris yang TERNYATA dobel fungsi sebagai mesin pemberian-obat+billing+
// jurnal sendiri (method tampilPO3() yang dipanggil bahkan tidak ada di
// file itu, kemungkinan bug/quirk lama Khanza) — nyaris duplikat
// DlgCariObat yang sudah diport jadi "Validasi". DIKONFIRMASI USER: BUKAN
// direplikasi 1:1 (akan membawa balik mesin billing/jurnal yang sengaja
// di-skip di semua fitur lain proyek ini). Sebagai gantinya: modal
// READ-ONLY yang menampilkan rincian obat yang SUDAH diserahkan untuk
// resep itu — reuse PERSIS endpoint items yang sama dipakai
// ModalValidasiObat (getPermintaanResepRalanItems/RanapItems), TANPA
// endpoint atau mesin baru sama sekali.
const ModalObatTervalidasi: React.FC<{ resep: SelectedResep | null; onClose: () => void }> = ({ resep, onClose }) => {
  const [detail, setDetail] = React.useState<ResepItems | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!resep) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/permintaan-resep/${resep.kind}/${encodeURIComponent(resep.no_resep)}/items`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setDetail(data);
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
  }, [resep]);

  if (!resep) return null;
  const formatRupiah = (v: number) => Math.round(v || 0).toLocaleString('id-ID');

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#ffffff', borderRadius: 16, padding: 24, width: 900, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Obat Tervalidasi</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              No.Resep {resep.no_resep} — {resep.nm_pasien} ({resep.no_rkm_medis})
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}>
            ×
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, marginTop: 12 }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 12.5 }}>Memuat data...</div>
          ) : !detail || (detail.non_racikan.length === 0 && detail.racikan.length === 0) ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 12.5 }}>Tidak ada item obat pada resep ini</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {detail.non_racikan.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: '#6b7280', borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: '4px 6px', textAlign: 'left' }}>Kode</th>
                      <th style={{ padding: '4px 6px', textAlign: 'left' }}>Nama Obat</th>
                      <th style={{ padding: '4px 6px', textAlign: 'right' }}>Jumlah</th>
                      <th style={{ padding: '4px 6px', textAlign: 'left' }}>Satuan</th>
                      <th style={{ padding: '4px 6px', textAlign: 'right' }}>Harga(Rp)</th>
                      <th style={{ padding: '4px 6px', textAlign: 'right' }}>Subtotal(Rp)</th>
                      <th style={{ padding: '4px 6px', textAlign: 'left' }}>Aturan Pakai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.non_racikan.map((it) => (
                      <tr key={it.kode_brng} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '4px 6px', color: '#374151' }}>{it.kode_brng}</td>
                        <td style={{ padding: '4px 6px', color: '#111827' }}>{it.nama_brng}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', color: '#374151' }}>{it.jml}</td>
                        <td style={{ padding: '4px 6px', color: '#374151' }}>{it.kode_sat}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', color: '#374151' }}>{formatRupiah(it.h_jual)}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right', color: '#374151' }}>{formatRupiah(it.subtotal)}</td>
                        <td style={{ padding: '4px 6px', color: '#6b7280' }}>{it.aturan_pakai}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {detail.racikan.map((rc) => (
                <div key={rc.no_racik} style={{ border: '1px solid #e5e7eb', borderRadius: 4, padding: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#4f46e5', marginBottom: 4 }}>
                    Racikan #{rc.no_racik} — {rc.nama_racik} ({rc.metode_racik}) × {rc.jml_dr}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ color: '#6b7280' }}>
                        <th style={{ padding: '3px 6px', textAlign: 'left' }}>Kode</th>
                        <th style={{ padding: '3px 6px', textAlign: 'left' }}>Nama Obat</th>
                        <th style={{ padding: '3px 6px', textAlign: 'right' }}>Jumlah</th>
                        <th style={{ padding: '3px 6px', textAlign: 'left' }}>Satuan</th>
                        <th style={{ padding: '3px 6px', textAlign: 'right' }}>Subtotal(Rp)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rc.detail.map((d) => (
                        <tr key={d.kode_brng}>
                          <td style={{ padding: '3px 6px', color: '#374151' }}>{d.kode_brng}</td>
                          <td style={{ padding: '3px 6px', color: '#111827' }}>{d.nama_brng}</td>
                          <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{d.jml}</td>
                          <td style={{ padding: '3px 6px', color: '#374151' }}>{d.kode_sat}</td>
                          <td style={{ padding: '3px 6px', textAlign: 'right', color: '#374151' }}>{formatRupiah(d.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                    Aturan Pakai: {rc.aturan_pakai} {rc.keterangan && `— ${rc.keterangan}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {detail && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb', fontSize: 13 }}>
            <div>Total: <strong>{formatRupiah(detail.total)}</strong></div>
            <div>PPN: <strong>{formatRupiah(detail.ppn)}</strong></div>
            <div>Total+PPN: <strong>{formatRupiah(detail.total_ppn)}</strong></div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

// ---- Sidebar item: Telaah Resep --------------------------------------------
//
// Padanan inventory/InventoryTelaahResep.java — di Java ini DIALOG
// TERSENDIRI dengan pencarian resep sendiri (tampil2(), filter tanggal +
// cari bebas), BUKAN tombol aksi per-baris di Daftar Resep Dokter (sudah
// dikoreksi user — awalnya salah taruh di situ, padahal Java memang
// punya layar pencarian sendiri terpisah dari DlgDaftarPermintaanResep).
// Reuse endpoint /api/permintaan-resep/ralan yang sudah ada (query-nya di
// Java untuk tampil2() nyaris identik: resep_obat+reg_periksa+pasien+
// dokter, filter tgl_peresepan + search bebas), cuma kolom yang
// ditampilkan disederhanakan (tanpa Validasi/Penyerahan yang tidak
// relevan di sini) + tombol "Telaah" per baris membuka ModalTelaahResep.

const TELAAH_SUB_TABS: { key: 'belum' | 'sudah'; label: string }[] = [
  { key: 'belum', label: 'Belum Ditelaah' },
  { key: 'sudah', label: 'Sudah Ditelaah' },
];

const TabTelaahResep: React.FC = () => {
  const [tgl1, setTgl1] = React.useState(todayStr());
  const [tgl2, setTgl2] = React.useState(todayStr());
  const [searchText, setSearchText] = React.useState('');
  const [subTab, setSubTab] = React.useState<'belum' | 'sudah'>('belum');
  const [allItems, setAllItems] = React.useState<ResepRalanRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [telaahRow, setTelaahRow] = React.useState<ResepRalanRow | null>(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/permintaan-resep/ralan?tgl1=${tgl1}&tgl2=${tgl2}`;
      if (searchText) url += `&search=${encodeURIComponent(searchText)}`;
      const res = await fetch(url);
      const data = await res.json();
      setAllItems(Array.isArray(data) ? data : []);
    } catch {
      setAllItems([]);
    } finally {
      setLoading(false);
    }
  }, [tgl1, tgl2, searchText]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh tiap 30 detik (lihat catatan sama di TabResepRalan).
  React.useEffect(() => {
    const interval = setInterval(() => fetchData(), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // "Belum Ditelaah" — resep tanpa baris di telaah_farmasi (belum pernah
  // disimpan lewat ModalTelaahResep). "Sudah Ditelaah" — kebalikannya,
  // dibuka sebagai riwayat/untuk edit ulang.
  const items = React.useMemo(
    () => allItems.filter((r) => (subTab === 'belum' ? !r.sdh_telaah : r.sdh_telaah)),
    [allItems, subTab]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        {TELAAH_SUB_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSubTab(t.key)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: subTab === t.key ? '2px solid #059669' : '2px solid transparent',
              background: 'transparent',
              color: subTab === t.key ? '#059669' : '#6b7280',
              fontWeight: subTab === t.key ? 600 : 400,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Dari Tanggal</label>
          <input type="date" style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12.5, boxSizing: 'border-box' }} value={tgl1} onChange={(e) => setTgl1(e.target.value)} />
        </div>
        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>s.d. Tanggal</label>
          <input type="date" style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12.5, boxSizing: 'border-box' }} value={tgl2} onChange={(e) => setTgl2(e.target.value)} />
        </div>
        <div style={{ minWidth: 220, flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cari</label>
          <input
            style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12.5, boxSizing: 'border-box' }}
            placeholder="No. Resep / No. Rawat / No. RM / Pasien / Dokter..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
      </div>

      <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Resep</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tgl/Jam Peresepan</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Rawat</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. RM</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Pasien</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Dokter Peresep</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Status</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>{subTab === 'belum' ? 'Tidak ada resep yang belum ditelaah' : 'Belum ada resep yang ditelaah'}</td></tr>
            ) : (
              items.map((row, index) => {
                const belum = row.status === 'Belum Terlayani';
                return (
                  <tr key={row.no_resep} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{row.no_resep}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                      {row.tgl_peresepan.slice(0, 10)} <span style={{ color: '#9ca3af' }}>{row.jam_peresepan}</span>
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{row.no_rawat}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{row.no_rkm_medis}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{row.nm_pasien}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{row.nm_dokter}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: belum ? '#fffbeb' : '#ecfdf5', color: belum ? '#d97706' : '#059669' }}>
                        {row.status}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setTelaahRow(row)}
                        style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #1AB1E5', background: '#ffffff', color: '#1AB1E5', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}
                      >
                        {subTab === 'belum' ? 'Telaah' : 'Lihat/Edit'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ModalTelaahResep resep={telaahRow} onClose={() => setTelaahRow(null)} onSaved={fetchData} />
    </div>
  );
};

// ---- Tab: Konseling Farmasi -------------------------------------------------

const KONSELING_SUB_TABS: { key: 'belum' | 'sudah'; label: string }[] = [
  { key: 'belum', label: 'Belum Konseling' },
  { key: 'sudah', label: 'Sudah Konseling' },
];

// Padanan BtnKonselingFarmasi di DlgDaftarPermintaanResep.java — di Java
// tombol toolbar yang bekerja atas baris resep yang sedang dipilih di
// Daftar Resep Dokter, tapi mengikuti keputusan user sebelumnya untuk
// Telaah Resep (dedicated tab + layar cari sendiri, bukan tombol
// per-baris/kolom), Konseling Farmasi dibuat dengan pola yang identik.
// Sumber daftar tetap /api/permintaan-resep/ralan (sama dgn Telaah Resep,
// Ranap belum tercakup — konsisten dengan cakupan Telaah Resep saat ini),
// dibedakan lewat kolom sdh_konseling (LEFT JOIN konseling_farmasi
// ON no_rawat, BUKAN no_resep — satu kunjungan bisa punya beberapa resep,
// semuanya berbagi status konseling yang sama).
const TabKonselingFarmasi: React.FC = () => {
  const [tgl1, setTgl1] = React.useState(todayStr());
  const [tgl2, setTgl2] = React.useState(todayStr());
  const [searchText, setSearchText] = React.useState('');
  const [subTab, setSubTab] = React.useState<'belum' | 'sudah'>('belum');
  const [allItems, setAllItems] = React.useState<ResepRalanRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [konselingRow, setKonselingRow] = React.useState<ResepRalanRow | null>(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/permintaan-resep/ralan?tgl1=${tgl1}&tgl2=${tgl2}`;
      if (searchText) url += `&search=${encodeURIComponent(searchText)}`;
      const res = await fetch(url);
      const data = await res.json();
      setAllItems(Array.isArray(data) ? data : []);
    } catch {
      setAllItems([]);
    } finally {
      setLoading(false);
    }
  }, [tgl1, tgl2, searchText]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh tiap 30 detik (lihat catatan sama di TabResepRalan).
  React.useEffect(() => {
    const interval = setInterval(() => fetchData(), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const items = React.useMemo(
    () => allItems.filter((r) => (subTab === 'belum' ? !r.sdh_konseling : r.sdh_konseling)),
    [allItems, subTab]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        {KONSELING_SUB_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSubTab(t.key)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: subTab === t.key ? '2px solid #059669' : '2px solid transparent',
              background: 'transparent',
              color: subTab === t.key ? '#059669' : '#6b7280',
              fontWeight: subTab === t.key ? 600 : 400,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Dari Tanggal</label>
          <input type="date" style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12.5, boxSizing: 'border-box' }} value={tgl1} onChange={(e) => setTgl1(e.target.value)} />
        </div>
        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>s.d. Tanggal</label>
          <input type="date" style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12.5, boxSizing: 'border-box' }} value={tgl2} onChange={(e) => setTgl2(e.target.value)} />
        </div>
        <div style={{ minWidth: 220, flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cari</label>
          <input
            style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12.5, boxSizing: 'border-box' }}
            placeholder="No. Resep / No. Rawat / No. RM / Pasien / Dokter..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
      </div>

      <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Resep</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tgl/Jam Peresepan</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Rawat</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. RM</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Pasien</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Dokter Peresep</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Status</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>{subTab === 'belum' ? 'Tidak ada resep yang belum konseling' : 'Belum ada resep yang dikonseling'}</td></tr>
            ) : (
              items.map((row, index) => {
                const belum = row.status === 'Belum Terlayani';
                return (
                  <tr key={row.no_resep} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{row.no_resep}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                      {row.tgl_peresepan.slice(0, 10)} <span style={{ color: '#9ca3af' }}>{row.jam_peresepan}</span>
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{row.no_rawat}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{row.no_rkm_medis}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{row.nm_pasien}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{row.nm_dokter}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: belum ? '#fffbeb' : '#ecfdf5', color: belum ? '#d97706' : '#059669' }}>
                        {row.status}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setKonselingRow(row)}
                        style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #1AB1E5', background: '#ffffff', color: '#1AB1E5', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}
                      >
                        {subTab === 'belum' ? 'Konseling' : 'Lihat/Edit'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ModalKonselingFarmasi resep={konselingRow} onClose={() => setKonselingRow(null)} onSaved={fetchData} />
    </div>
  );
};

// ---- Shell Permintaan Resep -------------------------------------------------

// Dipicu dari tab 'permintaan-resep' di sidebar Apotek.tsx, dirender
// sebagai overlay layar-penuh yang menutupi seluruh halaman Apotek
// (position: fixed, di atas overlay Apotek sendiri) — bukan konten inline
// di dalam card Apotek. Struktur & spacing DISAMAKAN PERSIS dengan
// ApotekView (sidebar 240px rounded-24 + header breadcrumb/Tutup + body
// card putih rounded-24), supaya terasa konsisten sebagai "form Khanza"
// yang sama — tapi sidebar-nya PUTIH/netral (bukan gradient hijau Apotek),
// supaya kedua layar tetap bisa dibedakan sekilas mana Apotek vs
// Permintaan Resep.
type PermintaanResepViewProps = {
  onClose: () => void;
};

export const PermintaanResepView: React.FC<PermintaanResepViewProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = React.useState<PermintaanResepTab>('dashboard');
  // Sub-menu di bawah "Daftar Resep Dokter" — padanan TabPilihRawat
  // (JTabbedPane Rawat Jalan/Rawat Inap) di DlgDaftarPermintaanResep.java.
  // Rawat Jalan sudah nyata (TabResepRalan), Rawat Inap masih placeholder.
  const [daftarResepSub, setDaftarResepSub] = React.useState<'ralan' | 'ranap'>('ralan');
  const [daftarResepExpanded, setDaftarResepExpanded] = React.useState(true);
  const [daftarResepHover, setDaftarResepHover] = React.useState(false);
  const activeLabel = MENU.find((m) => m.key === activeTab)?.label || '';

  // "Riwayat Pasien" — padanan BtnRiwayat di DlgDaftarPermintaanResep.java:
  // tombol toolbar yang aksinya terikat ke baris resep/permintaan yang
  // SEDANG DIPILIH di tab Daftar Resep Dokter (Ralan atau Ranap), BUKAN
  // tab navigasi mandiri. selectedPasien di-update oleh TabResepRalan/
  // TabResepRanap tiap kali baris diklik (lihat prop onSelectPasien); klik
  // "Riwayat Pasien" di sidebar TIDAK memindah activeTab, cuma membuka
  // RiwayatModal untuk pasien yang terakhir dipilih — kalau belum ada yang
  // dipilih, tampilkan peringatan (padanan JOptionPane "Silahkan pilih
  // data..!!" di Java).
  const [selectedPasien, setSelectedPasien] = React.useState<PasienRingkas | null>(null);
  const [showRiwayatModal, setShowRiwayatModal] = React.useState(false);

  const handleRiwayatPasienClick = () => {
    if (!selectedPasien) {
      Swal.fire({ icon: 'warning', title: 'Belum ada pasien dipilih', text: 'Silahkan klik salah satu baris di Daftar Resep Dokter terlebih dahulu.' });
      return;
    }
    setShowRiwayatModal(true);
  };

  // "Obat Tervalidasi" — padanan BtnPemberianObat: sama pola tombol aksi
  // dengan Riwayat Pasien, TAPI cuma jalan untuk resep (Ralan/Ranap, bukan
  // Stok Pasien/Resep Pulang) dan HARUS sudah Status="Sudah Terlayani"
  // (padanan JOptionPane "Silahkan pilih data yang sudah divalidasi..!!"
  // di Java kalau belum). Lihat komentar ModalObatTervalidasi untuk
  // kenapa BUKAN direplikasi sebagai DlgPemberianObat penuh.
  const [selectedResep, setSelectedResep] = React.useState<SelectedResep | null>(null);
  const [showObatTervalidasiModal, setShowObatTervalidasiModal] = React.useState(false);

  const handleObatTervalidasiClick = () => {
    if (!selectedResep) {
      Swal.fire({ icon: 'warning', title: 'Belum ada resep dipilih', text: 'Silahkan klik salah satu baris resep di Daftar Resep Dokter (Rawat Jalan/Rawat Inap) terlebih dahulu.' });
      return;
    }
    if (selectedResep.status !== 'Sudah Terlayani') {
      Swal.fire({ icon: 'warning', title: 'Resep belum divalidasi', text: 'Silahkan pilih data resep yang sudah divalidasi.' });
      return;
    }
    setShowObatTervalidasiModal(true);
  };

  return (
    <section
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: '#F3F4F6',
        padding: 20,
        display: 'flex',
        gap: 16,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Sidebar — putih, bukan gradient, tapi bentuk/ukuran sama Apotek */}
      <aside
        style={{
          width: 240,
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 24,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          padding: 16,
          boxSizing: 'border-box',
          boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 20px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111827', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path>
              <path d="M14 2v6h6"></path>
              <path d="M9 15h6"></path>
              <path d="M9 11h6"></path>
            </svg>
          </div>
          <div style={{ color: '#111827', fontSize: 15, fontWeight: 700, letterSpacing: '0.2px' }}>
            Permintaan Resep
          </div>
        </div>

        {/* Menu */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {MENU.map((item) => {
            const active = activeTab === item.key;
            const isDaftarResep = item.key === 'dashboard';

            // "Daftar Resep Dokter" — saat aktif & terbuka, judul + sub-item
            // Rawat Jalan/Rawat Inap dibungkus SATU container dengan SATU
            // warna background hijau yang sama (bukan dua rona/gradasi
            // berbeda) — item mana yang sedang dipilih ditandai lewat bobot
            // teks, bukan warna latar terpisah. Saat tidak aktif, tombol
            // datar tanpa warna, sama seperti item lain.
            if (isDaftarResep) {
              return (
                <div
                  key={item.key}
                  style={{
                    background: active ? '#059669' : 'transparent',
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (active) {
                        setDaftarResepExpanded((v) => !v);
                      } else {
                        setActiveTab(item.key);
                        setDaftarResepExpanded(true);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: 'none',
                      background: !active && daftarResepHover ? '#f9fafb' : 'transparent',
                      color: active ? '#ffffff' : '#6b7280',
                      fontWeight: 400,
                      fontSize: 13,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={() => setDaftarResepHover(true)}
                    onMouseLeave={() => setDaftarResepHover(false)}
                  >
                    {item.icon}
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flexShrink: 0, transform: daftarResepExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                  {active && daftarResepExpanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 6 }}>
                      {([
                        { key: 'ralan', label: 'Rawat Jalan' },
                        { key: 'ranap', label: 'Rawat Inap' },
                      ] as const).map((sub) => {
                        const subActive = daftarResepSub === sub.key;
                        return (
                          <button
                            key={sub.key}
                            type="button"
                            onClick={() => setDaftarResepSub(sub.key)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '8px 14px 8px 34px',
                              border: 'none',
                              background: 'transparent',
                              color: '#ffffff',
                              fontWeight: subActive ? 700 : 400,
                              fontSize: 12.5,
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            {subActive && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <polyline points="9 6 15 12 9 18"></polyline>
                              </svg>
                            )}
                            {sub.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // "Riwayat Pasien"/"Obat Tervalidasi" — tombol AKSI, bukan tab
            // navigasi (lihat komentar handleRiwayatPasienClick/
            // handleObatTervalidasiClick): tidak pernah tersorot
            // hijau/aktif karena tidak mengubah activeTab.
            const isActionButton = item.key === 'riwayat-pasien' || item.key === 'obat-tervalidasi';
            const actionHandler = item.key === 'riwayat-pasien' ? handleRiwayatPasienClick : handleObatTervalidasiClick;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => (isActionButton ? actionHandler() : setActiveTab(item.key))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: 'none',
                  background: !isActionButton && active ? '#059669' : 'transparent',
                  color: !isActionButton && active ? '#ffffff' : '#6b7280',
                  fontWeight: 400,
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (isActionButton || !active) e.currentTarget.style.background = '#f9fafb';
                }}
                onMouseLeave={(e) => {
                  if (isActionButton || !active) e.currentTarget.style.background = 'transparent';
                }}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header — langsung di atas background, tanpa card */}
        <div
          style={{
            padding: '0 4px 16px',
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <button
              type="button"
              onClick={onClose}
              title="Kembali ke halaman sebelumnya"
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                border: '1px solid #d1d5db',
                background: '#ffffff',
                color: '#374151',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                padding: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5"></path>
                <path d="M12 19l-7-7 7-7"></path>
              </svg>
            </button>
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              <span style={{ color: '#111827', fontWeight: 600 }}>Permintaan Resep</span> / {activeLabel}
              {activeTab === 'dashboard' && ` / ${daftarResepSub === 'ralan' ? 'Rawat Jalan' : 'Rawat Inap'}`}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #059669',
                background: '#059669',
                color: '#ffffff',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Kembali Ke Halaman Apotek
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: 24,
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            background: '#ffffff',
            borderRadius: 24,
            boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
          }}
        >
          {activeTab === 'dashboard' &&
            (daftarResepSub === 'ralan' ? (
              <TabResepRalan onSelectPasien={setSelectedPasien} onSelectResep={setSelectedResep} />
            ) : (
              <TabResepRanap onSelectPasien={setSelectedPasien} onSelectResep={setSelectedResep} />
            ))}
          {activeTab === 'telaah-resep' && <TabTelaahResep />}
          {activeTab === 'konseling-farmasi' && <TabKonselingFarmasi />}
          {activeTab === 'informasi-obat' && <Placeholder title="Informasi Obat" />}
          {activeTab === 'cetak-resep-awal' && <Placeholder title="Cetak Resep Awal" />}
          {activeTab === 'resep-luar' && <Placeholder title="Resep Luar" />}
          {activeTab === 'piutang-obat' && <Placeholder title="Piutang Obat" />}
          {activeTab === 'data-sep-bpjs' && <Placeholder title="Data Sep BPJS" />}
          {activeTab === 'obat-online-bpjs' && <Placeholder title="Obat Apotek Online BPJS" />}
        </div>
      </div>

      {showRiwayatModal && selectedPasien && (
        <RiwayatModal patient={selectedPasien} onClose={() => setShowRiwayatModal(false)} />
      )}
      {showObatTervalidasiModal && selectedResep && (
        <ModalObatTervalidasi resep={selectedResep} onClose={() => setShowObatTervalidasiModal(false)} />
      )}
    </section>
  );
};

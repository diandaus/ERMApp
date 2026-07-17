import React from 'react';
import Swal from 'sweetalert2';
import { localDateStr } from '../utils/date';

type FormState = {
  kodebooking: string;
  no_rawat: string;
  jenispasien: 'JKN' | 'NON JKN';
  nomorkartu: string;
  nik: string;
  nohp: string;
  kodepoli: string;
  namapoli: string;
  pasienbaru: boolean;
  norm: string;
  tanggalperiksa: string;
  kodedokter: string;
  namadokter: string;
  jampraktek: string;
  jeniskunjungan: number;
  nomorreferensi: string;
  nomorantrean: string;
  angkaantrean: string;
  estimasidilayani: string; // datetime-local value
  sisakuotajkn: string;
  kuotajkn: string;
  sisakuotanonjkn: string;
  kuotanonjkn: string;
  keterangan: string;
};

const emptyForm = (): FormState => ({
  kodebooking: '',
  no_rawat: '',
  jenispasien: 'JKN',
  nomorkartu: '',
  nik: '',
  nohp: '',
  kodepoli: '',
  namapoli: '',
  pasienbaru: false,
  norm: '',
  tanggalperiksa: localDateStr(),
  kodedokter: '',
  namadokter: '',
  jampraktek: '',
  jeniskunjungan: 1,
  nomorreferensi: '',
  nomorantrean: '',
  angkaantrean: '',
  estimasidilayani: '',
  sisakuotajkn: '',
  kuotajkn: '',
  sisakuotanonjkn: '',
  kuotanonjkn: '',
  keterangan: '',
});

const jenisKunjunganLabel: Record<number, string> = {
  1: 'Rujukan FKTP',
  2: 'Rujukan Internal',
  3: 'Kontrol',
  4: 'Rujukan Antar RS',
};

type TaskListRow = {
  taskid: number;
  taskname: string;
  waktu: string;
  wakturs: string;
  kodebooking: string;
};

type DashboardRow = {
  kdppk: string;
  nmppk: string;
  kodepoli: string;
  namapoli: string;
  tanggal: string;
  jumlah_antrean: number;
  avg_waktu_task1: number;
  avg_waktu_task2: number;
  avg_waktu_task3: number;
  avg_waktu_task4: number;
  avg_waktu_task5: number;
  avg_waktu_task6: number;
};

type PendaftaranRow = {
  kodebooking: string;
  tanggal: string;
  kodepoli: string;
  kodedokter: number;
  jampraktek: string;
  nik: string;
  nokapst: string;
  nohp: string;
  norekammedis: string;
  jeniskunjungan: number;
  nomorreferensi: string;
  sumberdata: string;
  ispeserta: number;
  noantrean: string;
  estimasidilayani: number;
  createdtime: number;
  status: string;
};

const formatDetik = (v: number) => {
  if (!v) return '0 dtk';
  const menit = Math.floor(v / 60);
  const detik = v % 60;
  return menit > 0 ? `${menit}m ${detik}dtk` : `${detik} dtk`;
};

const TASK_ID_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: '1 - Mulai waktu tunggu admisi' },
  { value: '2', label: '2 - Akhir tunggu / mulai layan admisi' },
  { value: '3', label: '3 - Akhir layan admisi / mulai tunggu poli' },
  { value: '4', label: '4 - Akhir tunggu / mulai layan poli' },
  { value: '5', label: '5 - Akhir layan poli / mulai tunggu farmasi' },
  { value: '6', label: '6 - Akhir tunggu farmasi / mulai layan (racik obat)' },
  { value: '7', label: '7 - Akhir obat selesai dibuat' },
  { value: '99', label: '99 - Tidak hadir / batal' },
];

// Status antrean dari BPJS berupa teks bebas (mis. "Belum dilayani",
// "Selesai dilayani") — bukan enum tetap seperti tabel lokal, jadi
// pewarnaan badge dicocokkan lewat substring, bukan exact match.
const getStatusColor = (status: string): { bg: string; color: string; border: string } => {
  const s = (status || '').toLowerCase();
  if (s.includes('batal') || s.includes('gagal')) return { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' };
  if (s.includes('selesai')) return { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' };
  if (s.includes('belum')) return { bg: '#fefce8', color: '#854d0e', border: '#fde68a' };
  return { bg: '#f3f4f6', color: '#374151', border: '#e5e7eb' };
};

const formatTgl = (tgl: string) => {
  if (!tgl || tgl.startsWith('0000-00-00')) return '-';
  const datePart = tgl.includes('T') ? tgl.split('T')[0] : tgl;
  const [y, m, d] = datePart.split('-');
  return y && m && d ? `${d}/${m}/${y}` : datePart;
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 4,
  display: 'block',
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label style={labelStyle}>{label}</label>
    {children}
  </div>
);

export const AntreanRsView: React.FC = () => {
  const [items, setItems] = React.useState<PendaftaranRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchText, setSearchText] = React.useState('');
  const [tglDari, setTglDari] = React.useState(localDateStr());
  const [showModal, setShowModal] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(emptyForm());
  const [saving, setSaving] = React.useState(false);

  const [farmasiKodeBooking, setFarmasiKodeBooking] = React.useState<string | null>(null);
  const [farmasiForm, setFarmasiForm] = React.useState({ jenisresep: 'non racikan', nomorantrean: '', keterangan: '' });
  const [savingFarmasi, setSavingFarmasi] = React.useState(false);

  const [waktuKodeBooking, setWaktuKodeBooking] = React.useState<string | null>(null);
  const [waktuForm, setWaktuForm] = React.useState({ taskid: '1', waktu: '', jenisresep: '' });
  const [savingWaktu, setSavingWaktu] = React.useState(false);

  const [listTaskKodeBooking, setListTaskKodeBooking] = React.useState<string | null>(null);
  const [listTaskLoading, setListTaskLoading] = React.useState(false);
  const [listTaskError, setListTaskError] = React.useState<string | null>(null);
  const [listTaskRows, setListTaskRows] = React.useState<TaskListRow[]>([]);

  const [showDashboard, setShowDashboard] = React.useState(false);
  const [dashboardMode, setDashboardMode] = React.useState<'tanggal' | 'bulan'>('tanggal');
  const [dashboardTanggal, setDashboardTanggal] = React.useState(localDateStr());
  const [dashboardBulan, setDashboardBulan] = React.useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  const [dashboardTahun, setDashboardTahun] = React.useState(() => String(new Date().getFullYear()));
  const [dashboardWaktu, setDashboardWaktu] = React.useState<'rs' | 'server'>('rs');
  const [dashboardLoading, setDashboardLoading] = React.useState(false);
  const [dashboardError, setDashboardError] = React.useState<string | null>(null);
  const [dashboardRows, setDashboardRows] = React.useState<DashboardRow[]>([]);

  const [showPendaftaran, setShowPendaftaran] = React.useState(false);
  const [pendaftaranMode, setPendaftaranMode] = React.useState<'tanggal' | 'kodebooking' | 'aktif' | 'filter'>('tanggal');
  const [pendaftaranKodeBooking, setPendaftaranKodeBooking] = React.useState<string | null>(null);
  const [pendaftaranTanggal, setPendaftaranTanggal] = React.useState(localDateStr());
  const [pendaftaranFilter, setPendaftaranFilter] = React.useState({ kodePoli: '', kodeDokter: '', hari: '1', jamPraktek: '' });
  const [pendaftaranLoading, setPendaftaranLoading] = React.useState(false);
  const [pendaftaranError, setPendaftaranError] = React.useState<string | null>(null);
  const [pendaftaranRows, setPendaftaranRows] = React.useState<PendaftaranRow[]>([]);

  // Ringkasan jumlah belum/selesai, dipecah per sumber data: "Total" untuk
  // antrean yang dibuat lewat bridging RS ini (sumberdata selain Mobile JKN),
  // "MJKN" untuk antrean yang didaftarkan pasien lewat aplikasi Mobile JKN.
  const pendaftaranSummary = React.useMemo(() => {
    let totalBelum = 0;
    let totalSelesai = 0;
    let mjknBelum = 0;
    let mjknSelesai = 0;
    for (const row of pendaftaranRows) {
      const isMjkn = (row.sumberdata || '').toLowerCase().includes('mobile jkn');
      const isBelum = (row.status || '').toLowerCase().includes('belum');
      const isSelesai = (row.status || '').toLowerCase().includes('selesai');
      if (isMjkn) {
        if (isBelum) mjknBelum++;
        if (isSelesai) mjknSelesai++;
      } else {
        if (isBelum) totalBelum++;
        if (isSelesai) totalSelesai++;
      }
    }
    return { totalBelum, totalSelesai, mjknBelum, mjknSelesai };
  }, [pendaftaranRows]);

  // Diambil langsung dari BPJS (bukan tabel lokal) supaya kode booking dari
  // Mobile JKN maupun yang dibuat lewat RS (bridging) sama-sama tampil,
  // persis seperti "Cek Pendaftaran BPJS (Antrean Per Tanggal)". Pencarian
  // dilakukan di sisi client karena endpoint BPJS-nya tidak punya parameter
  // keyword, cuma tanggal.
  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bridging/antrean/pendaftaran-tanggal?tanggal=${tglDari}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil data antrean');
      const rows: PendaftaranRow[] = data.pendaftaran?.list ?? [];
      setItems(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tglDari]);

  React.useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filteredItems = React.useMemo(() => {
    const kw = searchText.trim().toLowerCase();
    if (!kw) return items;
    return items.filter((it) =>
      [it.kodebooking, it.norekammedis, it.nokapst, it.nik].some((v) => (v || '').toLowerCase().includes(kw))
    );
  }, [items, searchText]);

  const openModal = () => {
    setForm(emptyForm());
    setShowModal(true);
  };

  // Dipakai saat BPJS menolak update (Waktu/Farmasi/List Task) dengan
  // "Kode Booking tidak ditemukan" — narik data lokal (referensi_mobilejkn_bpjs,
  // yang sudah pernah tersimpan saat antrean ini pertama dibuat, baik lewat
  // klik manual maupun worker otomatis) dan mengisi modal "Tambah Antrean"
  // supaya staf tinggal cek ulang lalu kirim lagi, tanpa mengetik dari nol.
  const openModalFromLocal = async (kodeBooking: string) => {
    try {
      const res = await fetch(`/api/bridging/antrean/list?kodebooking=${encodeURIComponent(kodeBooking)}`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data) || data.length === 0) {
        Swal.fire({ icon: 'warning', title: 'Data lokal tidak ditemukan', text: `Tidak ada catatan lokal untuk kode booking ${kodeBooking}, silahkan isi manual.` });
        setForm({ ...emptyForm(), kodebooking: kodeBooking });
        setShowModal(true);
        return;
      }
      const row = data[0];
      const jkMatch = /^(\d+)/.exec(row.jeniskunjungan || '');
      setForm({
        ...emptyForm(),
        kodebooking: row.kodebooking || kodeBooking,
        no_rawat: row.no_rawat || '',
        jenispasien: row.nomorkartu ? 'JKN' : 'NON JKN',
        nomorkartu: row.nomorkartu || '',
        nik: row.nik || '',
        nohp: row.nohp || '',
        kodepoli: row.kodepoli || '',
        namapoli: row.namapoli || '',
        pasienbaru: row.pasienbaru === '1',
        norm: row.norm || '',
        tanggalperiksa: (row.tanggalperiksa || '').slice(0, 10) || localDateStr(),
        kodedokter: row.kodedokter || '',
        namadokter: row.namadokter || '',
        jampraktek: row.jampraktek || '',
        jeniskunjungan: jkMatch ? Number(jkMatch[1]) : 1,
        nomorreferensi: row.nomorreferensi || '',
        nomorantrean: row.nomorantrean || '',
        angkaantrean: row.angkaantrean || '',
        estimasidilayani: row.estimasidilayani ? epochMsToDatetimeLocal(Number(row.estimasidilayani)) : '',
        sisakuotajkn: row.sisakuotajkn ? String(row.sisakuotajkn) : '',
        kuotajkn: row.kuotajkn ? String(row.kuotajkn) : '',
        sisakuotanonjkn: row.sisakuotanonjkn ? String(row.sisakuotanonjkn) : '',
        kuotanonjkn: row.kuotanonjkn ? String(row.kuotanonjkn) : '',
      });
      setShowModal(true);
      Swal.fire({
        icon: 'info',
        title: 'Terisi dari data lokal',
        text: 'Mohon cek ulang semua field sebelum dikirim ke BPJS.',
        timer: 3000,
        showConfirmButton: false,
      });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal mengambil data lokal', text: err.message });
    }
  };

  // "Kode Booking tidak ditemukan" dari BPJS berarti antrean itu tidak
  // (lagi) dikenali di sisi BPJS — desync antara tabel lokal & BPJS
  // (mis. dibuat worker tapi gagal di BPJS, atau kadaluarsa). Satu-satunya
  // jalan keluar staf adalah kirim ulang "Tambah Antrean" untuk kode
  // booking yang sama, jadi begitu error ini terdeteksi, langsung
  // tawarkan itu alih-alih cuma menampilkan pesan gagal buntu.
  const offerTambahUlang = (kodeBooking: string, message: string) => {
    const notFound = /tidak ditemukan/i.test(message);
    Swal.fire({
      icon: notFound ? 'warning' : 'error',
      title: 'Gagal!',
      text: message,
      showCancelButton: notFound,
      confirmButtonText: notFound ? 'Tambah Antrean Ulang' : 'OK',
      cancelButtonText: 'Tutup',
      confirmButtonColor: notFound ? '#2563eb' : undefined,
    }).then((result) => {
      if (notFound && result.isConfirmed) {
        openModalFromLocal(kodeBooking);
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const estimasiMs = form.estimasidilayani ? new Date(form.estimasidilayani).getTime() : 0;
      const body = {
        kodebooking: form.kodebooking.trim(),
        no_rawat: form.no_rawat.trim(),
        jenispasien: form.jenispasien,
        nomorkartu: form.jenispasien === 'JKN' ? form.nomorkartu.trim() : '',
        nik: form.nik.trim(),
        nohp: form.nohp.trim(),
        kodepoli: form.kodepoli.trim(),
        namapoli: form.namapoli.trim(),
        pasienbaru: form.pasienbaru ? 1 : 0,
        norm: form.norm.trim(),
        tanggalperiksa: form.tanggalperiksa,
        kodedokter: form.kodedokter.trim(),
        namadokter: form.namadokter.trim(),
        jampraktek: form.jampraktek.trim(),
        jeniskunjungan: form.jeniskunjungan,
        nomorreferensi: form.jenispasien === 'JKN' ? form.nomorreferensi.trim() : '',
        nomorantrean: form.nomorantrean.trim(),
        angkaantrean: Number(form.angkaantrean) || 0,
        estimasidilayani: estimasiMs,
        sisakuotajkn: Number(form.sisakuotajkn) || 0,
        kuotajkn: Number(form.kuotajkn) || 0,
        sisakuotanonjkn: Number(form.sisakuotanonjkn) || 0,
        kuotanonjkn: Number(form.kuotanonjkn) || 0,
        keterangan: form.keterangan.trim(),
      };
      const res = await fetch('/api/bridging/antrean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambah antrean');
      setShowModal(false);
      await fetchItems();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message || 'Antrean berhasil ditambahkan', timer: 2500, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const openFarmasiModal = (kodeBooking: string) => {
    setFarmasiForm({ jenisresep: 'non racikan', nomorantrean: '', keterangan: '' });
    setFarmasiKodeBooking(kodeBooking);
  };

  const handleSubmitFarmasi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmasiKodeBooking) return;
    setSavingFarmasi(true);
    try {
      const res = await fetch('/api/bridging/antrean-farmasi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kodebooking: farmasiKodeBooking,
          jenisresep: farmasiForm.jenisresep,
          nomorantrean: Number(farmasiForm.nomorantrean) || 0,
          keterangan: farmasiForm.keterangan.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambah antrean farmasi');
      setFarmasiKodeBooking(null);
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message || 'Antrean farmasi berhasil ditambahkan', timer: 2500, showConfirmButton: false });
    } catch (err: any) {
      const kodeGagal = farmasiKodeBooking;
      setFarmasiKodeBooking(null);
      if (kodeGagal) offerTambahUlang(kodeGagal, err.message);
    } finally {
      setSavingFarmasi(false);
    }
  };

  const nowDatetimeLocal = () => {
    const d = new Date();
    d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const epochMsToDatetimeLocal = (ms: number) => {
    if (!ms) return '';
    const d = new Date(ms);
    if (isNaN(d.getTime())) return '';
    d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const openWaktuModal = (kodeBooking: string) => {
    setWaktuForm({ taskid: '1', waktu: nowDatetimeLocal(), jenisresep: '' });
    setWaktuKodeBooking(kodeBooking);
  };

  const handleSubmitWaktu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waktuKodeBooking) return;
    setSavingWaktu(true);
    try {
      const waktuMs = waktuForm.waktu ? new Date(waktuForm.waktu).getTime() : 0;
      const body: any = {
        kodebooking: waktuKodeBooking,
        taskid: Number(waktuForm.taskid),
        waktu: waktuMs,
      };
      if (waktuForm.jenisresep) body.jenisresep = waktuForm.jenisresep;
      const res = await fetch('/api/bridging/antrean/update-waktu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim waktu antrean');
      setWaktuKodeBooking(null);
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: data.message || 'Waktu antrean berhasil dikirim', timer: 2500, showConfirmButton: false });
    } catch (err: any) {
      const kodeGagal = waktuKodeBooking;
      setWaktuKodeBooking(null);
      if (kodeGagal) offerTambahUlang(kodeGagal, err.message);
    } finally {
      setSavingWaktu(false);
    }
  };

  const openListTaskModal = async (kodeBooking: string) => {
    setListTaskKodeBooking(kodeBooking);
    setListTaskRows([]);
    setListTaskError(null);
    setListTaskLoading(true);
    try {
      const res = await fetch('/api/bridging/antrean/list-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kodebooking: kodeBooking }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil riwayat task id');
      const rows: TaskListRow[] = data.list_task?.list ?? [];
      setListTaskRows(Array.isArray(rows) ? rows : []);
    } catch (err: any) {
      setListTaskError(err.message || 'Terjadi kesalahan');
    } finally {
      setListTaskLoading(false);
    }
  };

  const fetchDashboard = async () => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const url = dashboardMode === 'tanggal'
        ? `/api/bridging/antrean/dashboard?tanggal=${dashboardTanggal}&waktu=${dashboardWaktu}`
        : `/api/bridging/antrean/dashboard-bulan?bulan=${dashboardBulan}&tahun=${dashboardTahun}&waktu=${dashboardWaktu}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil dashboard waktu tunggu');
      const rows: DashboardRow[] = data.dashboard?.list ?? [];
      setDashboardRows(Array.isArray(rows) ? rows : []);
    } catch (err: any) {
      setDashboardError(err.message || 'Terjadi kesalahan');
      setDashboardRows([]);
    } finally {
      setDashboardLoading(false);
    }
  };

  const openDashboard = () => {
    setShowDashboard(true);
    setDashboardRows([]);
    setDashboardError(null);
  };

  const fetchPendaftaran = async (mode: 'tanggal' | 'kodebooking' | 'aktif' | 'filter', kodeBooking?: string) => {
    setPendaftaranLoading(true);
    setPendaftaranError(null);
    try {
      let url = `/api/bridging/antrean/pendaftaran-tanggal?tanggal=${pendaftaranTanggal}`;
      if (mode === 'kodebooking') {
        url = `/api/bridging/antrean/pendaftaran-booking/${encodeURIComponent(kodeBooking || '')}`;
      } else if (mode === 'aktif') {
        url = `/api/bridging/antrean/pendaftaran-aktif`;
      } else if (mode === 'filter') {
        const p = new URLSearchParams({
          kode_poli: pendaftaranFilter.kodePoli.trim(),
          kode_dokter: pendaftaranFilter.kodeDokter.trim(),
          hari: pendaftaranFilter.hari,
          jampraktek: pendaftaranFilter.jamPraktek.trim(),
        });
        url = `/api/bridging/antrean/pendaftaran-filter?${p.toString()}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil pendaftaran antrean');
      const rows: PendaftaranRow[] = data.pendaftaran?.list ?? [];
      setPendaftaranRows(Array.isArray(rows) ? rows : []);
    } catch (err: any) {
      setPendaftaranError(err.message || 'Terjadi kesalahan');
      setPendaftaranRows([]);
    } finally {
      setPendaftaranLoading(false);
    }
  };

  const openPendaftaran = () => {
    setPendaftaranMode('tanggal');
    setPendaftaranKodeBooking(null);
    setShowPendaftaran(true);
    setPendaftaranRows([]);
    setPendaftaranError(null);
  };

  const openPendaftaranAktif = () => {
    setPendaftaranMode('aktif');
    setPendaftaranKodeBooking(null);
    setShowPendaftaran(true);
    setPendaftaranRows([]);
    setPendaftaranError(null);
    fetchPendaftaran('aktif');
  };

  const openPendaftaranFilter = () => {
    setPendaftaranMode('filter');
    setPendaftaranKodeBooking(null);
    setShowPendaftaran(true);
    setPendaftaranRows([]);
    setPendaftaranError(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Cari Kode Booking / No. RM / No. Kartu / NIK"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ ...inputStyle, width: 280 }}
          />
          <input type="date" value={tglDari} onChange={(e) => setTglDari(e.target.value)} style={{ ...inputStyle, width: 150 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={openDashboard}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #2563eb', background: '#ffffff', color: '#2563eb', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            Dashboard Waktu Tunggu
          </button>
          <button
            type="button"
            onClick={openPendaftaran}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #6b7280', background: '#ffffff', color: '#6b7280', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            Cek Pendaftaran BPJS
          </button>
          <button
            type="button"
            onClick={openPendaftaranAktif}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d97706', background: '#ffffff', color: '#d97706', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            Antrean Belum Dilayani
          </button>
          <button
            type="button"
            onClick={openPendaftaranFilter}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d97706', background: '#ffffff', color: '#d97706', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            Antrean Per Poli/Dokter/Jadwal
          </button>
          <button
            type="button"
            onClick={openModal}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            + Tambah Antrean
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kode Booking</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. RM</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Poli</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tgl Periksa</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Antrean</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Sumber Data</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Status</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : filteredItems.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Belum ada data antrean</td></tr>
            ) : (
              filteredItems.map((item, index) => {
                const sc = getStatusColor(item.status);
                return (
                  <tr key={item.kodebooking} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.kodebooking}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.norekammedis}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{item.kodepoli}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{formatTgl(item.tanggal)}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.noantrean}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.sumberdata}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                        {item.status}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => openWaktuModal(item.kodebooking)}
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #0ea5e9', background: '#ffffff', color: '#0ea5e9', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}
                        >
                          Waktu
                        </button>
                        <button
                          type="button"
                          onClick={() => openFarmasiModal(item.kodebooking)}
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #16a34a', background: '#ffffff', color: '#16a34a', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}
                        >
                          Farmasi
                        </button>
                        <button
                          type="button"
                          onClick={() => openListTaskModal(item.kodebooking)}
                          style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #6b7280', background: '#ffffff', color: '#6b7280', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}
                        >
                          List Task
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Tambah Antrean — pola default_card.md */}
      {showModal && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{ background: '#F3F4F6', borderRadius: 20, padding: '35px 8px 8px 8px', position: 'relative', maxWidth: 720, width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 16px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>Tambah Antrean</span>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db', padding: 16, overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Kode Booking *">
                  <input required style={inputStyle} value={form.kodebooking} onChange={(e) => setForm((p) => ({ ...p, kodebooking: e.target.value }))} placeholder="Isi manual, unik per antrean" />
                </Field>
                <Field label="Jenis Pasien">
                  <select style={inputStyle} value={form.jenispasien} onChange={(e) => setForm((p) => ({ ...p, jenispasien: e.target.value as 'JKN' | 'NON JKN' }))}>
                    <option value="JKN">JKN</option>
                    <option value="NON JKN">NON JKN</option>
                  </select>
                </Field>
                {form.jenispasien === 'JKN' && (
                  <Field label="No. Kartu BPJS">
                    <input style={inputStyle} value={form.nomorkartu} onChange={(e) => setForm((p) => ({ ...p, nomorkartu: e.target.value }))} />
                  </Field>
                )}
                <Field label="NIK">
                  <input style={inputStyle} value={form.nik} onChange={(e) => setForm((p) => ({ ...p, nik: e.target.value }))} />
                </Field>
                <Field label="No. HP">
                  <input style={inputStyle} value={form.nohp} onChange={(e) => setForm((p) => ({ ...p, nohp: e.target.value }))} />
                </Field>
                <Field label="No. RM *">
                  <input required style={inputStyle} value={form.norm} onChange={(e) => setForm((p) => ({ ...p, norm: e.target.value }))} />
                </Field>
                <Field label="Kode Poli *">
                  <input required style={inputStyle} value={form.kodepoli} onChange={(e) => setForm((p) => ({ ...p, kodepoli: e.target.value.toUpperCase() }))} placeholder="ANA" />
                </Field>
                <Field label="Nama Poli">
                  <input style={inputStyle} value={form.namapoli} onChange={(e) => setForm((p) => ({ ...p, namapoli: e.target.value }))} />
                </Field>
                <Field label="Tanggal Periksa *">
                  <input required type="date" style={inputStyle} value={form.tanggalperiksa} onChange={(e) => setForm((p) => ({ ...p, tanggalperiksa: e.target.value }))} />
                </Field>
                <Field label="Pasien Baru">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, height: 36 }}>
                    <input type="checkbox" checked={form.pasienbaru} onChange={(e) => setForm((p) => ({ ...p, pasienbaru: e.target.checked }))} />
                    Ya, pasien baru
                  </label>
                </Field>
                <Field label="Kode Dokter *">
                  <input required style={inputStyle} value={form.kodedokter} onChange={(e) => setForm((p) => ({ ...p, kodedokter: e.target.value }))} placeholder="12345" />
                </Field>
                <Field label="Nama Dokter">
                  <input style={inputStyle} value={form.namadokter} onChange={(e) => setForm((p) => ({ ...p, namadokter: e.target.value }))} />
                </Field>
                <Field label="Jam Praktek">
                  <input style={inputStyle} value={form.jampraktek} onChange={(e) => setForm((p) => ({ ...p, jampraktek: e.target.value }))} placeholder="08:00-16:00" />
                </Field>
                <Field label="Jenis Kunjungan">
                  <select style={inputStyle} value={form.jeniskunjungan} onChange={(e) => setForm((p) => ({ ...p, jeniskunjungan: Number(e.target.value) }))}>
                    {Object.entries(jenisKunjunganLabel).map(([v, label]) => (
                      <option key={v} value={v}>{v} - {label}</option>
                    ))}
                  </select>
                </Field>
                {form.jenispasien === 'JKN' && (
                  <Field label="No. Rujukan/Kontrol">
                    <input style={inputStyle} value={form.nomorreferensi} onChange={(e) => setForm((p) => ({ ...p, nomorreferensi: e.target.value }))} />
                  </Field>
                )}
                <Field label="No. Antrean">
                  <input style={inputStyle} value={form.nomorantrean} onChange={(e) => setForm((p) => ({ ...p, nomorantrean: e.target.value }))} placeholder="A-12" />
                </Field>
                <Field label="Angka Antrean">
                  <input type="number" style={inputStyle} value={form.angkaantrean} onChange={(e) => setForm((p) => ({ ...p, angkaantrean: e.target.value }))} />
                </Field>
                <Field label="Estimasi Dilayani">
                  <input type="datetime-local" style={inputStyle} value={form.estimasidilayani} onChange={(e) => setForm((p) => ({ ...p, estimasidilayani: e.target.value }))} />
                </Field>
                <Field label="Sisa Kuota JKN">
                  <input type="number" style={inputStyle} value={form.sisakuotajkn} onChange={(e) => setForm((p) => ({ ...p, sisakuotajkn: e.target.value }))} />
                </Field>
                <Field label="Kuota JKN">
                  <input type="number" style={inputStyle} value={form.kuotajkn} onChange={(e) => setForm((p) => ({ ...p, kuotajkn: e.target.value }))} />
                </Field>
                <Field label="Sisa Kuota Non JKN">
                  <input type="number" style={inputStyle} value={form.sisakuotanonjkn} onChange={(e) => setForm((p) => ({ ...p, sisakuotanonjkn: e.target.value }))} />
                </Field>
                <Field label="Kuota Non JKN">
                  <input type="number" style={inputStyle} value={form.kuotanonjkn} onChange={(e) => setForm((p) => ({ ...p, kuotanonjkn: e.target.value }))} />
                </Field>
              </div>
              <Field label="Keterangan">
                <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.keterangan} onChange={(e) => setForm((p) => ({ ...p, keterangan: e.target.value }))} placeholder="Informasi untuk pasien" />
              </Field>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#2563eb', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}
                >
                  {saving ? 'Mengirim...' : 'Kirim ke BPJS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Antrean Farmasi — pola default_card.md */}
      {farmasiKodeBooking && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={() => setFarmasiKodeBooking(null)}
        >
          <div
            style={{ background: '#F3F4F6', borderRadius: 20, padding: '35px 8px 8px 8px', position: 'relative', maxWidth: 460, width: '90%', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 16px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>Tambah Antrean Farmasi — {farmasiKodeBooking}</span>
              <button
                type="button"
                onClick={() => setFarmasiKodeBooking(null)}
                style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitFarmasi} style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Jenis Resep *">
                <select required style={inputStyle} value={farmasiForm.jenisresep} onChange={(e) => setFarmasiForm((p) => ({ ...p, jenisresep: e.target.value }))}>
                  <option value="non racikan">Non Racikan</option>
                  <option value="racikan">Racikan</option>
                </select>
              </Field>
              <Field label="Nomor Antrean *">
                <input required type="number" style={inputStyle} value={farmasiForm.nomorantrean} onChange={(e) => setFarmasiForm((p) => ({ ...p, nomorantrean: e.target.value }))} />
              </Field>
              <Field label="Keterangan">
                <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={farmasiForm.keterangan} onChange={(e) => setFarmasiForm((p) => ({ ...p, keterangan: e.target.value }))} />
              </Field>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setFarmasiKodeBooking(null)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={savingFarmasi}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: savingFarmasi ? '#9ca3af' : '#16a34a', color: '#fff', cursor: savingFarmasi ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}
                >
                  {savingFarmasi ? 'Mengirim...' : 'Kirim ke BPJS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Update Waktu Antrean — pola default_card.md */}
      {waktuKodeBooking && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={() => setWaktuKodeBooking(null)}
        >
          <div
            style={{ background: '#F3F4F6', borderRadius: 20, padding: '35px 8px 8px 8px', position: 'relative', maxWidth: 460, width: '90%', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 16px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>Update Waktu Antrean — {waktuKodeBooking}</span>
              <button
                type="button"
                onClick={() => setWaktuKodeBooking(null)}
                style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitWaktu} style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: '10px 12px', borderRadius: 10, fontSize: 11, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>
                Pasien baru: 1→2→3→4→5 (+6→7 jika ada obat). Pasien lama: 3→4→5 (+6→7 jika ada obat). Task Id harus dikirim berurutan dan waktunya menaik.
              </div>
              <Field label="Task Id *">
                <select required style={inputStyle} value={waktuForm.taskid} onChange={(e) => setWaktuForm((p) => ({ ...p, taskid: e.target.value }))}>
                  {TASK_ID_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Waktu *">
                <input required type="datetime-local" style={inputStyle} value={waktuForm.waktu} onChange={(e) => setWaktuForm((p) => ({ ...p, waktu: e.target.value }))} />
              </Field>
              <Field label="Jenis Resep (khusus jika sudah implementasi antrean farmasi)">
                <select style={inputStyle} value={waktuForm.jenisresep} onChange={(e) => setWaktuForm((p) => ({ ...p, jenisresep: e.target.value }))}>
                  <option value="">- Tidak diisi -</option>
                  <option value="Tidak ada">Tidak ada</option>
                  <option value="Racikan">Racikan</option>
                  <option value="Non racikan">Non racikan</option>
                </select>
              </Field>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setWaktuKodeBooking(null)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={savingWaktu}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: savingWaktu ? '#9ca3af' : '#0ea5e9', color: '#fff', cursor: savingWaktu ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}
                >
                  {savingWaktu ? 'Mengirim...' : 'Kirim ke BPJS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal List Waktu Task Id — pola default_card.md */}
      {listTaskKodeBooking && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={() => setListTaskKodeBooking(null)}
        >
          <div
            style={{ background: '#F3F4F6', borderRadius: 20, padding: '35px 8px 8px 8px', position: 'relative', maxWidth: 640, width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 16px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>List Waktu Task Id — {listTaskKodeBooking}</span>
              <button
                type="button"
                onClick={() => setListTaskKodeBooking(null)}
                style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db', padding: 16, overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {listTaskLoading ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Memuat...</div>
              ) : listTaskError ? (
                <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>{listTaskError}</div>
              ) : listTaskRows.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>Belum ada task id yang dikirim</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Task Id</th>
                      <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Task</th>
                      <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Waktu</th>
                      <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Waktu RS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listTaskRows.map((t, i) => (
                      <tr key={`${t.taskid}-${i}`} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                        <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{t.taskid}</td>
                        <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{t.taskname}</td>
                        <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{t.waktu}</td>
                        <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{t.wakturs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Dashboard Waktu Tunggu — pola default_card.md */}
      {showDashboard && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={() => setShowDashboard(false)}
        >
          <div
            style={{ background: '#F3F4F6', borderRadius: 20, padding: '35px 8px 8px 8px', position: 'relative', maxWidth: 960, width: '95%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 16px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>Dashboard Waktu Tunggu Per Tanggal</span>
              <button
                type="button"
                onClick={() => setShowDashboard(false)}
                style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db', padding: 16, overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 12, padding: 4, gap: 4, width: 'fit-content' }}>
                <button
                  type="button"
                  onClick={() => setDashboardMode('tanggal')}
                  style={{
                    padding: '6px 24px', borderRadius: 8,
                    border: dashboardMode === 'tanggal' ? '1px solid #2563eb' : '1px solid transparent',
                    background: dashboardMode === 'tanggal' ? '#ffffff' : 'transparent',
                    color: dashboardMode === 'tanggal' ? '#2563eb' : '#6b7280',
                    cursor: 'pointer', fontSize: 13, fontWeight: dashboardMode === 'tanggal' ? 600 : 400,
                  }}
                >
                  Per Tanggal
                </button>
                <button
                  type="button"
                  onClick={() => setDashboardMode('bulan')}
                  style={{
                    padding: '6px 24px', borderRadius: 8,
                    border: dashboardMode === 'bulan' ? '1px solid #2563eb' : '1px solid transparent',
                    background: dashboardMode === 'bulan' ? '#ffffff' : 'transparent',
                    color: dashboardMode === 'bulan' ? '#2563eb' : '#6b7280',
                    cursor: 'pointer', fontSize: 13, fontWeight: dashboardMode === 'bulan' ? 600 : 400,
                  }}
                >
                  Per Bulan
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                {dashboardMode === 'tanggal' ? (
                  <div>
                    <label style={labelStyle}>Tanggal</label>
                    <input type="date" style={{ ...inputStyle, width: 160 }} value={dashboardTanggal} onChange={(e) => setDashboardTanggal(e.target.value)} />
                  </div>
                ) : (
                  <>
                    <div>
                      <label style={labelStyle}>Bulan</label>
                      <select style={{ ...inputStyle, width: 140 }} value={dashboardBulan} onChange={(e) => setDashboardBulan(e.target.value)}>
                        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Tahun</label>
                      <input type="number" style={{ ...inputStyle, width: 100 }} value={dashboardTahun} onChange={(e) => setDashboardTahun(e.target.value)} />
                    </div>
                  </>
                )}
                <div>
                  <label style={labelStyle}>Sumber Waktu</label>
                  <select style={{ ...inputStyle, width: 140 }} value={dashboardWaktu} onChange={(e) => setDashboardWaktu(e.target.value as 'rs' | 'server')}>
                    <option value="rs">RS</option>
                    <option value="server">Server BPJS</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={fetchDashboard}
                  disabled={dashboardLoading}
                  style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: dashboardLoading ? '#9ca3af' : '#2563eb', color: '#fff', cursor: dashboardLoading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
                >
                  {dashboardLoading ? 'Memuat...' : 'Cari'}
                </button>
                {dashboardError && <span style={{ fontSize: 12, color: '#991b1b' }}>{dashboardError}</span>}
              </div>

              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                Task 1: Tunggu Admisi · Task 2: Layan Admisi · Task 3: Tunggu Poli · Task 4: Layan Poli · Task 5: Tunggu Farmasi · Task 6: Layan Farmasi
              </div>

              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6' }}>
                    <tr>
                      <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Poli</th>
                      <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jml Antrean</th>
                      <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Task 1</th>
                      <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Task 2</th>
                      <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Task 3</th>
                      <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Task 4</th>
                      <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Task 5</th>
                      <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Task 6</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardRows.length === 0 ? (
                      <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada data</td></tr>
                    ) : (
                      dashboardRows.map((r, i) => (
                        <tr key={`${r.kodepoli}-${i}`} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                          <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{r.namapoli}</td>
                          <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{r.jumlah_antrean}</td>
                          <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{formatDetik(r.avg_waktu_task1)}</td>
                          <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{formatDetik(r.avg_waktu_task2)}</td>
                          <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{formatDetik(r.avg_waktu_task3)}</td>
                          <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{formatDetik(r.avg_waktu_task4)}</td>
                          <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{formatDetik(r.avg_waktu_task5)}</td>
                          <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{formatDetik(r.avg_waktu_task6)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cek Pendaftaran BPJS (Antrean Per Tanggal) — pola default_card.md */}
      {showPendaftaran && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={() => setShowPendaftaran(false)}
        >
          <div
            style={{ background: '#F3F4F6', borderRadius: 20, padding: '35px 8px 8px 8px', position: 'relative', maxWidth: 1100, width: '95%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 16px 8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>
                {pendaftaranMode === 'kodebooking'
                  ? `Cek Pendaftaran BPJS — ${pendaftaranKodeBooking}`
                  : pendaftaranMode === 'aktif'
                    ? 'Antrean Belum Dilayani'
                    : pendaftaranMode === 'filter'
                      ? 'Antrean Belum Dilayani Per Poli/Dokter/Hari/Jam Praktek'
                      : 'Cek Pendaftaran BPJS (Antrean Per Tanggal)'}
              </span>
              <button
                type="button"
                onClick={() => setShowPendaftaran(false)}
                style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #d1d5db', padding: 16, overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                {pendaftaranMode === 'tanggal' && (
                  <div>
                    <label style={labelStyle}>Tanggal</label>
                    <input type="date" style={{ ...inputStyle, width: 160 }} value={pendaftaranTanggal} onChange={(e) => setPendaftaranTanggal(e.target.value)} />
                  </div>
                )}
                {pendaftaranMode === 'filter' && (
                  <>
                    <div>
                      <label style={labelStyle}>Kode Poli</label>
                      <input style={{ ...inputStyle, width: 100 }} value={pendaftaranFilter.kodePoli} onChange={(e) => setPendaftaranFilter((p) => ({ ...p, kodePoli: e.target.value.toUpperCase() }))} placeholder="INT" />
                    </div>
                    <div>
                      <label style={labelStyle}>Kode Dokter</label>
                      <input style={{ ...inputStyle, width: 120 }} value={pendaftaranFilter.kodeDokter} onChange={(e) => setPendaftaranFilter((p) => ({ ...p, kodeDokter: e.target.value }))} placeholder="1234" />
                    </div>
                    <div>
                      <label style={labelStyle}>Hari</label>
                      <select style={{ ...inputStyle, width: 130 }} value={pendaftaranFilter.hari} onChange={(e) => setPendaftaranFilter((p) => ({ ...p, hari: e.target.value }))}>
                        <option value="1">1 - Senin</option>
                        <option value="2">2 - Selasa</option>
                        <option value="3">3 - Rabu</option>
                        <option value="4">4 - Kamis</option>
                        <option value="5">5 - Jumat</option>
                        <option value="6">6 - Sabtu</option>
                        <option value="7">7 - Minggu</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Jam Praktek</label>
                      <input style={{ ...inputStyle, width: 140 }} value={pendaftaranFilter.jamPraktek} onChange={(e) => setPendaftaranFilter((p) => ({ ...p, jamPraktek: e.target.value }))} placeholder="08:00-17:00" />
                    </div>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => fetchPendaftaran(pendaftaranMode, pendaftaranKodeBooking || undefined)}
                  disabled={pendaftaranLoading}
                  style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: pendaftaranLoading ? '#9ca3af' : '#2563eb', color: '#fff', cursor: pendaftaranLoading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
                >
                  {pendaftaranLoading ? 'Memuat...' : 'Cari'}
                </button>
                {pendaftaranMode === 'tanggal' && pendaftaranRows.length > 0 && (
                  <>
                    <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 400, background: '#fefce8', color: '#854d0e', border: '1px solid #fde68a' }}>
                      Total Belum: {pendaftaranSummary.totalBelum}
                    </span>
                    <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 400, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
                      Total Selesai: {pendaftaranSummary.totalSelesai}
                    </span>
                    <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 400, background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }}>
                      MJKN Belum: {pendaftaranSummary.mjknBelum}
                    </span>
                    <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 400, background: '#eef2ff', color: '#3730a3', border: '1px solid #c7d2fe' }}>
                      MJKN Selesai: {pendaftaranSummary.mjknSelesai}
                    </span>
                  </>
                )}
                {pendaftaranError && <span style={{ fontSize: 12, color: '#991b1b' }}>{pendaftaranError}</span>}
              </div>

              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6' }}>
                    <tr>
                      <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kode Booking</th>
                      <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. RM</th>
                      <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Poli</th>
                      <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jam Praktek</th>
                      <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Antrean</th>
                      <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Sumber Data</th>
                      <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendaftaranRows.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada data</td></tr>
                    ) : (
                      pendaftaranRows.map((p, i) => (
                        <tr key={`${p.kodebooking}-${i}`} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                          <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{p.kodebooking}</td>
                          <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{p.norekammedis}</td>
                          <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{p.kodepoli}</td>
                          <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{p.jampraktek}</td>
                          <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{p.noantrean}</td>
                          <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{p.sumberdata}</td>
                          <td style={{ padding: '6px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{p.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

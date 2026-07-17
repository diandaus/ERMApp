import React from 'react';
import Swal from 'sweetalert2';

// ============================================================================
// BRIDGING BPJS — Referensi Pendaftaran Mobile JKN. Laporan READ-ONLY
// murni dari tabel LOKAL `referensi_mobilejkn_bpjs` (JOIN `pasien` untuk
// nama, lookup `maping_poli_bpjs`/`maping_dokter_dpjpvclaim` untuk nama
// poli/dokter versi BPJS) — TIDAK memanggil BPJS sama sekali untuk
// menampilkan daftarnya.
//
// Koreksi penting: percobaan pertama fitur ini salah menyamakannya
// dengan dialog bridging/BPJSAntreanPerTanggal.java ("Antrean Per
// Tanggal Mobile JKN", yang benar-benar memanggil live BPJS API dan
// menampilkan SEMUA sumber antrean + panel statistik capaian). User
// mengoreksi dengan mengutip langsung method `tampil()` dialog Java yang
// SEBENARNYA dipakai untuk tab ini — cuma SELECT dari
// `referensi_mobilejkn_bpjs`, tanpa panggilan BPJS, tanpa panel
// statistik apa pun. Endpoint backend disesuaikan total
// (`getReferensiMobileJkn` di bridging_antrean_handler.go, menggantikan
// `getSepTerbitCount` yang sudah tidak relevan).
//
// Tombol "Tambah Ulang" (+ modal "Tambah Antrean") ditambahkan setelah
// kasus nyata: booking tampil di tabel lokal ini TAPI tidak ditemukan di
// live BPJS ("Antrean Per Tanggal" di tab Antrian Mobile JKN) — artinya
// booking itu tidak pernah benar-benar tersimpan di BPJS meski sudah ada
// lokal (mis. dibuat worker otomatis tapi gagal di sisi BPJS). Karena
// halaman inilah yang justru menampilkan booking bermasalah semacam itu,
// tombol kirim-ulangnya diletakkan di sini juga (porting dari
// AntreanRs.tsx: form/modal & endpoint `/api/bridging/antrean` yang
// sama, field di-prefill dari `/api/bridging/antrean/list?kodebooking=`
// karena baris tabel ini sendiri tidak menyimpan semua field yang
// dibutuhkan payload Tambah Antrean, mis. kode poli/dokter mentah,
// kuota, No.Antrean, Estimasi Dilayani).
// ============================================================================

const inputStyle: React.CSSProperties = {
  padding: '7px 14px',
  borderRadius: 4,
  border: '1px solid #d1d5db',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

type ReferensiRow = {
  no_rawat: string;
  norm: string;
  nm_pasien: string;
  nohp: string;
  nomorkartu: string;
  nik: string;
  tanggalperiksa: string;
  nama_poli: string;
  nama_dokter: string;
  jampraktek: string;
  jeniskunjungan: string;
  nomorreferensi: string;
  status: string;
  validasi: string;
  nobooking: string;
};

const statusColor = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s.includes('checkin') || s.includes('selesai')) return { bg: '#ecfdf5', fg: '#059669' };
  if (s.includes('batal') || s.includes('gagal')) return { bg: '#fef2f2', fg: '#dc2626' };
  return { bg: '#fffbeb', fg: '#d97706' };
};

// ---- Modal "Tambah Antrean" (porting dari AntreanRs.tsx) ------------------

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
  tanggalperiksa: todayStr(),
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

const modalLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 4,
  display: 'block',
};

const modalInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label style={modalLabelStyle}>{label}</label>
    {children}
  </div>
);

const epochMsToDatetimeLocal = (ms: number) => {
  if (!ms) return '';
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export const ReferensiPendaftaranMobileJknView: React.FC = () => {
  const [tgl1, setTgl1] = React.useState(daysAgoStr(7));
  const [tgl2, setTgl2] = React.useState(todayStr());
  const [searchText, setSearchText] = React.useState('');
  const [items, setItems] = React.useState<ReferensiRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [showModal, setShowModal] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(emptyForm());
  const [saving, setSaving] = React.useState(false);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/bridging/referensi-mobilejkn?tgl1=${tgl1}&tgl2=${tgl2}`;
      if (searchText) url += `&search=${encodeURIComponent(searchText)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil data');
      setItems(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tgl1, tgl2, searchText]);

  const isFirstSearch = React.useRef(true);
  React.useEffect(() => {
    if (isFirstSearch.current) {
      isFirstSearch.current = false;
      fetchItems();
      return;
    }
    const t = setTimeout(() => fetchItems(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  React.useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tgl1, tgl2]);

  // Narik data lokal lengkap (baris tabel ini tidak menyimpan semua field
  // yang dibutuhkan payload Tambah Antrean, mis. kode poli/dokter mentah,
  // kuota, No.Antrean) lalu isi modal — staf tinggal cek Nama Poli/Dokter
  // sebelum kirim ulang ke BPJS.
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
        tanggalperiksa: (row.tanggalperiksa || '').slice(0, 10) || todayStr(),
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Dari Tanggal</label>
          <input type="date" style={inputStyle} value={tgl1} onChange={(e) => setTgl1(e.target.value)} />
        </div>
        <div style={{ width: 150 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>s.d. Tanggal</label>
          <input type="date" style={inputStyle} value={tgl2} onChange={(e) => setTgl2(e.target.value)} />
        </div>
        <div style={{ minWidth: 220, flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cari</label>
          <input style={{ ...inputStyle, width: '100%' }} placeholder="No.Rawat / No.RM / Nama Pasien / No.HP / No.Kartu / NIK / Status..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </div>
        <span style={{ fontSize: 12, color: '#6b7280', paddingBottom: 8, whiteSpace: 'nowrap' }}>{items.length} baris</span>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 6, background: '#fef2f2', color: '#dc2626', fontSize: 13, flexShrink: 0 }}>{error}</div>
      )}

      <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Rawat</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. RM</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Pasien</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. HP</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Kartu</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>NIK</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tgl Periksa</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Poli</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Dokter</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jam Praktek</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jenis Kunjungan</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Referensi</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Status</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Validasi</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. Booking</th>
              <th style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={16} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={16} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Tidak ada pendaftaran Mobile JKN pada rentang ini</td></tr>
            ) : (
              items.map((item, index) => {
                const sc = statusColor(item.status);
                return (
                  <tr key={`${item.no_rawat}-${index}`} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{item.no_rawat}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.norm}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827' }}>{item.nm_pasien}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nohp}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nomorkartu}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nik}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.tanggalperiksa?.slice(0, 10)}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nama_poli}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nama_dokter}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.jampraktek}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.jeniskunjungan}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nomorreferensi}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.fg }}>{item.status}</span>
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>{item.validasi}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{item.nobooking}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => openModalFromLocal(item.nobooking)}
                        title="Kirim ulang Tambah Antrean untuk kode booking ini, terisi dari data lokal — dipakai kalau booking ini tidak ditemukan di BPJS (mis. tidak muncul di Antrean Per Tanggal Mobile JKN)"
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #2563eb', background: '#ffffff', color: '#2563eb', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}
                      >
                        Tambah Ulang
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Tambah Antrean — porting dari AntreanRs.tsx, dipakai untuk kirim ulang */}
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
              <span style={{ color: '#000000', fontSize: 13, fontWeight: 400 }}>Tambah Antrean Ulang</span>
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
                  <input required style={modalInputStyle} value={form.kodebooking} onChange={(e) => setForm((p) => ({ ...p, kodebooking: e.target.value }))} placeholder="Isi manual, unik per antrean" />
                </Field>
                <Field label="Jenis Pasien">
                  <select style={modalInputStyle} value={form.jenispasien} onChange={(e) => setForm((p) => ({ ...p, jenispasien: e.target.value as 'JKN' | 'NON JKN' }))}>
                    <option value="JKN">JKN</option>
                    <option value="NON JKN">NON JKN</option>
                  </select>
                </Field>
                {form.jenispasien === 'JKN' && (
                  <Field label="No. Kartu BPJS">
                    <input style={modalInputStyle} value={form.nomorkartu} onChange={(e) => setForm((p) => ({ ...p, nomorkartu: e.target.value }))} />
                  </Field>
                )}
                <Field label="NIK">
                  <input style={modalInputStyle} value={form.nik} onChange={(e) => setForm((p) => ({ ...p, nik: e.target.value }))} />
                </Field>
                <Field label="No. HP">
                  <input style={modalInputStyle} value={form.nohp} onChange={(e) => setForm((p) => ({ ...p, nohp: e.target.value }))} />
                </Field>
                <Field label="No. RM *">
                  <input required style={modalInputStyle} value={form.norm} onChange={(e) => setForm((p) => ({ ...p, norm: e.target.value }))} />
                </Field>
                <Field label="Kode Poli *">
                  <input required style={modalInputStyle} value={form.kodepoli} onChange={(e) => setForm((p) => ({ ...p, kodepoli: e.target.value.toUpperCase() }))} placeholder="ANA" />
                </Field>
                <Field label="Nama Poli">
                  <input style={modalInputStyle} value={form.namapoli} onChange={(e) => setForm((p) => ({ ...p, namapoli: e.target.value }))} placeholder="auto-terisi dari data lokal" />
                </Field>
                <Field label="Tanggal Periksa *">
                  <input required type="date" style={modalInputStyle} value={form.tanggalperiksa} onChange={(e) => setForm((p) => ({ ...p, tanggalperiksa: e.target.value }))} />
                </Field>
                <Field label="Pasien Baru">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, height: 36 }}>
                    <input type="checkbox" checked={form.pasienbaru} onChange={(e) => setForm((p) => ({ ...p, pasienbaru: e.target.checked }))} />
                    Ya, pasien baru
                  </label>
                </Field>
                <Field label="Kode Dokter *">
                  <input required style={modalInputStyle} value={form.kodedokter} onChange={(e) => setForm((p) => ({ ...p, kodedokter: e.target.value }))} placeholder="12345" />
                </Field>
                <Field label="Nama Dokter">
                  <input style={modalInputStyle} value={form.namadokter} onChange={(e) => setForm((p) => ({ ...p, namadokter: e.target.value }))} placeholder="auto-terisi dari data lokal" />
                </Field>
                <Field label="Jam Praktek">
                  <input style={modalInputStyle} value={form.jampraktek} onChange={(e) => setForm((p) => ({ ...p, jampraktek: e.target.value }))} placeholder="08:00-16:00" />
                </Field>
                <Field label="Jenis Kunjungan">
                  <select style={modalInputStyle} value={form.jeniskunjungan} onChange={(e) => setForm((p) => ({ ...p, jeniskunjungan: Number(e.target.value) }))}>
                    {Object.entries(jenisKunjunganLabel).map(([v, label]) => (
                      <option key={v} value={v}>{v} - {label}</option>
                    ))}
                  </select>
                </Field>
                {form.jenispasien === 'JKN' && (
                  <Field label="No. Rujukan/Kontrol">
                    <input style={modalInputStyle} value={form.nomorreferensi} onChange={(e) => setForm((p) => ({ ...p, nomorreferensi: e.target.value }))} />
                  </Field>
                )}
                <Field label="No. Antrean">
                  <input style={modalInputStyle} value={form.nomorantrean} onChange={(e) => setForm((p) => ({ ...p, nomorantrean: e.target.value }))} placeholder="A-12" />
                </Field>
                <Field label="Angka Antrean">
                  <input type="number" style={modalInputStyle} value={form.angkaantrean} onChange={(e) => setForm((p) => ({ ...p, angkaantrean: e.target.value }))} />
                </Field>
                <Field label="Estimasi Dilayani">
                  <input type="datetime-local" style={modalInputStyle} value={form.estimasidilayani} onChange={(e) => setForm((p) => ({ ...p, estimasidilayani: e.target.value }))} />
                </Field>
                <Field label="Sisa Kuota JKN">
                  <input type="number" style={modalInputStyle} value={form.sisakuotajkn} onChange={(e) => setForm((p) => ({ ...p, sisakuotajkn: e.target.value }))} />
                </Field>
                <Field label="Kuota JKN">
                  <input type="number" style={modalInputStyle} value={form.kuotajkn} onChange={(e) => setForm((p) => ({ ...p, kuotajkn: e.target.value }))} />
                </Field>
                <Field label="Sisa Kuota Non JKN">
                  <input type="number" style={modalInputStyle} value={form.sisakuotanonjkn} onChange={(e) => setForm((p) => ({ ...p, sisakuotanonjkn: e.target.value }))} />
                </Field>
                <Field label="Kuota Non JKN">
                  <input type="number" style={modalInputStyle} value={form.kuotanonjkn} onChange={(e) => setForm((p) => ({ ...p, kuotanonjkn: e.target.value }))} />
                </Field>
              </div>
              <Field label="Keterangan">
                <textarea style={{ ...modalInputStyle, minHeight: 60, resize: 'vertical' }} value={form.keterangan} onChange={(e) => setForm((p) => ({ ...p, keterangan: e.target.value }))} placeholder="Informasi untuk pasien" />
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
    </div>
  );
};

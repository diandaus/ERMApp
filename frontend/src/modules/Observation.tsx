import React from 'react';
import Swal from 'sweetalert2';

const inputSm: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const labelSm: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 };

// ── Observation TTV (tanda-tanda vital) — padanan SatuSehatKirimObservationTTV.java:
// 10 jenis TTV (Suhu, Respirasi, Nadi, SpO2, GCS, Kesadaran, Tensi, TB, BB,
// LP), sumber pemeriksaan_ralan/pemeriksaan_ranap, wajib Encounter registrasi
// itu SUDAH terkirim dulu (sama pola dependency spt Condition). Checkbox "P"
// bisa dicentang di semua baris, dua tombol "Kirim Terpilih"/"Update
// Terpilih" masing-masing menyaring baris sesuai status ID Observation-nya
// — persis pola Condition. Baris diidentifikasi 4 kolom (no_rawat+
// tgl_perawatan+jam_rawat+status_lanjut) krn satu no_rawat bisa punya banyak
// kali pengukuran.
type ObservationTTVRow = {
  tgl_registrasi: string; no_rawat: string; no_rm: string; nama_pasien: string; no_ktp_pasien: string;
  stts_rawat: string; stts_lanjut: string; tanggal_pulang: string; id_encounter: string;
  nilai: string; petugas: string; no_ktp_praktisi: string; tgl_perawatan: string; jam_rawat: string; id_observation: string;
};

const TTV_TABS: { jenis: string; label: string; kolomNilai: string }[] = [
  { jenis: 'suhu', label: 'Suhu', kolomNilai: 'Suhu (°C)' },
  { jenis: 'respirasi', label: 'Respirasi', kolomNilai: 'Resp(/menit)' },
  { jenis: 'nadi', label: 'Nadi', kolomNilai: 'Nadi(/menit)' },
  { jenis: 'spo2', label: 'SpO2', kolomNilai: 'SpO2(%)' },
  { jenis: 'gcs', label: 'GCS', kolomNilai: 'GCS' },
  { jenis: 'kesadaran', label: 'Kesadaran', kolomNilai: 'Kesadaran' },
  { jenis: 'tensi', label: 'Tensi', kolomNilai: 'Tensi(mmHg)' },
  { jenis: 'tb', label: 'TB', kolomNilai: 'TB(Cm)' },
  { jenis: 'bb', label: 'BB', kolomNilai: 'BB(Kg)' },
  { jenis: 'lp', label: 'LP', kolomNilai: 'LP(Cm)' },
];

const todayISO = (): string => new Date().toISOString().slice(0, 10);
const rowKey = (row: ObservationTTVRow): string => `${row.no_rawat}::${row.tgl_perawatan}::${row.jam_rawat}::${row.stts_lanjut}`;

const ObservationTTVTable: React.FC<{ jenis: string; kolomNilai: string }> = ({ jenis, kolomNilai }) => {
  const [tglDari, setTglDari] = React.useState(todayISO());
  const [tglSampai, setTglSampai] = React.useState(todayISO());
  const [search, setSearch] = React.useState('');
  const [list, setList] = React.useState<ObservationTTVRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const fetchList = React.useCallback(async (dari: string, sampai: string, q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/satu-sehat/observation-ttv/${jenis}?tgl_dari=${dari}&tgl_sampai=${sampai}&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat daftar Observation');
      setList(Array.isArray(data.list) ? data.list : []);
      setSelected(new Set());
    } catch (err) {
      setList([]);
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setLoading(false);
    }
  }, [jenis]);

  React.useEffect(() => {
    const t = setTimeout(() => fetchList(tglDari, tglSampai, search), 300);
    return () => clearTimeout(t);
  }, [tglDari, tglSampai, search, fetchList]);

  const allSelected = list.length > 0 && list.every((r) => selected.has(rowKey(r)));

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(list.map(rowKey)));
  };
  const toggleSelectRow = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectedForKirim = list.filter((r) => selected.has(rowKey(r)) && !r.id_observation);
  const selectedForUpdate = list.filter((r) => selected.has(rowKey(r)) && !!r.id_observation);

  const runBulk = async (rows: ObservationTTVRow[], endpoint: 'send' | 'update', label: string) => {
    setProcessing(true);
    let ok = 0;
    const failed: string[] = [];
    for (const row of rows) {
      try {
        const res = await fetch(`/api/satu-sehat/observation-ttv/${jenis}/${endpoint}/${row.no_rawat}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tgl_perawatan: row.tgl_perawatan, jam_rawat: row.jam_rawat, status_lanjut: row.stts_lanjut }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal');
        ok++;
      } catch (err) {
        failed.push(`${row.no_rawat} (${row.tgl_perawatan} ${row.jam_rawat}): ${err instanceof Error ? err.message : 'Terjadi kesalahan'}`);
      }
    }
    setProcessing(false);

    if (failed.length === 0) {
      Swal.fire({ icon: 'success', title: 'Selesai', text: `${ok} Observation berhasil di-${label}` });
    } else {
      Swal.fire({ icon: ok > 0 ? 'warning' : 'error', title: 'Selesai dengan catatan', html: `${ok} berhasil, ${failed.length} gagal:<br/><small>${failed.join('<br/>')}</small>` });
    }
    fetchList(tglDari, tglSampai, search);
  };

  const handleKirimTerpilih = async () => {
    if (selectedForKirim.length === 0) return;
    const confirm = await Swal.fire({
      title: `Kirim ${selectedForKirim.length} Observation ke Satu Sehat?`,
      text: 'Setiap data terpilih (yang belum punya ID Observation) akan dikirim sebagai resource Observation baru.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Kirim', cancelButtonText: 'Batal', confirmButtonColor: '#059669',
    });
    if (!confirm.isConfirmed) return;
    runBulk(selectedForKirim, 'send', 'kirim');
  };

  const handleUpdateTerpilih = async () => {
    if (selectedForUpdate.length === 0) return;
    const confirm = await Swal.fire({
      title: `Perbarui ${selectedForUpdate.length} Observation di Satu Sehat?`,
      text: 'Setiap data terpilih (yang sudah punya ID Observation) akan di-PUT ulang dengan data lokal terbaru.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Perbarui', cancelButtonText: 'Batal', confirmButtonColor: '#2563eb',
    });
    if (!confirm.isConfirmed) return;
    runBulk(selectedForUpdate, 'update', 'perbarui');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={labelSm}>Tanggal Dari</label>
          <input type="date" value={tglDari} onChange={(e) => setTglDari(e.target.value)} style={inputSm} />
        </div>
        <div>
          <label style={labelSm}>Tanggal Sampai</label>
          <input type="date" value={tglSampai} onChange={(e) => setTglSampai(e.target.value)} style={inputSm} />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={labelSm}>Cari</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="No.Rawat, No.RM, nama pasien, petugas, status..."
            style={inputSm}
          />
        </div>
        <button
          type="button"
          onClick={handleKirimTerpilih}
          disabled={selectedForKirim.length === 0 || processing}
          style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: selectedForKirim.length === 0 || processing ? '#9ca3af' : '#059669', color: '#fff', cursor: selectedForKirim.length === 0 || processing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}
        >
          {processing ? 'Memproses...' : `Kirim Terpilih (${selectedForKirim.length})`}
        </button>
        <button
          type="button"
          onClick={handleUpdateTerpilih}
          disabled={selectedForUpdate.length === 0 || processing}
          style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #2563eb', background: '#ffffff', color: selectedForUpdate.length === 0 || processing ? '#9ca3af' : '#2563eb', cursor: selectedForUpdate.length === 0 || processing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}
        >
          {processing ? 'Memproses...' : `Update Terpilih (${selectedForUpdate.length})`}
        </button>
      </div>

      <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
              <th style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', width: 60 }}>
                {list.length > 0 && (
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                )}
              </th>
              {['Tanggal Registrasi', 'No.Rawat', 'No.RM', 'Nama Pasien', 'No.KTP Pasien', 'Stts Rawat', 'Stts Lanjut', 'Tanggal Pulang', 'ID Encounter', kolomNilai, 'Petugas/Dokter/Praktisi', 'No.KTP Praktisi', 'Tanggal', 'Jam', 'ID Observation'].map((h) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={16} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={16} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Tidak ada data pada rentang tanggal ini (pastikan Encounter registrasi sudah dikirim)</td></tr>
            ) : (
              list.map((row) => {
                const key = rowKey(row);
                return (
                  <tr key={key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                      <input type="checkbox" checked={selected.has(key)} onChange={() => toggleSelectRow(key)} />
                    </td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.tgl_registrasi}</td>
                    <td style={{ padding: '6px 10px', color: '#111827', whiteSpace: 'nowrap' }}>{row.no_rawat}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.no_rm}</td>
                    <td style={{ padding: '6px 10px', color: '#111827' }}>{row.nama_pasien}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.no_ktp_pasien}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.stts_rawat}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.stts_lanjut}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.tanggal_pulang}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.id_encounter}</td>
                    <td style={{ padding: '6px 10px', color: '#111827', whiteSpace: 'nowrap' }}>{row.nilai}</td>
                    <td style={{ padding: '6px 10px', color: '#374151' }}>{row.petugas}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.no_ktp_praktisi}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.tgl_perawatan}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.jam_rawat}</td>
                    <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                      {row.id_observation ? (
                        <span style={{ padding: '3px 8px', borderRadius: 999, background: '#ecfdf5', color: '#065f46', fontSize: 11, fontWeight: 600 }}>{row.id_observation}</span>
                      ) : (
                        <span style={{ padding: '3px 8px', borderRadius: 999, background: '#fef2f2', color: '#991b1b', fontSize: 11, fontWeight: 600 }}>Belum Terkirim</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Observation Radiologi/Lab — hasil temuan pemeriksaan (beda dari TTV di
// atas). Padanan SatuSehatKirimObservationRadiologi.java, ...LabPK.java,
// ...LabMB.java. Prasyarat: Specimen utk pemeriksaan itu SUDAH terkirim, dan
// hasil bacaan (periksa_radiologi/hasil_radiologi utk Radiologi;
// periksa_lab/detail_periksa_lab utk Lab) sudah diinput petugas. Dikirim sbg
// valueString (teks bebas), bukan valueQuantity — persis Java.
type ObservationRadiologiRow = {
  no_rawat: string; no_rm: string; nama_pasien: string; no_ktp_pasien: string;
  noorder: string; tgl_hasil: string; nm_perawatan: string; hasil: string;
  kd_jenis_prw: string; id_specimen: string; nama_petugas: string; id_encounter: string; id_observation: string;
};

const ObservationRadiologiTable: React.FC = () => {
  const [tglDari, setTglDari] = React.useState(todayISO());
  const [tglSampai, setTglSampai] = React.useState(todayISO());
  const [search, setSearch] = React.useState('');
  const [list, setList] = React.useState<ObservationRadiologiRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const rowKeyR = (row: ObservationRadiologiRow): string => `${row.noorder}::${row.kd_jenis_prw}`;

  const fetchList = React.useCallback(async (dari: string, sampai: string, q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/satu-sehat/observation-radiologi?tgl_dari=${dari}&tgl_sampai=${sampai}&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat daftar Observation Radiologi');
      setList(Array.isArray(data.list) ? data.list : []);
      setSelected(new Set());
    } catch (err) {
      setList([]);
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => fetchList(tglDari, tglSampai, search), 300);
    return () => clearTimeout(t);
  }, [tglDari, tglSampai, search, fetchList]);

  const allSelected = list.length > 0 && list.every((r) => selected.has(rowKeyR(r)));
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(list.map(rowKeyR)));
  const toggleSelectRow = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectedForKirim = list.filter((r) => selected.has(rowKeyR(r)) && !r.id_observation);
  const selectedForUpdate = list.filter((r) => selected.has(rowKeyR(r)) && !!r.id_observation);

  const runBulk = async (rows: ObservationRadiologiRow[], endpoint: 'send' | 'update', label: string) => {
    setProcessing(true);
    let ok = 0;
    const failed: string[] = [];
    for (const row of rows) {
      try {
        const res = await fetch(`/api/satu-sehat/observation-radiologi/${endpoint}/${row.noorder}?kd_jenis_prw=${encodeURIComponent(row.kd_jenis_prw)}`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal');
        ok++;
      } catch (err) {
        failed.push(`${row.noorder} - ${row.nm_perawatan} (${row.nama_pasien}): ${err instanceof Error ? err.message : 'Terjadi kesalahan'}`);
      }
    }
    setProcessing(false);
    if (failed.length === 0) {
      Swal.fire({ icon: 'success', title: 'Selesai', text: `${ok} Observation berhasil di-${label}` });
    } else {
      Swal.fire({ icon: ok > 0 ? 'warning' : 'error', title: 'Selesai dengan catatan', html: `${ok} berhasil, ${failed.length} gagal:<br/><small>${failed.join('<br/>')}</small>` });
    }
    fetchList(tglDari, tglSampai, search);
  };

  const handleKirimTerpilih = async () => {
    if (selectedForKirim.length === 0) return;
    const confirm = await Swal.fire({
      title: `Kirim ${selectedForKirim.length} Observation ke Satu Sehat?`,
      text: 'Setiap baris terpilih (yang belum punya ID Observation) akan dikirim sebagai resource baru.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Kirim', cancelButtonText: 'Batal', confirmButtonColor: '#059669',
    });
    if (!confirm.isConfirmed) return;
    runBulk(selectedForKirim, 'send', 'kirim');
  };
  const handleUpdateTerpilih = async () => {
    if (selectedForUpdate.length === 0) return;
    const confirm = await Swal.fire({
      title: `Perbarui ${selectedForUpdate.length} Observation di Satu Sehat?`,
      text: 'Setiap baris terpilih (yang sudah punya ID Observation) akan di-PUT ulang dengan data lokal terbaru.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Perbarui', cancelButtonText: 'Batal', confirmButtonColor: '#2563eb',
    });
    if (!confirm.isConfirmed) return;
    runBulk(selectedForUpdate, 'update', 'perbarui');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={labelSm}>Tanggal Dari</label>
          <input type="date" value={tglDari} onChange={(e) => setTglDari(e.target.value)} style={inputSm} />
        </div>
        <div>
          <label style={labelSm}>Tanggal Sampai</label>
          <input type="date" value={tglSampai} onChange={(e) => setTglSampai(e.target.value)} style={inputSm} />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={labelSm}>Cari</label>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="No.Rawat, No.RM, nama pasien, pemeriksaan..." style={inputSm} />
        </div>
        <button type="button" onClick={handleKirimTerpilih} disabled={selectedForKirim.length === 0 || processing}
          style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: selectedForKirim.length === 0 || processing ? '#9ca3af' : '#059669', color: '#fff', cursor: selectedForKirim.length === 0 || processing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
          {processing ? 'Memproses...' : `Kirim Terpilih (${selectedForKirim.length})`}
        </button>
        <button type="button" onClick={handleUpdateTerpilih} disabled={selectedForUpdate.length === 0 || processing}
          style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #2563eb', background: '#ffffff', color: selectedForUpdate.length === 0 || processing ? '#9ca3af' : '#2563eb', cursor: selectedForUpdate.length === 0 || processing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
          {processing ? 'Memproses...' : `Update Terpilih (${selectedForUpdate.length})`}
        </button>
      </div>

      <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
              <th style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', width: 60 }}>
                {list.length > 0 && <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />}
              </th>
              {['No.Order', 'Tgl/Jam Hasil', 'No.Rawat', 'No.RM', 'Nama Pasien', 'Pemeriksaan', 'Hasil', 'Petugas', 'ID Observation'].map((h) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Tidak ada hasil pemeriksaan pada rentang tanggal ini (pastikan Specimen sudah dikirim dan hasil sudah diinput)</td></tr>
            ) : (
              list.map((row) => {
                const key = rowKeyR(row);
                return (
                  <tr key={key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                      <input type="checkbox" checked={selected.has(key)} onChange={() => toggleSelectRow(key)} />
                    </td>
                    <td style={{ padding: '6px 10px', color: '#111827', whiteSpace: 'nowrap' }}>{row.noorder}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.tgl_hasil}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.no_rawat}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.no_rm}</td>
                    <td style={{ padding: '6px 10px', color: '#111827' }}>{row.nama_pasien}</td>
                    <td style={{ padding: '6px 10px', color: '#374151' }}>{row.nm_perawatan}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', maxWidth: 260 }}>{row.hasil}</td>
                    <td style={{ padding: '6px 10px', color: '#374151' }}>{row.nama_petugas}</td>
                    <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                      {row.id_observation ? (
                        <span style={{ padding: '3px 8px', borderRadius: 999, background: '#ecfdf5', color: '#065f46', fontSize: 11, fontWeight: 600 }}>{row.id_observation}</span>
                      ) : (
                        <span style={{ padding: '3px 8px', borderRadius: 999, background: '#fef2f2', color: '#991b1b', fontSize: 11, fontWeight: 600 }}>Belum Terkirim</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

type ObservationLabRow = {
  no_rawat: string; no_rm: string; nama_pasien: string; no_ktp_pasien: string;
  noorder: string; tgl_hasil: string; nm_perawatan: string; hasil: string;
  id_template: number; kd_jenis_prw: string; id_specimen: string; nama_petugas: string; id_encounter: string; id_observation: string;
};

const ObservationLabTable: React.FC<{ jenis: 'pk' | 'mb' }> = ({ jenis }) => {
  const [tglDari, setTglDari] = React.useState(todayISO());
  const [tglSampai, setTglSampai] = React.useState(todayISO());
  const [search, setSearch] = React.useState('');
  const [list, setList] = React.useState<ObservationLabRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const rowKeyL = (row: ObservationLabRow): string => `${row.noorder}::${row.id_template}::${row.kd_jenis_prw}`;

  const fetchList = React.useCallback(async (dari: string, sampai: string, q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/satu-sehat/observation-lab/${jenis}?tgl_dari=${dari}&tgl_sampai=${sampai}&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat daftar Observation Lab');
      setList(Array.isArray(data.list) ? data.list : []);
      setSelected(new Set());
    } catch (err) {
      setList([]);
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setLoading(false);
    }
  }, [jenis]);

  React.useEffect(() => {
    const t = setTimeout(() => fetchList(tglDari, tglSampai, search), 300);
    return () => clearTimeout(t);
  }, [tglDari, tglSampai, search, fetchList]);

  const allSelected = list.length > 0 && list.every((r) => selected.has(rowKeyL(r)));
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(list.map(rowKeyL)));
  const toggleSelectRow = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectedForKirim = list.filter((r) => selected.has(rowKeyL(r)) && !r.id_observation);
  const selectedForUpdate = list.filter((r) => selected.has(rowKeyL(r)) && !!r.id_observation);

  const runBulk = async (rows: ObservationLabRow[], endpoint: 'send' | 'update', label: string) => {
    setProcessing(true);
    let ok = 0;
    const failed: string[] = [];
    for (const row of rows) {
      try {
        const res = await fetch(`/api/satu-sehat/observation-lab/${jenis}/${endpoint}/${row.noorder}?id_template=${row.id_template}&kd_jenis_prw=${encodeURIComponent(row.kd_jenis_prw)}`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal');
        ok++;
      } catch (err) {
        failed.push(`${row.noorder} - ${row.nm_perawatan} (${row.nama_pasien}): ${err instanceof Error ? err.message : 'Terjadi kesalahan'}`);
      }
    }
    setProcessing(false);
    if (failed.length === 0) {
      Swal.fire({ icon: 'success', title: 'Selesai', text: `${ok} Observation berhasil di-${label}` });
    } else {
      Swal.fire({ icon: ok > 0 ? 'warning' : 'error', title: 'Selesai dengan catatan', html: `${ok} berhasil, ${failed.length} gagal:<br/><small>${failed.join('<br/>')}</small>` });
    }
    fetchList(tglDari, tglSampai, search);
  };

  const handleKirimTerpilih = async () => {
    if (selectedForKirim.length === 0) return;
    const confirm = await Swal.fire({
      title: `Kirim ${selectedForKirim.length} Observation ke Satu Sehat?`,
      text: 'Setiap baris terpilih (yang belum punya ID Observation) akan dikirim sebagai resource baru.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Kirim', cancelButtonText: 'Batal', confirmButtonColor: '#059669',
    });
    if (!confirm.isConfirmed) return;
    runBulk(selectedForKirim, 'send', 'kirim');
  };
  const handleUpdateTerpilih = async () => {
    if (selectedForUpdate.length === 0) return;
    const confirm = await Swal.fire({
      title: `Perbarui ${selectedForUpdate.length} Observation di Satu Sehat?`,
      text: 'Setiap baris terpilih (yang sudah punya ID Observation) akan di-PUT ulang dengan data lokal terbaru.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Perbarui', cancelButtonText: 'Batal', confirmButtonColor: '#2563eb',
    });
    if (!confirm.isConfirmed) return;
    runBulk(selectedForUpdate, 'update', 'perbarui');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={labelSm}>Tanggal Dari</label>
          <input type="date" value={tglDari} onChange={(e) => setTglDari(e.target.value)} style={inputSm} />
        </div>
        <div>
          <label style={labelSm}>Tanggal Sampai</label>
          <input type="date" value={tglSampai} onChange={(e) => setTglSampai(e.target.value)} style={inputSm} />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={labelSm}>Cari</label>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="No.Rawat, No.RM, nama pasien, pemeriksaan..." style={inputSm} />
        </div>
        <button type="button" onClick={handleKirimTerpilih} disabled={selectedForKirim.length === 0 || processing}
          style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: selectedForKirim.length === 0 || processing ? '#9ca3af' : '#059669', color: '#fff', cursor: selectedForKirim.length === 0 || processing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
          {processing ? 'Memproses...' : `Kirim Terpilih (${selectedForKirim.length})`}
        </button>
        <button type="button" onClick={handleUpdateTerpilih} disabled={selectedForUpdate.length === 0 || processing}
          style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #2563eb', background: '#ffffff', color: selectedForUpdate.length === 0 || processing ? '#9ca3af' : '#2563eb', cursor: selectedForUpdate.length === 0 || processing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
          {processing ? 'Memproses...' : `Update Terpilih (${selectedForUpdate.length})`}
        </button>
      </div>

      <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
              <th style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', width: 60 }}>
                {list.length > 0 && <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />}
              </th>
              {['No.Order', 'Tgl/Jam Hasil', 'No.Rawat', 'No.RM', 'Nama Pasien', 'Pemeriksaan', 'Hasil', 'Petugas', 'ID Observation'].map((h) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Tidak ada hasil pemeriksaan pada rentang tanggal ini (pastikan Specimen sudah dikirim dan hasil sudah diinput)</td></tr>
            ) : (
              list.map((row) => {
                const key = rowKeyL(row);
                return (
                  <tr key={key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                      <input type="checkbox" checked={selected.has(key)} onChange={() => toggleSelectRow(key)} />
                    </td>
                    <td style={{ padding: '6px 10px', color: '#111827', whiteSpace: 'nowrap' }}>{row.noorder}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.tgl_hasil}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.no_rawat}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.no_rm}</td>
                    <td style={{ padding: '6px 10px', color: '#111827' }}>{row.nama_pasien}</td>
                    <td style={{ padding: '6px 10px', color: '#374151' }}>{row.nm_perawatan}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', maxWidth: 260 }}>{row.hasil}</td>
                    <td style={{ padding: '6px 10px', color: '#374151' }}>{row.nama_petugas}</td>
                    <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                      {row.id_observation ? (
                        <span style={{ padding: '3px 8px', borderRadius: 999, background: '#ecfdf5', color: '#065f46', fontSize: 11, fontWeight: 600 }}>{row.id_observation}</span>
                      ) : (
                        <span style={{ padding: '3px 8px', borderRadius: 999, background: '#fef2f2', color: '#991b1b', fontSize: 11, fontWeight: 600 }}>Belum Terkirim</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

type ObservationTabEntry = { key: string; label: string; kind: 'ttv' | 'radiologi' | 'lab'; kolomNilai?: string; labJenis?: 'pk' | 'mb' };

const RESULT_TABS: ObservationTabEntry[] = [
  { key: 'hasil-radiologi', label: 'Radiologi', kind: 'radiologi' },
  { key: 'hasil-lab-pk', label: 'Lab PK', kind: 'lab', labJenis: 'pk' },
  { key: 'hasil-lab-mb', label: 'Lab MB', kind: 'lab', labJenis: 'mb' },
];

const ALL_OBSERVATION_TABS: ObservationTabEntry[] = [
  ...TTV_TABS.map((t) => ({ key: t.jenis, label: t.label, kind: 'ttv' as const, kolomNilai: t.kolomNilai })),
  ...RESULT_TABS,
];

export const ObservationSection: React.FC = () => {
  const [tab, setTab] = React.useState(ALL_OBSERVATION_TABS[0].key);
  const active = ALL_OBSERVATION_TABS.find((t) => t.key === tab) || ALL_OBSERVATION_TABS[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
        {TTV_TABS.map((t) => {
          const isActive = tab === t.jenis;
          return (
            <button
              key={t.jenis}
              type="button"
              onClick={() => setTab(t.jenis)}
              style={{
                padding: '8px 16px', border: 'none',
                borderBottom: isActive ? '2px solid #059669' : '2px solid transparent',
                background: 'transparent', color: isActive ? '#059669' : '#6b7280',
                fontWeight: isActive ? 600 : 400, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          );
        })}
        <div style={{ width: 1, alignSelf: 'stretch', background: '#e5e7eb', margin: '0 4px' }} />
        {RESULT_TABS.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                padding: '8px 16px', border: 'none',
                borderBottom: isActive ? '2px solid #059669' : '2px solid transparent',
                background: 'transparent', color: isActive ? '#059669' : '#6b7280',
                fontWeight: isActive ? 600 : 400, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {active.kind === 'ttv' && <ObservationTTVTable key={active.key} jenis={active.key} kolomNilai={active.kolomNilai || ''} />}
        {active.kind === 'radiologi' && <ObservationRadiologiTable key={active.key} />}
        {active.kind === 'lab' && <ObservationLabTable key={active.key} jenis={active.labJenis || 'pk'} />}
      </div>
    </div>
  );
};

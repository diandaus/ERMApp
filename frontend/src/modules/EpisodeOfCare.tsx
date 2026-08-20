import React from 'react';
import Swal from 'sweetalert2';

const inputSm: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const labelSm: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 };

// ── EpisodeOfCare — TIDAK ADA padanan Java Khanza (belum pernah dibangun
// Khanza). Dibangun dari draft yang diberikan user + payload disusun sendiri
// dari contoh resmi Kemenkes. Sumber: diagnosa_pasien difilter kd_penyakit
// LIKE '%O%' (bab ICD-10 "O" = Pregnancy, childbirth and the puerperium) —
// jadi fitur ini scope-nya EPISODE KEHAMILAN/PERSALINAN, bukan EpisodeOfCare
// generik (Khanza tidak punya modul "program" lain yang terstruktur).
// Wajib Condition (diagnosa) untuk diagnosa itu sudah terkirim dulu.
//
// 2 hal yang saya putuskan sendiri (tidak ada referensi resmi untuk kasus
// spesifik ini): field "type" (kode program spt "TB-SO" di contoh resmi)
// dilewati krn tidak ada kode resmi utk "program kehamilan"; "statusHistory"
// dilewati dan status selalu "finished" krn data yang dikirim retrospektif
// dari kunjungan yang sudah terjadi.
type EpisodeOfCareRow = {
  tgl_registrasi: string; no_rawat: string; no_rm: string; nama_pasien: string; no_ktp_pasien: string;
  stts_rawat: string; stts_lanjut: string; tanggal_pulang: string; id_encounter: string;
  kd_penyakit: string; nama_penyakit: string; id_episodeofcare: string; status: string;
};

const todayISO = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const rowKey = (row: EpisodeOfCareRow): string => `${row.no_rawat}::${row.kd_penyakit}::${row.status}`;

// tanggal_pulang dari backend sengaja format ISO8601 penuh
// ("2026-08-20T09:15:00+07:00") krn dipakai apa adanya sbg period.start FHIR
// saat dikirim ke Satu Sehat — di sini cuma dirapikan utk TAMPILAN tabel,
// tidak mengubah data yang dikirim.
const formatTanggalPulang = (iso: string): string => {
  if (!iso) return iso;
  const [datePart, rest] = iso.split('T');
  if (!rest) return iso;
  const timePart = rest.replace(/[+-]\d{2}:\d{2}$/, '').replace('Z', '');
  return `${datePart} ${timePart}`;
};

export const EpisodeOfCareSection: React.FC = () => {
  const [tglDari, setTglDari] = React.useState(todayISO());
  const [tglSampai, setTglSampai] = React.useState(todayISO());
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [list, setList] = React.useState<EpisodeOfCareRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const fetchList = React.useCallback(async (dari: string, sampai: string, q: string, status: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/satu-sehat/episode-of-care?tgl_dari=${dari}&tgl_sampai=${sampai}&q=${encodeURIComponent(q)}${status ? `&status=${status}` : ''}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat daftar EpisodeOfCare');
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
    const t = setTimeout(() => fetchList(tglDari, tglSampai, search, statusFilter), 300);
    return () => clearTimeout(t);
  }, [tglDari, tglSampai, search, statusFilter, fetchList]);

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

  const selectedForKirim = list.filter((r) => selected.has(rowKey(r)) && !r.id_episodeofcare);
  const selectedForUpdate = list.filter((r) => selected.has(rowKey(r)) && !!r.id_episodeofcare);

  const runBulk = async (rows: EpisodeOfCareRow[], endpoint: 'send' | 'update', label: string) => {
    setProcessing(true);
    let ok = 0;
    const failed: string[] = [];
    for (const row of rows) {
      try {
        const res = await fetch(`/api/satu-sehat/episode-of-care/${endpoint}/${row.no_rawat}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kd_penyakit: row.kd_penyakit, status: row.status }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal');
        ok++;
      } catch (err) {
        failed.push(`${row.no_rawat} - ${row.nama_penyakit} (${row.nama_pasien}): ${err instanceof Error ? err.message : 'Terjadi kesalahan'}`);
      }
    }
    setProcessing(false);

    if (failed.length === 0) {
      Swal.fire({ icon: 'success', title: 'Selesai', text: `${ok} EpisodeOfCare berhasil di-${label}` });
    } else {
      Swal.fire({ icon: ok > 0 ? 'warning' : 'error', title: 'Selesai dengan catatan', html: `${ok} berhasil, ${failed.length} gagal:<br/><small>${failed.join('<br/>')}</small>` });
    }
    fetchList(tglDari, tglSampai, search, statusFilter);
  };

  const handleKirimTerpilih = async () => {
    if (selectedForKirim.length === 0) return;
    const confirm = await Swal.fire({
      title: `Kirim ${selectedForKirim.length} EpisodeOfCare ke Satu Sehat?`,
      text: 'Setiap baris terpilih (yang belum punya ID EpisodeOfCare) akan dikirim sebagai resource baru. Diagnosa (Condition) harus sudah terkirim lebih dulu.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Kirim', cancelButtonText: 'Batal', confirmButtonColor: '#059669',
    });
    if (!confirm.isConfirmed) return;
    runBulk(selectedForKirim, 'send', 'kirim');
  };

  const handleUpdateTerpilih = async () => {
    if (selectedForUpdate.length === 0) return;
    const confirm = await Swal.fire({
      title: `Perbarui ${selectedForUpdate.length} EpisodeOfCare di Satu Sehat?`,
      text: 'Setiap baris terpilih (yang sudah punya ID EpisodeOfCare) akan di-PUT ulang dengan data lokal terbaru.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Perbarui', cancelButtonText: 'Batal', confirmButtonColor: '#2563eb',
    });
    if (!confirm.isConfirmed) return;
    runBulk(selectedForUpdate, 'update', 'perbarui');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={labelSm}>Tanggal Dari</label>
          <input type="date" value={tglDari} onChange={(e) => setTglDari(e.target.value)} style={inputSm} />
        </div>
        <div>
          <label style={labelSm}>Tanggal Sampai</label>
          <input type="date" value={tglSampai} onChange={(e) => setTglSampai(e.target.value)} style={inputSm} />
        </div>
        <div style={{ minWidth: 160 }}>
          <label style={labelSm}>Status Kirim</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputSm}>
            <option value="">Semua</option>
            <option value="terkirim">Sudah Terkirim</option>
            <option value="belum">Belum Terkirim</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={labelSm}>Cari</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="No.Rawat, No.RM, nama pasien, kode/nama penyakit..."
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

      <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', width: 60 }}>
                {list.length > 0 && (
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                )}
              </th>
              {['No.Rawat', 'No.RM', 'Nama Pasien', 'Rawat', 'ID Encounter', 'ICD-10', 'Nama Penyakit', 'Tanggal Pulang', 'ID Episode Of Care'].map((h) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Tidak ada diagnosa bab ICD-10 "O" (kehamilan/persalinan) pada rentang tanggal ini</td></tr>
            ) : (
              list.map((row) => {
                const key = rowKey(row);
                return (
                  <tr key={key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                      <input type="checkbox" checked={selected.has(key)} onChange={() => toggleSelectRow(key)} />
                    </td>
                    <td style={{ padding: '6px 10px', color: '#111827', whiteSpace: 'nowrap' }}>{row.no_rawat}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.no_rm}</td>
                    <td style={{ padding: '6px 10px', color: '#111827' }}>{row.nama_pasien}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.status}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>
                      {row.id_encounter ? row.id_encounter : <span style={{ color: '#991b1b' }}>Belum Ada</span>}
                    </td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.kd_penyakit}</td>
                    <td style={{ padding: '6px 10px', color: '#374151' }}>{row.nama_penyakit}</td>
                    <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{formatTanggalPulang(row.tanggal_pulang)}</td>
                    <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                      {row.id_episodeofcare ? (
                        <span style={{ padding: '3px 8px', borderRadius: 999, background: '#ecfdf5', color: '#065f46', fontSize: 11, fontWeight: 600 }}>{row.id_episodeofcare}</span>
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

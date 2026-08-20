import React from 'react';
import Swal from 'sweetalert2';

const inputSm: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const labelSm: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 };

// ── ImagingStudy — dua jalur kirim, tombol "Kirim via DICOM Router" (utama,
// hijau) meneruskan studi ASLI dari Orthanc ke DICOM Router yang terdaftar di
// Satu Sehat (lihat tab Konfigurasi) — Satu Sehat yang otomatis membentuk
// resource ImagingStudy dari situ; status "terkirim"-nya ditandai
// id_imagingstudy = 'via-dicom-router'. Tombol "Kirim Manual, Tanpa PACS"
// (abu-abu) adalah fallback lama: bikin resource dari data lokal saja, UID
// DICOM dikarang deterministik dari OrgID+noorder (BUKAN UID asli) — dipakai
// kalau fasilitas belum/tidak punya PACS Orthanc yg terhubung.
type ImagingStudyPemeriksaan = {
  kd_jenis_prw: string; nm_perawatan: string; code: string | null; system: string | null;
  display: string | null; modality_code: string | null; modality_display: string | null;
};
type ImagingStudyRow = {
  noorder: string; no_rawat: string; tgl_permintaan: string; jam_permintaan: string;
  nm_pasien: string; no_rkm_medis: string; nm_dokter: string; diagnosis_klinis: string;
  status: string; id_imagingstudy: string | null; id_encounter: string | null;
  pemeriksaan: ImagingStudyPemeriksaan[];
};

const todayISO = (): string => new Date().toISOString().slice(0, 10);

export const ImagingStudySection: React.FC = () => {
  const [tglDari, setTglDari] = React.useState(todayISO());
  const [tglSampai, setTglSampai] = React.useState(todayISO());
  const [statusFilter, setStatusFilter] = React.useState('');
  const [list, setList] = React.useState<ImagingStudyRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const fetchList = React.useCallback(async (dari: string, sampai: string, status: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/satu-sehat/imaging-study?tgl_dari=${dari}&tgl_sampai=${sampai}${status ? `&status=${status}` : ''}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat daftar ImagingStudy');
      setList(Array.isArray(data) ? data : []);
      setSelected(new Set());
    } catch (err) {
      setList([]);
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const t = setTimeout(() => fetchList(tglDari, tglSampai, statusFilter), 300);
    return () => clearTimeout(t);
  }, [tglDari, tglSampai, statusFilter, fetchList]);

  const allSelected = list.length > 0 && list.every((r) => selected.has(r.noorder));

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(list.map((r) => r.noorder)));
  };
  const toggleSelectRow = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectedForKirim = list.filter((r) => selected.has(r.noorder) && !r.id_imagingstudy);
  const selectedForUpdate = list.filter((r) => selected.has(r.noorder) && !!r.id_imagingstudy);

  const runBulk = async (rows: ImagingStudyRow[], endpoint: 'send' | 'update', label: string) => {
    setProcessing(true);
    let ok = 0;
    const failed: string[] = [];
    for (const row of rows) {
      try {
        const res = await fetch(`/api/satu-sehat/imaging-study/${endpoint}/${row.noorder}`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal');
        ok++;
      } catch (err) {
        failed.push(`${row.noorder} (${row.nm_pasien}): ${err instanceof Error ? err.message : 'Terjadi kesalahan'}`);
      }
    }
    setProcessing(false);

    if (failed.length === 0) {
      Swal.fire({ icon: 'success', title: 'Selesai', text: `${ok} ImagingStudy berhasil di-${label}` });
    } else {
      Swal.fire({ icon: ok > 0 ? 'warning' : 'error', title: 'Selesai dengan catatan', html: `${ok} berhasil, ${failed.length} gagal:<br/><small>${failed.join('<br/>')}</small>` });
    }
    fetchList(tglDari, tglSampai, statusFilter);
  };

  const handleKirimTerpilih = async () => {
    if (selectedForKirim.length === 0) return;
    const confirm = await Swal.fire({
      title: `Kirim ${selectedForKirim.length} ImagingStudy ke Satu Sehat?`,
      text: 'Setiap order radiologi terpilih (yang belum punya ID ImagingStudy) akan dikirim sebagai resource baru. Ini jalur manual — series/instance dibuat otomatis per pemeriksaan, bukan diambil dari gambar DICOM asli di PACS.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Kirim', cancelButtonText: 'Batal', confirmButtonColor: '#059669',
    });
    if (!confirm.isConfirmed) return;
    runBulk(selectedForKirim, 'send', 'kirim');
  };

  const handleUpdateTerpilih = async () => {
    if (selectedForUpdate.length === 0) return;
    const confirm = await Swal.fire({
      title: `Perbarui ${selectedForUpdate.length} ImagingStudy di Satu Sehat?`,
      text: 'Setiap order terpilih (yang sudah punya ID ImagingStudy) akan di-PUT ulang dengan data lokal terbaru.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Perbarui', cancelButtonText: 'Batal', confirmButtonColor: '#2563eb',
    });
    if (!confirm.isConfirmed) return;
    runBulk(selectedForUpdate, 'update', 'perbarui');
  };

  const runDicomRouter = async (rows: ImagingStudyRow[]) => {
    setProcessing(true);
    let ok = 0;
    const failed: string[] = [];
    for (const row of rows) {
      try {
        const res = await fetch(`/api/satu-sehat/dicom/send/${row.noorder}`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal');
        ok++;
      } catch (err) {
        failed.push(`${row.noorder} (${row.nm_pasien}): ${err instanceof Error ? err.message : 'Terjadi kesalahan'}`);
      }
    }
    setProcessing(false);

    if (failed.length === 0) {
      Swal.fire({ icon: 'success', title: 'Selesai', text: `${ok} studi berhasil diteruskan ke DICOM Router` });
    } else {
      Swal.fire({ icon: ok > 0 ? 'warning' : 'error', title: 'Selesai dengan catatan', html: `${ok} berhasil, ${failed.length} gagal:<br/><small>${failed.join('<br/>')}</small>` });
    }
    fetchList(tglDari, tglSampai, statusFilter);
  };

  const handleKirimDicom = async () => {
    if (selectedForKirim.length === 0) return;
    const confirm = await Swal.fire({
      title: `Kirim ${selectedForKirim.length} studi via DICOM Router?`,
      text: 'Orthanc akan dicek dulu apakah studi (AccessionNumber = No.Order) sudah ada, lalu diteruskan ke DICOM Router yang terdaftar di Satu Sehat. Satu Sehat akan otomatis membentuk resource ImagingStudy dari studi asli ini.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Kirim', cancelButtonText: 'Batal', confirmButtonColor: '#059669',
    });
    if (!confirm.isConfirmed) return;
    runDicomRouter(selectedForKirim);
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
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={handleKirimDicom}
          disabled={selectedForKirim.length === 0 || processing}
          title="Ambil studi asli dari Orthanc lalu teruskan ke DICOM Router Satu Sehat"
          style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: selectedForKirim.length === 0 || processing ? '#9ca3af' : '#059669', color: '#fff', cursor: selectedForKirim.length === 0 || processing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}
        >
          {processing ? 'Memproses...' : `Kirim via DICOM Router (${selectedForKirim.length})`}
        </button>
        <button
          type="button"
          onClick={handleKirimTerpilih}
          disabled={selectedForKirim.length === 0 || processing}
          title="Fallback tanpa PACS — resource dibuat dari data lokal, UID DICOM dikarang, bukan dari studi asli"
          style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff', color: selectedForKirim.length === 0 || processing ? '#9ca3af' : '#374151', cursor: selectedForKirim.length === 0 || processing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}
        >
          {processing ? 'Memproses...' : `Kirim Manual, Tanpa PACS (${selectedForKirim.length})`}
        </button>
        <button
          type="button"
          onClick={handleUpdateTerpilih}
          disabled={selectedForUpdate.length === 0 || processing}
          title="Update ulang resource yang sebelumnya dikirim jalur manual"
          style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff', color: selectedForUpdate.length === 0 || processing ? '#9ca3af' : '#374151', cursor: selectedForUpdate.length === 0 || processing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}
        >
          {processing ? 'Memproses...' : `Update Manual (${selectedForUpdate.length})`}
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
              {['No.Order', 'Tanggal Permintaan', 'No.Rawat', 'No.RM', 'Nama Pasien', 'Dokter Perujuk', 'Pemeriksaan', 'ID Encounter', 'ID ImagingStudy'].map((h) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Tidak ada order radiologi pada rentang tanggal ini</td></tr>
            ) : (
              list.map((row) => (
                <tr key={row.noorder} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <input type="checkbox" checked={selected.has(row.noorder)} onChange={() => toggleSelectRow(row.noorder)} />
                  </td>
                  <td style={{ padding: '6px 10px', color: '#111827', whiteSpace: 'nowrap' }}>{row.noorder}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.tgl_permintaan} {row.jam_permintaan}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.no_rawat}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.no_rkm_medis}</td>
                  <td style={{ padding: '6px 10px', color: '#111827' }}>{row.nm_pasien}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.nm_dokter}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.pemeriksaan.map((p) => p.nm_perawatan).filter(Boolean).join(', ')}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>
                    {row.id_encounter ? row.id_encounter : <span style={{ color: '#991b1b' }}>Belum Ada</span>}
                  </td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                    {row.id_imagingstudy ? (
                      <span style={{ padding: '3px 8px', borderRadius: 999, background: '#ecfdf5', color: '#065f46', fontSize: 11, fontWeight: 600 }}>
                        {row.id_imagingstudy === 'via-dicom-router' ? 'Via DICOM Router' : row.id_imagingstudy}
                      </span>
                    ) : (
                      <span style={{ padding: '3px 8px', borderRadius: 999, background: '#fef2f2', color: '#991b1b', fontSize: 11, fontWeight: 600 }}>Belum Terkirim</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

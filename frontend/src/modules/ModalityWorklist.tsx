import React from 'react';
import Swal from 'sweetalert2';

const inputSm: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const labelSm: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 };

// ModalityWorklist.tsx — Modality Worklist (MWL): kirim order radiologi ke
// Orthanc sbg file worklist DICOM (bukan panggil REST Orthanc, ini nulis
// file .wl ke folder yg dipantau plugin Worklist Orthanc). AccessionNumber
// SELALU diisi otomatis = No.Order (mwl_handler.go:sendToMWL) — tidak pernah
// diketik manual lagi. Begitu masuk worklist, alat CT/USG/X-Ray query ke
// Orthanc dan otomatis dapat identitas pasien + ACSN yg benar sebelum scan.
// Setelah gambar di-push modality ke Orthanc (ACSN sudah ikut terbawa),
// lanjut ke menu ImagingStudy > "Kirim via DICOM Router".
type MWLRow = {
  noorder: string; no_rawat: string; tgl_permintaan: string; jam_permintaan: string;
  nm_pasien: string; no_rkm_medis: string; nm_dokter: string; diagnosa_klinis: string;
  pemeriksaan: string[]; mwl_status: string; accession_number: string;
};

const todayISO = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const ModalityWorklistSection: React.FC = () => {
  const [tglDari, setTglDari] = React.useState(todayISO());
  const [tglSampai, setTglSampai] = React.useState(todayISO());
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [list, setList] = React.useState<MWLRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const fetchList = React.useCallback(async (dari: string, sampai: string, q: string, status: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/satu-sehat/mwl?tgl_dari=${dari}&tgl_sampai=${sampai}&q=${encodeURIComponent(q)}${status ? `&status=${status}` : ''}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat daftar worklist');
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

  const selectedForKirim = list.filter((r) => selected.has(r.noorder) && r.mwl_status !== 'terkirim');
  const selectedForHapus = list.filter((r) => selected.has(r.noorder) && r.mwl_status === 'terkirim');

  const handleKirimTerpilih = async () => {
    if (selectedForKirim.length === 0) return;
    const confirm = await Swal.fire({
      title: `Kirim ${selectedForKirim.length} order ke Modality Worklist?`,
      text: 'AccessionNumber diisi otomatis = No.Order — tidak perlu diketik manual lagi di modality.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Kirim', cancelButtonText: 'Batal', confirmButtonColor: '#059669',
    });
    if (!confirm.isConfirmed) return;

    setProcessing(true);
    let ok = 0;
    const failed: string[] = [];
    for (const row of selectedForKirim) {
      try {
        const res = await fetch(`/api/satu-sehat/mwl/send/${row.noorder}`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal');
        ok++;
      } catch (err) {
        failed.push(`${row.noorder} (${row.nm_pasien}): ${err instanceof Error ? err.message : 'Terjadi kesalahan'}`);
      }
    }
    setProcessing(false);

    if (failed.length === 0) {
      Swal.fire({ icon: 'success', title: 'Selesai', text: `${ok} order berhasil masuk Modality Worklist` });
    } else {
      Swal.fire({ icon: ok > 0 ? 'warning' : 'error', title: 'Selesai dengan catatan', html: `${ok} berhasil, ${failed.length} gagal:<br/><small>${failed.join('<br/>')}</small>` });
    }
    fetchList(tglDari, tglSampai, search, statusFilter);
  };

  const handleHapusTerpilih = async () => {
    if (selectedForHapus.length === 0) return;
    const confirm = await Swal.fire({
      title: `Batalkan ${selectedForHapus.length} entri worklist?`,
      text: 'Entri akan dihapus dari Modality Worklist Orthanc (dipakai kalau order dibatalkan/salah kirim).',
      icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Batalkan', cancelButtonText: 'Batal', confirmButtonColor: '#991b1b',
    });
    if (!confirm.isConfirmed) return;

    setProcessing(true);
    let ok = 0;
    for (const row of selectedForHapus) {
      try {
        await fetch(`/api/satu-sehat/mwl/${row.noorder}`, { method: 'DELETE' });
        ok++;
      } catch {
        // lanjut ke baris berikutnya
      }
    }
    setProcessing(false);
    Swal.fire({ icon: 'success', title: 'Selesai', text: `${ok} entri worklist dibatalkan`, timer: 1500, showConfirmButton: false });
    fetchList(tglDari, tglSampai, search, statusFilter);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}>
      <div style={{ padding: '10px 14px', borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 12, color: '#1e40af' }}>
        Kirim order radiologi ke sini dulu SEBELUM pasien di-scan, supaya alat CT/USG/X-Ray otomatis dapat identitas pasien + AccessionNumber dari Orthanc tanpa diketik manual. Setelah scan, lanjut ke menu ImagingStudy untuk teruskan hasilnya ke Satu Sehat.
      </div>

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
          <label style={labelSm}>Status Worklist</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputSm}>
            <option value="">Semua</option>
            <option value="terkirim">Sudah di Worklist</option>
            <option value="belum">Belum di Worklist</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={labelSm}>Cari</label>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="No.Order, No.Rawat, nama pasien..." style={inputSm} />
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
          onClick={handleHapusTerpilih}
          disabled={selectedForHapus.length === 0 || processing}
          style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #991b1b', background: '#ffffff', color: selectedForHapus.length === 0 || processing ? '#9ca3af' : '#991b1b', cursor: selectedForHapus.length === 0 || processing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}
        >
          {processing ? 'Memproses...' : `Batalkan Terpilih (${selectedForHapus.length})`}
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
              {['No.Order', 'Tanggal', 'No.Rawat', 'No.RM', 'Nama Pasien', 'Dokter Perujuk', 'Pemeriksaan', 'AccessionNumber', 'Status Worklist'].map((h) => (
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
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.pemeriksaan.filter(Boolean).join(', ')}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>
                    {row.accession_number || <span style={{ color: '#9ca3af' }}>—</span>}
                  </td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                    {row.mwl_status === 'terkirim' ? (
                      <span style={{ padding: '3px 8px', borderRadius: 999, background: '#ecfdf5', color: '#065f46', fontSize: 11, fontWeight: 600 }}>Sudah di Worklist</span>
                    ) : row.mwl_status === 'dibatalkan' ? (
                      <span style={{ padding: '3px 8px', borderRadius: 999, background: '#f3f4f6', color: '#6b7280', fontSize: 11, fontWeight: 600 }}>Dibatalkan</span>
                    ) : (
                      <span style={{ padding: '3px 8px', borderRadius: 999, background: '#fef2f2', color: '#991b1b', fontSize: 11, fontWeight: 600 }}>Belum</span>
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

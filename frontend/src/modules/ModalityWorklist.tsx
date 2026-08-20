import React from 'react';
import Swal from 'sweetalert2';

const inputSm: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const labelSm: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 };

// ModalityWorklist.tsx — dua jalur berbeda utk pastikan AccessionNumber di
// Orthanc = No.Permintaan Radiologi, TANPA diketik manual:
// 1. "Kirim Terpilih" (hijau) — Modality Worklist (MWL) klasik: tulis file
//    .wl ke folder yg dipantau plugin Worklist Orthanc, dipakai modality yg
//    QUERY ke Orthanc SEBELUM scan utk dapat identitas pasien+ACSN otomatis.
// 2. "Kirim ACSN ke PACS Orthanc" (ungu) — dipakai kalau modality SUDAH
//    push gambar ke Orthanc TANPA worklist (mis. langsung dari alat, dicari
//    match-nya lewat No.RM+tanggal), lalu ACSN studinya di-set/diperbaiki
//    langsung lewat REST Orthanc (dicom_handler.go:lazyModifyPACS) — gantiin
//    langkah ketik manual ACSN yg selama ini dilakukan di Khanza Java.
// Setelah salah satu dari dua ini, lanjut ke menu ImagingStudy > "Kirim via
// DICOM Router" utk teruskan studinya ke Satu Sehat.
type MWLRow = {
  noorder: string; no_rawat: string; tgl_permintaan: string; jam_permintaan: string;
  nm_pasien: string; no_rkm_medis: string; nm_dokter: string; diagnosa_klinis: string;
  pemeriksaan: string[]; mwl_status: string; accession_number: string;
};

type DicomInstance = { id: string; series_id: string; modality: string };
type DicomSeries = { series_id: string; modality: string; study_date: string; instance_count: number; webviewer_url: string };
type AccessionCandidate = {
  study_id: string; series_id: string; patient_id: string; modality: string;
  study_date: string; instance_count: number; webviewer_url: string;
};
type AmbiguousItem = { noorder: string; nm_pasien: string; message: string; candidates: AccessionCandidate[] };

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

  const [previewNoOrder, setPreviewNoOrder] = React.useState<string | null>(null);
  const [previewInstances, setPreviewInstances] = React.useState<DicomInstance[]>([]);
  const [previewSeries, setPreviewSeries] = React.useState<DicomSeries[]>([]);
  const [previewSearchMode, setPreviewSearchMode] = React.useState<string>('accession_number');
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);

  const [ambiguousQueue, setAmbiguousQueue] = React.useState<AmbiguousItem[]>([]);
  const [confirmingCandidate, setConfirmingCandidate] = React.useState<string | null>(null);
  const currentAmbiguous = ambiguousQueue[0] || null;

  const handlePilihKandidat = async (item: AmbiguousItem, candidate: AccessionCandidate) => {
    setConfirmingCandidate(candidate.study_id);
    try {
      const res = await fetch(`/api/satu-sehat/dicom/set-accession-confirm/${item.noorder}?study_id=${encodeURIComponent(candidate.study_id)}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal');
      Swal.fire({ icon: 'success', title: 'Tersimpan', text: data.message, timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setConfirmingCandidate(null);
      setAmbiguousQueue((prev) => prev.slice(1));
      fetchList(tglDari, tglSampai, search, statusFilter);
    }
  };

  const openPreview = async (noOrder: string) => {
    setPreviewNoOrder(noOrder);
    setPreviewInstances([]);
    setPreviewSeries([]);
    setPreviewSearchMode('accession_number');
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/satu-sehat/dicom/preview-list/${noOrder}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat foto dari Orthanc');
      setPreviewInstances(Array.isArray(data.instances) ? data.instances : []);
      setPreviewSeries(Array.isArray(data.series) ? data.series : []);
      setPreviewSearchMode(data.search_mode || 'accession_number');
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setPreviewLoading(false);
    }
  };

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
  const selectedAny = list.filter((r) => selected.has(r.noorder));

  const handleKirimAcsn = async () => {
    if (selectedAny.length === 0) return;
    const confirm = await Swal.fire({
      title: `Kirim ${selectedAny.length} AccessionNumber ke PACS Orthanc?`,
      text: 'No.Permintaan Radiologi dipakai sbg AccessionNumber, dicocokkan ke studi yang gambarnya sudah ada di Orthanc (dicari lewat No.RM + tanggal kalau ACSN belum ketemu), lalu tag studinya diisi/diperbarui.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Kirim', cancelButtonText: 'Batal', confirmButtonColor: '#7c3aed',
    });
    if (!confirm.isConfirmed) return;

    setProcessing(true);
    let ok = 0;
    const failed: string[] = [];
    const ambiguous: AmbiguousItem[] = [];
    for (const row of selectedAny) {
      try {
        const res = await fetch(`/api/satu-sehat/dicom/set-accession/${row.noorder}`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal');
        if (data.ambiguous) {
          ambiguous.push({ noorder: row.noorder, nm_pasien: row.nm_pasien, message: data.message, candidates: Array.isArray(data.candidates) ? data.candidates : [] });
          continue;
        }
        ok++;
      } catch (err) {
        failed.push(`${row.noorder} (${row.nm_pasien}): ${err instanceof Error ? err.message : 'Terjadi kesalahan'}`);
      }
    }
    setProcessing(false);

    const parts: string[] = [];
    if (ok > 0) parts.push(`${ok} berhasil`);
    if (ambiguous.length > 0) parts.push(`${ambiguous.length} perlu dipilih manual (lebih dari 1 studi ditemukan)`);
    if (failed.length > 0) parts.push(`${failed.length} gagal`);

    if (failed.length === 0 && ambiguous.length === 0) {
      Swal.fire({ icon: 'success', title: 'Selesai', text: `${ok} AccessionNumber berhasil dikirim ke PACS Orthanc` });
    } else {
      Swal.fire({ icon: failed.length === 0 ? 'warning' : 'error', title: 'Selesai dengan catatan', html: parts.join(', ') + (failed.length ? `:<br/><small>${failed.join('<br/>')}</small>` : '') });
    }

    if (ambiguous.length > 0) {
      setAmbiguousQueue(ambiguous);
    }
  };

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
          title="Tulis file Modality Worklist (.wl) — dipakai modality yang QUERY dulu sebelum scan"
          style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: selectedForKirim.length === 0 || processing ? '#9ca3af' : '#059669', color: '#fff', cursor: selectedForKirim.length === 0 || processing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}
        >
          {processing ? 'Memproses...' : `Kirim Terpilih (${selectedForKirim.length})`}
        </button>
        <button
          type="button"
          onClick={handleKirimAcsn}
          disabled={selectedAny.length === 0 || processing}
          title="Cocokkan & isi AccessionNumber langsung ke studi yang gambarnya sudah ada di Orthanc"
          style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #7c3aed', background: '#ffffff', color: selectedAny.length === 0 || processing ? '#9ca3af' : '#7c3aed', cursor: selectedAny.length === 0 || processing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}
        >
          {processing ? 'Memproses...' : `Kirim ACSN (${selectedAny.length})`}
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
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      onClick={() => openPreview(row.noorder)}
                      title="Lihat foto dari server Orthanc"
                      style={{ background: 'transparent', border: 'none', padding: 0, color: '#2563eb', textDecoration: 'underline', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                    >
                      {row.noorder}
                    </button>
                  </td>
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

      {previewNoOrder && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={() => setPreviewNoOrder(null)}
        >
          <div
            style={{ position: 'relative', background: '#ffffff', borderRadius: 16, maxWidth: 900, width: '95%', maxHeight: '90vh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewNoOrder(null)}
              style={{
                position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%',
                background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, zIndex: 1,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            <div style={{ padding: '20px 56px 14px 20px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Foto DICOM dari Orthanc</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>No.Order {previewNoOrder}</div>
            </div>

            <div style={{ overflowY: 'auto', padding: 20 }}>
              {previewLoading ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat dari Orthanc...</div>
              ) : previewError ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#991b1b' }}>{previewError}</div>
              ) : previewInstances.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Tidak ada gambar</div>
              ) : (
                <>
                {previewSearchMode === 'patient_id' && (
                  <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 12, color: '#92400e', marginBottom: 12 }}>
                    AccessionNumber untuk order ini belum ditemukan di Orthanc — menampilkan hasil pencarian berdasarkan No.RM pasien (lintas kunjungan). Pastikan pilih series yang benar sebelum dipakai.
                  </div>
                )}
                {previewSeries.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                    {previewSeries.map((ser) => (
                      <div key={ser.series_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb' }}>
                        <span style={{ fontSize: 12, color: '#374151' }}>
                          Series {ser.modality || '-'} &middot; {ser.instance_count} gambar
                          {ser.study_date && <> &middot; tanggal studi {ser.study_date}</>}
                        </span>
                        <a
                          href={ser.webviewer_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #2563eb', background: '#fff', color: '#2563eb', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}
                        >
                          Buka di Orthanc Viewer ↗
                        </a>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                  {previewInstances.map((inst) => (
                    <div key={inst.id} style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden', background: '#000' }}>
                      <img
                        src={`/api/satu-sehat/dicom/preview-image/${inst.id}`}
                        alt={inst.modality || 'DICOM'}
                        style={{ width: '100%', display: 'block', aspectRatio: '1 / 1', objectFit: 'contain' }}
                      />
                      {inst.modality && (
                        <div style={{ padding: '4px 8px', fontSize: 11, color: '#fff', background: '#111827' }}>{inst.modality}</div>
                      )}
                    </div>
                  ))}
                </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {currentAmbiguous && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 20 }}>
          <div style={{ position: 'relative', background: '#ffffff', borderRadius: 16, maxWidth: 900, width: '95%', maxHeight: '90vh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setAmbiguousQueue((prev) => prev.slice(1))}
              style={{
                position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%',
                background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, zIndex: 1,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            <div style={{ padding: '20px 56px 14px 20px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Pilih Studi yang Benar</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                No.Order {currentAmbiguous.noorder} &middot; {currentAmbiguous.nm_pasien}
                {ambiguousQueue.length > 1 && <> &middot; {ambiguousQueue.length - 1} order lain menyusul</>}
              </div>
              <div style={{ fontSize: 12, color: '#92400e', marginTop: 6, padding: '6px 10px', borderRadius: 6, background: '#fffbeb', border: '1px solid #fde68a' }}>
                {currentAmbiguous.message} — cek dulu isinya lewat "Lihat" sebelum pilih, biar tidak salah pasang AccessionNumber.
              </div>
            </div>

            <div style={{ overflowY: 'auto', padding: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['No.RM', 'ID Studies', 'ID Series', 'Modalitas', 'Tanggal Studi', 'Jml Gambar', ''].map((h) => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentAmbiguous.candidates.map((cand) => (
                    <tr key={cand.series_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{cand.patient_id}</td>
                      <td style={{ padding: '6px 10px', color: '#6b7280', fontFamily: 'monospace', fontSize: 10 }}>{cand.study_id}</td>
                      <td style={{ padding: '6px 10px', color: '#6b7280', fontFamily: 'monospace', fontSize: 10 }}>{cand.series_id}</td>
                      <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{cand.modality || '-'}</td>
                      <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{cand.study_date || '-'}</td>
                      <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{cand.instance_count}</td>
                      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                        <a
                          href={cand.webviewer_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ marginRight: 8, padding: '5px 10px', borderRadius: 6, border: '1px solid #2563eb', background: '#fff', color: '#2563eb', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}
                        >
                          Lihat
                        </a>
                        <button
                          type="button"
                          onClick={() => handlePilihKandidat(currentAmbiguous, cand)}
                          disabled={confirmingCandidate === cand.study_id}
                          style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: confirmingCandidate === cand.study_id ? '#9ca3af' : '#059669', color: '#fff', fontSize: 11, fontWeight: 600, cursor: confirmingCandidate === cand.study_id ? 'not-allowed' : 'pointer' }}
                        >
                          {confirmingCandidate === cand.study_id ? 'Menyimpan...' : 'Pilih Ini'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

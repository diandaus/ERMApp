import React from 'react';
import Swal from 'sweetalert2';

const inputSm: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const labelSm: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 };

// ── Encounter — padanan tampil() SatuSehatEncounter.java (rawat jalan):
// daftar reg_periksa SUDAH BAYAR di rentang tanggal yg poli-nya SUDAH punya
// mapping lokasi Satu Sehat (kalau belum, tidak akan muncul di daftar —
// harus dimapping dulu di Pengaturan > Mapping Lokasi). Kolom "ID Encounter"
// nunjukin status: kosong = belum dikirim, terisi = sudah. Kolom pertama
// diisi tombol "Kirim" (bukan checkbox "P" spt Java, krn backend cuma
// dukung kirim satu-satu per no_rawat) — bikin+kirim resource Encounter
// (class AMB/rawat jalan) ke Satu Sehat persis payload resmi POST /Encounter.
type EncounterCandidateRow = {
  tgl_registrasi: string; no_rawat: string; no_rm: string; nama_pasien: string; no_ktp_pasien: string;
  kode_dokter: string; nama_dokter: string; no_ktp_dokter: string; kode_poli: string; nama_poli: string;
  id_lokasi_unit: string; stts_rawat: string; stts_lanjut: string; tanggal_pulang: string; id_encounter: string;
};

const formatTglJamEncounter = (iso: string): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const todayISO = (): string => new Date().toISOString().slice(0, 10);

// ── Detail & siklus status Encounter — padanan "Encounter - By ID" /
// "Update Inprogress" / "Update dischargeDisposition" / "Update Finished".
// Semua update PUT resource penuh (backend yg urus fetch-modify-put), jadi di
// sini cukup panggil endpoint aksi lalu refresh detail dari server.
const DISPOSISI_PRESET = [
  { kode: 'home', display: 'Home', label: 'Pulang Rumah' },
  { kode: 'oth', display: 'other-hcf', label: 'Rujuk ke Fasilitas Kesehatan Lain' },
  { kode: '', display: '', label: 'Lainnya (isi manual)' },
];

const EncounterDetailModal: React.FC<{ noRawat: string; onClose: () => void }> = ({ noRawat, onClose }) => {
  const [loading, setLoading] = React.useState(true);
  const [resource, setResource] = React.useState<Record<string, any> | null>(null);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [showDisposisi, setShowDisposisi] = React.useState(false);
  const [disposisiPreset, setDisposisiPreset] = React.useState(0);
  const [disposisiKode, setDisposisiKode] = React.useState('');
  const [disposisiDisplay, setDisposisiDisplay] = React.useState('');
  const [disposisiText, setDisposisiText] = React.useState('');

  const fetchDetail = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/satu-sehat/encounter/detail/${noRawat}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat detail Encounter');
      setResource(data);
    } catch (err) {
      setResource(null);
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setLoading(false);
    }
  }, [noRawat]);

  React.useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const runAction = async (key: string, url: string, body?: object) => {
    setActionLoading(key);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Aksi gagal');
      Swal.fire({ icon: 'success', title: 'Berhasil', text: data.message, timer: 1500, showConfirmButton: false });
      setShowDisposisi(false);
      fetchDetail();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleInprogress = async () => {
    const confirm = await Swal.fire({ title: 'Ubah status jadi In Progress?', icon: 'question', showCancelButton: true, confirmButtonText: 'Ya', cancelButtonText: 'Batal', confirmButtonColor: '#059669' });
    if (!confirm.isConfirmed) return;
    runAction('inprogress', `/api/satu-sehat/encounter/inprogress/${noRawat}`);
  };

  const handleFinished = async () => {
    const confirm = await Swal.fire({ title: 'Selesaikan Encounter ini?', text: 'Status akan berubah jadi Finished dan tidak bisa diubah lagi lewat halaman ini.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Selesaikan', cancelButtonText: 'Batal', confirmButtonColor: '#dc2626' });
    if (!confirm.isConfirmed) return;
    runAction('finished', `/api/satu-sehat/encounter/finished/${noRawat}`);
  };

  const handleSubmitDisposisi = () => {
    const kode = disposisiPreset < 2 ? DISPOSISI_PRESET[disposisiPreset].kode : disposisiKode;
    const display = disposisiPreset < 2 ? DISPOSISI_PRESET[disposisiPreset].display : disposisiDisplay;
    if (!kode.trim()) {
      Swal.fire({ icon: 'warning', title: 'Data belum lengkap', text: 'Kode discharge disposition wajib diisi' });
      return;
    }
    runAction('disposisi', `/api/satu-sehat/encounter/disposisi/${noRawat}`, { kode, display, text: disposisiText });
  };

  const status: string = resource?.status || '-';
  const statusHistory: any[] = Array.isArray(resource?.statusHistory) ? resource!.statusHistory : [];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10030 }} onClick={onClose}>
      <div style={{ background: '#ffffff', borderRadius: 16, padding: 20, width: 560, maxWidth: '92%', maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Detail Encounter — {noRawat}</div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>×</button>
        </div>

        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</div>
        ) : !resource ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Data tidak tersedia</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={labelSm}>Status saat ini:</span>
              <span style={{ padding: '3px 10px', borderRadius: 999, background: '#ecfdf5', color: '#065f46', fontSize: 12, fontWeight: 700 }}>{status}</span>
            </div>

            <div>
              <div style={{ ...labelSm, marginBottom: 4 }}>Riwayat Status</div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                {statusHistory.length === 0 ? (
                  <div style={{ padding: 10, fontSize: 12, color: '#9ca3af' }}>Belum ada riwayat</div>
                ) : (
                  statusHistory.map((h, i) => (
                    <div key={i} style={{ padding: '8px 10px', fontSize: 12, borderBottom: i < statusHistory.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, color: '#374151' }}>{h?.status}</span>
                      <span style={{ color: '#9ca3af' }}>{h?.period?.start || '-'} {h?.period?.end ? `→ ${h.period.end}` : ''}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={actionLoading !== null}
                onClick={handleInprogress}
                style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: actionLoading === 'inprogress' ? '#9ca3af' : '#2563eb', color: '#fff', cursor: actionLoading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}
              >
                {actionLoading === 'inprogress' ? 'Memproses...' : 'Mulai Konsultasi (In Progress)'}
              </button>
              <button
                type="button"
                disabled={actionLoading !== null}
                onClick={() => setShowDisposisi((v) => !v)}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #059669', background: '#ffffff', color: '#059669', cursor: actionLoading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}
              >
                Set Kepulangan (Discharge)
              </button>
              <button
                type="button"
                disabled={actionLoading !== null}
                onClick={handleFinished}
                style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: actionLoading === 'finished' ? '#9ca3af' : '#dc2626', color: '#fff', cursor: actionLoading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}
              >
                {actionLoading === 'finished' ? 'Memproses...' : 'Selesaikan (Finished)'}
              </button>
            </div>

            {showDisposisi && (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, background: '#f9fafb' }}>
                <div>
                  <label style={labelSm}>Jenis Kepulangan</label>
                  <select
                    value={disposisiPreset}
                    onChange={(e) => setDisposisiPreset(Number(e.target.value))}
                    style={inputSm}
                  >
                    {DISPOSISI_PRESET.map((p, i) => (
                      <option key={i} value={i}>{p.label}</option>
                    ))}
                  </select>
                </div>
                {disposisiPreset === 2 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={labelSm}>Kode</label>
                      <input type="text" value={disposisiKode} onChange={(e) => setDisposisiKode(e.target.value)} style={inputSm} />
                    </div>
                    <div>
                      <label style={labelSm}>Display</label>
                      <input type="text" value={disposisiDisplay} onChange={(e) => setDisposisiDisplay(e.target.value)} style={inputSm} />
                    </div>
                  </div>
                )}
                <div>
                  <label style={labelSm}>Keterangan</label>
                  <input type="text" value={disposisiText} onChange={(e) => setDisposisiText(e.target.value)} style={inputSm} placeholder="mis. Anjuran dokter untuk pulang dan kontrol 1 bulan lagi" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    disabled={actionLoading !== null}
                    onClick={handleSubmitDisposisi}
                    style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: actionLoading === 'disposisi' ? '#9ca3af' : '#059669', color: '#fff', cursor: actionLoading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500 }}
                  >
                    {actionLoading === 'disposisi' ? 'Menyimpan...' : 'Simpan Discharge Disposition'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export const EncounterSection: React.FC = () => {
  const [tglDari, setTglDari] = React.useState(todayISO());
  const [tglSampai, setTglSampai] = React.useState(todayISO());
  const [search, setSearch] = React.useState('');
  const [list, setList] = React.useState<EncounterCandidateRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [detailNoRawat, setDetailNoRawat] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const fetchList = React.useCallback(async (dari: string, sampai: string, q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/satu-sehat/encounter?tgl_dari=${dari}&tgl_sampai=${sampai}&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat daftar Encounter');
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

  const belumTerkirim = list.filter((r) => !r.id_encounter);
  const allSelected = belumTerkirim.length > 0 && belumTerkirim.every((r) => selected.has(r.no_rawat));

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(belumTerkirim.map((r) => r.no_rawat)));
  };
  const toggleSelectRow = (noRawat: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(noRawat)) next.delete(noRawat); else next.add(noRawat);
      return next;
    });
  };

  const handleKirimTerpilih = async () => {
    if (selected.size === 0) return;
    const confirm = await Swal.fire({
      title: `Kirim ${selected.size} Encounter ke Satu Sehat?`,
      text: 'Setiap registrasi terpilih akan dikirim sebagai resource Encounter resmi ke server Satu Sehat.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Kirim Semua', cancelButtonText: 'Batal', confirmButtonColor: '#059669',
    });
    if (!confirm.isConfirmed) return;

    setSending(true);
    let ok = 0;
    const failed: string[] = [];
    for (const noRawat of selected) {
      try {
        const res = await fetch(`/api/satu-sehat/encounter/send/${noRawat}`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal');
        ok++;
      } catch (err) {
        failed.push(`${noRawat}: ${err instanceof Error ? err.message : 'Terjadi kesalahan'}`);
      }
    }
    setSending(false);

    if (failed.length === 0) {
      Swal.fire({ icon: 'success', title: 'Selesai', text: `${ok} Encounter berhasil dikirim` });
    } else {
      Swal.fire({ icon: ok > 0 ? 'warning' : 'error', title: 'Selesai dengan catatan', html: `${ok} berhasil, ${failed.length} gagal:<br/><small>${failed.join('<br/>')}</small>` });
    }
    fetchList(tglDari, tglSampai, search);
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
            placeholder="No.Rawat, No.RM, nama pasien/dokter, poli, status..."
            style={inputSm}
          />
        </div>
        <button
          type="button"
          onClick={handleKirimTerpilih}
          disabled={selected.size === 0 || sending}
          style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: selected.size === 0 || sending ? '#9ca3af' : '#059669', color: '#fff', cursor: selected.size === 0 || sending ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}
        >
          {sending ? 'Mengirim...' : `Kirim Terpilih (${selected.size})`}
        </button>
      </div>

      <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
              <th style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', width: 60 }}>
                {belumTerkirim.length > 0 && (
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                )}
              </th>
              {['Tanggal Registrasi', 'No.Rawat', 'No.RM', 'Nama Pasien', 'No.KTP Pasien', 'Kode Dokter', 'Nama Dokter', 'No.KTP Dokter', 'Kode Poli', 'Nama Poli/Unit', 'ID Lokasi Unit', 'Stts Rawat', 'Stts Lanjut', 'Tanggal Pulang', 'ID Encounter'].map((h) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={16} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={16} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Tidak ada data pada rentang tanggal ini (pastikan poli sudah punya Mapping Lokasi)</td></tr>
            ) : (
              list.map((row) => (
                <tr key={row.no_rawat} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    {row.id_encounter ? (
                      <button
                        type="button"
                        onClick={() => setDetailNoRawat(row.no_rawat)}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #059669', background: '#ffffff', color: '#059669', cursor: 'pointer', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}
                      >
                        Detail
                      </button>
                    ) : (
                      <input type="checkbox" checked={selected.has(row.no_rawat)} onChange={() => toggleSelectRow(row.no_rawat)} />
                    )}
                  </td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{formatTglJamEncounter(row.tgl_registrasi)}</td>
                  <td style={{ padding: '6px 10px', color: '#111827', whiteSpace: 'nowrap' }}>{row.no_rawat}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.no_rm}</td>
                  <td style={{ padding: '6px 10px', color: '#111827' }}>{row.nama_pasien}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.no_ktp_pasien}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.kode_dokter}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.nama_dokter}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.no_ktp_dokter}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.kode_poli}</td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{row.nama_poli}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.id_lokasi_unit}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.stts_rawat}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{row.stts_lanjut}</td>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{formatTglJamEncounter(row.tanggal_pulang)}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                    {row.id_encounter ? (
                      <span style={{ padding: '3px 8px', borderRadius: 999, background: '#ecfdf5', color: '#065f46', fontSize: 11, fontWeight: 600 }}>{row.id_encounter}</span>
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

      {detailNoRawat && (
        <EncounterDetailModal noRawat={detailNoRawat} onClose={() => setDetailNoRawat(null)} />
      )}
    </div>
  );
};

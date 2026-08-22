import React from 'react';
import Swal from 'sweetalert2';
import { ModalHasilRadiologi } from '../components/ModalHasilRadiologi';

// RadiologiView — worklist departemen Radiologi lintas pasien. Padanan
// DlgCariPermintaanRadiologi.java (Khanza Desktop): 2 tab terpisah "Rawat
// Jalan"/"Rawat Inap" (permintaan_radiologi.status='ralan'/'ranap'), kolom
// Ruang beda sumber per tab (Poliklinik utk ralan, kamar+bangsal terbaru
// utk ranap — dihitung backend). Tombol Input Hasil (ModalHasilRadiologi)
// per baris. Permintaan baru dibuat dari layar pasien (RadTab.tsx), bukan
// dari modul ini. Baca daftar dari GET /api/radiologi/list?rawat=ralan|ranap.

type RawatTab = 'ralan' | 'ranap';

const RAWAT_TABS: { key: RawatTab; label: string }[] = [
  { key: 'ralan', label: 'Rawat Jalan' },
  { key: 'ranap', label: 'Rawat Inap' },
];

type QueueRow = {
  noorder: string; tgl_permintaan: string; jam_permintaan: string;
  no_rawat: string; no_rkm_medis: string; nm_pasien: string;
  kd_dokter: string; nm_dokter: string; status: string; diagnosa_klinis: string;
  rawat: string; kd_pj: string; png_jawab: string; ruang: string;
  tgl_sampel: string; jam_sampel: string; tgl_hasil: string; jam_hasil: string;
  informasi_tambahan: string; pemeriksaan: string;
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const inputStyle: React.CSSProperties = { padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const TH: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', background: '#f9fafb' };
const TD: React.CSSProperties = { padding: '7px 10px', fontSize: 12, borderBottom: '1px solid #f3f4f6', color: '#374151', verticalAlign: 'top' };

type RadiologiViewProps = { user?: { nip?: string } | null };

export const RadiologiView: React.FC<RadiologiViewProps> = ({ user }) => {
  const [rawatTab, setRawatTab] = React.useState<RawatTab>('ralan');
  const [tgl1, setTgl1] = React.useState(todayStr());
  const [tgl2, setTgl2] = React.useState(todayStr());
  const [status, setStatus] = React.useState<'' | 'Belum Diperiksa' | 'Sudah Diperiksa'>('');
  const [search, setSearch] = React.useState('');
  const [rows, setRows] = React.useState<QueueRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const [hasilNoOrder, setHasilNoOrder] = React.useState<string | null>(null);
  const [sampelRow, setSampelRow] = React.useState<QueueRow | null>(null);
  const [sampelTgl, setSampelTgl] = React.useState('');
  const [sampelJam, setSampelJam] = React.useState('');
  const [savingSampel, setSavingSampel] = React.useState(false);
  const [sendingWorklist, setSendingWorklist] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ tgl1, tgl2, rawat: rawatTab });
      if (status) params.set('status', status);
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/radiologi/list?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat daftar permintaan radiologi');
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  }, [rawatTab, tgl1, tgl2, status, search]);

  React.useEffect(() => {
    const t = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(t);
  }, [fetchData]);

  const openSampelModal = (row: QueueRow) => {
    const now = new Date();
    setSampelRow(row);
    setSampelTgl(todayStr());
    setSampelJam(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  };

  const handleSubmitSampel = async () => {
    if (!sampelRow) return;
    setSavingSampel(true);
    try {
      const res = await fetch(`/api/radiologi/sampel/${encodeURIComponent(sampelRow.noorder)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tgl: sampelTgl, jam: sampelJam }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mencatat waktu sampel');
      setSampelRow(null);
      fetchData();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSavingSampel(false);
    }
  };

  // Sama seperti tombol "Kirim Terpilih" di ModalityWorklist.tsx (POST
  // /api/satu-sehat/mwl/send/:noorder) — tulis entri Modality Worklist di
  // Orthanc supaya AccessionNumber terisi otomatis = No.Order, tanpa
  // diketik manual di alat. Di sini dipicu langsung dari modal sampel utk
  // 1 order yg sedang dibuka (bukan multi-select spt di ModalityWorklist).
  const handleKirimWorklist = async () => {
    if (!sampelRow) return;
    const confirm = await Swal.fire({
      title: `Kirim ${sampelRow.noorder} ke Modality Worklist?`,
      text: 'AccessionNumber diisi otomatis = No.Order — tidak perlu diketik manual lagi di modality.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Kirim', cancelButtonText: 'Batal', confirmButtonColor: '#059669',
    });
    if (!confirm.isConfirmed) return;

    setSendingWorklist(true);
    try {
      const res = await fetch(`/api/satu-sehat/mwl/send/${sampelRow.noorder}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim ke Modality Worklist');
      Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Order berhasil masuk Modality Worklist', timer: 1800, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal!', text: err instanceof Error ? err.message : 'Terjadi kesalahan' });
    } finally {
      setSendingWorklist(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 12, padding: 4, gap: 4 }}>
          {RAWAT_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setRawatTab(tab.key)}
              style={{
                padding: '6px 24px',
                borderRadius: 8,
                border: rawatTab === tab.key ? '1px solid #d1d5db' : 'none',
                background: rawatTab === tab.key ? '#ffffff' : 'transparent',
                color: rawatTab === tab.key ? '#111827' : '#6b7280',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: rawatTab === tab.key ? 600 : 400,
                transition: 'all 0.2s ease',
                boxShadow: rawatTab === tab.key ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <div>
            <input type="date" style={inputStyle} value={tgl1} onChange={(e) => setTgl1(e.target.value)} />
          </div>
          <span style={{ fontSize: 13, color: '#6b7280', paddingBottom: 7 }}>s/d</span>
          <div>
            <input type="date" style={inputStyle} value={tgl2} onChange={(e) => setTgl2(e.target.value)} />
          </div>
          <div style={{ minWidth: 180 }}>
            <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="">Semua</option>
              <option value="Belum Diperiksa">Belum Diperiksa</option>
              <option value="Sudah Diperiksa">Sudah Diperiksa</option>
            </select>
          </div>
          <div style={{ minWidth: 220, position: 'relative' }}>
            <div style={{
              position: 'absolute', left: 12, top: '50%',
              transform: 'translateY(-50%)', pointerEvents: 'none',
              display: 'flex', alignItems: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
            </div>
            <input
              style={{ ...inputStyle, width: '100%', padding: '7px 10px 7px 36px' }}
              placeholder="No.Order / No.Rawat / No.RM / Nama Pasien / Dokter..."
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13, flexShrink: 0 }}>{error}</div>
      )}

      <div style={{ flex: 1, minHeight: 0, borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr>
              {[
                'No.Permintaan', 'No.Rawat', 'Pasien', 'Permintaan', 'Jam', 'Sampel', 'Jam', 'Hasil', 'Jam',
                'Dokter Perujuk', rawatTab === 'ralan' ? 'Poli Registrasi' : 'Ruang',
                'Informasi Tambahan', 'Diagnosis Klinis', 'Jenis Bayar',
              ].map((h, i) => (
                <th key={`${h}-${i}`} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={14} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={14} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>Tidak ada permintaan radiologi pada rentang ini</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.noorder}>
                  <td style={{ ...TD, whiteSpace: 'nowrap', fontFamily: 'monospace', color: '#2563eb' }}>{row.noorder}</td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>{row.no_rawat}</td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                    <div>{row.no_rkm_medis} {row.nm_pasien}</div>
                    {row.pemeriksaan && <div style={{ fontSize: 12, color: '#2563eb', marginTop: 2 }}>{row.pemeriksaan}</div>}
                  </td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>{row.tgl_permintaan}</td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>{row.jam_permintaan}</td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                    {row.tgl_sampel || (
                      <button
                        type="button" onClick={() => openSampelModal(row)}
                        style={{ padding: '4px 10px', borderRadius: 2, border: 'none', background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                      >
                        + Sampel
                      </button>
                    )}
                  </td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>{row.jam_sampel}</td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                    {row.tgl_hasil || (
                      <button
                        type="button" onClick={() => setHasilNoOrder(row.noorder)}
                        style={{ padding: '4px 10px', borderRadius: 2, border: 'none', background: '#2563eb', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                      >
                        + Hasil
                      </button>
                    )}
                  </td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>{row.jam_hasil}</td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>{row.nm_dokter || '-'}</td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>{row.ruang || '-'}</td>
                  <td style={TD}>{row.informasi_tambahan || '-'}</td>
                  <td style={TD}>{row.diagnosa_klinis || '-'}</td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>{row.png_jawab || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Input Hasil Pemeriksaan */}
      {hasilNoOrder && (
        <ModalHasilRadiologi
          noorder={hasilNoOrder}
          nip={user?.nip}
          onClose={() => setHasilNoOrder(null)}
          onSaved={fetchData}
        />
      )}

      {/* Modal Update Waktu Pengambilan Sampel */}
      {sampelRow && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}
          onClick={() => setSampelRow(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, padding: 20, maxWidth: 380, width: '95%', display: 'flex', flexDirection: 'column', gap: 14 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Waktu Pengambilan Sampel</span>
              <button
                type="button" onClick={() => setSampelRow(null)}
                style={{
                  width: 28, height: 28, borderRadius: '50%', border: '1px solid #e5e7eb',
                  background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, lineHeight: 1, cursor: 'pointer', color: '#6b7280', padding: 0,
                }}
              >
                &times;
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              {sampelRow.noorder} &middot; {sampelRow.nm_pasien}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Tanggal</label>
                <input type="date" style={{ ...inputStyle, width: '100%' }} value={sampelTgl} onChange={(e) => setSampelTgl(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Jam</label>
                <input type="time" style={{ ...inputStyle, width: '100%' }} value={sampelJam} onChange={(e) => setSampelJam(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <button
                type="button" onClick={handleKirimWorklist} disabled={sendingWorklist}
                title="Tulis entri Modality Worklist di Orthanc — sama seperti tombol Kirim Terpilih di menu Modality Worklist"
                style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: sendingWorklist ? '#9ca3af' : '#059669', color: '#fff', cursor: sendingWorklist ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                {sendingWorklist ? 'Mengirim...' : 'Kirim ke Worklist'}
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setSampelRow(null)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Batal</button>
                <button
                  type="button" onClick={handleSubmitSampel} disabled={savingSampel}
                  style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: savingSampel ? '#9ca3af' : '#2563eb', color: '#fff', cursor: savingSampel ? 'default' : 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  {savingSampel ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

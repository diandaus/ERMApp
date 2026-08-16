import React from 'react';

// ============================================================================
// KAMAR OPERASI (OK) — Jadwal Operasi, padanan tab "tampil()" di
// DlgBookingOperasi.java (Khanza): 4 filter status (Menunggu, Proses
// Operasi, rentang tanggal [semua status], Selesai + rentang tanggal),
// pencarian bebas, dan tabel booking_operasi lengkap dgn info
// pasien/dokter/ruang OK/rujukan asal/diagnosa. Baca-saja (booking
// operasinya sendiri masih dibuat lewat modul lain) — lihat
// backend/booking_operasi_handler.go.
// ============================================================================

type BookingOperasiRow = {
  no_rawat: string;
  no_rkm_medis: string;
  nama_pasien: string;
  umur: string;
  jk: string;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  status: string;
  rujukan_dari: string;
  diagnosa: string;
  kode_operasi: string;
  operasi: string;
  kode_operator: string;
  operator: string;
  order: string;
  kode_ok: string;
  nama_ruang_operasi: string;
};

type Filter = 'menunggu' | 'proses' | 'tanggal' | 'selesai';

const FILTER_OPTIONS: { key: Filter; label: string }[] = [
  { key: 'menunggu', label: 'Menunggu' },
  { key: 'proses', label: 'Proses Operasi' },
  { key: 'tanggal', label: 'Rentang Tanggal' },
  { key: 'selesai', label: 'Selesai' },
];

const inputStyle: React.CSSProperties = {
  padding: '7px 10px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

const TH: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', fontSize: 11,
  fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb',
  whiteSpace: 'nowrap', background: '#f9fafb',
};

const TD: React.CSSProperties = {
  padding: '7px 10px', fontSize: 12, borderBottom: '1px solid #f3f4f6',
  whiteSpace: 'nowrap', color: '#374151',
};

const statusBadge = (status: string): { bg: string; fg: string; border: string } => {
  if (status === 'Menunggu') return { bg: '#f97316', fg: '#ffffff', border: '#ea580c' };
  if (status === 'Proses Operasi') return { bg: '#2563eb', fg: '#ffffff', border: '#1d4ed8' };
  if (status === 'Selesai') return { bg: '#059669', fg: '#ffffff', border: '#047857' };
  return { bg: '#f3f4f6', fg: '#6b7280', border: '#d1d5db' };
};

// Status yang masih bisa diklik utk buka modal update (Selesai = final,
// tidak ada langkah lanjutan lagi).
const isStatusEditable = (status: string) => status === 'Menunggu' || status === 'Proses Operasi';

const todayStr = () => new Date().toISOString().slice(0, 10);
const pad2 = (n: number) => String(n).padStart(2, '0');

const tanggalIndo = (isoTanggal: string) => {
  const [y, m, d] = isoTanggal.split('-');
  if (!y || !m || !d) return isoTanggal;
  return `${d}-${m}-${y}`;
};

// Primitif pillInput/pillReadOnly/PillSelect/StepperIcon/Row DIDUPLIKASI
// dari components/ModalValidasiObat.tsx (bukan diimpor — pola yang sama
// dipakai di sana: menghindari risiko mengubah form lain yang sudah
// teruji), supaya tampilan field & jam stepper modal ini konsisten
// dengan modal Validasi Obat.
const pillInput: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '7px 14px',
  borderRadius: 4,
  border: '1px solid #d1d5db',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  background: '#ffffff',
  color: '#111827',
};

const pillReadOnly: React.CSSProperties = {
  ...pillInput,
  background: '#f9fafb',
  color: '#374151',
};

const pillSelectStyle: React.CSSProperties = {
  ...pillInput,
  appearance: 'none',
  WebkitAppearance: 'none',
  paddingRight: 30,
  cursor: 'pointer',
};

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
      background: '#2563eb',
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

const PillSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  style?: React.CSSProperties;
  disabled?: boolean;
}> = ({ value, onChange, options, style, disabled }) => (
  <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', ...style }}>
    <select disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} style={{ ...pillSelectStyle, ...(disabled ? { background: '#f9fafb', cursor: 'default' } : {}) }}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    <StepperIcon />
  </div>
);

// Row — satu baris label:value ala form Khanza Desktop.
const Row: React.FC<{ label: string; labelWidth?: number; children: React.ReactNode }> = ({ label, labelWidth = 90, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', rowGap: 8 }}>
    <div style={{ width: labelWidth, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: '#111827' }}>{label} :</div>
    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', rowGap: 8 }}>{children}</div>
  </div>
);

const range = (n: number) => Array.from({ length: n }, (_, i) => ({ value: pad2(i), label: pad2(i) }));

const STATUS_OPSI = ['Menunggu', 'Proses Operasi', 'Selesai'];

type DetailModalProps = {
  row: BookingOperasiRow;
  onClose: () => void;
  onSaved: () => void;
};

const DetailBookingModal: React.FC<DetailModalProps> = ({ row, onClose, onSaved }) => {
  const parseJam = (jam: string): [string, string, string] => {
    const parts = (jam || '00:00:00').split(':');
    return [pad2(parseInt(parts[0], 10) || 0), pad2(parseInt(parts[1], 10) || 0), pad2(parseInt(parts[2], 10) || 0)];
  };
  const [mulaiH0, mulaiM0, mulaiS0] = parseJam(row.jam_mulai);
  const [selesaiH0, selesaiM0, selesaiS0] = parseJam(row.jam_selesai);

  const [mh, setMh] = React.useState(mulaiH0);
  const [mm, setMm] = React.useState(mulaiM0);
  const [ms, setMs] = React.useState(mulaiS0);
  const [sh, setSh] = React.useState(selesaiH0);
  const [sm, setSm] = React.useState(selesaiM0);
  const [ss, setSs] = React.useState(selesaiS0);
  const [status, setStatus] = React.useState(row.status);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSimpan = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/booking-operasi/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_rawat: row.no_rawat,
          kode_paket: row.kode_operasi,
          tanggal: row.tanggal,
          jam_mulai_lama: row.jam_mulai,
          jam_mulai: `${mh}:${mm}:${ms}`,
          jam_selesai: `${sh}:${sm}:${ss}`,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan jadwal operasi');
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 900, boxShadow: '0 20px 48px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#111827' }}>Detail Jadwal Operasi</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', padding: '0 4px', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Row label="No.Rawat">
            <input readOnly value={row.no_rawat} style={{ ...pillReadOnly, flex: '0 0 150px' }} />
            <input readOnly value={row.nama_pasien} style={{ ...pillReadOnly, flex: 1 }} />
            <input readOnly value={row.rujukan_dari} style={{ ...pillReadOnly, flex: '0 0 160px' }} />
          </Row>

          <Row label="Ruang OK">
            <input readOnly value={row.kode_ok} style={{ ...pillReadOnly, flex: '0 0 70px' }} />
            <input readOnly value={row.nama_ruang_operasi} style={{ ...pillReadOnly, flex: 1 }} />
          </Row>

          <Row label="Tanggal">
            <input readOnly value={tanggalIndo(row.tanggal)} style={{ ...pillReadOnly, flex: '0 0 110px' }} />
            <div style={{ width: 40, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: '#111827' }}>Mulai :</div>
            <PillSelect value={mh} onChange={setMh} options={range(24)} style={{ flex: '0 0 60px' }} />
            <PillSelect value={mm} onChange={setMm} options={range(60)} style={{ flex: '0 0 60px' }} />
            <PillSelect value={ms} onChange={setMs} options={range(60)} style={{ flex: '0 0 60px' }} />
            <div style={{ width: 30, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: '#111827' }}>s.d. :</div>
            <PillSelect value={sh} onChange={setSh} options={range(24)} style={{ flex: '0 0 60px' }} />
            <PillSelect value={sm} onChange={setSm} options={range(60)} style={{ flex: '0 0 60px' }} />
            <PillSelect value={ss} onChange={setSs} options={range(60)} style={{ flex: '0 0 60px' }} />
          </Row>

          <Row label="Operator">
            <input readOnly value={row.kode_operator} style={{ ...pillReadOnly, flex: '0 0 100px' }} />
            <input readOnly value={row.operator} style={{ ...pillReadOnly, flex: 1 }} />
          </Row>

          <Row label="Operasi">
            <input readOnly value={row.kode_operasi} style={{ ...pillReadOnly, flex: '0 0 100px' }} />
            <input readOnly value={row.operasi} style={{ ...pillReadOnly, flex: 1 }} />
          </Row>

          <Row label="Status">
            <PillSelect
              value={status}
              onChange={setStatus}
              options={STATUS_OPSI.map((v) => ({ value: v, label: v }))}
              style={{ flex: '0 0 200px' }}
            />
          </Row>

          {error && (
            <div style={{ padding: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSimpan}
            disabled={saving}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#ec4899', color: '#ffffff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const JadwalOperasiView: React.FC = () => {
  const [filter, setFilter] = React.useState<Filter>('menunggu');
  const [tglAwal, setTglAwal] = React.useState(todayStr());
  const [tglAkhir, setTglAkhir] = React.useState(todayStr());
  const [search, setSearch] = React.useState('');
  const [rows, setRows] = React.useState<BookingOperasiRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [detailRow, setDetailRow] = React.useState<BookingOperasiRow | null>(null);

  const butuhTanggal = filter === 'tanggal' || filter === 'selesai';

  const fetchData = React.useCallback(async () => {
    if (butuhTanggal && (!tglAwal || !tglAkhir)) return;
    setLoading(true);
    setError(null);
    try {
      let url = `/api/booking-operasi/list?filter=${filter}`;
      if (butuhTanggal) url += `&tanggal_awal=${tglAwal}&tanggal_akhir=${tglAkhir}`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat jadwal operasi');
      setRows(Array.isArray(data.list) ? data.list : []);
    } catch (err: any) {
      setRows([]);
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, tglAwal, tglAkhir, search]);

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
  }, [filter, tglAwal, tglAkhir, search]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 0 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Status</label>
          <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 10, padding: 4, gap: 4 }}>
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setFilter(opt.key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 7,
                  border: filter === opt.key ? '1px solid #ec4899' : '1px solid transparent',
                  background: filter === opt.key ? '#ffffff' : 'transparent',
                  color: filter === opt.key ? '#ec4899' : '#6b7280',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: filter === opt.key ? 600 : 400,
                  whiteSpace: 'nowrap',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {butuhTanggal && (
          <>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Dari Tanggal</label>
              <input type="date" style={inputStyle} value={tglAwal} onChange={(e) => setTglAwal(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Sampai Tanggal</label>
              <input type="date" style={inputStyle} value={tglAkhir} onChange={(e) => setTglAkhir(e.target.value)} />
            </div>
          </>
        )}

        <div style={{ minWidth: 220, flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cari</label>
          <input
            style={{ ...inputStyle, width: '100%' }}
            placeholder="No. Rawat / Nama Pasien / Dokter / Ruang OK..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13, flexShrink: 0 }}>
          {error}
        </div>
      )}

      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'auto', height: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr>
              <th style={TH}>No.</th>
              <th style={TH}>No. Rawat</th>
              <th style={TH}>Nama Pasien</th>
              <th style={TH}>Umur</th>
              <th style={TH}>J.K.</th>
              <th style={TH}>Tanggal</th>
              <th style={TH}>Mulai</th>
              <th style={TH}>Selesai</th>
              <th style={TH}>Status</th>
              <th style={TH}>Rujukan Dari</th>
              <th style={TH}>Diagnosa</th>
              <th style={TH}>Operasi</th>
              <th style={TH}>Operator</th>
              <th style={TH}>Kode OK</th>
              <th style={TH}>Nama Ruang Operasi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={15} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={15} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Tidak ada data</td></tr>
            ) : (
              rows.map((row, index) => {
                const badge = statusBadge(row.status);
                return (
                  <tr key={`${row.no_rawat}-${row.kode_operasi}-${row.tanggal}`} style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={TD}>{index + 1}.</td>
                    <td style={TD}>{row.no_rawat}</td>
                    <td style={{ ...TD, fontWeight: 600, color: '#111827' }}>{row.nama_pasien}</td>
                    <td style={TD}>{row.umur}</td>
                    <td style={TD}>{row.jk}</td>
                    <td style={TD}>{row.tanggal}</td>
                    <td style={TD}>{row.jam_mulai}</td>
                    <td style={TD}>{row.jam_selesai}</td>
                    <td style={TD}>
                      {isStatusEditable(row.status) ? (
                        <button
                          type="button"
                          onClick={() => setDetailRow(row)}
                          style={{ padding: '2px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: badge.bg, color: badge.fg, border: `1px solid ${badge.border}`, cursor: 'pointer' }}
                        >
                          {row.status}
                        </button>
                      ) : (
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: badge.bg, color: badge.fg }}>{row.status}</span>
                      )}
                    </td>
                    <td style={TD}>{row.rujukan_dari}</td>
                    <td style={{ ...TD, whiteSpace: 'normal', minWidth: 180 }}>{row.diagnosa}</td>
                    <td style={{ ...TD, whiteSpace: 'normal', minWidth: 160 }}>{row.operasi}</td>
                    <td style={TD}>{row.operator}</td>
                    <td style={TD}>{row.kode_ok}</td>
                    <td style={TD}>{row.nama_ruang_operasi}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {!loading && (
        <div
          style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4,
            padding: '2px 8px', borderRadius: 10,
            fontSize: 11, color: '#6b7280', pointerEvents: 'none',
          }}
        >
          {rows.length} data
        </div>
      )}
      </div>

      {detailRow && (
        <DetailBookingModal
          row={detailRow}
          onClose={() => setDetailRow(null)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
};

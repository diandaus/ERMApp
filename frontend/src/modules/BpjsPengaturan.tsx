import React from 'react';
import { localDateStr } from '../utils/date';

// ============================================================================
// PENGATURAN BPJS — Mapping Poli VCLAIM & Mapping Dokter DPJP VCLAIM.
// Padanan BPJSMapingPoli.java & BPJSMapingDokterDPJP.java (SIMRS Khanza
// Desktop, package bridging). Tabel maping_poli_bpjs & maping_dokter_dpjpvclaim
// SUDAH ADA di skema Khanza — lihat backend/mapping_bpjs_handler.go, cuma
// baca/tulis ke tabel yang sudah ada, bukan tabel baru.
// Beda dari versi desktop: daftar di sini menampilkan SEMUA poli/dokter lokal
// (LEFT JOIN) supaya yang belum di-mapping ikut kelihatan, padanan pola
// MappingRadiologi di MappingSatuSehat.tsx.
// ============================================================================

type SettingKey = 'mapping-poli' | 'mapping-dokter';

const SETTING_LIST: { key: SettingKey; label: string }[] = [
  { key: 'mapping-poli', label: 'Mapping Poli VCLAIM' },
  { key: 'mapping-dokter', label: 'Mapping Dokter DPJP VCLAIM' },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const TH: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left', fontSize: 11,
  fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb',
  whiteSpace: 'nowrap', background: '#f9fafb',
};

const TD: React.CSSProperties = {
  padding: '8px 12px', fontSize: 12, borderBottom: '1px solid #f3f4f6',
  verticalAlign: 'middle',
};

// ─── Helper: baca daftar {kode,nama} dari respons referensi VClaim ─────────────
// Nama field pembungkus array-nya beda-beda per endpoint ("poli", "list",
// dll — lihat referensi/poli vs referensi/dokter/pelayanan/... di source
// BPJSCekReferensiPoli.java / BPJSCekReferensiDokterDPJP.java), jadi cari
// property pertama yang berupa array alih-alih menebak satu nama key tetap.

type RefItem = { kode: string; nama: string };

function extractRefList(data: any): RefItem[] {
  if (!data || typeof data !== 'object') return [];
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (Array.isArray(val)) {
      return val
        .map((item: any) => ({
          kode: String(item?.kode ?? ''),
          nama: String(item?.nama ?? ''),
        }))
        .filter((r) => r.kode);
    }
  }
  return [];
}

// ─── Search Box: Referensi Poli BPJS ───────────────────────────────────────────
// Belum dipakai — disiapkan untuk form pencarian Poli BPJS di dalam
// MappingPoliModal saat modal Tambah/Ganti dikembangkan lebih lanjut.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function BpjsPoliSearchBox({ value, display, onChange }: {
  value: string;
  display: string;
  onChange: (kode: string, nama: string) => void;
}) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<RefItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState('');
  const ref = React.useRef<HTMLDivElement>(null);

  const search = async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/bridging/referensi/poli/${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gagal mencari referensi poli'); setResults([]); return; }
      setResults(extractRefList(data.data));
      setOpen(true);
    } catch {
      setError('Gagal menghubungi server');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    const t = setTimeout(() => { if (query) search(query); }, 400);
    return () => clearTimeout(t);
  }, [query]);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {value && (
        <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, background: '#dcfce7', color: '#16a34a', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
            {value}
          </span>
          <span style={{ fontSize: 10, color: '#6b7280', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {display}
          </span>
          <button onClick={() => onChange('', '')}
            style={{ border: 'none', background: 'none', color: '#dc2626', fontSize: 12, cursor: 'pointer', padding: '0 2px' }}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={value ? 'Cari ulang...' : 'Cari nama/kode poli BPJS...'}
          style={{
            flex: 1, padding: '5px 10px', borderRadius: 7, fontSize: 12,
            border: '1px solid #d1d5db', outline: 'none', minWidth: 180,
          }}
        />
        {loading && <span style={{ fontSize: 11, color: '#9ca3af', alignSelf: 'center' }}>⏳</span>}
      </div>

      {error && <div style={{ fontSize: 10, color: '#dc2626', marginTop: 2 }}>{error}</div>}

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#fff', border: '1px solid #d1d5db', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 260, overflowY: 'auto',
          marginTop: 2,
        }}>
          {results.map((r, i) => (
            <div key={i}
              onClick={() => { onChange(r.kode, r.nama); setQuery(''); setOpen(false); }}
              style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f9ff')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', marginRight: 8 }}>{r.kode}</span>
              <span style={{ fontSize: 12, color: '#111827' }}>{r.nama}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Modal: Tambah/Ganti Mapping Poli ───────────────────────────────────────
// Shell dulu — isi form pencarian & pemilihan Poli RS/Poli BPJS (padanan
// btnPoliRS/btnPoliBPJS di BPJSMapingPoli.java) dikembangkan di langkah
// berikutnya. Untuk sekarang modal cuma menampilkan konteks baris yang
// diedit (mode Ganti) atau placeholder kosong (mode Tambah), lalu ditutup.

function MappingPoliModal({ row, onClose }: {
  row: MappingPoliRow | null; // null = mode Tambah, terisi = mode Ganti
  onClose: () => void;
}) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
    >
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, boxShadow: '0 20px 48px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#111827' }}>
            {row ? '✏️ Ganti Mapping Poli' : '➕ Tambah Mapping Poli'}
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', padding: '0 4px', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {row && (
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 10, color: '#0284c7', fontWeight: 600, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Poli RS
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0c4a6e' }}>{row.nm_poli}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Kode: <strong>{row.kd_poli}</strong></div>
            </div>
          )}
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12, background: '#f9fafb', borderRadius: 8 }}>
            🚧 Form pencarian &amp; pemilihan Poli RS / Poli BPJS akan dikembangkan pada langkah berikutnya.
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mapping Poli VCLAIM ────────────────────────────────────────────────────
// Padanan tampil() di BPJSMapingPoli.java: tabel read-only 4 kolom (Kode
// Unit RS, Nama Unit RS, Kode Unit BPJS, Nama Unit BPJS) yang cuma
// menampilkan poli yang SUDAH punya mapping. Tombol Tambah (pojok kanan
// atas) & Ganti per baris membuka modal yang sama, padanan BtnSimpan/BtnEdit.

type MappingPoliRow = { kd_poli: string; nm_poli: string; kd_poli_bpjs: string; nm_poli_bpjs: string };

function MappingPoliBpjs() {
  const [list, setList] = React.useState<MappingPoliRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [keyword, setKeyword] = React.useState('');
  const [modalRow, setModalRow] = React.useState<MappingPoliRow | null | undefined>(undefined); // undefined = tertutup

  const fetchList = async (q = '') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bpjs/mapping-poli?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setList(data.list || []);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { fetchList(); }, []);

  const handleDelete = async (row: MappingPoliRow) => {
    if (!confirm(`Hapus mapping poli ${row.nm_poli} (${row.kd_poli})?`)) return;
    await fetch(`/api/bpjs/mapping-poli/${encodeURIComponent(row.kd_poli)}`, { method: 'DELETE' });
    fetchList(keyword);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Toolbar: Search (kiri) + Tambah (kanan atas) */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchList(keyword)}
            placeholder="Cari nama/kode unit RS atau BPJS..."
            style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12, width: 260 }} />
          <button onClick={() => fetchList(keyword)} disabled={loading}
            style={{ padding: '5px 14px', borderRadius: 7, border: 'none', background: '#64748b', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
            {loading ? '⏳' : 'Cari'}
          </button>
        </div>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{list.length} record</span>

        <button
          onClick={() => setModalRow(null)}
          style={{
            marginLeft: 'auto', padding: '6px 16px', borderRadius: 7, border: 'none',
            background: '#2563eb', color: '#fff', fontSize: 12,
            cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Tambah
        </button>
      </div>

      {/* Table — read-only, padanan tabMode Java (4 kolom, isCellEditable false) */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
              <tr>
                <th style={TH}>Kode Unit RS</th>
                <th style={TH}>Nama Unit RS</th>
                <th style={TH}>Kode Unit BPJS</th>
                <th style={TH}>Nama Unit BPJS</th>
                <th style={TH}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Belum ada mapping poli — klik Tambah untuk membuat mapping baru</td></tr>
              ) : list.map((row) => (
                <tr key={row.kd_poli}>
                  <td style={{ ...TD, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{row.kd_poli}</td>
                  <td style={{ ...TD, color: '#111827' }}>{row.nm_poli}</td>
                  <td style={{ ...TD, fontFamily: 'monospace', color: '#2563eb', whiteSpace: 'nowrap' }}>{row.kd_poli_bpjs}</td>
                  <td style={{ ...TD, color: '#111827' }}>{row.nm_poli_bpjs}</td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => setModalRow(row)}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #2563eb', background: '#fff', color: '#2563eb', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
                        Ganti
                      </button>
                      <button onClick={() => handleDelete(row)}
                        style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', fontSize: 11, cursor: 'pointer' }}>
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {modalRow !== undefined && (
        <MappingPoliModal row={modalRow} onClose={() => { setModalRow(undefined); fetchList(keyword); }} />
      )}
    </div>
  );
}

// ─── Modal: Cari Referensi Dokter DPJP BPJS ────────────────────────────────
// Beda dari referensi poli (bisa dicari langsung pakai kata kunci),
// referensi dokter DPJP VClaim mengharuskan Tanggal Pelayanan + Kode
// Spesialis (dan Jenis Pelayanan Rawat Inap/Rawat Jalan) — padanan
// BPJSCekReferensiDokterDPJP.java: endpoint
// referensi/dokter/pelayanan/{1|2}/tglPelayanan/{tgl}/Spesialis/{kode}.
// Kode Spesialis dipilih dari referensi/spesialistik (dimuat sekali, difilter
// di sisi browser).
// Belum dipakai — disiapkan untuk dipanggil dari dalam MappingDokterModal
// saat modal Tambah/Ganti dikembangkan lebih lanjut.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function BpjsDpjpSearchModal({ onClose, onSelect }: {
  onClose: () => void;
  onSelect: (kode: string, nama: string) => void;
}) {
  const [spesialisList, setSpesialisList] = React.useState<RefItem[]>([]);
  const [loadingSpesialis, setLoadingSpesialis] = React.useState(false);
  const [spesialisSearch, setSpesialisSearch] = React.useState('');
  const [spesialis, setSpesialis] = React.useState<RefItem | null>(null);
  const [showSpesialisDropdown, setShowSpesialisDropdown] = React.useState(false);

  const [jenisPelayanan, setJenisPelayanan] = React.useState<'1' | '2'>('2'); // default: Rawat Jalan
  const [tanggal, setTanggal] = React.useState(localDateStr());

  const [results, setResults] = React.useState<RefItem[]>([]);
  const [loadingResults, setLoadingResults] = React.useState(false);
  const [error, setError] = React.useState('');
  const [searched, setSearched] = React.useState(false);

  React.useEffect(() => {
    setLoadingSpesialis(true);
    fetch('/api/bridging/referensi/spesialistik')
      .then((res) => res.json())
      .then((data) => setSpesialisList(extractRefList(data.data)))
      .catch(() => setSpesialisList([]))
      .finally(() => setLoadingSpesialis(false));
  }, []);

  const filteredSpesialis = spesialisSearch.trim()
    ? spesialisList.filter((s) => s.nama.toLowerCase().includes(spesialisSearch.trim().toLowerCase()) || s.kode.includes(spesialisSearch.trim()))
    : spesialisList;

  const handleCari = async () => {
    if (!spesialis || !tanggal) return;
    setLoadingResults(true);
    setError('');
    setSearched(true);
    try {
      const res = await fetch(`/api/bridging/referensi/dokter/pelayanan/${jenisPelayanan}/tglPelayanan/${tanggal}/Spesialis/${encodeURIComponent(spesialis.kode)}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gagal mencari referensi dokter'); setResults([]); return; }
      setResults(extractRefList(data.data));
    } catch {
      setError('Gagal menghubungi server');
    } finally {
      setLoadingResults(false);
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
    >
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560, boxShadow: '0 20px 48px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#111827' }}>🔎 Cari Referensi Dokter DPJP BPJS</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', padding: '0 4px', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Spesialis / Subspesialis *</div>
            <div style={{ position: 'relative' }}>
              <input
                value={spesialis ? `${spesialis.kode} — ${spesialis.nama}` : spesialisSearch}
                onChange={(e) => { setSpesialis(null); setSpesialisSearch(e.target.value); setShowSpesialisDropdown(true); }}
                onFocus={() => setShowSpesialisDropdown(true)}
                onBlur={() => setTimeout(() => setShowSpesialisDropdown(false), 200)}
                placeholder={loadingSpesialis ? 'Memuat daftar spesialis...' : 'Cari nama spesialis...'}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
              />
              {showSpesialisDropdown && filteredSpesialis.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto', marginTop: 2 }}>
                  {filteredSpesialis.map((s, i) => (
                    <div key={i}
                      onClick={() => { setSpesialis(s); setSpesialisSearch(''); setShowSpesialisDropdown(false); }}
                      style={{ padding: '7px 10px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #f3f4f6' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f9ff')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      <span style={{ fontWeight: 700, color: '#2563eb', marginRight: 6 }}>{s.kode}</span>{s.nama}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Tanggal Pelayanan *</div>
              <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Jenis Pelayanan</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {([{ v: '2', l: 'Rawat Jalan' }, { v: '1', l: 'Rawat Inap' }] as const).map((o) => (
                  <button key={o.v} onClick={() => setJenisPelayanan(o.v)} style={{
                    flex: 1, padding: '7px 6px', borderRadius: 7, fontSize: 11, cursor: 'pointer',
                    border: jenisPelayanan === o.v ? '1px solid #2563eb' : '1px solid #d1d5db',
                    background: jenisPelayanan === o.v ? '#eff6ff' : '#fff',
                    color: jenisPelayanan === o.v ? '#2563eb' : '#374151',
                    fontWeight: jenisPelayanan === o.v ? 600 : 400,
                  }}>{o.l}</button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleCari}
            disabled={!spesialis || !tanggal || loadingResults}
            style={{
              padding: '8px 16px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 600,
              cursor: spesialis && tanggal ? 'pointer' : 'not-allowed',
              background: spesialis && tanggal ? '#2563eb' : '#e5e7eb',
              color: spesialis && tanggal ? '#fff' : '#9ca3af',
            }}
          >
            {loadingResults ? 'Mencari...' : 'Cari Dokter'}
          </button>

          {error && <div style={{ fontSize: 11, color: '#dc2626' }}>{error}</div>}

          {searched && !loadingResults && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, maxHeight: 220, overflowY: 'auto' }}>
              {results.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Tidak ada dokter ditemukan untuk kombinasi ini</div>
              ) : results.map((r, i) => (
                <div key={i}
                  onClick={() => onSelect(r.kode, r.nama)}
                  style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: i < results.length - 1 ? '1px solid #f3f4f6' : 'none' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f9ff')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', marginRight: 8 }}>{r.kode}</span>
                  <span style={{ fontSize: 12, color: '#111827' }}>{r.nama}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Tambah/Ganti Mapping Dokter DPJP ───────────────────────────────
// Shell dulu — sama seperti MappingPoliModal. Form pencarian &amp; pemilihan
// DPJP BPJS (BpjsDpjpSearchModal di atas sudah punya logikanya, tinggal
// dipanggil dari sini) dikembangkan di langkah berikutnya.

function MappingDokterModal({ row, onClose }: {
  row: MappingDokterRow | null; // null = mode Tambah, terisi = mode Ganti
  onClose: () => void;
}) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
    >
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, boxShadow: '0 20px 48px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#111827' }}>
            {row ? '✏️ Ganti Mapping Dokter DPJP' : '➕ Tambah Mapping Dokter DPJP'}
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', padding: '0 4px', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {row && (
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 10, color: '#0284c7', fontWeight: 600, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Dokter RS
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0c4a6e' }}>{row.nm_dokter}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Kode: <strong>{row.kd_dokter}</strong></div>
            </div>
          )}
          <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 12, background: '#f9fafb', borderRadius: 8 }}>
            🚧 Form pemilihan Dokter RS / DPJP BPJS akan dikembangkan pada langkah berikutnya.
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mapping Dokter DPJP VCLAIM ─────────────────────────────────────────────
// Padanan tampil() di BPJSMapingDokterDPJP.java: tabel read-only 4 kolom
// (Kode Dokter RS, Nama Dokter RS, Kode DPJP VClaim, Nama Dokter DPJP
// VClaim) yang cuma menampilkan dokter yang SUDAH punya mapping. Tombol
// Tambah (pojok kanan atas) & Ganti per baris membuka modal yang sama.

type MappingDokterRow = { kd_dokter: string; nm_dokter: string; kd_dokter_bpjs: string; nm_dokter_bpjs: string };

function MappingDokterBpjs() {
  const [list, setList] = React.useState<MappingDokterRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [keyword, setKeyword] = React.useState('');
  const [modalRow, setModalRow] = React.useState<MappingDokterRow | null | undefined>(undefined); // undefined = tertutup

  const fetchList = async (q = '') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bpjs/mapping-dokter?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setList(data.list || []);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { fetchList(); }, []);

  const handleDelete = async (row: MappingDokterRow) => {
    if (!confirm(`Hapus mapping DPJP untuk dokter ${row.nm_dokter} (${row.kd_dokter})?`)) return;
    await fetch(`/api/bpjs/mapping-dokter/${encodeURIComponent(row.kd_dokter)}`, { method: 'DELETE' });
    fetchList(keyword);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Toolbar: Search (kiri) + Tambah (kanan atas) */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchList(keyword)}
            placeholder="Cari nama/kode dokter atau DPJP BPJS..."
            style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12, width: 260 }} />
          <button onClick={() => fetchList(keyword)} disabled={loading}
            style={{ padding: '5px 14px', borderRadius: 7, border: 'none', background: '#64748b', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
            {loading ? '⏳' : 'Cari'}
          </button>
        </div>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{list.length} record</span>

        <button
          onClick={() => setModalRow(null)}
          style={{
            marginLeft: 'auto', padding: '6px 16px', borderRadius: 7, border: 'none',
            background: '#2563eb', color: '#fff', fontSize: 12,
            cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Tambah
        </button>
      </div>

      {/* Table — read-only, padanan tabMode Java (4 kolom, isCellEditable false) */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
              <tr>
                <th style={TH}>Kode Dokter RS</th>
                <th style={TH}>Nama Dokter RS</th>
                <th style={TH}>Kode DPJP VClaim</th>
                <th style={TH}>Nama Dokter DPJP VClaim</th>
                <th style={TH}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Belum ada mapping dokter — klik Tambah untuk membuat mapping baru</td></tr>
              ) : list.map((row) => (
                <tr key={row.kd_dokter}>
                  <td style={{ ...TD, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{row.kd_dokter}</td>
                  <td style={{ ...TD, color: '#111827' }}>{row.nm_dokter}</td>
                  <td style={{ ...TD, fontFamily: 'monospace', color: '#2563eb', whiteSpace: 'nowrap' }}>{row.kd_dokter_bpjs}</td>
                  <td style={{ ...TD, color: '#111827' }}>{row.nm_dokter_bpjs}</td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => setModalRow(row)}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #2563eb', background: '#fff', color: '#2563eb', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
                        Ganti
                      </button>
                      <button onClick={() => handleDelete(row)}
                        style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', fontSize: 11, cursor: 'pointer' }}>
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {modalRow !== undefined && (
        <MappingDokterModal row={modalRow} onClose={() => { setModalRow(undefined); fetchList(keyword); }} />
      )}
    </div>
  );
}

// ─── Shell Pengaturan BPJS (2 sub-menu) ─────────────────────────────────────

export const BpjsPengaturanView: React.FC = () => {
  const [active, setActive] = React.useState<SettingKey>('mapping-poli');
  const activeItem = SETTING_LIST.find((s) => s.key === active)!;

  return (
    <div style={{ display: 'flex', gap: 20, height: '100%', minHeight: 0 }}>
      <nav style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
        {SETTING_LIST.map((item) => {
          const isActive = item.key === active;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActive(item.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 12px', borderRadius: 8, border: 'none',
                background: isActive ? '#eff6ff' : 'transparent',
                color: isActive ? '#2563eb' : '#374151',
                fontWeight: isActive ? 600 : 400,
                fontSize: 12.5, cursor: 'pointer', textAlign: 'left',
              }}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 16 }}>{activeItem.label}</div>
        {activeItem.key === 'mapping-poli' ? <MappingPoliBpjs /> : <MappingDokterBpjs />}
      </div>
    </div>
  );
};

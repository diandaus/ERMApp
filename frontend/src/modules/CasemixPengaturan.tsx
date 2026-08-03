import React from 'react';
import { ModalCariDokter } from '../components/ModalCariDokter';

// ============================================================================
// PENGATURAN CASEMIX — "Jasa Medis" (master nama & PERSENTASE jasa medis,
// bukan nominal tetap — persentase ini dikalikan ke nilai klaim_inacbg
// pasien utk menghitung kolom "Jasa Medis" di Monitoring Biaya Klaim BPJS,
// KlaimInacbg.tsx) dan "Preview Billing" (toggle per kategori biaya —
// Registrasi/Kamar Inap/Pemeriksaan Lab/Radiologi/Obat & BHP + kategori
// dinamis dari kategori_perawatan — supaya user bisa menyembunyikan
// kategori tertentu, mis. Prosedur Bedah, dari PreviewBilling.tsx tanpa
// harus dihapus datanya; lihat preview_billing_pengaturan_handler.go &
// computeBillingPreview di biaya_handler.go). Struktur nav+content
// mengikuti pola BpjsPengaturanView (BpjsPengaturan.tsx) supaya gampang
// menambah menu pengaturan Casemix lain di kemudian hari.
// ============================================================================

type SettingKey = 'jasa-medis' | 'preview-billing';

const SETTING_LIST: { key: SettingKey; label: string }[] = [
  { key: 'jasa-medis', label: 'Jasa Medis' },
  { key: 'preview-billing', label: 'Preview Billing' },
];

// Toggle switch pill kecil — dipakai PreviewBillingSetting utk tiap baris
// kategori (Tampil/Sembunyikan), lebih ringkas drpd checkbox biasa krn
// daftarnya bisa panjang (kategori dinamis dari kategori_perawatan).
const Switch: React.FC<{ checked: boolean; onChange: () => void; disabled?: boolean }> = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    onClick={onChange}
    disabled={disabled}
    role="switch"
    aria-checked={checked}
    style={{
      width: 38, height: 22, borderRadius: 999, border: 'none',
      background: checked ? '#2563eb' : '#d1d5db',
      position: 'relative', cursor: disabled ? 'default' : 'pointer',
      flexShrink: 0, padding: 0, opacity: disabled ? 0.6 : 1,
      transition: 'background 0.15s ease',
    }}
  >
    <span
      style={{
        position: 'absolute', top: 2, left: checked ? 18 : 2,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.25)', transition: 'left 0.15s ease',
      }}
    />
  </button>
);

const TH: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left', fontSize: 11,
  fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb',
  whiteSpace: 'nowrap', background: '#f9fafb',
};

const TD: React.CSSProperties = {
  padding: '8px 12px', fontSize: 12, borderBottom: '1px solid #f3f4f6',
  verticalAlign: 'middle',
};

// ─── Modal: Tambah/Ubah Jasa Medis ─────────────────────────────────────────

type JasaMedisRow = { id: number; nama_jasa: string; persentase: number; kd_dokter: string; nm_dokter: string };

function JasaMedisModal({ row, onClose }: {
  row: JasaMedisRow | null; // null = mode Tambah, terisi = mode Ubah
  onClose: () => void;
}) {
  const [namaJasa, setNamaJasa] = React.useState(row?.nama_jasa || '');
  const [persentase, setPersentase] = React.useState(row ? String(row.persentase) : '');
  const [kdDokter, setKdDokter] = React.useState(row?.kd_dokter || '');
  const [nmDokter, setNmDokter] = React.useState(row?.nm_dokter || '');
  const [showCariDokter, setShowCariDokter] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSimpan = async () => {
    if (!namaJasa.trim()) {
      setError('Nama jasa wajib diisi');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        nama_jasa: namaJasa.trim(),
        persentase: parseFloat(persentase.replace(/[^0-9.-]/g, '')) || 0,
        kd_dokter: kdDokter,
      };
      const res = await fetch(row ? `/api/jasa-medis/${row.id}` : '/api/jasa-medis', {
        method: row ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Gagal menyimpan jasa medis');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
    >
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 420, boxShadow: '0 20px 48px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#111827' }}>
            {row ? 'Ubah Jasa Medis' : 'Tambah Jasa Medis'}
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', padding: '0 4px', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Nama Jasa</div>
            <input
              value={namaJasa}
              onChange={(e) => setNamaJasa(e.target.value)}
              autoFocus
              style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Persentase</div>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                value={persentase}
                onChange={(e) => setPersentase(e.target.value)}
                placeholder="0"
                min={0}
                max={100}
                step={0.1}
                style={{ width: '100%', padding: '8px 28px 8px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9ca3af', pointerEvents: 'none' }}>%</span>
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Persentase dari nilai Klaim INACBG per pasien</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}>DPJP</div>
            {kdDokter ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 7, border: '1px solid #d1d5db', background: '#f9fafb' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nmDokter}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>Kode: {kdDokter}</div>
                </div>
                <button onClick={() => { setKdDokter(''); setNmDokter(''); }}
                  style={{ border: 'none', background: 'none', color: '#dc2626', fontSize: 12, cursor: 'pointer', padding: '0 2px' }}>✕</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCariDokter(true)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px dashed #d1d5db', background: '#fff', color: '#6b7280', fontSize: 12.5, cursor: 'pointer', textAlign: 'left' }}
              >
                + Pilih DPJP...
              </button>
            )}
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Kosongkan jika berlaku untuk semua DPJP</div>
          </div>
          {error && <div style={{ fontSize: 12, color: '#dc2626' }}>{error}</div>}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 4, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
            Batal
          </button>
          <button
            onClick={handleSimpan}
            disabled={saving}
            style={{ padding: '7px 16px', borderRadius: 4, border: 'none', background: '#2563eb', color: '#fff', fontSize: 12, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>

      <ModalCariDokter
        isOpen={showCariDokter}
        onClose={() => setShowCariDokter(false)}
        onSelect={(kode, nama) => { setKdDokter(kode); setNmDokter(nama); setShowCariDokter(false); }}
      />
    </div>
  );
}

// ─── Jasa Medis — master nama & tarif jasa medis ───────────────────────────

function JasaMedisSetting() {
  const [list, setList] = React.useState<JasaMedisRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [keyword, setKeyword] = React.useState('');
  const [modalRow, setModalRow] = React.useState<JasaMedisRow | null | undefined>(undefined); // undefined = tertutup

  const fetchList = async (q = '') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/jasa-medis?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { fetchList(); }, []);

  const handleDelete = async (row: JasaMedisRow) => {
    if (!confirm(`Hapus jasa medis "${row.nama_jasa}"?`)) return;
    await fetch(`/api/jasa-medis/${row.id}`, { method: 'DELETE' });
    fetchList(keyword);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchList(keyword)}
            placeholder="Cari nama jasa..."
            style={{ padding: '5px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, width: 220 }} />
          <button onClick={() => fetchList(keyword)} disabled={loading}
            style={{ padding: '5px 14px', borderRadius: 4, border: 'none', background: '#64748b', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
            {loading ? '...' : 'Cari'}
          </button>
        </div>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{list.length} record</span>

        <button
          onClick={() => setModalRow(null)}
          style={{
            marginLeft: 'auto', padding: '6px 16px', borderRadius: 4, border: 'none',
            background: '#2563eb', color: '#fff', fontSize: 12,
            cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Tambah
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
              <tr>
                <th style={TH}>Nama Jasa</th>
                <th style={{ ...TH, textAlign: 'right' }}>Persentase</th>
                <th style={TH}>DPJP</th>
                <th style={TH}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Belum ada jasa medis — klik Tambah untuk menambah data baru</td></tr>
              ) : list.map((row) => (
                <tr key={row.id}>
                  <td style={{ ...TD, color: '#111827' }}>{row.nama_jasa}</td>
                  <td style={{ ...TD, textAlign: 'right', color: '#374151' }}>{row.persentase}%</td>
                  <td style={{ ...TD, color: row.kd_dokter ? '#111827' : '#9ca3af' }}>{row.kd_dokter ? row.nm_dokter : 'Semua DPJP'}</td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => setModalRow(row)}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #2563eb', background: '#fff', color: '#2563eb', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
                        Ubah
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
        <JasaMedisModal row={modalRow} onClose={() => { setModalRow(undefined); fetchList(keyword); }} />
      )}
    </div>
  );
}

// ─── Preview Billing — toggle tampil/sembunyikan per kategori biaya ────────

type PreviewBillingKategori = { kategori: string; tampil: boolean };

// Preview Billing punya 2 sub-tab: "Kategori Biaya" (toggle tampil/
// sembunyikan per kategori, sudah ada) dan "Set Preview Obat" (basis harga
// obat di section Obat & BHP — harga jual/modal, baru).
type PreviewBillingSubTab = 'kategori' | 'set-preview-obat';

const PREVIEW_BILLING_SUB_TABS: { key: PreviewBillingSubTab; label: string }[] = [
  { key: 'kategori', label: 'Kategori Biaya' },
  { key: 'set-preview-obat', label: 'Set Preview Obat' },
];

function KategoriBiayaSetting() {
  const [list, setList] = React.useState<PreviewBillingKategori[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [savingKategori, setSavingKategori] = React.useState<string | null>(null);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/preview-billing-pengaturan');
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { fetchList(); }, []);

  const handleToggle = async (row: PreviewBillingKategori) => {
    const nextTampil = !row.tampil;
    setSavingKategori(row.kategori);
    // Optimistic update — biar switch langsung responsif, dibalik lagi kalau gagal.
    setList((prev) => prev.map((r) => (r.kategori === row.kategori ? { ...r, tampil: nextTampil } : r)));
    try {
      const res = await fetch(`/api/preview-billing-pengaturan/${encodeURIComponent(row.kategori)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tampil: nextTampil }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setList((prev) => prev.map((r) => (r.kategori === row.kategori ? { ...r, tampil: row.tampil } : r)));
    } finally {
      setSavingKategori(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 12, color: '#6b7280' }}>
        Kategori yang di-nonaktifkan tidak akan ditampilkan sama sekali di Preview Billing (mis. Prosedur Bedah), tanpa perlu menghapus datanya.
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
              <tr>
                <th style={TH}>Kategori Biaya</th>
                <th style={{ ...TH, textAlign: 'right' }}>Tampil</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={2} style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={2} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Tidak ada kategori biaya</td></tr>
              ) : list.map((row) => (
                <tr key={row.kategori}>
                  <td style={{ ...TD, color: row.tampil ? '#111827' : '#9ca3af' }}>{row.kategori}</td>
                  <td style={{ ...TD, textAlign: 'right' }}>
                    <Switch checked={row.tampil} onChange={() => handleToggle(row)} disabled={savingKategori === row.kategori} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Set Preview Obat — basis harga obat di section Obat & BHP ─────────────

type ObatMode = 'jual' | 'modal';

const OBAT_MODE_OPTIONS: { key: ObatMode; label: string; desc: string }[] = [
  { key: 'jual', label: 'Harga Jual', desc: 'Harga yang ditagihkan ke pasien (detail_pemberian_obat.biaya_obat) — bawaan.' },
  { key: 'modal', label: 'Harga Modal', desc: 'Harga beli/modal apotek (h_beli), tanpa embalase/tuslah.' },
];

function SetPreviewObatSetting() {
  const [mode, setMode] = React.useState<ObatMode>('jual');
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    fetch('/api/preview-obat-pengaturan')
      .then((res) => res.json())
      .then((data) => setMode(data?.mode === 'modal' ? 'modal' : 'jual'))
      .finally(() => setLoading(false));
  }, []);

  const handlePilih = async (next: ObatMode) => {
    if (next === mode || saving) return;
    const prev = mode;
    setMode(next); // optimistic
    setSaving(true);
    try {
      const res = await fetch('/api/preview-obat-pengaturan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setMode(prev);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 12, color: '#6b7280' }}>
        Pilih basis harga obat yang ditampilkan pada bagian "Obat & BHP" di Preview Billing.
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 12 }}>Memuat data...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {OBAT_MODE_OPTIONS.map((opt) => {
            const active = mode === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => handlePilih(opt.key)}
                disabled={saving}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left',
                  padding: '12px 14px', borderRadius: 10,
                  border: active ? '1px solid #2563eb' : '1px solid #e5e7eb',
                  background: active ? '#eff6ff' : '#ffffff',
                  cursor: saving ? 'default' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                <span
                  style={{
                    width: 16, height: 16, borderRadius: '50%', marginTop: 2, flexShrink: 0,
                    border: active ? '5px solid #2563eb' : '1px solid #9ca3af',
                    background: '#ffffff', boxSizing: 'border-box',
                  }}
                />
                <span>
                  <div style={{ fontSize: 13, fontWeight: 600, color: active ? '#1d4ed8' : '#111827' }}>{opt.label}</div>
                  <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 2 }}>{opt.desc}</div>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PreviewBillingSetting() {
  const [subTab, setSubTab] = React.useState<PreviewBillingSubTab>('kategori');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #e5e7eb' }}>
        {PREVIEW_BILLING_SUB_TABS.map((tab) => {
          const active = subTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSubTab(tab.key)}
              style={{
                padding: '8px 12px', border: 'none', background: 'transparent',
                borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
                color: active ? '#2563eb' : '#6b7280',
                fontWeight: active ? 600 : 400, fontSize: 12.5, cursor: 'pointer',
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {subTab === 'kategori' && <KategoriBiayaSetting />}
      {subTab === 'set-preview-obat' && <SetPreviewObatSetting />}
    </div>
  );
}

// ─── Shell Pengaturan Casemix ───────────────────────────────────────────────

export const CasemixPengaturanView: React.FC = () => {
  const [active, setActive] = React.useState<SettingKey>('jasa-medis');
  const activeItem = SETTING_LIST.find((s) => s.key === active)!;

  return (
    <div style={{ display: 'flex', gap: 20, height: '100%', minHeight: 0 }}>
      <nav style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
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
        {activeItem.key === 'jasa-medis' && <JasaMedisSetting />}
        {activeItem.key === 'preview-billing' && <PreviewBillingSetting />}
      </div>
    </div>
  );
};

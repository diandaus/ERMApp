import React from 'react';
import Swal from 'sweetalert2';

// ============================================================================
// APOTEK — Darurat Stok (tab utama modul Apotek). Cocok dengan dialog
// Khanza Desktop inventory/DlgDaruratStok.java — laporan READ-ONLY murni
// (tidak ada tombol Simpan/Hapus di Java, cuma Cari/Cetak) atas barang yang
// stok live-nya sudah turun ke titik/di bawah `databarang.stokminimal`.
// Lihat backend/apotek_darurat_stok_handler.go untuk detail replikasi
// query Java (termasuk kuirk stokminimal NULL diperlakukan sebagai 0).
//
// Sama seperti Riwayat Obat: TIDAK auto-load saat dibuka (replikasi Java —
// tabel kosong sampai user cari), wajib klik "Cari" dulu.
// ============================================================================

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 14px',
  borderRadius: 4,
  border: '1px solid #d1d5db',
  fontSize: 13,
  boxSizing: 'border-box',
  outline: 'none',
};

type DaruratStokRow = {
  kode_brng: string;
  nama_brng: string;
  satuan: string;
  jenis: string;
  stok_minimal: number;
  stok_saat_ini: number;
};

export const ApotekDaruratStokView: React.FC = () => {
  const [searchText, setSearchText] = React.useState('');
  const [items, setItems] = React.useState<DaruratStokRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [editValues, setEditValues] = React.useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = React.useState<Set<string>>(new Set());

  // Stok Minimal — TIDAK read-only lagi (beda dari Java, lihat catatan
  // updateStokMinimal di backend/apotek_darurat_stok_handler.go), diedit
  // inline & auto-save saat blur kalau nilainya berubah, supaya staf bisa
  // langsung koreksi ambang darurat dari laporan yang sama tanpa pindah
  // ke modul Data Barang.
  const handleSaveStokMinimal = async (item: DaruratStokRow, rawValue: string) => {
    const newValue = Number(rawValue);
    if (rawValue.trim() === '' || isNaN(newValue) || newValue < 0 || newValue === item.stok_minimal) {
      setEditValues((prev) => {
        const next = { ...prev };
        delete next[item.kode_brng];
        return next;
      });
      return;
    }
    setSavingKeys((prev) => new Set(prev).add(item.kode_brng));
    try {
      const res = await fetch(`/api/apotek/darurat-stok/${encodeURIComponent(item.kode_brng)}/stok-minimal`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stok_minimal: newValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
      setItems((prev) => prev.map((r) => (r.kode_brng === item.kode_brng ? { ...r, stok_minimal: newValue } : r)));
      setEditValues((prev) => {
        const next = { ...prev };
        delete next[item.kode_brng];
        return next;
      });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal menyimpan', text: err.message });
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(item.kode_brng);
        return next;
      });
    }
  };

  const fetchDaruratStok = React.useCallback(async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      const url = `/api/apotek/darurat-stok${searchText ? `?search=${encodeURIComponent(searchText)}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [searchText]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ minWidth: 260, flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Cari</label>
          <input
            style={inputStyle}
            placeholder="Kode / Nama Barang / Jenis... (kosongkan untuk semua)"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') fetchDaruratStok(); }}
          />
        </div>
        <button
          type="button"
          onClick={fetchDaruratStok}
          disabled={loading}
          style={{
            padding: '7px 20px',
            borderRadius: 4,
            border: 'none',
            background: loading ? '#9ca3af' : '#059669',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? 'Memuat...' : 'Cari'}
        </button>
        <span style={{ fontSize: 12, color: '#6b7280', paddingBottom: 8, whiteSpace: 'nowrap' }}>{hasSearched ? `${items.length} barang di bawah stok minimal` : ''}</span>
      </div>

      <div style={{ borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'auto', flex: 1, minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
            <tr>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Kode Barang</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Barang</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Satuan</th>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Jenis</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Stok Minimal</th>
              <th style={{ padding: 8, textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Stok Saat Ini</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Memuat data...</td></tr>
            ) : !hasSearched ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>Klik "Cari" untuk menampilkan barang yang stoknya sudah di bawah minimal</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#059669' }}>Aman — tidak ada barang di bawah stok minimal</td></tr>
            ) : (
              items.map((item, index) => {
                const kritis = item.stok_saat_ini <= 0;
                return (
                  <tr key={item.kode_brng} style={{ background: kritis ? '#fef2f2' : index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.kode_brng}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#111827', fontWeight: 600 }}>{item.nama_brng}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.satuan}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{item.jenis}</td>
                    <td style={{ padding: '4px 6px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                      <input
                        type="number"
                        step="any"
                        min={0}
                        value={editValues[item.kode_brng] ?? String(item.stok_minimal)}
                        onChange={(e) => setEditValues((prev) => ({ ...prev, [item.kode_brng]: e.target.value }))}
                        onBlur={(e) => handleSaveStokMinimal(item, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        disabled={savingKeys.has(item.kode_brng)}
                        style={{ width: 70, padding: '5px 6px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 12, textAlign: 'right', outline: 'none', boxSizing: 'border-box', background: savingKeys.has(item.kode_brng) ? '#f3f4f6' : '#ffffff' }}
                      />
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: kritis ? '#dc2626' : '#d97706', fontWeight: 700 }}>{item.stok_saat_ini}</td>
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

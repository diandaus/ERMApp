import React from 'react';

// ============================================================================
// Picker pasien ringan — padanan DlgCariPasien.java yang dipanggil dari
// BtnMemActionPerformed di inventory/DlgPenjualan.java (tombol di sebelah
// field "Nama Pembeli"/nmmem, buka daftar SEMUA pasien untuk dipilih).
// BEDA dari ModalCariPasien.tsx (yang gabung Cari+Input Registrasi baru,
// dipakai ModalRegistrasi.tsx) — di sini cuma cari & pilih, tidak ada tab
// input pasien baru, karena konteksnya cuma mengisi nama pembeli OTC,
// bukan alur pendaftaran. Reuse endpoint /api/pendaftaran/pasien/list
// yang sama dengan ModalCariPasien.tsx.
// ============================================================================

type PasienRingkas = {
  no_rkm_medis: string;
  nm_pasien: string;
  alamat?: string;
  jk?: string;
};

type ModalCariPasienRingkasProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (pasien: PasienRingkas) => void;
};

export const ModalCariPasienRingkas: React.FC<ModalCariPasienRingkasProps> = ({ open, onClose, onSelect }) => {
  const [searchText, setSearchText] = React.useState('');
  const [items, setItems] = React.useState<PasienRingkas[]>([]);
  const [loading, setLoading] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pendaftaran/pasien/list?search=${encodeURIComponent(searchText)}&limit=100`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [searchText]);

  React.useEffect(() => {
    if (!open) return;
    setSearchText('');
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, searchText]);

  if (!open) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#ffffff', borderRadius: 16, padding: 24, width: 620, maxWidth: '94vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Cari Pasien</div>
        <input
          autoFocus
          type="text"
          placeholder="No. RM / Nama Pasien..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
        />
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#f3f4f6', zIndex: 1 }}>
              <tr>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>No. RM</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Nama Pasien</th>
                <th style={{ padding: 8, textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Alamat</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Memuat...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>Tidak ada pasien ditemukan</td></tr>
              ) : (
                items.map((p, index) => (
                  <tr
                    key={p.no_rkm_medis}
                    onClick={() => {
                      onSelect(p);
                      onClose();
                    }}
                    style={{ background: index % 2 === 0 ? '#ffffff' : '#f9fafb', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{p.no_rkm_medis}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>{p.nm_pasien}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>{p.alamat || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

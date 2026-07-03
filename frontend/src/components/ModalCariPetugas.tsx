import React from 'react';

type Petugas = {
  nip: string;
  nama: string;
};

interface ModalCariPetugasProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (nip: string, nama: string) => void;
}

export const ModalCariPetugas: React.FC<ModalCariPetugasProps> = ({ isOpen, onClose, onSelect }) => {
  const [petugasList, setPetugasList] = React.useState<Petugas[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const fetchPetugas = React.useCallback(async () => {
    setLoading(true);
    try {
      const url = search
        ? `/api/petugas?search=${encodeURIComponent(search)}`
        : '/api/petugas';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Gagal mengambil data petugas');
      const data: Petugas[] = await res.json();
      setPetugasList(data);
    } catch (e) {
      console.error('Error fetching petugas:', e);
      setPetugasList([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    if (isOpen) fetchPetugas();
  }, [isOpen, fetchPetugas]);

  React.useEffect(() => {
    if (!isOpen) setSearch('');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#F3F4F6',
          borderRadius: 20,
          padding: '35px 8px 8px 8px',
          position: 'relative',
          width: '90%',
          maxWidth: 600,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          padding: '12px 20px',
          color: '#000000',
          fontSize: 13,
          fontWeight: 400,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>Pilih Petugas</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none', border: 'none', fontSize: 20,
              cursor: 'pointer', color: '#6b7280', padding: 0,
              width: 24, height: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {/* White Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: 16,
          border: '1px solid #d1d5db',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden'
        }}>
          {/* Search */}
          <div style={{ paddingBottom: 12 }}>
            <input
              type="text"
              autoFocus
              placeholder="Cari petugas (NIP atau nama)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 12,
                border: '1px solid #d1d5db',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                Memuat data petugas...
              </div>
            ) : petugasList.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                Tidak ada petugas ditemukan
              </div>
            ) : (
              petugasList.map((p) => (
                <div
                  key={p.nip}
                  onClick={() => { onSelect(p.nip, p.nama); onClose(); }}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f3f4f6',
                    borderRadius: 8,
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                    {p.nama}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    NIP: {p.nip}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

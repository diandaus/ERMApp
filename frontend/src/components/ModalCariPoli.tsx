import React from 'react';

type Poli = {
  kd_poli: string;
  nm_poli: string;
};

interface ModalCariPoliProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (kode: string, nama: string) => void;
}

export const ModalCariPoli: React.FC<ModalCariPoliProps> = ({ isOpen, onClose, onSelect }) => {
  const [poliList, setPoliList] = React.useState<Poli[]>([]);
  const [searchPoli, setSearchPoli] = React.useState<string>('');
  const [loadingPoli, setLoadingPoli] = React.useState<boolean>(false);

  // Fetch poli from API
  const fetchPoli = React.useCallback(async () => {
    setLoadingPoli(true);
    try {
      const url = searchPoli
        ? `/api/pendaftaran/poli?search=${encodeURIComponent(searchPoli)}`
        : '/api/pendaftaran/poli';
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Gagal mengambil data poli');
      }
      const data: Poli[] = await res.json();
      setPoliList(data);
    } catch (e) {
      console.error('Error fetching poli:', e);
      setPoliList([]);
    } finally {
      setLoadingPoli(false);
    }
  }, [searchPoli]);

  // Load poli when modal opens
  React.useEffect(() => {
    if (isOpen) {
      fetchPoli();
    }
  }, [isOpen, fetchPoli]);

  // Reset search when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setSearchPoli('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
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
        {/* Header Title */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '12px 20px',
          color: '#000000',
          fontSize: 13,
          fontWeight: 400,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>Pilih Unit/Poli</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: '#6b7280',
              padding: 0,
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {/* White Card Content */}
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
          {/* Search Box */}
          <div style={{ padding: '0 0 12px 0' }}>
            <input
              type="text"
              placeholder="Cari poli (kode atau nama)..."
              value={searchPoli}
              onChange={(e) => setSearchPoli(e.target.value)}
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

          {/* List Poli */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingPoli ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                Memuat data poli...
              </div>
            ) : poliList.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                Tidak ada poli ditemukan
              </div>
            ) : (
              poliList.map((poli) => (
                <div
                  key={poli.kd_poli}
                  onClick={() => {
                    onSelect(poli.kd_poli, poli.nm_poli);
                    onClose();
                  }}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f3f4f6',
                    borderRadius: 8,
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f9fafb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#ffffff';
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                    {poli.nm_poli}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Kode: {poli.kd_poli}
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

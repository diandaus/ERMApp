import React from 'react';

type Dokter = {
  kd_dokter: string;
  nm_dokter: string;
};

interface ModalCariDokterProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (kode: string, nama: string) => void;
}

export const ModalCariDokter: React.FC<ModalCariDokterProps> = ({ isOpen, onClose, onSelect }) => {
  const [dokterList, setDokterList] = React.useState<Dokter[]>([]);
  const [searchDokter, setSearchDokter] = React.useState<string>('');
  const [loadingDokter, setLoadingDokter] = React.useState<boolean>(false);

  // Fetch dokter from API
  const fetchDokter = React.useCallback(async () => {
    setLoadingDokter(true);
    try {
      const url = searchDokter
        ? `/api/pendaftaran/dokter?search=${encodeURIComponent(searchDokter)}`
        : '/api/pendaftaran/dokter';
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Gagal mengambil data dokter');
      }
      const data: Dokter[] = await res.json();
      setDokterList(data);
    } catch (e) {
      console.error('Error fetching dokter:', e);
      setDokterList([]);
    } finally {
      setLoadingDokter(false);
    }
  }, [searchDokter]);

  // Load dokter when modal opens
  React.useEffect(() => {
    if (isOpen) {
      fetchDokter();
    }
  }, [isOpen, fetchDokter]);

  // Reset search when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setSearchDokter('');
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
          <span>Pilih Dokter</span>
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
              placeholder="Cari dokter (kode atau nama)..."
              value={searchDokter}
              onChange={(e) => setSearchDokter(e.target.value)}
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

          {/* List Dokter */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingDokter ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                Memuat data dokter...
              </div>
            ) : dokterList.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                Tidak ada dokter ditemukan
              </div>
            ) : (
              dokterList.map((dok) => (
                <div
                  key={dok.kd_dokter}
                  onClick={() => {
                    onSelect(dok.kd_dokter, dok.nm_dokter);
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
                    {dok.nm_dokter}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Kode: {dok.kd_dokter}
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

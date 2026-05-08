import React from 'react';

type CaraBayar = {
  kd_pj: string;
  nm_pj: string;
};

interface ModalCariCaraBayarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (kode: string, nama: string) => void;
}

export const ModalCariCaraBayar: React.FC<ModalCariCaraBayarProps> = ({ isOpen, onClose, onSelect }) => {
  const [caraBayarList, setCaraBayarList] = React.useState<CaraBayar[]>([]);
  const [searchCaraBayar, setSearchCaraBayar] = React.useState<string>('');
  const [loadingCaraBayar, setLoadingCaraBayar] = React.useState<boolean>(false);

  // Fetch cara bayar from API
  const fetchCaraBayar = React.useCallback(async () => {
    setLoadingCaraBayar(true);
    try {
      const url = searchCaraBayar
        ? `/api/pendaftaran/penjab?search=${encodeURIComponent(searchCaraBayar)}`
        : '/api/pendaftaran/penjab';
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Gagal mengambil data cara bayar');
      }
      const data: CaraBayar[] = await res.json();
      setCaraBayarList(data);
    } catch (e) {
      console.error('Error fetching cara bayar:', e);
      setCaraBayarList([]);
    } finally {
      setLoadingCaraBayar(false);
    }
  }, [searchCaraBayar]);

  // Load cara bayar when modal opens
  React.useEffect(() => {
    if (isOpen) {
      fetchCaraBayar();
    }
  }, [isOpen, fetchCaraBayar]);

  // Reset search when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setSearchCaraBayar('');
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
          <span>Pilih Cara Bayar</span>
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
              placeholder="Cari cara bayar (kode atau nama)..."
              value={searchCaraBayar}
              onChange={(e) => setSearchCaraBayar(e.target.value)}
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

          {/* List Cara Bayar */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingCaraBayar ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                Memuat data cara bayar...
              </div>
            ) : caraBayarList.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                Tidak ada cara bayar ditemukan
              </div>
            ) : (
              caraBayarList.map((cb) => (
                <div
                  key={cb.kd_pj}
                  onClick={() => {
                    onSelect(cb.kd_pj, cb.nm_pj);
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
                    {cb.nm_pj}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Kode: {cb.kd_pj}
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

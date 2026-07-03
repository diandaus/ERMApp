import React from 'react';

type Pegawai = {
  nik: string;
  nama: string;
  jbtn: string;
};

interface ModalCariPegawaiProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (nik: string, nama: string, jbtn: string) => void;
}

export const ModalCariPegawai: React.FC<ModalCariPegawaiProps> = ({ isOpen, onClose, onSelect }) => {
  const [pegawaiList, setPegawaiList] = React.useState<Pegawai[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const fetchPegawai = React.useCallback(async () => {
    setLoading(true);
    try {
      const url = search
        ? `/api/pegawai?search=${encodeURIComponent(search)}`
        : '/api/pegawai';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Gagal mengambil data pegawai');
      const data: Pegawai[] = await res.json();
      setPegawaiList(data);
    } catch (e) {
      console.error('Error fetching pegawai:', e);
      setPegawaiList([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    if (isOpen) fetchPegawai();
  }, [isOpen, fetchPegawai]);

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
          <span>Pilih Pegawai</span>
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
              placeholder="Cari pegawai (NIK, nama, atau jabatan)..."
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
                Memuat data pegawai...
              </div>
            ) : pegawaiList.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                Tidak ada pegawai ditemukan
              </div>
            ) : (
              pegawaiList.map((p) => (
                <div
                  key={p.nik}
                  onClick={() => { onSelect(p.nik, p.nama, p.jbtn); onClose(); }}
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
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#6b7280' }}>
                    <span>NIK: {p.nik}</span>
                    {p.jbtn && <span style={{ color: '#7c3aed' }}>{p.jbtn}</span>}
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

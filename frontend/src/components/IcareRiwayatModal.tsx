import React from 'react';

// IcareRiwayatModal — padanan dialog "Riwayat Perawatan ICare FKTL BPJS"
// Khanza Desktop (bridging.ICareRiwayatPerawatan). BEDA dgn
// HistoriPelayananBpjsModal: API I-Care (GET /api/bpjs/icare-riwayat) TIDAK
// mengembalikan daftar riwayat berbentuk JSON, melainkan sebuah URL sesi
// (SSO) ke halaman riwayat pelayanan yg di-hosting BPJS sendiri — di Khanza
// Desktop ditampilkan lewat embedded WebView. Di web, halaman BPJS itu
// kemungkinan menolak di-embed lewat iframe (X-Frame-Options), makanya
// selalu disediakan juga tombol "Buka di tab baru" sbg fallback yg pasti
// jalan.
const btnPrimary: React.CSSProperties = {
  padding: '7px 16px',
  borderRadius: 999,
  border: 'none',
  background: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

type Props = {
  noRkmMedis: string;
  kdDokter: string;
  namaPasien?: string;
  onClose: () => void;
};

export const IcareRiwayatModal: React.FC<Props> = ({ noRkmMedis, kdDokter, namaPasien, onClose }) => {
  const [state, setState] = React.useState<{ loading: boolean; error: string; url: string }>({
    loading: true,
    error: '',
    url: '',
  });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/bpjs/icare-riwayat?no_rkm_medis=${encodeURIComponent(noRkmMedis)}&kd_dokter=${encodeURIComponent(kdDokter)}`
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || 'Gagal mengambil riwayat pelayanan I-Care');
        setState({ loading: false, error: '', url: data.url || '' });
      } catch (err) {
        if (cancelled) return;
        setState({ loading: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan', url: '' });
      }
    })();
    return () => { cancelled = true; };
  }, [noRkmMedis, kdDokter]);

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#ffffff', borderRadius: 16, padding: 20, position: 'relative', maxWidth: 1100, width: '95%', height: '85vh', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
            Riwayat Pelayanan I-Care BPJS{namaPasien ? ` — ${namaPasien}` : ''}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {state.url && (
              <a href={state.url} target="_blank" rel="noopener noreferrer" style={btnPrimary}>
                Buka di tab baru ↗
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 0, lineHeight: 1 }}
            >
              &times;
            </button>
          </div>
        </div>

        {state.loading && <div style={{ fontSize: 12, color: '#6b7280' }}>Memuat riwayat pelayanan I-Care...</div>}
        {state.error && <div style={{ fontSize: 12, color: '#991b1b' }}>{state.error}</div>}
        {!state.loading && !state.error && !state.url && (
          <div style={{ fontSize: 12, color: '#6b7280' }}>Tidak ada riwayat pelayanan untuk pasien ini.</div>
        )}

        {state.url && (
          <div style={{ flex: 1, minHeight: 0, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <iframe
              title="Riwayat Pelayanan I-Care BPJS"
              src={state.url}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

import React from 'react';

// ErrorBoundary — tanpa ini, error React yang tidak tertangkap (mis. exception
// di useEffect) bikin SELURUH aplikasi unmount jadi layar putih kosong tanpa
// pesan apa pun ke user, sulit didiagnosis dari jauh (lihat investigasi layar
// putih presensi.rsislamibnusinasigli.com). Dengan ini, minimal user bisa
// screenshot pesan errornya dan kirim ke IT/pengembang.
type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary menangkap error:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div
        style={{
          minHeight: '100dvh',
          padding: 24,
          boxSizing: 'border-box',
          fontFamily: 'Tahoma, Geneva, sans-serif',
          fontSize: 14,
          color: '#111827',
          background: '#fff',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: '#b91c1c' }}>
          Terjadi kesalahan
        </div>
        <div style={{ marginBottom: 16, color: '#374151' }}>
          Mohon screenshot halaman ini lalu kirim ke IT/pengembang aplikasi.
        </div>
        <div
          style={{
            padding: 12,
            background: '#f3f4f6',
            borderRadius: 6,
            fontFamily: 'monospace',
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: '50vh',
            overflow: 'auto',
          }}
        >
          {error.message}
          {error.stack ? `\n\n${error.stack}` : ''}
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 16,
            padding: '10px 18px',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Muat Ulang
        </button>
      </div>
    );
  }
}
